/**
 * @fileoverview Este archivo centraliza todos los permisos y su lógica jerárquica.
 * Organizado por módulos para facilitar la gestión en la UI de Roles.
 */

export const permissionGroups = {
    "Acceso General": ["dashboard:access", "dashboard:stats:view"],
    "Cotizador": ["quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete"],
    "Soporte Técnico": [
        "tickets:read:all", "tickets:create", "tickets:reply", "tickets:manage", 
        "tickets:time-tracking", "tickets:delete", "tickets:admin:settings",
        "tickets:license:assign", "tickets:license:view"
    ],
    "Clientes": [
        "customers:read", "customers:contacts:read", "customers:create", "customers:update", "customers:delete", "customers:update:plan"
    ],
    "Inventario y Garantías": [
        "inventory:read", "inventory:manage", "inventory:warranty:hub", "inventory:consumables:update"
    ],
    "Contratos": [
        "contracts:read", "contracts:create", "contracts:update", "contracts:delete"
    ],
    "Gestión de Licencias": [
        "licenses:read", "licenses:manage", "licenses:admin:keys", "licenses:perpetual:assign"
    ],
    "Proyectos TI": [
        "planner:read", "planner:create", "planner:status:approve", "planner:status:in-progress", 
        "planner:status:completed", "planner:priority:update", "planner:financials:view"
    ],
    "Herramientas de TI": [
        "it-tools:access", "it-tools:notes:read", "it-tools:notes:create", "it-tools:notes:update", "it-tools:notes:delete"
    ],
    "Hacienda": ["hacienda:query"],
    "Asistente de Costos": [
        "cost-assistant:access", "cost-assistant:view", "cost-assistant:process", 
        "cost-assistant:margins", "cost-assistant:export"
    ],
    "Marketing Dinámico": ["admin:marketing:manage"],
    "Facturación y Finanzas": ["billing:manage", "view:provider:costs", "providers:manage", "providers:read"],
    "Gestión de Usuarios": ["users:create", "users:read", "users:update", "users:delete"],
    "Gestión de Roles": ["roles:create", "roles:read", "roles:update", "roles:delete"],
    "Administración del Sistema": [
        "admin:access",
        "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:stock",
        "admin:suggestions:read", "admin:import:run", "admin:import:files", "admin:import:sql", "admin:import:sql-config",
        "admin:logs:read", "admin:logs:clear",
        "admin:maintenance:backup", "admin:maintenance:restore", "admin:maintenance:reset"
    ],
    "Super Admin": ["admin:all"]
};

