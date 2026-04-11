"""
Router: Vista consolidada multientidad
"""

import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User
from app.auth.jwt import get_current_user
from app.config import settings

router = APIRouter()


@router.get("/", summary="Obtener datos consolidados de todos los escaneos")
def get_consolidated(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el JSON consolidado generado por el worker-report
    con métricas agregadas de todas las entidades escaneadas.
    """
    consolidated_path = os.path.join(settings.consolidated_dir, "consolidado_data.json")
    if not os.path.exists(consolidated_path):
        return {"entities": [], "metrics": {}, "message": "Aún no hay datos consolidados disponibles"}

    with open(consolidated_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return data
