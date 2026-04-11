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

## Cómo migrar el proyecto a otra máquina (paso a paso para dummies)

Esta sección explica **exactamente qué hacer para que el proyecto funcione en un computador diferente al que se usó para desarrollarlo**. No se necesita saber DevOps avanzado — solo seguir los pasos en orden.

---

### ¿Qué necesita el equipo destino?

Antes de empezar, el equipo donde vas a correr el proyecto necesita dos programas instalados:

#### En Windows:

1. **Docker Desktop** — descárgalo desde [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   - Durante la instalación, acepta habilitar WSL 2 si te lo pide
   - Reinicia el equipo cuando termine
   - Abre Docker Desktop y espera a que aparezca el ícono de la ballena en la barra de tareas en verde

2. **Git** — descárgalo desde [git-scm.com](https://git-scm.com/)
   - Instala con todas las opciones por defecto
   - Para verificar que quedó instalado, abre una terminal (cmd o PowerShell) y escribe: `git --version`

#### En Linux (Ubuntu/Debian):

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Instalar Git
sudo apt install git -y

# Verificar
docker --version
git --version
```

#### En macOS:

1. Descarga **Docker Desktop** desde [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Git ya viene instalado en macOS — si no, al escribir `git` en la terminal te ofrecerá instalarlo

---

### Paso 1 — Descargar el proyecto

Abre una terminal (en Windows: PowerShell o CMD; en Mac/Linux: Terminal) y escribe:

```bash
git clone https://github.com/danca0224/asm-devsecops.git
```

Esto descarga todos los archivos del proyecto a una carpeta llamada `asm-devsecops`. Luego entra a esa carpeta:

```bash
cd asm-devsecops
```

**¿Qué hace `git clone`?** Es como descargar un ZIP desde GitHub pero de forma inteligente — trae el historial completo del proyecto y lo conecta al repositorio original para que puedas recibir actualizaciones después.

---

### Paso 2 — Crear el archivo de configuración

El proyecto necesita un archivo llamado `.env` que contiene las contraseñas y configuraciones internas. Este archivo **no está en GitHub** por seguridad (está en `.gitignore`), por eso hay que crearlo manualmente.

Hay un archivo de ejemplo llamado `.env.example`. Cópialo:

**En Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**En Mac/Linux:**
```bash
cp .env.example .env
```

Ahora abre el archivo `.env` con cualquier editor de texto (Bloc de Notas, VS Code, nano, etc.) y configura los valores. Los mínimos necesarios para que funcione:

```env
# Base de datos
POSTGRES_DB=asm_db
POSTGRES_USER=asm_user
POSTGRES_PASSWORD=MiContraseñaSegura123

# Seguridad JWT (clave para firmar los tokens de sesión — ponla larga y aleatoria)
JWT_SECRET_KEY=esta-clave-debe-ser-larga-y-aleatoria-minimo-32-caracteres

# RabbitMQ (mensajería interna — puedes dejar estos valores)
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# Usuario administrador inicial de la aplicación
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin2024!
ADMIN_EMAIL=admin@miempresa.com
```

**Importante:** No uses contraseñas simples como `123456`. El sistema arranca igualmente pero es mala práctica.

---

### Paso 3 — Construir y levantar todos los servicios

Este es el paso principal. Con un solo comando Docker construye las imágenes y levanta todo:

```bash
docker compose up --build -d
```

**¿Qué significa cada parte?**
- `docker compose up` — levanta todos los servicios definidos en `docker-compose.yml`
- `--build` — construye las imágenes desde cero (necesario la primera vez)
- `-d` — modo "detached", es decir, corre en segundo plano y te devuelve la terminal

**¿Cuánto tarda?** La primera vez puede tomar entre **5 y 15 minutos** porque Docker descarga las imágenes base (Python, Node, PostgreSQL, etc.) y compila el código. Las veces siguientes es mucho más rápido.

Mientras esperas, puedes ver qué está pasando con:

```bash
docker compose logs -f
```

Presiona `Ctrl+C` para salir de los logs (los servicios siguen corriendo).

---

### Paso 4 — Verificar que todo arrancó bien

```bash
docker compose ps
```

Deberías ver algo así:

```
NAME                    STATUS          PORTS
asm-db-1                healthy         5432/tcp
asm-rabbitmq-1          healthy         5672/tcp, 15672/tcp
asm-api-gateway-1       healthy         0.0.0.0:8000->8000/tcp
asm-worker-scanner-1    running
asm-worker-report-1     running
asm-frontend-1          healthy         0.0.0.0:3000->80/tcp
```

Si todos los servicios dicen `healthy` o `running`, el sistema está listo.

**Si algún servicio dice `Exit` o `Restarting`**, ve a la sección de solución de problemas más abajo.

---

### Paso 5 — Crear el usuario administrador

Solo hay que hacer esto **una vez**, la primera vez que levantas el proyecto en ese equipo:

```bash
docker compose exec api-gateway python app/scripts/create_admin.py
```

**¿Qué hace esto?** Entra dentro del contenedor del API Gateway y ejecuta un script Python que crea el usuario administrador en la base de datos usando los valores que pusiste en el `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).

---

### Paso 6 — Abrir la aplicación

Abre un navegador y ve a:

| Servicio | URL |
|---|---|
| **Aplicación principal** | http://localhost:3000 |
| **Documentación API** | http://localhost:8000/docs |
| **Panel RabbitMQ** | http://localhost:15672 |

Ingresa con las credenciales que pusiste en `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

---

### Comandos útiles del día a día

```bash
# Ver el estado de todos los contenedores
docker compose ps

# Ver los logs en tiempo real de todos los servicios
docker compose logs -f

# Ver los logs de un servicio específico
docker compose logs -f api-gateway
docker compose logs -f worker-scanner

# Apagar todo (los datos se conservan)
docker compose down

# Apagar todo Y borrar los datos de la base de datos (cuidado)
docker compose down -v

# Reiniciar un servicio específico sin bajar todo
docker compose restart api-gateway

# Reconstruir solo un servicio después de cambiar su código
docker compose up --build -d api-gateway
```

---

### ¿Cómo actualizar el proyecto cuando hay cambios nuevos en GitHub?

```bash
# Descargar los cambios nuevos
git pull origin master

# Reconstruir y reiniciar con los cambios
docker compose up --build -d
```

---

## Guía de resolución de problemas (Troubleshooting)

Esta sección cubre los errores más comunes que pueden ocurrir y cómo resolverlos.

---

### ❌ Error: "docker: command not found" o "docker compose: command not found"

**Qué significa:** Docker no está instalado o no está en el PATH del sistema.

**Solución:**
1. Verifica que Docker Desktop esté instalado y **abierto** (en Windows/Mac, el ícono de la ballena debe estar en la barra de tareas)
2. Cierra y vuelve a abrir la terminal después de instalar Docker
3. En Linux, verifica con `sudo docker --version`. Si funciona con sudo pero no sin él, ejecuta:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

---

### ❌ Error: "Cannot connect to the Docker daemon"

**Qué significa:** El servicio de Docker no está corriendo.

**Solución:**
- **Windows/Mac:** Abre Docker Desktop y espera a que el ícono de la ballena esté en verde
- **Linux:**
  ```bash
  sudo systemctl start docker
  sudo systemctl enable docker
  ```

---

### ❌ El comando `docker compose up` falla con "port is already allocated"

**Ejemplo del error:**
```
Error starting userland proxy: listen tcp 0.0.0.0:5432: bind: address already in use
```

**Qué significa:** El puerto que necesita uno de los contenedores ya está siendo usado por otro programa en tu máquina. Común con PostgreSQL (5432) o servicios web (80, 3000, 8000).

**Solución:**

En Windows, busca qué usa ese puerto:
```powershell
netstat -ano | findstr :5432
```
El último número es el PID del proceso. Ábrelo en el Administrador de tareas y termínalo.

En Mac/Linux:
```bash
lsof -i :5432
kill -9 <PID>
```

O cambia el puerto en `docker-compose.yml` — por ejemplo, cambia `"5432:5432"` a `"5433:5432"` para exponer el postgres en el puerto 5433 de tu máquina.

---

### ❌ El servicio `api-gateway` aparece como `Restarting` o `Exit 1`

**Diagnóstico:**
```bash
docker compose logs api-gateway
```

**Causas más comunes:**

| Mensaje en el log | Causa | Solución |
|---|---|---|
| `could not connect to server: Connection refused` | PostgreSQL no terminó de arrancar antes que el API | Espera 30 segundos y ejecuta `docker compose restart api-gateway` |
| `pydantic_settings ValidationError` | Falta una variable en `.env` | Revisa que `.env` tenga todas las variables de `.env.example` |
| `ModuleNotFoundError` | Dependencia de Python no instalada en la imagen | Ejecuta `docker compose up --build -d` para reconstruir |
| `Address already in use: 8000` | Otro proceso usa el puerto 8000 | Cierra el proceso o cambia el puerto en `docker-compose.yml` |

---

### ❌ El servicio `frontend` arranca pero el navegador muestra pantalla en blanco

**Diagnóstico:**
```bash
docker compose logs frontend
```

**Causas comunes:**

1. **El build de React falló silenciosamente** — revisa los logs durante el `docker compose up --build`. Busca errores de JavaScript.

2. **El API Gateway no está respondiendo** — el frontend intenta conectarse al backend. Verifica:
   ```bash
   curl http://localhost:8000/health
   ```
   Debe responder: `{"status": "ok", "service": "api-gateway"}`

3. **Cache del navegador** — presiona `Ctrl+Shift+R` (o `Cmd+Shift+R` en Mac) para recargar sin caché.

---

### ❌ El análisis de dominio se queda en estado "running" para siempre

**Qué significa:** El Worker Scanner recibió la tarea pero algo falló durante la ejecución.

**Diagnóstico:**
```bash
docker compose logs worker-scanner
```

**Causas comunes:**

| Causa | Solución |
|---|---|
| El script bash `validar_subdominioModtimeout.sh` no está en el contenedor | Verifica que el archivo existe en `servicios/worker-scanner/` y reconstruye con `--build` |
| El dominio ingresado no existe o no responde | Prueba con un dominio conocido como `google.com` |
| RabbitMQ no está listo cuando el worker arranca | `docker compose restart worker-scanner` |
| Timeout del script bash | Normal para dominios grandes — espera más tiempo |

---

### ❌ Error al crear el admin: "UNIQUE constraint failed" o "already exists"

**Qué significa:** El usuario administrador ya fue creado antes — es un error inofensivo.

**Solución:** No necesitas hacer nada. El usuario ya existe, simplemente intenta hacer login con las credenciales del `.env`.

---

### ❌ Los informes PDF/DOCX no se generan o no se pueden descargar

**Diagnóstico:**
```bash
docker compose logs worker-report
```

**Causas comunes:**

| Mensaje | Causa | Solución |
|---|---|---|
| `No such file or directory: reports/scan_*.csv` | El scanner no terminó de copiar el CSV | Espera a que el estado del scan cambie a `completed` |
| `ImportError: reportlab` | Dependencia faltante | `docker compose up --build -d worker-report` |
| El download retorna 404 | El archivo existe pero no está en el volumen compartido | Verifica que el `docker-compose.yml` tiene el volumen `reports_data` montado en ambos workers |

---

### ❌ "No space left on device" durante el build

**Qué significa:** Docker llenó el disco con imágenes y capas antiguas.

**Solución:**
```bash
# Ver cuánto espacio usa Docker
docker system df

# Limpiar imágenes, contenedores y capas sin usar
docker system prune -a

# Limpiar también los volúmenes (CUIDADO: borra datos de la BD)
docker system prune -a --volumes
```

En Docker Desktop (Windows/Mac), también puedes ir a Settings → Resources → Disk usage y hacer "Clean / Purge data".

---

### ❌ Los cambios en el código no se reflejan al volver a levantar

**Causa:** Docker usa imágenes cacheadas. Si cambias código, necesitas reconstruir.

**Solución:**
```bash
# Reconstruir todas las imágenes desde cero (ignora el caché)
docker compose build --no-cache
docker compose up -d
```

---

### ❌ En Windows: WSL 2 o Hyper-V no habilitado

**Síntoma:** Docker Desktop no arranca y muestra un error sobre virtualización.

**Solución:**
1. Abre PowerShell **como Administrador** y ejecuta:
   ```powershell
   wsl --install
   ```
2. Reinicia el equipo
3. Abre Docker Desktop nuevamente

Si el error es sobre Hyper-V:
1. Abre PowerShell como Administrador:
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
   ```
2. Reinicia

---

### ❌ El equipo destino no tiene acceso a internet para descargar imágenes

**Situación:** Quieres correr el proyecto en una máquina sin acceso a Docker Hub o GitHub.

**Solución — exportar e importar imágenes manualmente:**

En el equipo con internet (donde ya funciona):
```bash
# Guardar todas las imágenes en archivos tar
docker save asm-api-gateway:latest | gzip > api-gateway.tar.gz
docker save asm-worker-scanner:latest | gzip > worker-scanner.tar.gz
docker save asm-worker-report:latest | gzip > worker-report.tar.gz
docker save asm-frontend:latest | gzip > frontend.tar.gz
```

Copia esos archivos `.tar.gz` al equipo destino (USB, red local, etc.) y en el equipo destino:
```bash
docker load < api-gateway.tar.gz
docker load < worker-scanner.tar.gz
docker load < worker-report.tar.gz
docker load < frontend.tar.gz
```

Luego el `docker compose up -d` funcionará sin necesitar internet.

---

### Tabla resumen de comandos de diagnóstico

| Quiero saber... | Comando |
|---|---|
| Si todos los servicios están corriendo | `docker compose ps` |
| Por qué falló un servicio | `docker compose logs <nombre-servicio>` |
| Los logs en tiempo real | `docker compose logs -f` |
| Cuánta memoria/CPU usa cada contenedor | `docker stats` |
| Si el API responde | `curl http://localhost:8000/health` |
| Entrar "dentro" de un contenedor a inspeccionar | `docker compose exec api-gateway bash` |
| Cuánto disco usa Docker | `docker system df` |
| Limpiar todo lo que no se usa | `docker system prune -a` |

---

*Documento generado como parte del Trabajo Final de Especialización en Ciberseguridad — Énfasis DevSecOps.*
