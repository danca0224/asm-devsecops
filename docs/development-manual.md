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

```bash
docker compose exec api-gateway python -m app.scripts.create_admin
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

## 7. Estrategia de Branching

```
main        → rama de producción (protegida, requiere PR + CI)
develop     → integración de features
feature/X   → desarrollo de funcionalidad X
hotfix/X    → correcciones urgentes en producción
```

## 8. Convención de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agrega validación de dominios internacionales
fix: corrige timeout en escaneo de puertos
docs: actualiza manual de despliegue
test: agrega pruebas de autenticación JWT
ci: mejora pipeline con caché de Docker layers
sec: actualiza dependencias con CVEs críticos
```

## 9. Proceso de Contribución

1. Fork del repositorio
2. Crear branch: `git checkout -b feature/mi-feature`
3. Hacer cambios y commits siguiendo la convención
4. Asegurarse que todos los tests pasan
5. Abrir Pull Request hacia `develop`
6. El CI/CD verificará automáticamente la seguridad del código
