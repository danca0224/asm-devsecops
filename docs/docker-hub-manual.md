# Manual de Publicación de Imágenes en Docker Hub

## 1. Objetivo

Este documento describe el proceso de construcción y publicación de imágenes Docker en Docker Hub como parte del pipeline CI/CD del proyecto ASM DevSecOps.

---

## 2. Requisitos

Para utilizar Docker Hub en este proyecto se requiere:

- Cuenta activa en Docker Hub
- Token de acceso (Access Token)
- Repositorio en GitHub
- Dockerfiles definidos por servicio
- GitHub Actions configurado

---

## 3. Servicios del proyecto

El sistema está compuesto por los siguientes microservicios:

```text
servicios/
├── api-gateway/
├── frontend/
├── worker-report/
└── worker-scanner/
```

Cada uno genera su propia imagen Docker.

---

## 4. Repositorios en Docker Hub

Las imágenes se publican bajo:

```text
danca0224/api-gateway
danca0224/frontend
danca0224/worker-report
danca0224/worker-scanner
```

---

## 5. Configuración de credenciales en GitHub

En el repositorio de GitHub se deben configurar los siguientes secrets:

| Nombre | Descripción |
|---|---|
| DOCKER_HUB_USERNAME | Usuario de Docker Hub |
| DOCKER_HUB_TOKEN | Token de acceso de Docker Hub |

El token se obtiene desde:

Docker Hub → Account Settings → Security → Access Tokens

⚠️ No usar la contraseña personal.

---

## 6. Workflow CI/CD

El pipeline de publicación está definido en:

```text
.github/workflows/docker-publish.yml
```

Este workflow realiza automáticamente:

1. Checkout del código
2. Login en Docker Hub
3. Build de imágenes
4. Push de imágenes

---

## 7. Ejemplo del flujo en GitHub Actions

```yaml
- name: Log in to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_HUB_USERNAME }}
    password: ${{ secrets.DOCKER_HUB_TOKEN }}
```

---

## 8. Construcción de imágenes (local)

Para construir manualmente las imágenes:

```bash
docker build -t danca0224/api-gateway:latest ./servicios/api-gateway
docker build -t danca0224/frontend:latest ./servicios/frontend
docker build -t danca0224/worker-report:latest ./servicios/worker-report
docker build -t danca0224/worker-scanner:latest ./servicios/worker-scanner
```

---

## 9. Publicación manual

```bash
docker push danca0224/api-gateway:latest
docker push danca0224/frontend:latest
docker push danca0224/worker-report:latest
docker push danca0224/worker-scanner:latest
```

---

## 10. Validación en GitHub Actions

La publicación se valida en:

👉 Pestaña **Actions** del repositorio

Workflow:

```text
Build and Push Docker Images
```

Resultado esperado:

✔ Todos los jobs en estado **Success**

- api-gateway
- frontend
- worker-report
- worker-scanner

---

## 11. Consideraciones de red

Durante la construcción local se descargan imágenes base como:

```text
python:3.11-slim
node:20-alpine
nginx:1.27-alpine
postgres:16-alpine
rabbitmq:3.13-management-alpine
```

Si la red es inestable pueden ocurrir errores.

### Solución:

```bash
docker-compose up --build
```

o descargar manualmente:

```bash
docker pull python:3.11-slim
docker pull node:20-alpine
docker pull nginx:1.27-alpine
docker pull postgres:16-alpine
docker pull rabbitmq:3.13-management-alpine
```

---

## 12. Seguridad

- Las credenciales NO están en el repositorio
- Se usan GitHub Secrets
- Se utiliza token en lugar de contraseña
- El archivo `.env` NO debe subirse

---

## 13. Conclusión

El sistema implementa un flujo automatizado de construcción y publicación de imágenes Docker mediante GitHub Actions, garantizando:

- reproducibilidad
- seguridad de credenciales
- integración continua
- despliegue consistente
