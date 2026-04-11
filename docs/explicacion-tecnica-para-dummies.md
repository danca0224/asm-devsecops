# Explicación Técnica del Proyecto ASM — Para Dummies

> Este documento explica, en lenguaje sencillo, **qué se construyó, por qué se tomó cada decisión y cómo funciona todo junto**. Está escrito para alguien que sabe algo de programación pero no necesariamente ha trabajado con microservicios o DevSecOps antes.

---

## ¿De dónde partimos?

Teníamos una aplicación funcionando llamada **Analizador de Superficie de Ataque**. Era un archivo Python enorme (`app.py`) que hacía TODO en un solo lugar:

- Mostraba la interfaz gráfica (con Streamlit)
- Manejaba los usuarios y contraseñas
- Ejecutaba el análisis de dominios
- Generaba los informes PDF y DOCX
- Guardaba los datos en PostgreSQL

Esto se llama **arquitectura monolítica** — todo en un solo bloque. Funciona bien al principio, pero tiene problemas:

| Problema | Por qué duele |
|---|---|
| Si el análisis falla, cae toda la app | Un bug en una parte rompe todo |
| No puedes escalar solo la parte lenta | Si el análisis tarda, no puedes poner más "analizadores" sin duplicar todo |
| Difícil de probar con seguridad | No puedes saber si un cambio rompió algo sin revisar todo el código |
| No tiene pipeline de seguridad | Nadie valida si el código tiene contraseñas hardcodeadas o vulnerabilidades |

---

## ¿A dónde llegamos?

Convertimos esa aplicación en **microservicios** con un **pipeline DevSecOps completo**. Ahora el sistema tiene piezas separadas que se comunican entre sí:

```
[Navegador] ──▶ [Frontend React] ──▶ [API Gateway FastAPI]
                                              │
                                       [RabbitMQ] (mensajería)
                                         │         │
                                  [Worker         [Worker
                                  Scanner]         Report]
                                         │         │
                                      [PostgreSQL + Archivos]
```

Cada pieza hace UNA sola cosa y la hace bien. Si el Worker Scanner se cae, el resto sigue funcionando.

---

## Las piezas del sistema explicadas

### 1. Frontend (React + Vite + Tailwind)

**¿Qué es?** La pantalla que ve el usuario en el navegador.

**¿Por qué React?** Porque permite construir interfaces dinámicas donde la página se actualiza sin recargar (como Gmail o Twitter). El monolito usaba Streamlit que era más limitado visualmente.

**¿Qué hace?**
- Muestra el formulario de login
- Permite ingresar un dominio para analizar
- Muestra los resultados con gráficas interactivas (barras, torta)
- Tiene tabs: Resumen / Puertos / Tecnologías / Activos / Informes

**Dato técnico:** Está construido con **Vite** (empaquetador muy rápido) y **Tailwind CSS** (sistema de estilos por clases). En producción lo sirve **Nginx** (servidor web ultraliviano).

---

### 2. API Gateway (FastAPI + Python)

**¿Qué es?** El cerebro central. Es el único punto de contacto entre el frontend y el resto del sistema.

**¿Por qué FastAPI?** Porque:
- Es Python (mismo lenguaje del monolito original)
- Es muy rápido (comparable a Node.js)
- Genera documentación automática en `/docs` (Swagger)
- Tiene tipado con Pydantic que evita bugs

**¿Qué hace?**
- Valida quién eres (autenticación con JWT)
- Recibe solicitudes de escaneo y las encola
- Devuelve el estado de los escaneos
- Sirve los informes para descargar
- Analiza el CSV y devuelve los datos para las gráficas

**Dato técnico — JWT:** En el monolito la sesión vivía en la memoria de Streamlit. Ahora usamos **JSON Web Tokens**: cuando haces login, el servidor te da un "ticket firmado" que demuestras en cada solicitud. No hay sesión guardada en el servidor — el ticket se valida matemáticamente.

```
Login ──▶ servidor verifica bcrypt ──▶ genera JWT firmado ──▶ te lo envía
Próxima solicitud: envías el JWT ──▶ servidor verifica firma ──▶ sabe quién eres
```

---

### 3. RabbitMQ (Broker de mensajes)

