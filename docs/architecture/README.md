# Manual de Arquitectura — ASM Attack Surface Manager

## 1. Descripción General

ASM es una plataforma de **gestión de superficie de ataque externa** (EASM) implementada con arquitectura de microservicios. Permite a equipos de seguridad descubrir y analizar la exposición pública de dominios e infraestructura de manera automatizada.

### 1.1 Decisiones de Diseño

| Decisión | Alternativas consideradas | Razón de elección |
|---|---|---|
| FastAPI como API Gateway | Flask, Django REST | Async nativo, OpenAPI automático, tipado con Pydantic |
| Celery + RabbitMQ | Redis Queue, Python asyncio | Persistencia de tareas, reintentos, monitoreo nativo |
| PostgreSQL | SQLite, MongoDB | ACID, soporte de roles (RLS), amplia compatibilidad |
| React + Vite | Vue.js, Angular | Ecosistema maduro, velocidad de build con Vite |
| JWT stateless | Sessions, OAuth2 externo | Simplicidad, compatible con microservicios, no requiere estado |

---

## 2. Diagrama de Componentes

Ver archivo: [component-diagram.puml](component-diagram.puml)

```
┌─────────────────────────────────────────────────────────────┐
│                     ASM Platform                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │   Frontend    │    │         API Gateway              │  │
│  │  React SPA   │───▶│  FastAPI + JWT Auth             │  │
│  │  Nginx :3000 │    │  /api/auth /api/scans /api/...  │  │
│  └──────────────┘    └──────────────┬───────────────────┘  │
│                                     │                       │
│                                     ▼ AMQP                  │
│                           ┌─────────────────┐               │
│                           │    RabbitMQ      │               │
│                           │  Broker AMQP    │               │
│                           └───┬─────────┬───┘               │
│                               │         │                   │
│                    scanner Q  │         │ report Q          │
│                               ▼         ▼                   │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │   Worker Scanner    │  │      Worker Report           │  │
│  │  Celery Worker      │  │  Celery Worker               │  │
│  │  bash scan script   │  │  ReportLab PDF gen           │  │
│  └──────────┬──────────┘  └───────────┬──────────────────┘  │
│             │                         │                     │
│             └──────────┬──────────────┘                     │
│                        ▼                                    │
│              ┌──────────────────┐                           │
│              │    PostgreSQL    │                           │
│              │  app_users       │                           │
│              │  scans           │                           │
│              │  reports         │                           │
│              └──────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Diagrama de Despliegue

Ver archivo: [deployment-diagram.puml](deployment-diagram.puml)

```
┌─────────────────────────────────────────────────────────────┐
│                   Servidor de Producción                    │
│                   (EC2 t3.small / Ubuntu 22.04)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Docker Compose Network (asm_net)        │   │
│  │                                                     │   │
│  │  frontend:80 ──── nginx:80 ──── :3000 (host)       │   │
│  │  api-gateway:8000 ──────────── :8000 (host)        │   │
│  │  rabbitmq:5672, 15672                              │   │
│  │  db (PostgreSQL):5432 (interno solo)               │   │
│  │                                                     │   │
│  │  Volúmenes:                                        │   │
│  │    db_data      → /var/lib/postgresql/data         │   │
│  │    reports_data → /data (compartido workers)       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Diagrama de Secuencia — Autenticación

Ver archivo: [sequence-auth.puml](sequence-auth.puml)

---

## 5. Diagrama de Casos de Uso

Ver archivo: [use-cases.puml](use-cases.puml)

---

## 6. Modelo de Amenazas STRIDE

Ver archivo: [threat-model.md](../security-manual.md#modelado-de-amenazas)

| Categoría | Amenaza | Contramedida |
|---|---|---|
| **Spoofing** | Suplantación de usuario | JWT con expiración corta (60min), bcrypt |
| **Tampering** | Modificación de resultados en tránsito | HTTPS TLS 1.2+, validación de integridad |
| **Repudiation** | Negación de acciones | Audit log en PostgreSQL con timestamp |
| **Information Disclosure** | Filtración de secretos | .env excluido de git, Gitleaks en CI |
| **Denial of Service** | Abuso del endpoint de escaneo | Rate limiting implícito en Celery queue |
| **Elevation of Privilege** | Acceso de user a funciones admin | Role check en cada endpoint |
