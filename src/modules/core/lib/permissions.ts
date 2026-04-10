/**
 * @fileoverview This file centralizes all permission-related constants and logic.
 * Features hierarchical dependencies and granular categorization for MSP operations.
 */

export const permissionGroups = {
    "Acceso General": ["dashboard:access"],
    "Cotizador": ["quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete"],
    "Soporte Técnico": [
        "tickets:read:all", "tickets:create", "tickets:reply", "tickets:manage", 
        "tickets:time-tracking", "tickets:delete", "tickets:admin:settings"
    ],
    "Clientes": [
        "customers:read", "customers:create", "customers:update", "customers:delete", "customers:update:plan"
    ],
    "Contratos": [
        "contracts:read", "contracts:create", "contracts:update", "contracts:delete"
    ],
    "Gestión de Licencias": [
        "licenses:read", "licenses:manage", "licenses:admin:keys"
    ],
    "Proyectos TI": [
        "planner:read", "planner:create", "planner:status:approve", "planner:status:in-progress", 
        "planner:status:completed", "planner:priority:update"
    ],
    "Hacienda": ["hacienda:query"],
    "Asistente de Costos": [
        "cost-assistant:access", "cost-assistant:view", "cost-assistant:process", 
        "cost-assistant:margins", "cost-assistant:export"
    ],
    "Facturación y Finanzas": ["billing:manage", "view:provider:costs", "providers:manage", "providers:read"],
    "Gestión de Usuarios": ["users:create", "users:read", "users:update", "users:delete"],
    "Gestión de Roles": ["roles:create", "roles:read", "roles:update", "roles:delete"],
    "Administración del Sistema": [
        "admin:access",
        "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:stock",
        "admin:suggestions:read", "admin:import:run", "admin:logs:read", "admin:maintenance:backup"
    ],
    "Super Admin": ["admin:all"]
};

export const permissionTranslations: Record<string, string> = {
    "dashboard:access": "Acceso al Panel Principal",
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
    "customers:read": "Clientes: Ver Listado",
    "customers:create": "Clientes: Crear Nuevo",
    "customers:update": "Clientes: Editar Datos",
    "customers:delete": "Clientes: Eliminar",
    "customers:update:plan": "Clientes: Cambiar Plan de Soporte",
    "contracts:read": "Contratos: Ver Listado",
    "contracts:create": "Contratos: Crear Nuevo",
    "contracts:update": "Contratos: Editar / Renovar",
    "contracts:delete": "Contratos: Eliminar",
    "licenses:read": "Licencias: Ver Listado",
    "licenses:manage": "Licencias: Crear / Editar",
    "licenses:admin:keys": "Licencias: Gestión de Claves",
    "planner:read": "Proyectos: Ver Listado",
    "planner:create": "Proyectos: Crear Nuevo",
    "planner:status:approve": "Proyectos: Aprobar Fases",
    "planner:status:in-progress": "Proyectos: Iniciar Ejecución",
    "planner:status:completed": "Proyectos: Finalizar",
    "planner:priority:update": "Proyectos: Cambiar Prioridad",
    "hacienda:query": "Hacienda: Consultas de Contribuyentes",
    "cost-assistant:access": "Asist. Costos: Acceso General",
    "cost-assistant:view": "Asist. Costos: Ver Módulo",
    "cost-assistant:process": "Asist. Costos: Procesar XML",
    "cost-assistant:margins": "Asist. Costos: Editar Márgenes",
    "cost-assistant:export": "Asist. Costos: Exportar Excel",
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
    "admin:logs:read": "Admin: Ver Logs del Sistema",
    "admin:maintenance:backup": "Admin: Gestión de Backups",
    "admin:all": "Administrador Total (Control Total)"
};

export type AppPermission = keyof typeof permissionTranslations;

/**
 * Defines the hierarchical dependencies between permissions.
 * The key is the parent permission, and the value is an array of child permissions it grants.
 * NOTE: 'admin:all' is excluded from this tree to avoid reverse-triggering the super-admin 
 * status when selecting common functional permissions.
 */
export const permissionTree: Record<string, string[]> = {
    "dashboard:access": ["tickets:read:all", "customers:read", "contracts:read", "planner:read"],
    
    "admin:access": [
        "users:read", "roles:read", "admin:settings:general", "admin:settings:api", 
        "admin:settings:planner", "admin:settings:stock", "admin:suggestions:read", 
        "admin:import:run", "admin:logs:read", "admin:maintenance:backup"
    ],
    
    "users:read": ["users:create", "users:update", "users:delete"],
    "roles:read": ["roles:create", "roles:update", "roles:delete"],
    
    "tickets:read:all": ["tickets:create", "tickets:reply"],
    "tickets:manage": ["tickets:read:all", "tickets:time-tracking"],
    "tickets:admin:settings": ["tickets:manage"],
    
    "customers:read": ["customers:create", "customers:update"],
    "customers:update": ["customers:update:plan"],
    
    "contracts:read": ["contracts:create", "contracts:update"],
    
    "planner:read": ["planner:create", "planner:status:in-progress"],
    "planner:status:approve": ["planner:read"],
    "planner:status:completed": ["planner:status:in-progress"],
    
    "cost-assistant:access": ["cost-assistant:view", "cost-assistant:process"],
    "cost-assistant:process": ["cost-assistant:margins", "cost-assistant:export"],
    
    "providers:manage": ["providers:read", "view:provider:costs"],
};

/**
 * Pure recursive function to check if a set of permissions contains a specific one, 
 * respecting the defined hierarchy.
 */
export function checkPermissionInTree(userPermissions: string[], permissionToSearch: string): boolean {
    if (userPermissions.includes('admin:all') || userPermissions.includes('admin')) return true;
    if (userPermissions.includes(permissionToSearch)) return true;

    const memo = new Set<string>();
    const search = (perms: string[]): boolean => {
        for (const p of perms) {
            if (p === permissionToSearch) return true;
            if (memo.has(p)) continue;
            memo.add(p);
            
            const children = permissionTree[p] || [];
            if (children.includes(permissionToSearch)) return true;
            if (search(children)) return true;
        }
        return false;
    };

    return search(userPermissions);
}
