"""
Router: Usuarios — gestión de usuarios (solo admin)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.db.database import get_db
from app.models.models import User
from app.auth.jwt import require_admin, hash_password

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[UserResponse], summary="Listar todos los usuarios (admin)")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.id).all()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED,
             summary="Crear usuario (admin)")
def create_user(body: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar usuario (admin)")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar el usuario admin principal")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    db.delete(user)
    db.commit()
