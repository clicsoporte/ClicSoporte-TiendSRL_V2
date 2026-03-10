/**
 * @fileoverview Centralized definition of all application permissions and their hierarchy.
 */

export const permissionGroups = {
  "Acceso General": ["dashboard:access"],
  "Cotizador": ["quotes:create", "quotes:generate", "quotes:drafts:create", "quotes:drafts:read", "quotes:drafts:delete"],
  "Asistente de Costos": ["cost-assistant:access"],
  "Soporte Técnico": ["tickets:create", "tickets:read:all", "tickets:update", "tickets:delete", "tickets:admin:settings"],
  "Clientes y Contratos": ["customers:read", "customers:manage", "contracts:read", "contracts:manage", "providers:read", "providers:manage"],
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
 * If a user has a parent permission, they automatically inherit the child permissions.
 */
export const permissionTree: Record<string, string[]> = {
  'admin:all': [
    'admin:settings:general', 'admin:settings:api', 'admin:settings:planner', 'admin:settings:stock',
    'admin:suggestions:read', 'admin:import:run', 'admin:logs:read', 'admin:maintenance:backup',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    'licenses:admin:keys', 'tickets:admin:settings'
  ],
  'users:manage': ['users:read', 'users:create', 'users:update', 'users:delete'],
  'roles:manage': ['roles:read', 'roles:create', 'roles:update', 'roles:delete'],
  'customers:manage': ['customers:read'],
  'contracts:manage': ['contracts:read'],
  'providers:manage': ['providers:read']
};

export const permissionTranslations: Record<string, string> = {
  "dashboard:access": "Acceso al Panel",
  "cost-assistant:access": "Acceder al Asistente de Costos",
  "quotes:create": "Cotizador: Crear",
  "quotes:generate": "Cotizador: Generar PDF",
  "tickets:create": "Tickets: Abrir Casos",
  "tickets:read:all": "Tickets: Ver Todos",
  "users:read": "Usuarios: Ver Lista",
  "users:create": "Usuarios: Crear Nuevo",
  "roles:read": "Roles: Ver Lista",
  "admin:all": "Control Total del Sistema",
  "admin:import:run": "Ejecutar Sincronización ERP"
};
