# Manual de Despliegue y Operación — ASM

## Prerrequisitos del Servidor

- Ubuntu 22.04 LTS
- Docker >= 24.x
- Docker Compose >= 2.x
- Mínimo: 2 vCPU, 4 GB RAM, 30 GB disco
- Puerto 80 y 443 abiertos al público
- Puerto 22 abierto solo desde IP de gestión

## 1. Provisionar Infraestructura con Terraform

```bash
cd infraestructura/terraform

# Inicializar Terraform
terraform init

# Revisar plan
terraform plan \
  -var="key_name=mi-llave-ssh" \
  -var="admin_cidr=MI_IP/32"

# Aplicar (crea EC2 en AWS)
terraform apply \
  -var="key_name=mi-llave-ssh" \
  -var="admin_cidr=MI_IP/32"

# Obtener IP del servidor
terraform output server_ip
```

## 2. Desplegar con Ansible

```bash
cd infraestructura/ansible

# Editar inventory.ini con la IP del servidor
nano inventory.ini

# Crear vault con secretos (NO commitear este archivo)
ansible-vault create vars/secrets.yml
# Agregar:
# postgres_password: MiPasswordFuerte123!
# jwt_secret_key: miJWTSecretKeyAleatoria256bits
# rabbitmq_password: MiRabbitMQPass

# Ejecutar despliegue
ansible-playbook -i inventory.ini site.yml \
  --ask-vault-pass
```

## 3. Variables de Entorno Necesarias

```bash
# En el servidor, crear /opt/asm/.env
POSTGRES_PASSWORD=MiPasswordFuerte123!
JWT_SECRET_KEY=miJWTSecretKeyAleatoria256bits
RABBITMQ_PASSWORD=MiRabbitMQPass
RABBITMQ_USER=asm
CELERY_BROKER_URL=amqp://asm:MiRabbitMQPass@rabbitmq:5672//
```

## 4. Verificar Despliegue

### Verificar servicios

En el servidor o máquina donde se ejecuta el proyecto:

```bash
docker compose ps
curl http://localhost:8000/health
```

En entornos donde se utilice Docker Compose clásico:

```bash
docker-compose ps
curl http://localhost:8000/health
```

### Crear admin inicial

El usuario administrador no se crea automáticamente durante el despliegue.

Después de levantar los contenedores, se debe ejecutar manualmente:

```bash
docker compose exec api-gateway python -m app.scripts.create_admin
```

En sistemas donde se use Docker Compose clásico:

```bash
docker-compose exec api-gateway python -m app.scripts.create_admin
```

Si el sistema requiere permisos elevados:

```bash
sudo docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin
```

Este paso es obligatorio para poder iniciar sesión en la aplicación web.

### URLs de validación

```text
Frontend: http://localhost:3000
API Gateway: http://localhost:8000
Swagger UI: http://localhost:8000/docs
Healthcheck: http://localhost:8000/health
```

## 5. Publicar Imágenes en Docker Hub

```bash
# Crear tag de versión semántica
git tag v1.0.0
git push origin v1.0.0

> Importante: el pipeline de CI utiliza nombres locales de imagen para el build y análisis dentro del runner, mientras que el pipeline de release/deploy es el encargado de publicar imágenes versionadas en Docker Hub.

# GitHub Actions ejecutará automáticamente:
# 1. CI completo (tests, SAST, trivy, ZAP)
# 2. Build y push a Docker Hub con tag v1.0.0 + latest
# 3. Despliegue en producción
```

## 6. Ejecución del Pipeline de Despliegue y Validación

Además del despliegue manual mediante Terraform, Ansible y Docker Compose, el proyecto incorpora un pipeline automatizado en GitHub Actions que valida la aplicación antes de cualquier liberación.

### Qué realiza el pipeline

- Detección de secretos en el repositorio.
- Escaneo SAST de código fuente.
- Escaneo SCA de dependencias.
- Build de imágenes Docker por servicio.
- Pruebas unitarias de backend y frontend.
- Levantamiento de entorno temporal de staging con Docker Compose.
- Creación automática de usuario administrador.
- Autenticación contra la API mediante JWT.
- Ejecución de análisis ASM desde la propia API del sistema.
- Escaneo DAST con OWASP ZAP.
- Validación de infraestructura como código con Checkov.
- Apagado automático del entorno al finalizar.

### Entorno temporal de staging en CI

Durante la ejecución del pipeline, se genera dinámicamente un archivo `.env` con variables mínimas de operación para levantar:

