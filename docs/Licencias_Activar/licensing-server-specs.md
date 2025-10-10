# Especificaciones Técnicas para el Servidor de Licencias - Clic Cola

Este documento describe los requisitos técnicos que el servidor de licencias debe cumplir para integrarse correctamente con la aplicación de gestión de colas **Clic Cola**.

---

## 1. Flujo de Activación Unificado

1.  **Creación del Cliente:** Un administrador crea una cuenta para el cliente en el panel del servidor de licencias (fuera del alcance de esta API).
2.  **Generación de Licencia:** El administrador genera una `licenseKey` para ese cliente.
3.  **Entrega de la Clave:** El administrador entrega la `licenseKey` al cliente final.
4.  **Activación en la App:** El cliente introduce la `licenseKey` en la aplicación Clic Cola.
5.  **Validación y Sincronización:** La aplicación Clic Cola llama al endpoint de validación, enviando la `licenseKey` y la información del hardware/empresa. El servidor valida la clave contra su `hardwareId` asociado y actualiza los datos del cliente.

---

## 2. Endpoint de Validación de Licencia

La aplicación cliente realizará todas las validaciones a través de un único endpoint.

-   **URL:** `https://[DOMINIO_DE_LICENCIAS]/api/v1/license/validate`
-   **Método HTTP:** `POST`
-   **Content-Type:** `application/json`

El `[DOMINIO_DE_LICENCIAS]` es configurable desde la aplicación cliente.

---

## 3. Estructura de la Petición (`Request Body`)

El cliente enviará un objeto JSON con la siguiente estructura:

```json
{
  "licenseKey": "string",
  "hardwareId": "string",
  "hostname": "string",
  "version": "string",
  "publicIp": "string",
  "companyName": "string",
  "companyId": "string",
  "contactPhone": "string",
  "contactEmail": "string",
  "country": "string",
  "address": "string"
}
```

-   **`licenseKey` (string):** La clave de licencia para activar/validar.
-   **`hardwareId` (string):** Un hash SHA-256 que identifica de forma única al hardware.
-   **`hostname` (string):** El nombre de host del sistema operativo.
-   **`version` (string):** La versión actual de la aplicación Clic Cola.
-   **`publicIp` (string):** La dirección IP pública del servidor donde corre la app.
-   **`companyName` a `address` (string):** Información de la empresa del cliente. El servidor debe usar estos datos para crear o actualizar el registro del cliente asociado a la licencia.

### Generación del `hardwareId`

El `hardwareId` se genera a partir de la concatenación de las siguientes propiedades del sistema operativo, separadas por un guion, y luego hasheadas con SHA-256:

1.  `os.hostname()`
2.  `os.platform()`
3.  `os.arch()`
4.  `os.userInfo().username`

**Ejemplo (antes del hash):** `NOMBREEQUIPO-win32-x64-NombreUsuario`

---

## 4. Estructura de la Respuesta (`Response Body`)

El servidor debe responder con un objeto JSON que contenga el estado de la validación.

```json
{
  "status": "string",
  "message": "string"
}
```

-   **`status` (string):** Un código que representa el resultado. Debe ser uno de los valores listados a continuación.
-   **`message` (string):** Un mensaje descriptivo y legible para el usuario final.

### Valores para `status`

El campo `status` es **crítico** y debe ser uno de los siguientes:

-   **`VALID`**: La licencia es válida y está activa para el `hardwareId` proporcionado.
-   **`INVALID_KEY`**: La `licenseKey` no existe, es incorrecta o no coincide con el `hardwareId` registrado.
-   **`EXPIRED`**: La licencia ha expirado.
-   **`BLOCKED`**: La licencia ha sido bloqueada o desactivada por un administrador.

---

## 5. Lógica del Servidor y Flujo de Trabajo

1.  **Primera Activación:** Cuando se recibe una `licenseKey` válida que no tiene un `hardwareId` asociado, el servidor debe guardar el `hardwareId` de la petición y vincularlo a esa clave.
2.  **Validaciones Posteriores:** Si la `licenseKey` ya tiene un `hardwareId` asociado, el servidor debe verificar que el `hardwareId` de la petición coincida con el almacenado.
3.  **Sincronización (Heartbeat):** La aplicación cliente realizará esta misma llamada periódicamente (cada 24 horas). El servidor debe validar el par `licenseKey`/`hardwareId`, actualizar los datos de la empresa si han cambiado, y devolver el estado actual de la licencia.
4.  **API Exclusiva para Validación:** La API **no** debe permitir la creación de licencias. Es exclusivamente para validar y sincronizar licencias preexistentes.
