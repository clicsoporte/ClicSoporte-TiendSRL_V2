
/**
 * @fileoverview Centralized constants for database initialization and default settings.
 * This file helps break circular dependencies by isolating static data.
 */
import type { User, Company, Role } from "../types";

export const initialUsers: User[] = [
  {
    id: 1,
    name: "Jonathan Ugalde G",
    email: "jonathan@clicsoporte.com",
    password: "LGnexus4*",
    phone: "+(506) 1111-2222",
    whatsapp: "+(506) 1111-2222",
    avatar: "",
    role: "admin",
    recentActivity: "Usuario administrador principal.",
    securityQuestion: "¿Cuál es el nombre de mi primera mascota?",
    securityAnswer: "fido",
  },
];

export const initialCompany: Company = {
    name: "CLIC SOPORTE Y CLIC TIENDA S.R.L",
    taxId: "3102894538",
    address: "San José, Costa Rica",
    phone: "+50640000630",
    email: "facturacion@clicsoporte.com",
    systemName: "Clic-Soporte",
    quotePrefix: "COT-",
    nextQuoteNumber: 1,
    decimalPlaces: 2,
    quoterShowTaxId: true,
    searchDebounceTime: 500,
    syncWarningHours: 12,
    importMode: 'file',
    lastSyncTimestamp: null,
    customerFilePath: "",
    productFilePath: "",
    exemptionFilePath: "",
    stockFilePath: "",
    cabysFilePath: "",
    supportPackages: [],
    servicesCatalog: [],
};

export const initialRoles: Role[] = [
  {
    id: "admin",
    name: "Admin",
    permissions: [
        "dashboard:access", "quotes:create", "quotes:generate", "quotes:drafts:create", 
        "quotes:drafts:read", "quotes:drafts:delete", "cost-assistant:access",
        "planner:read", "planner:create", "planner:edit:pending", "planner:edit:approved",
        "planner:reopen", "planner:schedule", "planner:status:approve", "planner:status:in-queue",
        "planner:status:in-progress", "planner:status:on-hold", "planner:status:completed",
        "planner:status:cancel", "planner:status:cancel-approved", "planner:priority:update",
        "planner:machine:assign", "analytics:read", "users:create", "users:read", "users:update",
        "users:delete", "roles:create", "roles:read", "roles:update", "roles:delete",
        "admin:settings:general", "admin:settings:api", "admin:settings:planner", "admin:settings:stock", 
        "admin:suggestions:read", "admin:import:run", "admin:import:files", "admin:import:sql", 
        "admin:import:sql-config", "admin:logs:read", "admin:logs:clear", "admin:maintenance:backup", 
        "admin:maintenance:restore", "admin:maintenance:reset", "hacienda:query", "tickets:create", 
        "tickets:read:all", "tickets:update", "tickets:delete", "tickets:admin:settings", "licenses:read", 
        "licenses:manage", "licenses:admin:keys", "customers:read", "customers:manage",
        "contracts:read", "contracts:manage", "providers:read", "providers:manage"
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    permissions: ["dashboard:access", "quotes:create", "quotes:drafts:read", "tickets:read:all", "planner:read", "contracts:read"],
  },
  {
    id: 'planner-user',
    name: 'Planificador',
    permissions: [
        "dashboard:access", "planner:read", "planner:create", "planner:status:approve", 
        "planner:status:in-progress", "planner:status:on-hold", "planner:status:completed", 
        "planner:status:cancel", "planner:priority:update", "planner:machine:assign",
    ]
  },
  {
    id: 'support-agent',
    name: 'Soporte Técnico',
    permissions: [
        "dashboard:access", "tickets:create", "tickets:read:all", "tickets:update", "customers:read", "contracts:read"
    ]
  }
];
