/**
 * @fileoverview This file centralizes all permission-related constants and logic.
 * Features hierarchical dependencies and granular categorization for MSP operations.
 */

export const permissionGroups = {
    "Acceso General": ["dashboard:access", "dashboard:stats:view"],
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
        "planner:status:completed", "planner:priority:update", "planner:financials:view"
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
        "admin:suggestions:read", "admin:import:run", "admin:logs:read", "admin:logs:clear",
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
    "planner:financials:view": "Proyectos: Ver Rentabilidad (Escudo)",
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
    "admin:logs:clear": "Admin: Limpiar Logs",
    "admin:maintenance:backup": "Admin: Gestión de Backups",
    "admin:maintenance:restore": "Admin: Restaurar Sistema",
    "admin:maintenance:reset": "Admin: Reseteo de Fábrica (Peligro)",
    "admin:all": "Administrador Total (Control Total)"
};

export type AppPermission = keyof typeof permissionTranslations;

/**
 * Defines the hierarchical dependencies between permissions.
 * The Key is the BASE permission (the one that is REQUIRED).
 * The Value is an array of ADVANCED permissions that automatically check the base.
 * Logic: Check advanced -> auto-check base. Uncheck base -> auto-uncheck advanced.
 */
export const permissionTree: Record<string, string[]> = {
    // Top-Level Access
    "dashboard:access": ["dashboard:stats:view", "tickets:read:all", "customers:read", "contracts:read", "planner:read", "licenses:read", "admin:access"],
    
    // Tickets (Read is base for everything)
    "tickets:read:all": ["tickets:create", "tickets:reply", "tickets:manage", "tickets:delete"],
    "tickets:manage": ["tickets:time-tracking", "tickets:admin:settings"],
    
    // Customers (Read is base)
    "customers:read": ["customers:create", "customers:update", "customers:delete"],
    "customers:update": ["customers:update:plan"],
    
    // Contracts
    "contracts:read": ["contracts:create", "contracts:update", "contracts:delete"],
    
    // Planner
    "planner:read": ["planner:create", "planner:status:approve", "planner:status:in-progress", "planner:financials:view"],
    "planner:status:in-progress": ["planner:status:completed", "planner:priority:update"],
    
    // Cost Assistant
    "cost-assistant:access": ["cost-assistant:view", "cost-assistant:process"],
    "cost-assistant:process": ["cost-assistant:margins", "cost-assistant:export"],
    
    // Providers
    "providers:read": ["providers:manage", "view:provider:costs"],
    
    // User Management
    "users:read": ["users:create", "users:update", "users:delete"],
    
    // Roles Management
    "roles:read": ["roles:create", "roles:update", "roles:delete"],
    
    // Administration & Maintenance
    "admin:access": ["admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:stock", "admin:suggestions:read", "admin:import:run", "admin:logs:read", "admin:maintenance:backup"],
    "admin:logs:read": ["admin:logs:clear"],
    "admin:maintenance:backup": ["admin:maintenance:restore", "admin:maintenance:reset"],
};

/**
 * Pure recursive function to check if a set of permissions contains a specific one, 
 * respecting the defined hierarchy.
 */
export function checkPermissionInTree(userPermissions: string[], permissionToSearch: string): boolean {
    if (userPermissions.includes('admin:all') || userPermissions.includes('admin')) return true;
    if (userPermissions.includes(permissionToSearch)) return true;

    // To check if a user has 'permissionToSearch', we check if any of their permissions
    // is a descendant of 'permissionToSearch' in the tree.
    const memo = new Set<string>();
    const isDescendant = (current: string): boolean => {
        const children = permissionTree[current] || [];
        if (children.includes(permissionToSearch)) return true;
        for (const child of children) {
            if (memo.has(child)) continue;
            memo.add(child);
            if (isDescendant(child)) return true;
        }
        return false;
    };

    // Note: The hierarchy logic in the tree is: Base -> Advanced.
    // If user has 'Advanced', they have 'Base'.
    // So if permissionToSearch is 'Base', and user has 'Advanced', they are authorized.
    for (const userPerm of userPermissions) {
        if (isDescendant(userPerm)) return true;
    }

    return false;
}
