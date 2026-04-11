"""
Router: Informes — descargar reportes generados
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.models.models import Report, Scan, User
from app.auth.jwt import get_current_user

router = APIRouter()


class ReportResponse(BaseModel):
    id: int
    scan_id: int
    format: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/{scan_id}", response_model=list[ReportResponse], summary="Listar informes de un escaneo")
def list_reports(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Escaneo no encontrado")
    if scan.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Sin permiso")

    return db.query(Report).filter(Report.scan_id == scan_id).all()


@router.get("/{scan_id}/download/{report_id}", summary="Descargar informe")
def download_report(
    scan_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id, Report.scan_id == scan_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Informe no encontrado")

    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if scan.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Sin permiso")

    if not os.path.exists(report.path):
        raise HTTPException(status_code=404, detail="Archivo no disponible en el servidor")

    return FileResponse(
        path=report.path,
        filename=os.path.basename(report.path),
        media_type="application/octet-stream",
    )
