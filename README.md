# Clic-Tools: Documentación Técnica y Manual de Usuario

**Clic-Tools v2.2.0** es una aplicación web interna diseñada para centralizar y automatizar herramientas y procesos empresariales clave. El objetivo es proporcionar una plataforma sencilla, rápida, segura y altamente configurable, optimizada para su uso en una red local (LAN) y enfocada en las necesidades de un Proveedor de Servicios Gestionados (MSP).

---

## 1. Arquitectura y Filosofía

-   **Stack Tecnológico**:
    -   **Framework**: Next.js 14+ (con App Router).
    -   **Lenguaje**: TypeScript.
    -   **UI**: React, Tailwind CSS, ShadCN UI y Lucide React (iconos).
    -   **Fuente Única de Verdad**: El sistema utiliza un único motor `better-sqlite3` sobre la base de datos centralizada `intratool.db`. Esto garantiza alta velocidad, funcionamiento offline y, sobre todo, integridad referencial total entre todos los módulos.
    -   **Conectividad ERP**: Soporte para `mssql` para conexión directa y de solo lectura a bases de datos de SQL Server para sincronización de datos maestros.

-   **Filosofía de Diseño**:
    -   **Server-Centric**: La mayor parte de la lógica crítica se ejecuta en el servidor (`'use server'`), mejorando la seguridad y el rendimiento.
    -   **Integridad Centralizada**: Al utilizar una única base de datos, el sistema permite relaciones complejas y seguras. Por ejemplo, un Ticket de Soporte puede validar en tiempo real si existe un Contrato vigente o si el Cliente está bloqueado administrativamente.
    -   **Independencia y Resiliencia**: Los datos del ERP (clientes, productos, etc.) se **sincronizan** a la base de datos local. Esto significa que la aplicación es extremadamente rápida y puede seguir funcionando incluso si el servidor del ERP no está disponible temporalmente.
    -   **Doble Modo de Importación**:
        1.  **Desde Archivos**: El método tradicional, cargando datos desde archivos de texto (`.txt` o `.csv`). Ideal para una configuración rápida o como método de respaldo.
        2.  **Desde SQL Server**: El método recomendado. Conecta directamente a la base de datos del ERP (con un usuario de **solo lectura**) para sincronizar los datos.
    -   **Gestor de Consultas Dinámico**: Para el modo SQL, las consultas `SELECT` se configuran desde la interfaz de administración, permitiendo adaptar la aplicación a cambios en la estructura del ERP sin necesidad de modificar el código fuente.

---

## 2. Estructura del Proyecto

-   `src/app/`: Contiene las rutas y páginas de la aplicación.
    -   `(auth)/`: Páginas de autenticación (login).
    -   `dashboard/`: Layout y páginas del panel de control principal.
-   `src/components/`: Componentes de React reutilizables (UI, Layout).
-   `src/modules/`: El corazón de la aplicación, organizado por funcionalidad.
    -   `core/`: Lógica compartida (autenticación, tipos, hooks, conexión a BD central).
    -   `quoter/`, `planner/`, `tickets/`, `licenses/`, `analytics/`, etc.: Módulos de negocio que consumen la base de datos única.
-   `src/lib/`: Utilidades generales.
-   `dbs/`: **Directorio persistente** donde se almacena el archivo `intratool.db` y sus respaldos.
-   `.env.local`: Archivo donde se almacenan las credenciales de SQL Server y claves de API.

---

## 3. Guía de Módulos (Funcionalidades)

### 3.1. Soporte Técnico (Tickets) (`/dashboard/tickets`)
- **Gestión Centralizada:** Gestión del ciclo de vida de incidentes.
- **Validación de Cobertura:** Al crear un ticket, el sistema verifica automáticamente si el cliente tiene un Contrato de Soporte vigente o un Paquete de Horas, marcando el ticket como "Facturable" o "Bajo Contrato" según corresponda.
- **Control de Tiempo:** Cronómetro integrado por ticket para registro de horas hombre.

### 3.2. Gestor de Proyectos TI (`/dashboard/planner`)
- **Escudo de Rentabilidad:** Control financiero que resta materiales y mano de obra interna del presupuesto de venta para evitar pérdidas.
- **Bitácora de Avances:** Registro histórico de hitos y adjuntos.

### 3.3. Cotizador (`/dashboard/quoter`)
- **Creación Rápida:** Generación de proformas PDF con validación de exoneraciones en tiempo real vía API de Hacienda.

### 3.4. Gestión de Licencias (`/dashboard/licenses`)
- **Vigilante de Vencimientos:** Escaneo diario automático que notifica sobre licencias de software próximas a expirar.

### 3.5. Analíticas (`/dashboard/analytics`)
- **BI Operativo:** Reportes de rendimiento técnico, rentabilidad por modalidad de cobro y volumen por cliente.

---

## 4. Proceso de Sincronización de Datos

Gestionado desde **Administración > Importar Datos**.

### Modo SQL Server (Recomendado)
1.  Configurar credenciales en `.env.local`.
2.  Definir consultas SELECT que mapeen las columnas del ERP a los nombres esperados por Clic-Tools (ej: `ID_Cliente AS CLIENTE`).
3.  Ejecutar la sincronización para actualizar Clientes, Productos, Exoneraciones y Existencias en la base de datos local.

---

## 5. Instalación y Despliegue

1.  **Instalar dependencias**: `npm install`
2.  **Configurar Entorno**: Crear `.env.local` con las credenciales necesarias.
3.  **Ejecutar**: `npm run dev` (Desarrollo) o `npm run build && npm run start` (Producción).

---

## 6. Proceso de Actualización y Backup

**¡IMPORTANTE!**: Al usar una arquitectura de base de datos única, el respaldo es ahora más sencillo pero más crítico.

1.  **Backup**: Copie el archivo `dbs/intratool.db` a una ubicación segura antes de cualquier actualización.
2.  **Migración Automática**: El sistema detecta cambios en el esquema al iniciar y aplica las columnas o tablas faltantes sin borrar los datos existentes.
3.  **Restauración**: En caso de error, el Centro de Mantenimiento permite cargar un archivo `.db` anterior para restaurar el estado completo del sistema.

---

## 7. Créditos y Licencia

Desarrollado y mantenido por CLIC SOPORTE Y CLIC TIENDA S.R.L. bajo **Licencia MIT**.