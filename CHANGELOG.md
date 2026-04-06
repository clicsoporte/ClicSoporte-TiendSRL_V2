# Changelog - Clic-Tools

Registro de cambios y evolución de la plataforma Clic-Tools para gestión de MSP.

## [2.1.0] - 2024-05-22
### Añadido
- **Módulo Geográfico de Costa Rica**: Implementación de la jerarquía Provincias, Cantones y Distritos administrable en `Administración > Soporte Técnico`.
- **Inteligencia de Proveedores**: Matriz de servicios y precios (Remoto/Sitio) vinculada al catálogo de la empresa.
- **Gestión Avanzada de Márgenes**: Lógica de "Precio de Compra + Margen + IVA = Precio de Venta" para especialistas externos.
- **Seguridad Financiera**: Nuevo permiso `view:provider:costs` para ocultar costos de compra y márgenes a técnicos de nivel 1.
- **Zonificación de Viáticos**: Tarifario geográfico por proveedor para cálculo automático de transporte según la ubicación del cliente.
- **Gestión de Contactos**: Soporte para múltiples contactos en el registro de proveedores externos, igualando la funcionalidad de clientes.
- **Ubicación Geográfica en Clientes**: Los clientes ahora se vinculan a la división territorial oficial para automatizar la logística.

### Restaurado
- **Paquetes de Soporte**: Se recuperó la gestión de planes de soporte, lógica de redondeo y periodos de gracia (SLA).
- **Consecutivos de Tickets**: Configuración de prefijos y numeración manual para soporte técnico.

### Mejoras
- **Panel de Inteligencia en Tickets**: Ahora muestra el costo sugerido de labor y transporte al seleccionar un especialista.
- **Centro de Ayuda**: Actualización masiva con mini-tutoriales sobre SLAs, Cobertura y Módulo Geográfico.

## [2.0.0] - 2024-05-20
### Cambios Mayores
- **Arquitectura Single-DB**: Consolidación de 8 bases de datos fragmentadas en `intratool.db`.
- **Integridad Referencial**: Implementación de llaves foráneas globales para mejorar la consistencia de datos.
- **Migraciones Automáticas**: Sistema centralizado de actualización de esquema al iniciar la aplicación.

### Mejoras
- **Flicker-Free UI**: Optimización de estados de carga en Proyectos y Tickets para evitar parpadeos de interfaz.
- **Estandarización de Tipos**: Limpieza masiva de errores TypeScript y ESLint en todos los módulos.

## [1.5.0] - Anterior
- Versiones iniciales con múltiples archivos SQLite y módulos de Cotización, Costos y Soporte básico.