export const permissionTranslations: Record<string, string> = {
    "dashboard:access": "Acceso al Panel Principal",
    "dashboard:stats:view": "Ver Resumen de Operaciones",
    "quotes:create": "Cotizador: Crear Proformas",
    "quotes:generate": "Cotizador: Generar PDF",
    "quotes:drafts:create": "Cotizador: Guardar Borradores",
    "quotes:drafts:read": "Cotizador: Ver Borradores",
    "quotes:drafts:delete": "Cotizador: Borrar Borradores",
    "tickets:create": "Tickets: Abrir Casos",
    "tickets:read:all": "Tickets: Ver Todos los Casos",
    "tickets:reply": "Tickets: Responder / Notas",
    "tickets:manage": "Tickets: Gestión (Estado/Asignación)",
    "tickets:time-tracking": "Tickets: Control de Tiempo",
    "tickets:delete": "Tickets: Eliminar Casos",
    "tickets:admin:settings": "Tickets: Configuración Avanzada",
    "tickets:license:assign": "Tickets: Vincular Licencias",
    "tickets:license:view": "Tickets: Ver Claves de Activación",
    "customers:read": "Clientes: Ver Listado",
    "customers:contacts:read": "Clientes: Ver Contactos (Sin Editar)",
    "customers:create": "Clientes: Crear Nuevo",
    "customers:update": "Clientes: Editar Datos",
    "customers:delete": "Clientes: Eliminar",
    "customers:update:plan": "Clientes: Cambiar Plan de Soporte",
    "inventory:read": "Inventario: Ver Equipos",
    "inventory:manage": "Inventario: Gestionar Hardware",
    "inventory:warranty:hub": "Inventario: Panel de Garantías",
    "inventory:consumables:update": "Inventario: Editar Insumos",
    "contracts:read": "Contratos: Ver Listado",
    "contracts:create": "Contratos: Crear Nuevo",
    "contracts:update": "Contratos: Editar / Renovar",
    "contracts:delete": "Contratos: Eliminar",
    "licenses:read": "Licencias: Ver Listado",
    "licenses:manage": "Licencias: Crear / Editar",
    "licenses:admin:keys": "Licencias: Gestión de Claves",
    "licenses:perpetual:assign": "Licencias: Autorizar Licencias Perpetuas",
    "it-tools:access": "IT-Tools: Acceso General",
    "it-tools:notes:read": "Notas TI: Ver Listado",
    "it-tools:notes:create": "Notas TI: Crear Nueva",
    "it-tools:notes:update": "Notas TI: Editar Notas",
    "it-tools:notes:delete": "Notas TI: Eliminar Notas",
    "planner:read": "Proyectos: Ver Listado",
    "planner:create": "Proyectos: Crear Nuevo",
    "planner:status:approve": "Proyectos: Aprobar Fases",
    "planner:status:in-progress": "Proyectos: Iniciar Ejecución",
    "planner:status:completed": "Proyectos: Finalizar",
    "planner:priority:update": "Proyectos: Cambiar Prioridad",
    "planner:financials:view": "Proyectos: Ver Rentabilidad (Escudo)",
    "hacienda:query": "Hacienda: Consultas de Contribuyentes",
    "cost-assistant:access": "Asist. Costos: Acceso General",
    "cost-assistant:view": "Asist. Costos: Ver Módulo",
    "cost-assistant:process": "Asist. Costos: Procesar XML",
    "cost-assistant:margins": "Asist. Costos: Editar Márgenes",
    "cost-assistant:export": "Asist. Costos: Exportar Excel",
    "admin:marketing:manage": "Marketing: Gestionar Publicidad Global",
    "billing:manage": "Facturación: Auditar y Conciliar",
    "providers:read": "Proveedores: Ver Catálogo",
    "providers:manage": "Proveedores: Gestionar Tarifas",
    "view:provider:costs": "Supervisor: Ver Costos y Utilidad",
    "users:read": "Usuarios: Ver Listado",
    "users:create": "Usuarios: Crear Nuevo",
    "users:update": "Usuarios: Editar / Clave",
    "users:delete": "Usuarios: Eliminar",
    "roles:read": "Roles: Ver Listado",
    "roles:create": "Roles: Crear Nuevo",
    "roles:update": "Roles: Editar Permisos",
    "roles:delete": "Roles: Eliminar",
    "admin:access": "Admin: Acceso a Configuración",
    "admin:settings:general": "Admin: Configuración Empresa",
    "admin:settings:api": "Admin: Enlaces API",
    "admin:settings:planner": "Admin: Ajustes Proyectos",
    "admin:settings:stock": "Admin: Ajustes Inventario",
    "admin:suggestions:read": "Admin: Ver Sugerencias",
    "admin:import:run": "Admin: Sincronizar con ERP",
    "admin:import:files": "Admin: Importar desde Archivos",
    "admin:import:sql": "Admin: Importar desde SQL Server",
    "admin:import:sql-config": "Admin: Configurar Consultas SQL",
    "admin:logs:read": "Admin: Ver Logs del Sistema",
    "admin:logs:clear": "Admin: Limpiar Logs",
    "admin:maintenance:backup": "Admin: Gestión de Backups",
    "admin:maintenance:restore": "Admin: Restaurar Sistema",
    "admin:maintenance:reset": "Admin: Reseteo de Fábrica (Peligro)",
    "admin:all": "Administrador Total (Control Total)"
};

export type AppPermission = keyof typeof permissionTranslations;

/**
 * Define las dependencias jerárquicas.
 * La llave es el PADRE (Avanzado). El valor es un arreglo de HIJOS (Requisitos).
 */
