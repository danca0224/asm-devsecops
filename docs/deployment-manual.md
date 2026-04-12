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

```bash
# En el servidor
cd /opt/asm
docker compose ps

# Verificar health checks
curl http://localhost:8000/health
curl http://localhost:3000/health

# Crear admin inicial
docker compose exec api-gateway python -m app.scripts.create_admin
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
| API Gateway no arranca | `docker compose logs api-gateway` | Verificar POSTGRES_PASSWORD en .env |
| Worker no procesa tareas | `docker compose logs worker-scanner` | Verificar CELERY_BROKER_URL |
| RabbitMQ no conecta | `docker compose logs rabbitmq` | Verificar RABBITMQ_PASSWORD |
| PostgreSQL no inicia | `docker compose logs db` | Verificar volumen db_data |
| Frontend 502 Bad Gateway | `docker compose logs frontend` | Verificar que api-gateway esté corriendo |
| Pipeline falla en login JWT | Revisar step `Obtener token JWT desde la API` en GitHub Actions | Verificar credenciales admin y formato `application/x-www-form-urlencoded` |
| API reinicia en CI | Revisar logs de `api-gateway` | Verificar variables `.env` requeridas por `Settings` |
| Checkov reporta hallazgos y devuelve exit code 1 | Revisar configuración del comando | Ejecutar en modo no bloqueante con `|| true` |
| ZAP muestra warning de `fail_action` | Revisar step de ZAP en `ci.yml` | Usar `fail_action: false` si se quiere eliminar warning |
