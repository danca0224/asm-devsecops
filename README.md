# ASM — Attack Surface Manager

[![CI Pipeline](https://github.com/TU_USUARIO/asm-devsecops/actions/workflows/ci.yml/badge.svg)](https://github.com/TU_USUARIO/asm-devsecops/actions/workflows/ci.yml)
[![Deploy](https://github.com/TU_USUARIO/asm-devsecops/actions/workflows/deploy.yml/badge.svg)](https://github.com/TU_USUARIO/asm-devsecops/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-asm--devsecops-blue?logo=docker)](https://hub.docker.com/u/TU_USUARIO)

**Plataforma de gestión de superficie de ataque externa con arquitectura de microservicios y pipeline DevSecOps de ciclo completo.**

> Evalúa dominios, detecta subdominios expuestos, analiza puertos, certificados TLS, cabeceras HTTP y configuración de correo. Genera informes técnicos automatizados en DOCX y PDF.

---

## Descripción

ASM es una plataforma OSINT/ASM (Attack Surface Management) de código abierto que permite:

- **Descubrimiento de subdominios** activos e inactivos (huérfanos)
- **Análisis de puertos** expuestos con clasificación de riesgo
- **Evaluación de certificados** SSL/TLS y configuraciones criptográficas
- **Revisión de cabeceras HTTP** de seguridad (HSTS, CSP, X-Frame-Options)
- **Auditoría de correo** (SPF, DKIM, DMARC)
- **Detección de tecnologías** expuestas y versiones EOL
- **Generación de informes** técnicos automatizados (DOCX + PDF)
- **Vista consolidada** multientidad para análisis organizacional

---

## Arquitectura

```
┌───────────────────────┐
│   Frontend SPA         │
│   React + Vite :3000  │
└──────────┬────────────┘
           │ HTTP/HTTPS
┌──────────▼────────────┐
│   API Gateway          │
│   FastAPI + JWT :8000 │
└──────────┬────────────┘
           │ AMQP
┌──────────▼────────────┐
│   RabbitMQ Broker      │
└──┬──────────────┬──────┘
   │              │
┌──▼──────┐  ┌───▼──────┐
│ Worker   │  │ Worker   │
│ Scanner  │  │ Report   │
│ (Celery) │  │ (Celery) │
└──┬───────┘  └───┬──────┘
   │              │
┌──▼──────────────▼──────┐
│      PostgreSQL         │
│  (usuarios + escaneos) │
└─────────────────────────┘
```

Componente | Tecnología | Puerto
-----------|-----------|-------
Frontend | React 18 + Vite + Tailwind | 3000
API Gateway | FastAPI + JWT | 8000
Worker Scanner | Python + Celery | —
Worker Report | Python + Celery | —
Base de datos | PostgreSQL 16 | 5432
Message Broker | RabbitMQ 3 | 5672 / 15672

---

## Quick Start

### Requisitos previos

- Docker >= 24.x
- Docker Compose >= 2.x
- Git

### Inicio rápido

```bash
git clone https://github.com/TU_USUARIO/asm-devsecops.git
cd asm-devsecops

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Levantar todos los servicios
docker compose up -d

# Crear usuario admin inicial
docker compose exec api-gateway python -m app.scripts.create_admin

# Acceder a la aplicación
# Frontend:  http://localhost:3000
# API docs:  http://localhost:8000/docs
# RabbitMQ:  http://localhost:15672  (guest/guest)
```

---

## Variables de entorno

Ver [.env.example](.env.example) para la lista completa. Las variables sensibles **nunca** se commiten al repositorio.

---

## Tecnologías

| Capa | Tecnología | Licencia |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | MIT |
| API Gateway | FastAPI 0.111 (Python 3.11+) | MIT |
| Workers | Python 3.11 + Celery 5 | BSD |
| Broker | RabbitMQ 3 | MPL 2.0 |
| Base de datos | PostgreSQL 16 + SQLAlchemy | PostgreSQL |
| Auth | JWT (python-jose) + bcrypt | MIT |
| Contenerización | Docker + Docker Compose | Apache 2.0 |
| Orquestación | K3s / Docker Swarm | Apache 2.0 |
| CI/CD | GitHub Actions | Gratis (FOSS) |
| SAST | Semgrep + Bandit | Apache 2.0 |
| Imagen scan | Trivy | Apache 2.0 |
| DAST | OWASP ZAP | Apache 2.0 |
| Secrets scan | Gitleaks | MIT |
| IaC scan | Checkov | Apache 2.0 |
| IaC | Terraform + Ansible | MPL 2.0 / GPL |

---

## Documentación

- [Manual de Arquitectura](docs/architecture/README.md)
- [Manual de Desarrollo](docs/development-manual.md)
- [Manual de Despliegue](docs/deployment-manual.md)
- [Manual de Seguridad](docs/security-manual.md)
- [Manual de Usuario](docs/user-manual.md)

---

## Licencia

MIT — ver [LICENSE](LICENSE)
