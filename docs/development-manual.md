# Manual de Desarrollo — ASM

## Prerrequisitos

- Docker >= 24.x y Docker Compose >= 2.x
- Node.js 20.x (para desarrollo frontend)
- Python 3.11+ (para desarrollo backend)
- Git

## 1. Clonar y Configurar

```bash
git clone https://github.com/TU_USUARIO/asm-devsecops.git
cd asm-devsecops

# Configurar variables de entorno
cp .env.example .env
# Editar .env con valores de desarrollo
```

## 2. Levantar en Modo Desarrollo

```bash
# Levantar todos los servicios
docker compose up -d

# Verificar estado
docker compose ps

# Ver logs de un servicio
docker compose logs -f api-gateway
docker compose logs -f worker-scanner
```

## 3. Crear Usuario Admin

El usuario administrador inicial no se crea automáticamente al levantar los contenedores.

Después de iniciar el sistema con Docker Compose, se debe ejecutar manualmente el script de creación del administrador. Este paso es obligatorio para poder iniciar sesión por primera vez en la interfaz web.

### 3.1 Crear el administrador usando Docker Compose plugin

Si la máquina utiliza el comando moderno `docker compose`, ejecutar:

```bash
docker compose exec api-gateway python -m app.scripts.create_admin
```

### 3.2 Crear el administrador usando Docker Compose clásico

En algunas distribuciones, como Kali Linux, puede estar disponible el comando clásico `docker-compose`. En ese caso, ejecutar:

```bash
docker-compose exec api-gateway python -m app.scripts.create_admin
```

### 3.3 Crear el administrador usando Docker directamente

Si el comando anterior no funciona, también puede ejecutarse directamente dentro del contenedor del API Gateway:

```bash
docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin
```

Si el sistema requiere permisos elevados:

```bash
sudo docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin
```

### 3.4 Variables utilizadas

El script toma las credenciales iniciales desde el archivo `.env`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

Estas variables deben estar configuradas antes de levantar el sistema.

### 3.5 Validar que el usuario fue creado

Para verificar que el usuario administrador quedó registrado en la base de datos, ejecutar:

```bash
docker exec -it asm-devsecops-db-1 psql -U asm_user -d asm_db -c "SELECT id, username, role, is_active FROM app_users;"
```

Si la máquina requiere permisos elevados:

```bash
sudo docker exec -it asm-devsecops-db-1 psql -U asm_user -d asm_db -c "SELECT id, username, role, is_active FROM app_users;"
```

El resultado esperado debe mostrar el usuario `admin` activo.

### 3.6 Reiniciar la base de datos si el admin no se crea

Si el usuario administrador no aparece o las credenciales no funcionan, se puede limpiar el entorno y recrear la base de datos:

```bash
docker-compose down -v
docker-compose up --build
```

Luego se debe volver a ejecutar el script de creación de administrador:

```bash
docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin
```

## 4. Acceder a los Servicios

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |

## 5. Ejecutar Pruebas Unitarias

```bash
# API Gateway (Python)
cd servicios/api-gateway
pip install -r requirements.txt
pip install pytest pytest-cov
pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend (JavaScript)
cd servicios/frontend
npm install
npm test
```
> Nota: en el entorno CI se utiliza `npm install` en lugar de `npm ci`, ya que el repositorio no mantiene `package-lock.json` como artefacto obligatorio de versionamiento.

## 6. Ejecutar Análisis de Seguridad Local

```bash
# SAST - Bandit
pip install bandit
bandit -r servicios/api-gateway/app/ -f json

# SAST - Semgrep
pip install semgrep
semgrep --config p/python servicios/api-gateway/app/

# Secretos - Gitleaks
gitleaks detect --source . --verbose

# Dependencias - Trivy
trivy fs servicios/api-gateway/requirements.txt --severity HIGH,CRITICAL
```

## 7. Pipeline CI/CD (DevSecOps)

El proyecto implementa un pipeline DevSecOps automatizado mediante **GitHub Actions**, ejecutado sobre la rama `master` y preparado para validar código, dependencias, imágenes, infraestructura y la aplicación en ejecución.

### Flujo del pipeline

1. **Detección de secretos** con Gitleaks.
2. **SAST** sobre código Python con Bandit y Semgrep.
3. **SCA** sobre dependencias con Trivy.
4. **Build** de imágenes Docker por microservicio:
   - `api-gateway`
   - `worker-scanner`
   - `worker-report`
   - `frontend`
5. **Pruebas unitarias**:
   - `pytest` para backend
   - `jest` para frontend
6. **Levantamiento de entorno de staging** con Docker Compose dentro del runner CI.
7. **Creación automática de usuario administrador** para pruebas autenticadas.
8. **Obtención de JWT** desde `/api/auth/token`.
9. **Ejecución automática de análisis ASM** contra la API.
10. **DAST** con OWASP ZAP sobre el entorno levantado.
11. **Escaneo de IaC** con Checkov sobre Terraform, Kubernetes y Docker Compose.
12. **Apagado automático del entorno** al finalizar.

### Características clave del pipeline

- La seguridad se ejecuta como parte del ciclo de integración continua.
- El pipeline levanta un entorno real de ejecución para validar el comportamiento de la aplicación.
- Se realiza autenticación automática antes de pruebas dinámicas sobre endpoints protegidos.
- Los hallazgos de herramientas como Bandit, Trivy y Checkov se conservan como evidencia aun cuando se ejecuten en modo no bloqueante.
- Se apaga automáticamente el entorno de staging para no dejar residuos en el runner.

### Validación en GitHub Actions

La validación del pipeline se realiza desde la pestaña **Actions** del repositorio. Cada ejecución permite revisar:

- estado de cada job,
- logs detallados,
- hallazgos de seguridad,
- artefactos generados,
- comportamiento del despliegue temporal.

## 8. Estrategia de Branching

```
master      → rama principal activa del proyecto y punto de ejecución del pipeline
develop     → integración de funcionalidades en evolución
feature/X   → desarrollo de funcionalidad específica
hotfix/X    → correcciones urgentes
```

## 9. Convención de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agrega validación de dominios internacionales
fix: corrige timeout en escaneo de puertos
docs: actualiza manual de despliegue
test: agrega pruebas de autenticación JWT
ci: mejora pipeline con caché de Docker layers
sec: actualiza dependencias con CVEs críticos
```

## 10. Proceso de Contribución

1. Fork del repositorio
2. Crear branch: `git checkout -b feature/mi-feature`
3. Hacer cambios y commits siguiendo la convención
4. Asegurarse que todos los tests pasan
5. Abrir Pull Request hacia `develop`
6. El CI/CD verificará automáticamente la seguridad del código
