# Manual de Usuario — ASM Attack Surface Manager

## ¿Qué es ASM?

ASM es una plataforma de análisis de superficie de ataque externa. Permite identificar qué activos digitales (subdominios, puertos, tecnologías) de un dominio son visibles desde Internet, y evalúa su nivel de exposición.

---

## 1. Acceso a la Plataforma (Local y Producción)

1. Abrir el navegador y acceder a:

   - Entorno local: `http://localhost:3000`
   - Entorno desplegado: `http://<IP_SERVIDOR>:3000`

2. Ingresar usuario y contraseña
3. Hacer clic en **Iniciar sesión**

> Nota: en el pipeline CI/CD la aplicación se ejecuta de forma interna en el runner, por lo que no es accesible vía navegador. En ese contexto, la API se consume directamente en `http://localhost:8000`.

> El sistema usa tokens JWT. La sesión expira después de 60 minutos de inactividad.

---

## 2. Análisis Individual

### 2.1 Solicitar un análisis

1. En el Dashboard, ingresa el dominio en el campo de texto (ej: `ejemplo.com`)
2. Haz clic en **Ejecutar análisis**
3. El análisis queda en estado **Pendiente** → **En ejecución** → **Completado**
4. Mientras se procesa, el dashboard muestra el progreso visual y el estado del análisis más reciente

> El análisis puede tomar entre 5 y 15 minutos dependiendo de la cantidad de subdominios y la velocidad de respuesta del objetivo.

### 2.2 Consultar resultados

- Una vez completado, aparece el botón **Ver informe →**
- Haz clic para acceder a la página de detalle del escaneo

> El dashboard principal muestra los escaneos recientes, su estado, y el acceso directo al detalle del análisis mediante el botón **Ver informe →**.

### 2.3 Descargar informes

En la página de detalle del escaneo, abre la pestaña **Informes** y usa el botón **Descargar** sobre el reporte generado.

El sistema puede mostrar uno o varios informes asociados al escaneo, según el procesamiento realizado.

Cada informe puede incluir:
- Resumen de criticidad global
- Tabla de hallazgos por categoría
- Detalle de activos analizados

---

## 3. Vista Consolidada

Accede desde el menú superior → **Consolidado**

Muestra datos agregados de **todas las entidades** previamente escaneadas:
- Total de activos y entidades analizadas
- Gráfica de hallazgos por categoría
- Tabla comparativa multientidad

Ideal para análisis de riesgo organizacional o seguimiento de un portafolio de dominios.

---

## 4. Administración de Usuarios (solo Admin)

Accede desde el menú superior → **Usuarios**

### Crear usuario
1. Ingresa nombre de usuario, contraseña y rol (`user` o `admin`)
2. Haz clic en **Crear**

### Eliminar usuario
1. Ubica el usuario en la tabla
2. Haz clic en **Eliminar**

> No es posible eliminar el usuario `admin` principal ni eliminarte a ti mismo.

---

## 5. Categorías de Hallazgos

| Categoría | Descripción | Severidad |
|---|---|---|
| Subdominios huérfanos | Subdominios sin IP activa | Media |
| Sin SPF/DKIM/DMARC | Configuración de correo insegura | Alta |
| Software expuesto | Versión de servidor visible | Alta |
| Puertos de administración | Puertos sensibles abiertos | Alta |
| Cabeceras HTTP ausentes | HSTS, CSP, X-Frame-Options | Media |
| Certificado SSL inválido | Expirado, inválido o ausente | Alta |
| TLS obsoleto | TLS 1.0 o 1.1 habilitado | Media |
| Cifrados débiles | RC4, CBC, DES, NULL | Media |

## 6. Consideraciones de Uso

- La plataforma está diseñada para análisis OSINT y de superficie de ataque externa.
- El tiempo de procesamiento puede variar según el dominio objetivo.
- La disponibilidad de informes depende de la correcta finalización del escaneo y del procesamiento de resultados.
- Algunos análisis pueden reflejar estados temporales como `Pendiente`, `En ejecución`, `Completado` o `Error`.
