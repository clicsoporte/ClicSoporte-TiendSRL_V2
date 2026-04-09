/**
 * @fileoverview Centralized definition of all application permissions and their hierarchy.
 */

export const permissionGroups = {
  "Acceso General": ["dashboard:access"],
  "Cotizador": ["quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete"],
  "Asistente de Costos": [
    "cost-assistant:view", 
    "cost-assistant:process", 
    "cost-assistant:margins", 
    "cost-assistant:export"
  ],
  "Soporte Técnico": [
    "tickets:create", 
    "tickets:read:all", 
    "tickets:reply", 
    "tickets:manage", 
    "tickets:time-tracking", 
    "tickets:delete", 
    "tickets:admin:settings"
  ],
  "Clientes": [
    "customers:read", 
    "customers:create", 
    "customers:update", 
    "customers:delete",
    "customers:update:plan"
  ],
  "Contratos": [
    "contracts:read", 
    "contracts:create", 
    "contracts:update", 
    "contracts:delete"
  ],
  "Proveedores": [
    "providers:read", 
    "providers:manage",
    "view:provider:costs"
  ],
  "Facturación": [
    "billing:manage"
  ],
  "Gestión de Licencias": ["licenses:read", "licenses:manage", "licenses:admin:keys"],
  "Proyectos TI": ["planner:read", "planner:create", "planner:status:approve", "planner:status:in-progress", "planner:status:completed", "planner:priority:update"],
  "Hacienda": ["hacienda:query"],
  "Analíticas": ["analytics:read"],
  "Usuarios y Roles": ["users:read", "users:create", "users:update", "users:delete", "roles:read", "roles:create", "roles:update", "roles:delete"],
  "Administración": ["admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:stock", "admin:suggestions:read", "admin:import:run", "admin:logs:read", "admin:maintenance:backup"],
  "Super Admin": ["admin:all"]
};

export type AppPermission = string;

/**
 * Defines the hierarchical relationship between permissions.
 */
export const permissionTree: Record<string, string[]> = {
  'admin:all': [
    'admin:settings:general', 'admin:settings:api', 'admin:settings:planner', 'admin:settings:stock',
    'admin:suggestions:read', 'admin:import:run', 'admin:logs:read', 'admin:maintenance:backup',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    'licenses:admin:keys', 'tickets:admin:settings', 'billing:manage',
    'customers:read', 'customers:create', 'customers:update', 'customers:delete', 'customers:update:plan',
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete',
    'cost-assistant:margins', 'cost-assistant:export', 'cost-assistant:view', 'cost-assistant:process',
    'view:provider:costs', 'providers:read', 'providers:manage', 'planner:read', 'tickets:read:all', 'hacienda:query', 'analytics:read'
  ],
  'users:manage': ['users:read', 'users:create', 'users:update', 'users:delete'],
  'roles:manage': ['roles:read', 'roles:create', 'roles:update', 'roles:delete'],
  'customers:manage': ['customers:read', 'customers:create', 'customers:update', 'customers:delete', 'customers:update:plan'],
  'contracts:manage': ['contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete'],
  'tickets:manage': ['tickets:reply', 'tickets:time-tracking'],
  'cost-assistant:access': ['cost-assistant:view', 'cost-assistant:process']
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

export const permissionTranslations: Record<string, string> = {
  "dashboard:access": "Acceso al Panel Principal",
  "quotes:create": "Cotizador: Crear Proformas",
  "quotes:generate": "Cotizador: Generar PDF",
  "quotes:drafts:create": "Cotizador: Guardar Borradores",
  "quotes:drafts:read": "Cotizador: Ver Borradores",
  "quotes:drafts:delete": "Cotizador: Borrar Borradores",
  "cost-assistant:view": "Asistente Costos: Ver Módulo",
  "cost-assistant:process": "Asistente Costos: Procesar XML",
  "cost-assistant:margins": "Asistente Costos: Editar Márgenes",
  "cost-assistant:export": "Asistente Costos: Exportar Excel",
  "tickets:create": "Tickets: Abrir Casos",
  "tickets:read:all": "Tickets: Ver Todos los Casos",
  "tickets:reply": "Tickets: Responder / Notas",
  "tickets:manage": "Tickets: Gestión (Estado/Asignación)",
  "tickets:time-tracking": "Tickets: Control de Tiempo",
  "tickets:delete": "Tickets: Eliminar",
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
  "providers:read": "Proveedores: Ver Catálogo",
  "providers:manage": "Proveedores: Gestionar Tarifas",
  "view:provider:costs": "Supervisor: Ver Costos y Utilidad",
  "billing:manage": "Facturación: Auditar y Conciliar",
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
  "analytics:read": "Analíticas: Ver Reportes Gerenciales",
  "users:read": "Usuarios: Ver Listado",
  "users:create": "Usuarios: Crear Nuevo",
  "users:update": "Usuarios: Editar / Clave",
  "users:delete": "Usuarios: Eliminar",
  "roles:read": "Roles: Ver Listado",
  "roles:create": "Roles: Crear Nuevo",
  "roles:update": "Roles: Editar Permisos",
  "roles:delete": "Roles: Eliminar",
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
