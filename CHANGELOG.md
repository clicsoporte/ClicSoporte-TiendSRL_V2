# Changelog - Clic-Tools

Registro de cambios y evolución de la plataforma Clic-Tools para gestión de MSP.

## [2.1.0] - 2024-05-22
### Añadido
- **Módulo Geográfico de Costa Rica**: Implementación de la jerarquía Provincias, Cantones y Distritos administrable.
- **Inteligencia de Proveedores**: Matriz de servicios y precios (Remoto/Sitio) vinculada al catálogo de la empresa.
- **Zonificación de Viáticos**: Tarifario geográfico por proveedor para cálculo automático de transporte.
- **Gestión de Contactos**: Se añadió soporte para múltiples contactos en el registro de proveedores externos.
- **Ubicación Geográfica en Clientes**: Ahora los clientes se vinculan a la división territorial oficial.

### Restaurado
- **Paquetes de Soporte**: Se recuperó la gestión de planes de soporte, lógica de redondeo y periodos de gracia.
- **Consecutivos de Tickets**: Configuración de prefijos y numeración manual para soporte técnico.

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
