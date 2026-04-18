# 📦 Manual de Publicación de Imágenes en Docker Hub

## 1. Objetivo

Este documento describe el proceso de construcción, versionado y publicación de imágenes Docker en Docker Hub, como parte del pipeline CI/CD del proyecto DevSecOps.

---

## 2. Requisitos previos

Para realizar la publicación de imágenes se requiere:

- Cuenta activa en Docker Hub
- Repositorio del proyecto en GitHub
- Dockerfiles definidos por cada microservicio
- GitHub Actions configurado
- Secrets de autenticación configurados en GitHub

---

## 3. Arquitectura de microservicios

El proyecto está compuesto por los siguientes servicios:

servicios/
├── api-gateway/
├── frontend/
├── worker-report/
└── worker-scanner/


Cada servicio cuenta con su propio Dockerfile.

---

## 4. Repositorios en Docker Hub

Las imágenes se publican en los siguientes repositorios:

- danca0224/api-gateway
- danca0224/frontend
- danca0224/worker-report
- danca0224/worker-scanner

---

## 5. Configuración de autenticación

Se configuraron los siguientes secrets en GitHub:

| Secret | Descripción |
|------|--------|
| DOCKER_HUB_USERNAME | Usuario de Docker Hub |
| DOCKER_HUB_TOKEN | Token de acceso |

El token se genera en:

Docker Hub → Account Settings → Security → Access Tokens

---

## 6. Automatización con GitHub Actions

El proceso de publicación está automatizado mediante el archivo:

.github/workflows/docker-publish.yml


Este workflow realiza:

1. Checkout del repositorio
2. Autenticación en Docker Hub
3. Construcción de imágenes Docker
4. Publicación de imágenes

---

## 7. Construcción de imágenes

Ejemplo de construcción:

```bash
docker build -t danca0224/api-gateway:latest ./servicios/api-gateway


Este workflow realiza:

1. Checkout del repositorio
2. Autenticación en Docker Hub
3. Construcción de imágenes Docker
4. Publicación de imágenes

---

## 7. Construcción de imágenes

Ejemplo de construcción:

```bash
docker build -t danca0224/api-gateway:latest ./servicios/api-gateway


