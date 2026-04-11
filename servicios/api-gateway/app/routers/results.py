"""
Router: Resultados — devuelve análisis completo de un escaneo (CSV → JSON)
"""

import os
import re
import math
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Scan, User
from app.auth.jwt import get_current_user

router = APIRouter()

# ── Constantes de análisis (idénticas al monolito) ──────────────
PUERTOS_RIESGO = {
    7: ("Echo", "Crítico"), 9: ("Discard", "Crítico"), 21: ("FTP", "Alto"),
    22: ("SSH", "Alto"), 23: ("Telnet", "Crítico"), 25: ("SMTP", "Alto"),
    80: ("HTTP", "Bajo"), 443: ("HTTPS", "Bajo"), 445: ("SMB", "Crítico"),
    1433: ("MSSQL", "Crítico"), 3306: ("MySQL", "Alto"), 3389: ("RDP", "Crítico"),
    5432: ("PostgreSQL", "Alto"), 5900: ("VNC", "Crítico"), 6379: ("Redis", "Alto"),
    8080: ("HTTP Proxy", "Alto"), 8443: ("HTTPS Alt", "Bajo"), 10000: ("Webmin", "Crítico"),
    27017: ("MongoDB", "Alto"),
}

SEVERITY_WEIGHT = {"Crítica": 4, "Alta": 3, "Media": 2, "Baja": 1, "Informativa": 0}

CIFRADOS_DEBILES_RE = re.compile(r"(?:RC4|CBC|DES|NULL|EXPORT|MD5)", re.IGNORECASE)
TLS_OBSOLETO_RE    = re.compile(r"tls1\.0|tls1_0|tls1\.1|tls1_1|sslv", re.IGNORECASE)

WORD_VULN_ORDER = [
    "Subdominios huérfanos",
    "Carencia de registros SPF, DKIM y DMARC",
    "Software expuesto",
    "Exposición de puertos de administración",
    "Ausencia de encabezados de seguridad HTTP esenciales",
    "Certificado SSL inexistente o inválido",
    "Protocolos TLS obsoletos habilitados",
    "Cifrados débiles",
]

WORD_VULN_SEVERITY = {
    "Subdominios huérfanos": "Media",
    "Carencia de registros SPF, DKIM y DMARC": "Alta",
    "Software expuesto": "Alta",
    "Exposición de puertos de administración": "Alta",
    "Ausencia de encabezados de seguridad HTTP esenciales": "Media",
    "Certificado SSL inexistente o inválido": "Alta",
    "Protocolos TLS obsoletos habilitados": "Media",
    "Cifrados débiles": "Media",
}

SEVERITY_COLOR = {
    "Crítica": "#8B0000",
    "Alta":    "#D62828",
    "Media":   "#F77F00",
    "Baja":    "#FCBF49",
    "Informativa": "#277DA1",
}


def _safe(val):
    if val is None:
        return ""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return ""
    return str(val)


def _evaluar_fila(row: dict) -> dict:
    puertos_str = _safe(row.get("Puertos abiertos"))
    puertos = [p.strip() for p in puertos_str.split(",") if p.strip().isdigit()]
    estado  = _safe(row.get("Estado")).lower()
    correo  = _safe(row.get("Correo")).lower()
    cert    = _safe(row.get("Estado Certificado")).lower()
    tls     = _safe(row.get("Versiones TLS soportadas")).lower()
    cifrado = _safe(row.get("Riesgos de cifrado"))
    servidor= _safe(row.get("version servidor")).lower()

    return {
        "flag_subdominios_huerfanos":       estado in ("huérfano", "huerfano", "sin datos", ""),
        "flag_carencia_spf_dkim_dmarc":     "ausente" in correo or "sin dmarc" in correo or "sin spf" in correo,
        "flag_software_expuesto":           servidor not in ("", "no identificado", "no expuesto", "nan"),
        "flag_exposicion_puertos_admin":    any(p in ["22","23","3389","5900","5432","3306","8080","10000","1433","445","6379","27017"] for p in puertos),
        "flag_headers_esenciales":          "ausente" in cert,
        "flag_cert_ssl_invalido":           cert in ("vencido", "inválido", "invalido", "sin ssl", "no obtenido"),
        "flag_tls_obsoleto":                bool(TLS_OBSOLETO_RE.search(tls)),
        "flag_cifrados_debiles":            bool(CIFRADOS_DEBILES_RE.search(cifrado)),
    }


def _calcular_criticidad(filas_flags: list) -> tuple:
    score = 0
    for flags in filas_flags:
        for v in flags.values():
            if v:
                score += 2
    if score >= 24: return "Crítica", score
    if score >= 14: return "Alta",    score
    if score >= 6:  return "Media",   score
    if score >= 1:  return "Baja",    score
    return "Informativa", score


def _resumen_puertos(rows: list) -> list:
    conteo: dict[str, int] = {}
    for row in rows:
        for p in _safe(row.get("Puertos abiertos")).split(","):
            p = p.strip()
            if p.isdigit():
                conteo[p] = conteo.get(p, 0) + 1
    resultado = []
    for puerto_str, cnt in sorted(conteo.items(), key=lambda x: -x[1]):
        p = int(puerto_str)
        nombre, riesgo = PUERTOS_RIESGO.get(p, ("Desconocido", "Medio"))
        resultado.append({"puerto": p, "nombre": nombre, "riesgo": riesgo, "cantidad": cnt})
    return resultado[:20]