- PostgreSQL
- RabbitMQ
- API Gateway
- Frontend
- Workers

Esto permite validar la aplicación en un entorno efímero, separado del entorno local del desarrollador y del entorno de producción.

### Consideraciones operativas

- El pipeline no depende de la aplicación Streamlit existente del proyecto previo.
- La aplicación Streamlit y su base de datos PostgreSQL se consideran independientes y no forman parte del entorno temporal del pipeline.
- El pipeline levanta su propia infraestructura efímera dentro del runner de GitHub Actions.

## 7. Troubleshooting Común

| Problema | Diagnóstico | Solución |
|---|---|---|
| API Gateway no arranca | `docker compose logs api-gateway` | Verificar POSTGRES_PASSWORD |
| Worker no procesa tareas | `docker compose logs worker-scanner` | Verificar CELERY_BROKER_URL |
| RabbitMQ no conecta | `docker compose logs rabbitmq` | Verificar RABBITMQ_PASSWORD |
| PostgreSQL no inicia | `docker compose logs db` | Verificar volumen db_data |
| Frontend 502 Bad Gateway | `docker compose logs frontend` | Verificar api-gateway |
| Pipeline falla en login JWT | Revisar step API | Verificar credenciales admin |
| Docker no está instalado | `docker --version` no responde | `sudo apt install docker.io docker-compose -y` |
| Docker daemon apagado | `Cannot connect to the Docker daemon` | `sudo systemctl start docker` |
| Usuario sin permisos Docker | `permission denied` | `sudo usermod -aG docker $USER` |
| Login web falla | Usuario admin no existe (tabla app_users vacía) | Ejecutar `docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin` |
| Error descargando imágenes | Conectividad inestable | Reintentar `docker-compose up --build` |

## 8. Validación en Máquina Limpia

Se realizó una prueba completa de despliegue en una máquina nueva (Kali Linux) sin configuraciones previas.

### Flujo ejecutado

1. Instalación de Docker y Docker Compose.
2. Clonación del repositorio desde GitHub.
3. Creación del archivo `.env` a partir de `.env.example`.
4. Configuración de variables mínimas.
5. Construcción de imágenes con Docker Compose.
6. Levantamiento de todos los servicios.
7. Creación manual del usuario administrador.
8. Acceso a la interfaz web.
9. Validación de autenticación.
10. Creación de nuevos usuarios desde la aplicación.

### Comandos utilizados

#### Opción A: ejecución desde el repositorio principal del proyecto

Esta es la ruta principal del proyecto y desde donde se ejecuta el pipeline CI/CD:

```bash
git clone https://github.com/danca0224/asm-devsecops.git
cd asm-devsecops
cp .env.example .env
docker-compose up --build
```

#### Opción B: ejecución desde el repositorio compartido de entrega

El proyecto también fue copiado al repositorio académico compartido:

```bash
git clone https://github.com/jaiderospina/DevSecOps2026.git
cd DevSecOps2026/TRABAJO_FINAL/GRUPO_S
cp .env.example .env
docker-compose up --build
```

> Nota: el despliegue continuo y la publicación de imágenes se realizan desde el repositorio principal `danca0224/asm-devsecops`. El repositorio compartido se usa como ubicación académica de entrega.

Creación del administrador:

```bash
docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin
```

Si el sistema requiere permisos elevados:

```bash
sudo docker exec -it asm-devsecops-api-gateway-1 python -m app.scripts.create_admin
```

### URLs de validación

```text
Frontend: http://localhost:3000
API: http://localhost:8000
Swagger: http://localhost:8000/docs
Health: http://localhost:8000/health
```

### Resultado

El sistema fue desplegado exitosamente en una máquina limpia, permitiendo:

- acceso a la interfaz web
- autenticación de usuario administrador
- creación de usuarios adicionales
- ejecución de funcionalidades del sistema

### Hallazgos

Durante la validación se identificaron los siguientes puntos:

- El usuario administrador no se crea automáticamente
- Es obligatorio ejecutar el script `create_admin`
- En Kali Linux puede utilizarse `docker-compose` en lugar de `docker compose`
- Docker puede no estar activo por defecto
- Se requieren permisos adecuados para ejecutar Docker
- La descarga de imágenes depende de conectividad estable

### Conclusión

El sistema es completamente transferible a otro entorno siempre que se sigan los pasos documentados, incluyendo la creación manual del usuario administrador.
