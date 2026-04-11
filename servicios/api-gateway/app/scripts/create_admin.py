"""
Script de inicialización: crea el usuario admin si no existe.
Ejecutar: docker compose exec api-gateway python -m app.scripts.create_admin
"""

import os
from app.db.database import SessionLocal
from app.models.models import User
from app.auth.jwt import hash_password


def main():
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "Admin123!")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"El usuario '{username}' ya existe.")
            return

        user = User(
            username=username,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Usuario '{username}' creado correctamente con rol admin.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
