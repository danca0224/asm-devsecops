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

# GitHub Actions ejecutará automáticamente:
# 1. CI completo (tests, SAST, trivy, ZAP)
# 2. Build y push a Docker Hub con tag v1.0.0 + latest
# 3. Despliegue en producción
```

## 6. Troubleshooting Común

| Problema | Diagnóstico | Solución |
|---|---|---|
| API Gateway no arranca | `docker compose logs api-gateway` | Verificar POSTGRES_PASSWORD en .env |
| Worker no procesa tareas | `docker compose logs worker-scanner` | Verificar CELERY_BROKER_URL |
| RabbitMQ no conecta | `docker compose logs rabbitmq` | Verificar RABBITMQ_PASSWORD |
| PostgreSQL no inicia | `docker compose logs db` | Verificar volumen db_data |
| Frontend 502 Bad Gateway | `docker compose logs frontend` | Verificar que api-gateway esté corriendo |
