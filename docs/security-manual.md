# Manual de Seguridad — ASM

## 1. Modelado de Amenazas

El modelo completo está disponible en formato OWASP Threat Dragon en:
[`docs/architecture/threat-model.json`](architecture/threat-model.json)

### Resumen STRIDE

| Categoría | Amenaza | Severidad | Estado |
|---|---|---|---|
| Spoofing | Suplantación de usuario | Alta | Mitigada — JWT + bcrypt |
| Tampering | Modificación de datos en tránsito | Media | Mitigada — Red interna Docker |
| Repudiation | Negación de escaneos | Baja | Mitigada — Audit log en DB |
| Information Disclosure | Filtración de secretos en código | Crítica | Mitigada — Gitleaks + .gitignore |
| Information Disclosure | Command injection via dominio | Crítica | Mitigada — Regex + args posicionales |
| Denial of Service | Abuso del endpoint de escaneo | Media | Abierta — Rate limiting pendiente |
| Elevation of Privilege | Acceso admin sin autorización | Alta | Mitigada — require_admin() |

---

## 2. Herramientas de Seguridad Integradas

### 2.1 Gitleaks (Detección de Secretos)
- **Cuándo:** En cada push a `main` y `develop`
- **Configuración:** `.github/workflows/ci.yml` → job `secrets-scan`
- **Alcance:** Todo el historial de commits (`fetch-depth: 0`)
- **Acción ante hallazgo:** El pipeline falla y notifica

### 2.2 Bandit (SAST Python)
- **Cuándo:** En cada push sobre la rama principal y ramas de integración
- **Alcance:** `servicios/api-gateway/app/`, `servicios/worker-scanner/`, `servicios/worker-report/`
- **Objetivo:** detectar patrones de seguridad inseguros en código Python
- **Exclusiones documentadas:** B101 y B601
- **Modo de ejecución en CI:** se conserva la evidencia de hallazgos sin bloquear el pipeline en fase académica, permitiendo análisis y remediación posterior

### 2.3 Semgrep (SAST multi-reglas)
- **Cuándo:** En cada push/PR
- **Reglas activas:** `p/python`, `p/owasp-top-ten`, `p/secrets`
- **Configuración:** `.github/workflows/ci.yml` → job `sast-scan`

### 2.4 Trivy (Escaneo de dependencias e imágenes)
- **Dependencias (SCA):** análisis sobre dependencias del backend y frontend
- **Imágenes Docker:** análisis posterior al build de cada microservicio
- **Cobertura:** sistema de archivos y contenedores
- **Modo en CI:** configurado para conservar evidencia de hallazgos y permitir continuidad del pipeline en entorno académico controlado
- **Objetivo:** visibilizar CVEs en dependencias y en imágenes finales antes de despliegue

### 2.5 OWASP ZAP (DAST)

- **Cuándo:** Después de pruebas unitarias y con entorno de staging levantado en CI
- **Tipo:** Baseline Scan
- **Target:** `http://localhost:8000`
- **Entorno:** Docker Compose efímero dentro de GitHub Actions

#### Autenticación en pruebas dinámicas

El pipeline implementa autenticación previa al escaneo mediante:

1. Creación automática de usuario administrador
2. Autenticación contra `/api/auth/token`
3. Obtención de token JWT dinámico
4. Uso del token en cabeceras de solicitudes (`Authorization: Bearer <token>`)

#### Capacidad diferencial

A diferencia de un escaneo tradicional no autenticado, este enfoque permite:

- Validar endpoints protegidos
- Evaluar lógica interna de negocio
- Simular comportamiento de usuario real autenticado

#### Reglas ignoradas

Definidas en `.zap/rules.tsv` para evitar falsos positivos en entorno académico.

### 2.6 Checkov (IaC Security)
- **Alcance:** Terraform, manifiestos Kubernetes y Docker Compose
- **Frameworks:** terraform, kubernetes y validación asociada a configuración de contenedores
- **Modo de ejecución:** ejecución directa por contenedor Docker en GitHub Actions
- **Comportamiento:** reporta hallazgos sin romper el pipeline
- **Justificación:** en entorno académico, el objetivo es evidenciar riesgos sin impedir la ejecución completa del pipeline, permitiendo análisis posterior y discusión técnica

### 2.7 Autenticación automática para pruebas dinámicas

El pipeline implementa autenticación automática contra la API antes de ejecutar análisis dinámicos y acciones funcionales sobre el sistema.

## 2.8 Entorno de Staging en CI/CD

El pipeline levanta un entorno temporal utilizando Docker Compose que incluye:

- API Gateway
- Base de datos PostgreSQL
- RabbitMQ
- Workers de procesamiento

Este entorno permite ejecutar pruebas dinámicas y análisis de seguridad en condiciones similares a producción.

### Características

- Entorno efímero (se destruye al finalizar el pipeline)
- Aislamiento completo dentro del runner
- Simulación de arquitectura real

### Beneficio de seguridad