def _resumen_tecnologias(rows: list) -> list:
    conteo: dict[str, int] = {}
    for row in rows:
        tech = _safe(row.get("version servidor")).strip()
        if tech and tech.lower() not in ("", "no identificado", "no expuesto", "nan", "no"):
            conteo[tech] = conteo.get(tech, 0) + 1
    return [{"tecnologia": k, "cantidad": v} for k, v in sorted(conteo.items(), key=lambda x: -x[1])[:15]]


@router.get("/{scan_id}/results", summary="Resultados completos analizados de un escaneo")
def get_scan_results(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lee el CSV del escaneo, evalúa todos los flags de vulnerabilidad
    y retorna un JSON completo con hallazgos, scoring, gráficas y detalle de activos.
    Equivale a toda la lógica de análisis del monolito Streamlit.
    """
    import pandas as pd

    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Escaneo no encontrado")
    if scan.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Sin permiso")
    if scan.status != "completed" or not scan.csv_path:
        raise HTTPException(status_code=400, detail="El escaneo aún no tiene resultados disponibles")
    if not os.path.exists(scan.csv_path):
        raise HTTPException(status_code=404, detail="Archivo CSV no encontrado en el servidor")

    # ── Leer CSV ───────────────────────────────────────────
    try:
        df = pd.read_csv(scan.csv_path).fillna("")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo CSV: {e}")

    rows = df.to_dict(orient="records")

    # ── Evaluar flags por fila ─────────────────────────────
    flags_por_fila = [_evaluar_fila(r) for r in rows]

    # ── Criticidad global ──────────────────────────────────
    nivel, score = _calcular_criticidad(flags_por_fila)

    # ── Hallazgos por categoría ────────────────────────────
    flag_map = {
        "flag_subdominios_huerfanos":       "Subdominios huérfanos",
        "flag_carencia_spf_dkim_dmarc":     "Carencia de registros SPF, DKIM y DMARC",
        "flag_software_expuesto":            "Software expuesto",
        "flag_exposicion_puertos_admin":     "Exposición de puertos de administración",
        "flag_headers_esenciales":           "Ausencia de encabezados de seguridad HTTP esenciales",
        "flag_cert_ssl_invalido":            "Certificado SSL inexistente o inválido",
        "flag_tls_obsoleto":                 "Protocolos TLS obsoletos habilitados",
        "flag_cifrados_debiles":             "Cifrados débiles",
    }

    hallazgos = []
    for flag_key, categoria in flag_map.items():
        cantidad = sum(1 for f in flags_por_fila if f.get(flag_key))
        if cantidad > 0:
            hallazgos.append({
                "categoria":  categoria,
                "cantidad":   cantidad,
                "severidad":  WORD_VULN_SEVERITY.get(categoria, "Media"),
                "color":      SEVERITY_COLOR.get(WORD_VULN_SEVERITY.get(categoria, "Media"), "#277DA1"),
            })

    # Ordenar por orden canónico del monolito
    hallazgos.sort(key=lambda h: WORD_VULN_ORDER.index(h["categoria"]) if h["categoria"] in WORD_VULN_ORDER else 99)

    # ── Métricas generales ─────────────────────────────────
    total = len(rows)
    activos = sum(1 for r in rows if _safe(r.get("Estado")).lower() == "activo")
    huerfanos = sum(1 for f in flags_por_fila if f.get("flag_subdominios_huerfanos"))

    metricas = {
        "total_activos":     total,
        "activos_expuestos": activos,
        "huerfanos":         huerfanos,
        "con_puertos":       sum(1 for r in rows if _safe(r.get("Puertos abiertos")).strip()),
        "cert_invalidos":    sum(1 for f in flags_por_fila if f.get("flag_cert_ssl_invalido")),
        "correo_inseguro":   sum(1 for f in flags_por_fila if f.get("flag_carencia_spf_dkim_dmarc")),
    }

    # ── Detalle de activos ─────────────────────────────────
    activos_detalle = []
    for row, flags in zip(rows, flags_por_fila):
        activos_detalle.append({
            "subdominio":       _safe(row.get("Subdominio")),
            "ip":               _safe(row.get("A")),
            "estado":           _safe(row.get("Estado")),
            "puertos":          _safe(row.get("Puertos abiertos")),
            "exposicion":       _safe(row.get("Exposicion de puertos")),
            "cert":             _safe(row.get("Estado Certificado")),
            "correo":           _safe(row.get("Correo")),
            "tls":              _safe(row.get("Versiones TLS soportadas")),
            "cifrados":         _safe(row.get("Riesgos de cifrado")),
            "servidor":         _safe(row.get("version servidor")),
            "flags":            flags,
            "tiene_hallazgos":  any(flags.values()),
        })

    return {
        "scan_id":      scan_id,
        "domain":       scan.domain,
        "nivel":        nivel,
        "score":        score,
        "metricas":     metricas,
        "hallazgos":    hallazgos,
        "top_puertos":  _resumen_puertos(rows),
        "top_tecnologias": _resumen_tecnologias(rows),
        "activos":      activos_detalle,
    }