export const permissionTree: Record<string, string[]> = {
    "admin:access": ["dashboard:access"],
    "tickets:read:all": ["dashboard:access"],
    "customers:read": ["dashboard:access"],
    "inventory:read": ["dashboard:access"],
    "contracts:read": ["dashboard:access"],
    "planner:read": ["dashboard:access"],
    "licenses:read": ["dashboard:access"],
    "it-tools:access": ["dashboard:access"],
    "analytics:read": ["dashboard:access"],
    "billing:manage": ["dashboard:access"],
    "cost-assistant:access": ["dashboard:access"],
    "hacienda:query": ["dashboard:access"],

    "licenses:manage": ["licenses:read"],
    "licenses:admin:keys": ["admin:access"],
    "licenses:perpetual:assign": ["licenses:manage"],
    "admin:marketing:manage": ["admin:access"],

    "inventory:manage": ["inventory:read"],
    "inventory:warranty:hub": ["inventory:read"],
    "inventory:consumables:update": ["inventory:manage"],

    "it-tools:notes:read": ["it-tools:access"],
    "it-tools:notes:create": ["it-tools:notes:read"],
    "it-tools:notes:update": ["it-tools:notes:read"],
    "it-tools:notes:delete": ["it-tools:notes:read"],

    "tickets:admin:settings": ["tickets:manage"],
    "tickets:manage": ["tickets:read:all"],
    "tickets:time-tracking": ["tickets:read:all"],
    "tickets:reply": ["tickets:read:all"],
    "tickets:create": ["tickets:read:all"],
    "tickets:delete": ["tickets:manage"],
    "tickets:license:assign": ["tickets:manage"],
    "tickets:license:view": ["tickets:read:all"],

    "customers:contacts:read": ["customers:read"],
    "customers:update:plan": ["customers:update"],
    "customers:update": ["customers:read"],
    "customers:create": ["customers:read"],
    "customers:delete": ["customers:update"],

    "contracts:update": ["contracts:read"],
    "contracts:create": ["contracts:read"],
    "contracts:delete": ["contracts:update"],

    "planner:financials:view": ["planner:read"],
    "planner:status:completed": ["planner:status:in-progress"],
    "planner:status:in-progress": ["planner:status:approve"],
    "planner:status:approve": ["planner:read"],
    "planner:create": ["planner:read"],
    "planner:priority:update": ["planner:read"],

    "cost-assistant:export": ["cost-assistant:process"],
    "cost-assistant:margins": ["cost-assistant:process"],
    "cost-assistant:process": ["cost-assistant:view"],
    "cost-assistant:view": ["cost-assistant:access"],

    "admin:maintenance:reset": ["admin:maintenance:restore"],
    "admin:maintenance:restore": ["admin:maintenance:backup"],
    "admin:maintenance:backup": ["admin:access"],
    "admin:logs:clear": ["admin:logs:read"],
    "admin:logs:read": ["admin:access"],
    "admin:import:run": ["admin:access"],
    "admin:import:files": ["admin:access"],
    "admin:import:sql": ["admin:access"],
    "admin:import:sql-config": ["admin:import:sql"],
    "admin:suggestions:read": ["admin:access"],
    "admin:settings:general": ["admin:access"],
    "admin:settings:api": ["admin:access"],
    "admin:settings:planner": ["admin:access"],
    "admin:settings:stock": ["admin:access"],
    "users:read": ["admin:access"],
    "users:create": ["users:read"],
    "users:update": ["users:read"],
    "users:delete": ["users:update"],
    "roles:read": ["admin:access"],
    "roles:create": ["roles:read"],
    "roles:update": ["roles:read"],
    "roles:delete": ["roles:update"],
};

/**
 * Función pura recursiva para verificar si un conjunto de permisos contiene uno específico,
 * respetando la jerarquía definida (El Padre otorga a los Hijos).
 */
export function checkPermissionInTree(userPermissions: string[], permissionToSearch: string): boolean {
    if (userPermissions.includes('admin:all') || userPermissions.includes('admin')) return true;
    if (userPermissions.includes(permissionToSearch)) return true;

    const memo = new Set<string>();
    
    const grantsPermission = (current: string, target: string): boolean => {
        const children = permissionTree[current] || [];
        if (children.includes(target)) return true;
        for (const child of children) {
            if (memo.has(child)) continue;
            memo.add(child);
            if (grantsPermission(child, target)) return true;
        }
        return false;
    };

    for (const userPerm of userPermissions) {
        if (grantsPermission(userPerm, permissionToSearch)) return true;
    }

    return false;
}