**¿Qué es?** Un "cartero" entre servicios. Cuando el API Gateway dice "analiza este dominio", no lo hace él mismo — mete un mensaje en una cola y el Worker Scanner lo recoge.

**¿Por qué no llamar directamente al Worker?** Porque el análisis puede tardar 10-15 minutos. Si el API Gateway esperara eso, el navegador del usuario daría timeout y todo parecería roto. Con RabbitMQ:

```
Usuario: "analiza ejemplo.com"
API Gateway: "OK, lo encolo" (responde en milisegundos)
[...10 minutos después...]
Worker Scanner: termina el análisis, actualiza la base de datos
Frontend: hace polling cada 8 segundos y ve "Completado"
```

---

### 4. Worker Scanner (Python + Celery)

**¿Qué es?** El "obrero" que hace el análisis real. Corre en segundo plano, sin interfaz.

**¿Cómo funciona?**
1. Espera mensajes en la cola `scanner` de RabbitMQ
2. Cuando llega uno, ejecuta el script bash `validar_subdominioModtimeout.sh`
3. El script hace el análisis OSINT real (nmap, openssl, dig, curl)
4. Guarda el CSV resultante en un volumen compartido
5. Actualiza el estado del escaneo a "completado" en PostgreSQL
6. Manda un nuevo mensaje al Worker Report

**Dato técnico — Celery:** Es una librería Python que convierte funciones normales en tareas que se ejecutan en segundo plano. Así:

```python
# Esto NO bloquea al que llama:
@app.task
def run_scan(scan_id, domain):
    # ...corre el análisis...
```

---

### 5. Worker Report (Python + Celery + ReportLab + python-docx)

**¿Qué es?** El "escritor automático". Genera los informes después de cada análisis.

**¿Qué hace?**
1. Recibe el mensaje "escaneo completado"
2. Lee el CSV generado
3. Evalúa los 8 tipos de vulnerabilidades (flags) por cada activo
4. Calcula la criticidad global (Crítica/Alta/Media/Baja/Informativa)
5. Genera un PDF con ReportLab (mismo que usaba el monolito)
6. Genera un DOCX con python-docx
7. Registra los informes en PostgreSQL
8. Actualiza el JSON consolidado multientidad

---

### 6. PostgreSQL (Base de datos)

**¿Qué guarda?** Tres tablas principales:

| Tabla | ¿Qué contiene? |
|---|---|
| `app_users` | Usuarios, contraseñas hasheadas con bcrypt, roles |
| `scans` | Todos los escaneos: dominio, estado, quién lo pidió, ruta del CSV |
| `reports` | Rutas de los PDF y DOCX generados, asociados a cada escaneo |

**Dato técnico — bcrypt:** Las contraseñas nunca se guardan en texto plano. bcrypt las convierte en un hash irreversible. Aunque alguien robe la base de datos, no puede saber la contraseña original.

---

## La lógica de análisis (el corazón del sistema)

Esta es la parte más importante — la lógica que evalúa vulnerabilidades. Se portó exactamente del monolito original:

### Los 8 flags de vulnerabilidad

Por cada subdominio analizado, el sistema evalúa:

| Flag | ¿Qué detecta? | Severidad |
|---|---|---|
| `flag_subdominios_huerfanos` | Subdominios sin IP activa (huérfanos) | Media |
| `flag_carencia_spf_dkim_dmarc` | Correo sin SPF, DKIM o DMARC | Alta |
| `flag_software_expuesto` | Servidor revela su versión (ej: Apache/2.4.1) | Alta |
| `flag_exposicion_puertos_admin` | Puertos peligrosos abiertos (22, 3389, 5432...) | Alta |
| `flag_headers_esenciales` | Faltan cabeceras HTTP de seguridad (HSTS, CSP) | Media |
| `flag_cert_ssl_invalido` | Certificado SSL vencido, inválido o ausente | Alta |
| `flag_tls_obsoleto` | Usa TLS 1.0 o 1.1 (desactualizados) | Media |
| `flag_cifrados_debiles` | Usa RC4, DES, CBC (cifrados rotos) | Media |

### Cálculo de criticidad global

El sistema suma puntos por cada hallazgo y clasifica:

```
Score ≥ 24 → CRÍTICA
Score ≥ 14 → ALTA
Score ≥ 6  → MEDIA
Score ≥ 1  → BAJA
Score = 0  → INFORMATIVA
```

