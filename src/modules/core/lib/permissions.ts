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
    "customers:delete"
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
 * If a user has a parent permission, they automatically inherit the child permissions.
 */
export const permissionTree: Record<string, string[]> = {
  'admin:all': [
    'admin:settings:general', 'admin:settings:api', 'admin:settings:planner', 'admin:settings:stock',
    'admin:suggestions:read', 'admin:import:run', 'admin:logs:read', 'admin:maintenance:backup',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    'licenses:admin:keys', 'tickets:admin:settings', 'billing:manage',
    'customers:create', 'customers:update', 'customers:delete',
    'contracts:create', 'contracts:update', 'contracts:delete',
    'cost-assistant:margins', 'cost-assistant:export',
    'view:provider:costs'
  ],
  'users:manage': ['users:read', 'users:create', 'users:update', 'users:delete'],
  'roles:manage': ['roles:read', 'roles:create', 'roles:update', 'roles:delete'],
  'customers:manage': ['customers:read', 'customers:create', 'customers:update', 'customers:delete'],
  'contracts:manage': ['customers:read', 'customers:create', 'customers:update', 'customers:delete'],
  'tickets:manage': ['tickets:reply', 'tickets:time-tracking'],
  'cost-assistant:access': ['cost-assistant:view', 'cost-assistant:process']
};

export const permissionTranslations: Record<string, string> = {
  "dashboard:access": "Acceso al Panel",
  "cost-assistant:view": "Ver Asistente de Costos",
  "cost-assistant:process": "Procesar XMLs",
  "cost-assistant:margins": "Editar Márgenes",
  "cost-assistant:export": "Exportar para ERP",
  "quotes:create": "Cotizador: Crear",
  "tickets:create": "Tickets: Abrir Casos",
  "tickets:reply": "Tickets: Responder",
  "tickets:manage": "Tickets: Gestionar (Estado/Asignación)",
  "tickets:time-tracking": "Tickets: Usar Cronómetro",
  "billing:manage": "Facturación: Auditar Tiempos",
  "customers:create": "Clientes: Crear",
  "customers:update": "Clientes: Editar",
  "contracts:create": "Contratos: Crear",
  "admin:all": "Control Total del Sistema",
  "admin:import:run": "Ejecutar Sincronización ERP",
  "view:provider:costs": "Ver Costos, Márgenes y Rentabilidad (Supervisor)"
};
