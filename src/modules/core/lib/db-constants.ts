
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
    name: "Administrador",
    permissions: ["admin:all"],
  },
  {
    id: "viewer",
    name: "Solo Lectura",
    permissions: [
        "dashboard:access", 
        "quotes:create", 
        "tickets:read:all", 
        "planner:read", 
        "contracts:read", 
        "customers:read"
    ],
  },
  {
    id: 'planner-user',
    name: 'Planificador de Proyectos',
    permissions: [
        "dashboard:access", "planner:read", "planner:create", "planner:status:approve", 
        "planner:status:in-progress", "planner:status:completed", "planner:priority:update",
        "customers:read", "providers:read"
    ]
  },
  {
    id: 'support-agent',
    name: 'Técnico de Soporte',
    permissions: [
        "dashboard:access", "tickets:create", "tickets:read:all", "tickets:reply", 
        "tickets:time-tracking", "customers:read", "contracts:read", "providers:read", "hacienda:query",
        "tickets:license:assign", "tickets:license:view"
    ]
  }
];