---

## El pipeline DevSecOps — la joya del proyecto

Este es el **40% de la nota** según el rubric del trabajo. Es un proceso automatizado que cada vez que subes código a GitHub, hace esto automáticamente:

```
Push de código
     │
     ▼
[1. Gitleaks] ── ¿Hay contraseñas o tokens en el código?
     │ No
     ▼
[2. Bandit + Semgrep] ── ¿Hay código Python inseguro? (SAST)
     │ No
     ▼
[3. Trivy SCA] ── ¿Las librerías tienen vulnerabilidades conocidas?
     │ No
     ▼
[4. Docker Build] ── Construye las 4 imágenes Docker
     │
     ▼
[5. Trivy imagen] ── ¿Las imágenes tienen CVEs críticos?
     │ No (si hay CVE crítico → FALLA EL BUILD)
     ▼
[6. Pytest + Jest] ── ¿Pasan todas las pruebas?
     │ Sí
     ▼
[7. OWASP ZAP] ── ¿La API tiene vulnerabilidades web? (DAST)
     │
     ▼
[8. Checkov] ── ¿La infraestructura Terraform/K8s es segura?
     │
     ▼
[9. Si es tag v1.x.x → Push a Docker Hub + Deploy en producción]
```

### ¿Qué hace cada herramienta?

**Gitleaks** — Detecta secretos expuestos
```
MALO:  password = "Admin123!"  ← Gitleaks lo bloquea
BUENO: password = os.getenv("POSTGRES_PASSWORD")  ← OK
```

**Bandit** — Analiza código Python buscando patrones inseguros
```python
# Bandit detecta esto como peligroso:
os.system("ping " + user_input)  # ← Posible command injection
```

**Trivy** — Escanea dependencias e imágenes Docker en busca de CVEs
```
CRITICO: cryptography==36.0.0 → CVE-2023-0286 (buffer overflow)
ACCIÓN:  El build falla automáticamente
```

**OWASP ZAP** — Ataca la aplicación en staging para encontrar vulnerabilidades web
- Prueba inyección SQL, XSS, cabeceras inseguras, etc.
- Lo hace de forma automática sin intervención humana

**Checkov** — Verifica que la infraestructura (Terraform, Kubernetes) siga buenas prácticas
```
ALERTA: Container running as root ← Cambiado a runAsUser: 1000
ALERTA: No resource limits defined ← Añadidos limits de CPU/memoria
```

---

## Contenerización — Docker

Cada servicio tiene su propio `Dockerfile` con dos etapas:

```dockerfile
# Etapa 1: Construcción (tiene herramientas de build)
FROM python:3.11-slim AS builder
RUN pip install -r requirements.txt

# Etapa 2: Runtime (solo lo necesario para correr)
FROM python:3.11-slim
COPY --from=builder /root/.local /home/appuser/.local
USER appuser  # ← NUNCA corre como root
```

**¿Por qué dos etapas?** Para que la imagen final sea más pequeña y segura. La imagen de construcción puede tener compiladores y herramientas; la de runtime solo tiene lo mínimo.

**¿Por qué usuario no-root?** Si alguien explota una vulnerabilidad en la app, el proceso comprometido no tiene permisos de administrador del sistema.

---

## Infraestructura como Código (IaC)

En lugar de configurar el servidor manualmente (click aquí, instalar esto, configurar aquello), el servidor se configura con código que vive en el repositorio.

### Terraform
```hcl
# Esto CREA un servidor en AWS con un comando:
resource "aws_instance" "asm_server" {
  ami           = "ami-ubuntu-22.04"
  instance_type = "t3.small"
  # ...
}
```
```bash
terraform apply  # ← Crea el servidor en AWS automáticamente
```

### Ansible
```yaml
# Esto CONFIGURA el servidor (instala Docker, despliega la app):
- name: Levantar servicios
  command: docker compose up -d
```
```bash
ansible-playbook -i inventory.ini site.yml  # ← Despliega la app
```

**¿Por qué esto importa?** Si el servidor se daña o hay que crear uno nuevo, en lugar de horas de configuración manual son minutos ejecutando un comando.

---

## Orquestación con Kubernetes

Los manifiestos YAML en `orquestacion/k8s/` describen cómo desplegar la app en Kubernetes (K3s):

