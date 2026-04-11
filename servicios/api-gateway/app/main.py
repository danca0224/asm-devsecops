"""
ASM — Attack Surface Manager
API Gateway principal (FastAPI)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, scans, reports, users, consolidated, results
from app.db.database import engine, Base

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ASM — Attack Surface Manager API",
    description="API Gateway para gestión de superficie de ataque externa",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:80"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(scans.router, prefix="/api/scans", tags=["Escaneos"])
app.include_router(reports.router, prefix="/api/reports", tags=["Informes"])
app.include_router(users.router, prefix="/api/users", tags=["Usuarios"])
app.include_router(consolidated.router, prefix="/api/consolidated", tags=["Consolidado"])
app.include_router(results.router, prefix="/api/scans", tags=["Resultados"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "api-gateway"}
