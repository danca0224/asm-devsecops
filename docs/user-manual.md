# Manual de Usuario — ASM Attack Surface Manager

## ¿Qué es ASM?

ASM es una plataforma de análisis de superficie de ataque externa. Permite identificar qué activos digitales (subdominios, puertos, tecnologías) de un dominio son visibles desde Internet, y evalúa su nivel de exposición.

---

## 1. Acceso a la Plataforma

1. Abrir el navegador y acceder a `http://TU_IP:3000`
2. Ingresar usuario y contraseña
3. Hacer clic en **Iniciar sesión**

> El sistema usa tokens JWT. La sesión expira después de 60 minutos de inactividad.

---

## 2. Análisis Individual

### 2.1 Solicitar un análisis

1. En el Dashboard, ingresa el dominio en el campo de texto (ej: `ejemplo.com`)
2. Haz clic en **Ejecutar análisis**
3. El análisis queda en estado **Pendiente** → **En ejecución** → **Completado**

> El análisis puede tomar entre 5 y 15 minutos dependiendo de la cantidad de subdominios y la velocidad de respuesta del objetivo.

### 2.2 Consultar resultados

- Una vez completado, aparece el botón **Ver informe →**
- Haz clic para acceder a la página de detalle del escaneo

### 2.3 Descargar informe PDF

En la página de detalle, haz clic en **↓ Descargar** junto al informe PDF.
El informe incluye:
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