```yaml
# Esto dice: "quiero 2 copias del API Gateway corriendo siempre"
spec:
  replicas: 2
  # Si una falla, Kubernetes reinicia automáticamente
```

Con Docker Compose se puede correr en un solo servidor. Con Kubernetes se puede escalar a decenas de servidores.

---

## Documentación incluida

| Documento | ¿Qué contiene? |
|---|---|
| `docs/architecture/README.md` | Arquitectura, decisiones de diseño, modelo de amenazas STRIDE |
| `docs/architecture/*.puml` | 5 diagramas UML (componentes, despliegue, 2 secuencias, casos de uso) |
| `docs/architecture/threat-model.json` | Modelo OWASP Threat Dragon con 7 amenazas identificadas |
| `docs/development-manual.md` | Cómo clonar, configurar y correr el proyecto en local |
| `docs/deployment-manual.md` | Cómo desplegar en producción con Terraform + Ansible |
| `docs/security-manual.md` | Herramientas de seguridad, cómo interpretar reportes, política de divulgación |
| `docs/user-manual.md` | Manual de uso para el usuario final |

---

## Resumen: Monolito vs Microservicios

| Aspecto | Monolito (antes) | Microservicios (ahora) |
|---|---|---|
| **Interfaz** | Streamlit (Python) | React 18 + Vite |
| **Autenticación** | Sesión en memoria | JWT stateless |
| **Análisis** | Síncrono (bloquea UI) | Asíncrono (Celery + RabbitMQ) |
| **Reportes** | Generación directa | Worker independiente |
| **Seguridad del código** | Manual / ninguna | Gitleaks + Bandit + Semgrep automáticos |
| **Vulnerabilidades en deps** | No verificadas | Trivy en cada PR |
| **Pruebas web automáticas** | Ninguna | OWASP ZAP en CI |
| **Despliegue** | Manual | Automatizado con Ansible |
| **Infraestructura** | Manual | Terraform (código) |
| **Escalabilidad** | Todo o nada | Escalar solo lo que necesitas |
| **Imágenes Docker** | Ninguna | 4 imágenes publicadas en Docker Hub |
| **Pipeline CI/CD** | Ninguno | 8 etapas de seguridad automatizadas |

---

## Pasos de construcción (cronología)

### Paso 1 — Análisis del monolito
Se leyó el `app.py` original (más de 3.400 líneas) para entender:
- Qué funcionalidades existían
- Qué lógica debía portarse exactamente (los 8 flags, el scoring de criticidad)
- Qué dependencias externas usaba (PostgreSQL, bash script, ReportLab)

### Paso 2 — Diseño de la arquitectura
Se diseñaron 4 microservicios con responsabilidades claras:
- API Gateway: expone la API REST, maneja auth
- Worker Scanner: hace el análisis de dominios
- Worker Report: genera los informes
- Frontend: interfaz de usuario

Se eligió RabbitMQ como broker para desacoplar el análisis (tarea lenta) de la respuesta al usuario (debe ser rápida).

### Paso 3 — Base de datos y modelos
Se diseñaron 3 tablas (`app_users`, `scans`, `reports`) que cubren todos los casos de uso. Se migró de bcrypt directo en Streamlit a bcrypt con SQLAlchemy ORM en FastAPI.

### Paso 4 — API Gateway (FastAPI)
Se implementaron 6 routers:
- `/auth` — login y JWT
- `/scans` — solicitar y listar escaneos
- `/scans/{id}/results` — análisis completo del CSV
- `/reports` — listar y descargar informes
- `/users` — gestión de usuarios (admin)
- `/consolidated` — datos multientidad

### Paso 5 — Workers
Se implementaron las tareas Celery:
- `run_scan`: ejecuta bash script → guarda CSV → notifica worker-report
- `generate_report`: lee CSV → evalúa flags → genera PDF + DOCX → actualiza consolidado

### Paso 6 — Frontend React
Se construyó la SPA con:
- Login con manejo de JWT en localStorage
- Dashboard con lista de escaneos y auto-refresh
- ScanDetail con 5 tabs, 6 métricas, 4 gráficas (barras, torta), tabla filtrable de activos
- Vista consolidada multientidad con gráfica global
- Panel admin de usuarios

