# Changelog - Clic-Tools

Registro de cambios y evolución de la plataforma Clic-Tools para gestión de MSP.

## [2.2.0] - 2024-05-25
### Añadido
- **Escudo de Rentabilidad**: Nuevo sistema de monitorización financiera en Proyectos TI. Calcula el margen de contribución real restando materiales, subcontratos y mano de obra interna del presupuesto de venta.
- **Vigilancia Proactiva (Scheduler)**: Tareas automáticas que escanean el sistema diariamente buscando vencimientos de contratos y licencias (alertas a 30, 15 y 7 días).
- **Inteligencia Gerencial (Analytics)**: Reportes BI con desgloses de tickets por cliente, por tema de ayuda y por tipo de servicio.
- **Mensajería Híbrida**: Soporte para el placeholder `[TELEGRAM_CLIENTE]` en el motor de notificaciones, permitiendo alertas directas a clientes vía bot de Telegram.
- **Traducción 100%**: Localización total al español de todos los permisos granulares y roles del sistema.

### Mejoras
- **Seguridad Financiera**: Los costos de compra y márgenes netos ahora están estrictamente ocultos para roles técnicos en todo el sistema (Proyectos y Analíticas).
- **Fórmula de Venta de Proveedores**: Se corrigió el cálculo de precios sugeridos para incluir el IVA digitalizado manualmente.
- **Eliminación de Flickering**: Optimización de estados de carga en el AuthProvider para evitar parpadeos de interfaz durante la navegación.
- **Limpieza Estructural**: Eliminación masiva de código muerto e importaciones huérfanas detectadas por ESLint.

## [2.1.2] - 2024-05-24
### Añadido
- **Base Geográfica Oficial**: Carga completa de las 7 provincias, 82 cantones y ~480 distritos de Costa Rica.
- **Sistema de Seeding**: Implementación de un motor de semillas automático que asegura que los datos geográficos estén siempre actualizados.

## [2.1.1] - 2024-05-23
### Añadido
- **Modalidades de Cobro en Servicios**: Soporte para servicios facturables "Por Hora" o "Por Tarea" (monto fijo).

## [2.1.0] - 2024-05-22
### Añadido
- **Módulo Geográfico de Costa Rica**: Jerarquía territorial administrable para viáticos.
- **Inteligencia de Proveedores**: Matriz de servicios y precios (Remoto/Sitio) vinculada al catálogo.

## [2.0.0] - 2024-05-20
### Cambios Mayores
- **Arquitectura Single-DB**: Consolidación de 8 bases de datos fragmentadas en `intratool.db`.
- **Integridad Referencial**: Implementación de llaves foráneas globales.
