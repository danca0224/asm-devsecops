"""
Router: Escaneos — solicitar y consultar análisis de dominio
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Scan, User
from app.auth.jwt import get_current_user
from app.celery_app import celery_app

router = APIRouter()

DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


class ScanRequest(BaseModel):
    domain: str


class ScanResponse(BaseModel):
    id: int
    domain: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    csv_path: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("/", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED,
             summary="Solicitar escaneo de un dominio")
def request_scan(
    body: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = body.domain.strip().lower()
    if not DOMAIN_RE.match(domain):
        raise HTTPException(status_code=400, detail="Formato de dominio inválido")

    scan = Scan(domain=domain, status="pending", user_id=current_user.id)
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Enviar tarea al worker via Celery
    celery_app.send_task("worker_scanner.tasks.run_scan", args=[scan.id, domain])

    return scan


@router.get("/", response_model=list[ScanResponse], summary="Listar escaneos del usuario")
def list_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        scans = db.query(Scan).order_by(Scan.created_at.desc()).all()
    else:
        scans = db.query(Scan).filter(Scan.user_id == current_user.id).order_by(Scan.created_at.desc()).all()
    return scans


@router.get("/{scan_id}", response_model=ScanResponse, summary="Consultar estado de escaneo")
def get_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Escaneo no encontrado")
    if scan.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Sin permiso para ver este escaneo")
    return scan
