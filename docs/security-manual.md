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
- **Cuándo:** En cada push/PR
- **Alcance:** `servicios/api-gateway/app/`, `worker-scanner/`, `worker-report/`
- **Nivel de severidad reportado:** MEDIUM+
- **Exclusiones documentadas:** B101 (assert en tests), B601 (shell=True en scripts conocidos)

### 2.3 Semgrep (SAST multi-reglas)
- **Cuándo:** En cada push/PR
- **Reglas activas:** `p/python`, `p/owasp-top-ten`, `p/secrets`
- **Configuración:** `.github/workflows/ci.yml` → job `sast-scan`

### 2.4 Trivy (Escaneo de dependencias e imágenes)
- **Dependencias (SCA):** `requirements.txt` y `package.json` en cada PR
- **Imágenes Docker:** Después del build, severidad CRITICAL = falla automática
- **Acción:** Pipeline falla si hay CVE crítico sin excepción documentada

### 2.5 OWASP ZAP (DAST)
- **Cuándo:** Después de pruebas unitarias, contra entorno de staging levantado en CI
- **Tipo:** Baseline Scan (pasivo, sin fuzzing agresivo)
- **Target:** `http://localhost:8000` (API Gateway)
- **Reglas ignoradas:** Ver `.zap/rules.tsv`

### 2.6 Checkov (IaC Security)
- **Alcance:** `infraestructura/terraform/`, `orquestacion/k8s/`, `docker-compose.yml`
- **Frameworks:** terraform, kubernetes, dockerfile
- **Modo:** `soft_fail: true` (reporta pero no bloquea el pipeline)

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