### Paso 7 — Pipeline DevSecOps
Se configuraron dos workflows de GitHub Actions:
- `ci.yml`: 8 jobs de seguridad en cada push (Gitleaks, Bandit, Semgrep, Trivy x2, Pytest, Jest, ZAP, Checkov)
- `deploy.yml`: build y push a Docker Hub + deploy en producción al crear un tag `v1.x.x`

### Paso 8 — IaC y Orquestación
- Terraform: crea la VM en AWS (EC2 t3.small, Ubuntu 22.04, cifrado de disco)
- Ansible: configura Docker, despliega docker-compose, crea usuario admin
- K3s: manifiestos YAML para producción en Kubernetes

### Paso 9 — Documentación
- 5 diagramas PlantUML (UML estándar)
- Threat model OWASP Threat Dragon
- 4 manuales técnicos
- Este documento

---

## Estructura final del repositorio

```
asm-devsecops/
├── LICENSE                          # Licencia MIT
├── README.md                        # Portada con badges del pipeline
├── .env.example                     # Plantilla de variables de entorno
├── .gitignore                       # Excluye .env, node_modules, etc.
├── docker-compose.yml               # Entorno de desarrollo local
├── docker-compose.prod.yml          # Ajustes de producción
│
├── .github/workflows/
│   ├── ci.yml                       # Pipeline CI completo (8 etapas)
│   └── deploy.yml                   # Release + push Docker Hub + deploy
│
├── .zap/rules.tsv                   # Reglas ignoradas en ZAP scan
│
├── servicios/
│   ├── api-gateway/                 # FastAPI + JWT
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── app/
│   │   │   ├── main.py             # App principal + routers
│   │   │   ├── config.py           # Variables de entorno
│   │   │   ├── celery_app.py       # Cliente Celery
│   │   │   ├── auth/jwt.py         # JWT + bcrypt
│   │   │   ├── db/database.py      # SQLAlchemy
│   │   │   ├── db/init.sql         # Esquema inicial
│   │   │   ├── models/models.py    # ORM: User, Scan, Report
│   │   │   ├── routers/            # auth, scans, results, reports, users, consolidated
│   │   │   └── scripts/create_admin.py
│   │   └── tests/                  # Pytest: test_auth, test_scans
│   │
│   ├── worker-scanner/              # Celery + bash OSINT
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── tasks.py                # Tarea run_scan
│   │   └── validar_subdominioModtimeout.sh
│   │
│   ├── worker-report/               # Celery + ReportLab + python-docx
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── tasks.py                # Tareas: generate_report, generar_pdf, generar_docx
│   │
│   └── frontend/                   # React 18 + Vite + Tailwind
│       ├── Dockerfile
│       ├── nginx.conf              # Con todas las cabeceras de seguridad
│       ├── package.json
│       ├── vite.config.js
│       ├── tailwind.config.js
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           ├── api/auth.js         # JWT + Axios
│           ├── components/Layout.jsx
│           └── pages/
│               ├── Login.jsx
│               ├── Dashboard.jsx
│               ├── ScanDetail.jsx  # Gráficas + tablas + tabs
│               ├── Consolidated.jsx
│               └── AdminUsers.jsx
│
├── infraestructura/
│   ├── terraform/                  # Crea VM en AWS
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── ansible/                    # Configura y despliega
│       ├── site.yml
│       ├── inventory.ini
│       └── roles/asm/tasks/main.yml
│
├── orquestacion/k8s/               # Kubernetes / K3s
│   ├── namespace.yaml
│   ├── deployments/api-gateway.yaml
│   ├── deployments/workers.yaml
│   └── ingress.yaml
│
└── docs/
    ├── architecture/
    │   ├── README.md               # Manual de arquitectura
    │   ├── component-diagram.puml
    │   ├── deployment-diagram.puml
    │   ├── sequence-auth.puml
    │   ├── sequence-scan.puml
    │   ├── use-cases.puml
    │   └── threat-model.json       # OWASP Threat Dragon
    ├── development-manual.md
    ├── deployment-manual.md
    ├── security-manual.md
    ├── user-manual.md
    └── explicacion-tecnica-para-dummies.md   ← este archivo
```

---

*Documento generado como parte del Trabajo Final de Especialización en Ciberseguridad — Énfasis DevSecOps.*