Permite validar:

- Conectividad entre servicios
- Autenticación real
- Ejecución de lógica de negocio
- Exposición real de endpoints

#### Flujo aplicado en CI

1. Se levanta un entorno temporal de staging con Docker Compose.
2. Se crea un usuario administrador de forma automática.
3. Se realiza autenticación contra `/api/auth/token`.
4. Se obtiene un token JWT dinámico.
5. El token se reutiliza para invocar endpoints protegidos.
6. Se ejecuta un análisis ASM real desde la propia API antes de ZAP.

#### Valor de seguridad

Este enfoque permite validar no solo endpoints públicos, sino también el comportamiento de la aplicación en escenarios autenticados, acercando la validación a condiciones reales de operación.

---

## 3. Interpretación de Reportes

### Bandit
```json
{
  "results": [{
    "filename": "app/routers/scans.py",
    "test_id": "B608",
    "issue_severity": "MEDIUM",
    "issue_text": "..."
  }]
}
```
Clasificación: LOW / MEDIUM / HIGH. Solo HIGH bloquea el build.

### Trivy
```
CVE-2024-XXXXX | CRITICAL | libssl | 3.0.2 → 3.0.13
```
- CRITICAL sin excepción → build falla
- HIGH → warning en reporte

### ZAP
- **PASS**: Sin alertas
- **WARN**: Alertas informativas o de bajo riesgo
- **FAIL**: Alertas de riesgo alto — requiere análisis

---

## 4. Gestión de Vulnerabilidades

### Flujo de remediación

1. CI detecta vulnerabilidad → notificación automática al equipo
2. Analista evalúa: ¿falso positivo? ¿explotable?
3. Si es real: crear issue en GitHub con etiqueta `security`
4. Asignar a desarrollador → branch `fix/cve-XXXXX`
5. PR con corrección → CI debe pasar
6. Merge y tag de parche

### Tabla de hallazgos (ejemplo)

| Herramienta | CVE / Rule | Severidad | Componente | Estado |
|---|---|---|---|---|
| Trivy | CVE-2024-1234 | CRITICAL | cryptography==41.0.0 | Resuelto → 42.0.4 |
| Bandit | B608 | MEDIUM | scans.py:45 | Falso positivo — justificado |
| ZAP | 10202 | LOW | /api/auth/token | Aceptado — HTTPS en producción |

---

## 5. Política de Divulgación Responsable

Si descubres una vulnerabilidad en este proyecto:

1. **No publicar** hasta recibir confirmación de corrección
2. Enviar reporte a: **security@tu-organizacion.com** con:
   - Descripción detallada del hallazgo
   - Pasos para reproducir
   - Impacto estimado
   - Versión afectada
3. Recibirás respuesta en **72 horas hábiles**
4. Se te acreditará en el `CHANGELOG.md` (si lo deseas)

Seguimos el estándar [CVSS v3.1](https://www.first.org/cvss/) para clasificar severidad.

## 6. Resultados del Pipeline DevSecOps

La ejecución del pipeline permite validar múltiples capas del sistema en una sola corrida:

- Código fuente
- Dependencias
- Imágenes Docker
- Aplicación en ejecución
- Infraestructura como código

### Ejecución validada

Durante la implementación se validó exitosamente el siguiente flujo:

1. Construcción de imágenes por microservicio
2. Ejecución de pruebas unitarias
3. Levantamiento de entorno efímero de staging
4. Creación automática de usuario administrador
5. Generación de JWT por login programático
6. Ejecución de análisis ASM sobre la API
7. Ejecución de OWASP ZAP contra la API levantada
8. Ejecución de Checkov sobre Terraform, Kubernetes y Docker Compose
9. Apagado del entorno al finalizar

### Interpretación

Este pipeline demuestra un enfoque DevSecOps real, donde la seguridad no se limita al código fuente, sino que cubre también infraestructura, dependencias, imágenes y comportamiento dinámico en runtime.

## 7. Valor del enfoque DevSecOps

La principal ventaja del enfoque implementado es que la seguridad se integra desde etapas tempranas y se mantiene activa durante todo el ciclo de vida del software.

### Beneficios obtenidos

- Detección temprana de errores de configuración
- Visibilidad sobre vulnerabilidades en dependencias e imágenes
- Validación de la aplicación en ejecución
- Automatización del aseguramiento mínimo antes de despliegue
- Evidencia reproducible para auditoría técnica y académica

### Diferencial del proyecto

El proyecto no se limita a ejecutar herramientas aisladas. Implementa una cadena completa de validación técnica que integra:
- autenticación automática,
- análisis de superficie de ataque,
- pruebas dinámicas,
- validación de infraestructura,
- y levantamiento temporal de servicios para pruebas reales.

### Alineación con prácticas modernas

El enfoque implementado se alinea con principios de:

- Shift Left Security
- Continuous Security Testing
- DevSecOps Automation

Permitiendo integrar seguridad desde el desarrollo hasta la ejecución en runtime.
