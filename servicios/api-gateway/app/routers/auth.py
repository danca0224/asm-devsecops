"""
Router: Autenticación — login y token JWT
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User
from app.auth.jwt import verify_password, create_access_token, get_current_user

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/token", response_model=Token, summary="Iniciar sesión y obtener JWT")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")

    token = create_access_token({"sub": user.username, "role": user.role})
    return Token(access_token=token, token_type="bearer", username=user.username, role=user.role)


@router.get("/me", response_model=UserInfo, summary="Información del usuario autenticado")
def me(current_user: User = Depends(get_current_user)):
    return current_user
