"""
Worker Scanner — Tarea Celery para ejecutar análisis de superficie de ataque.

Recibe un scan_id y dominio, ejecuta el script bash de análisis,
procesa el CSV resultante y actualiza el estado en PostgreSQL.
Al completar notifica al worker-report para generar el informe.
"""

import os
import subprocess
import csv
import json
import logging
from datetime import datetime, timezone
from celery import Celery
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "amqp://asm:password@rabbitmq:5672//")
REPORTS_DIR = os.getenv("REPORTS_DIR", "/data/reportes")
SCRIPT_NAME = os.getenv("SCAN_SCRIPT", "/app/validar_subdominioModtimeout.sh")

DATABASE_URL = (
    f"postgresql://{os.getenv('POSTGRES_USER', 'asm_user')}:"
    f"{os.getenv('POSTGRES_PASSWORD')}@"
    f"{os.getenv('POSTGRES_HOST', 'db')}:"
    f"{os.getenv('POSTGRES_PORT', '5432')}/"
    f"{os.getenv('POSTGRES_DB', 'asm_db')}"
)

app = Celery("worker_scanner", broker=CELERY_BROKER_URL)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def update_scan_status(scan_id: int, status: str, csv_path: str = None, error: str = None):
    with engine.connect() as conn:
        conn.execute(
            text("""
                UPDATE scans
                SET status = :status,
                    csv_path = :csv_path,
                    error_message = :error,
                    completed_at = CASE WHEN :status IN ('completed','failed') THEN NOW() ELSE completed_at END
                WHERE id = :scan_id
            """),
            {"status": status, "csv_path": csv_path, "error": error, "scan_id": scan_id},
        )
        conn.commit()


@app.task(name="worker_scanner.tasks.run_scan", bind=True, max_retries=0)
def run_scan(self, scan_id: int, domain: str):
    """
    Ejecuta el análisis de superficie de ataque para un dominio.

    Flujo:
    1. Actualiza estado a 'running'
    2. Ejecuta script bash de análisis
    3. Guarda CSV resultante en REPORTS_DIR
    4. Actualiza estado a 'completed' con ruta del CSV
    5. Publica tarea al worker-report para generación de informe
    """
    logger.info(f"[scan:{scan_id}] Iniciando análisis de dominio: {domain}")
    update_scan_status(scan_id, "running")

    os.makedirs(REPORTS_DIR, exist_ok=True)
    csv_filename = f"reporte_validado_{domain}_{scan_id}.csv"
    csv_path = os.path.join(REPORTS_DIR, csv_filename)

    # Verificar que el script existe
    if not os.path.exists(SCRIPT_NAME):
        msg = f"Script de análisis no encontrado: {SCRIPT_NAME}"
        logger.error(msg)
        update_scan_status(scan_id, "failed", error=msg)
        return

    try:
        logger.info(f"[scan:{scan_id}] Ejecutando script bash para {domain}")
        result = subprocess.run(
            ["bash", SCRIPT_NAME, domain],
            capture_output=True,
            text=True,
            timeout=900,   # 15 minutos máximo
            cwd="/app",
        )

        # El script genera reporte_validado_{domain}.csv en el directorio de trabajo
        raw_csv = f"/app/reporte_validado_{domain}.csv"
        if os.path.exists(raw_csv):
            import shutil
            shutil.move(raw_csv, csv_path)
            logger.info(f"[scan:{scan_id}] CSV generado: {csv_path}")
        else:
            # Si el script no genera CSV, crear uno mínimo con error
            logger.warning(f"[scan:{scan_id}] Script completó sin CSV. stdout: {result.stdout[-500:]}")
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Subdominio", "A", "Estado", "Puertos abiertos",
                                  "Estado Certificado", "Correo",
                                  "Versiones TLS soportadas", "Riesgos de cifrado",
                                  "version servidor", "Exposicion de puertos"])
                writer.writerow([domain, "", "Sin datos", "", "", "", "", "", "", ""])

        update_scan_status(scan_id, "completed", csv_path=csv_path)

        # Notificar al worker-report
        app.send_task(
            "worker_report.tasks.generate_report",
            args=[scan_id, domain, csv_path],
            queue="report",
        )
        logger.info(f"[scan:{scan_id}] Tarea de generación de informe enviada")

    except subprocess.TimeoutExpired:
        msg = "Tiempo de escaneo agotado (15 min)"
        logger.error(f"[scan:{scan_id}] {msg}")
        update_scan_status(scan_id, "failed", error=msg)

    except Exception as e:
        logger.error(f"[scan:{scan_id}] Error inesperado: {e}")
        update_scan_status(scan_id, "failed", error=str(e))
