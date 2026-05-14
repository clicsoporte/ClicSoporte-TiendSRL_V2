# Changelog - Clic-Tools

Registro de cambios y evolución de la plataforma Clic-Tools para gestión de MSP.

## [2.4.0] - 2024-05-28
### Añadido (Certificación de Producción)
- **Blindaje de Identidad (Free)**: El flujo de restauración de licencias gratuitas ahora exige que el correo coincida con el registro original de hardware para evitar suplantación de identidad.
- **Trazabilidad de Fraude**: Registro automático de advertencias (`logWarn`) en el servidor ante intentos de activación Multi-PC o uso de licencias Premium en equipos no autorizados.
- **SDK v3.8.4 (Infalible)**: Sincronización total de las rutas del objeto JSON en los ejemplos de Publicidad y Activación.
- **Documentación de Throttling**: El SDK ahora especifica el límite de 1 minuto entre solicitudes OTP para el manejo de interfaces en el software hijo.

## [2.3.2] - 2024-05-28
### Añadido (Seguridad y UX)
- **Validación Cruzada de Perpetuidad**: El sistema ahora impide emitir licencias "(perpetua)" si el software no tiene habilitada esta capacidad técnica en el Catálogo de Software.
- **Sincronización de Interfaz**: Se actualizó la etiqueta "Sin vencimiento" a "Sin vencimiento (perpetua)" para mayor claridad comercial.
- **Advertencias Contextuales**: Nuevo aviso en el formulario de emisión que indica cuando una licencia no puede ser perpetua debido a la configuración global del producto.

## [2.3.1] - 2024-05-27
### Añadido (Blindaje de Producción)
- **Throttling de Seguridad (OTP)**: Límite de 1 minuto entre solicitudes de código para un mismo correo para proteger el servidor SMTP.
- **Protección Multi-PC**: La API de activación ahora deniega el uso de una misma licencia en distintos equipos mediante el bloqueo estricto de Hardware ID.
- **Detección de Equipos Duplicados**: Prevención de segundas activaciones para el mismo software en un equipo que ya posee una licencia activa.
- **Respaldo Criptográfico Automático**: El motor de mantenimiento ahora incluye la carpeta `/keys` en los backups, garantizando la persistencia de las firmas RSA tras una restauración.
- **Permiso de Licencia Perpetua**: Nuevo permiso `licenses:perpetual:assign` y flujo de doble verificación para evitar emisiones accidentales de licencias sin vencimiento.

### Mejoras (SDK v3.8.3)
- **SDK Hardened**: Actualizada la documentación para reflejar el throttling de OTP y corregir las rutas de acceso al JSON firmado de Publicidad Dinámica.
- **Mensajería de Error Enriquecida**: Las fallas de activación ahora incluyen datos de contacto oficiales (Email/WhatsApp) para el cliente final.
- **Saneamiento UI**: Alineación de términos a "Licencia Perpetua" en todo el sistema.
