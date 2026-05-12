# Changelog - Clic-Tools

Registro de cambios y evolución de la plataforma Clic-Tools para gestión de MSP.

## [2.3.0] - 2024-05-26
### Añadido (Arquitectura de Cumplimiento Dinámico)
- **Motor de Políticas de Conexión**: Ahora el administrador puede definir cada cuántos días debe conectarse el software hijo para validar su licencia y publicidad.
- **Inyección de Políticas en RSA**: Las reglas de conexión viajan dentro del payload firmado, impidiendo que el cliente las altere localmente.
- **Protección Anti-Reloj**: Algoritmo LKT (Last Known Time) para detectar si el usuario atrasa la fecha del servidor para evitar bloqueos.
- **Lógica de Nag-Screen**: Componente sugerido en SDK para versiones Free que bloquea la pantalla 60s si falla la carga de anuncios.

### Mejoras (SDK v3.8.0)
- **SDK Consolidado**: Se añadieron pestañas de Políticas de Conexión, Verificación Inteligente y UI de Sincronización Manual.
- **Higiene Automatizada**: El Scheduler ahora purga códigos OTP expirados cada medianoche para optimizar la base de datos.
- **Blindaje de Leads**: La API de registro gratuito ya no sobrescribe datos de clientes Premium existentes.

## [2.2.5] - 2024-05-25
### Añadido
- **Editor Visual de Plantillas**: Nueva pestaña en Automatizaciones para editar el HTML de correos y el formato de Telegram sin tocar código.
- **Soporte de Variables dinámicas**: Sistema de "copiar al clic" para inyectar datos de tickets y licencias en los mensajes.
- **Previsualización Real-time**: Diálogo para ver cómo quedará el correo HTML antes de guardarlo.

## [2.2.1] - 2024-05-25
### Corregido
- **Fuga de Identidad (OTP)**: Implementación de validación por correo para registros gratuitos, evitando spam de licencias Free.
- **Firmado RSA-SHA256**: Migración de licencias de texto plano a objetos JSON firmados criptográficamente.

## [2.2.0] - 2024-05-25
### Añadido
- **Escudo de Rentabilidad**: Monitorización financiera en Proyectos TI.
- **Vigilancia Proactiva (Scheduler)**: Escaneo diario de vencimientos.
- **Inteligencia Gerencial (Analytics)**: Reportes BI y analíticas globales.
