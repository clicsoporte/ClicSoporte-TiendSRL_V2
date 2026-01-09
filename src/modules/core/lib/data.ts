/**
 * @fileoverview This file contains the initial or default data for the application.
 * This data is used to populate the database on its first run.
 * Spanish is used for UI-facing strings like names and descriptions.
 */

import type { Tool, User, Role, Company, DatabaseModule } from "@/modules/core/types";
import {
  Sheet,
  CalendarCheck,
  ShoppingCart,
  Warehouse,
  Search,
  PackagePlus,
  LifeBuoy,
  FileScan,
  Ticket,
  KeyRound,
  AreaChart,
} from "lucide-react";
import { initializeMainDatabase } from './db';
import { runPlannerMigrations, initializePlannerDb } from '../../planner/lib/db';
import { runRequestMigrations, initializeRequestsDb } from '../../requests/lib/db';
import { runWarehouseMigrations, initializeWarehouseDb } from '../../warehouse/lib/db';
import { runCostAssistantMigrations, initializeCostAssistantDb } from '../../cost-assistant/lib/db';
import { runTicketMigrations, initializeTicketsDb } from '../../tickets/lib/db';
import { runLicensesMigrations, initializeLicensesDb } from '../../licenses/lib/db';
import { runTimesheetMigrations, initializeTimesheetDb } from "../../timesheet/lib/db";

/**
 * Acts as a registry for all database modules in the application.
 * This structure allows the core `connectDb` function to be completely agnostic
 * of any specific module, promoting true modularity and decoupling.
 */
export const DB_MODULES: DatabaseModule[] = [
    { id: 'clic-tools-main', name: 'Clic-Tools (Sistema Principal)', dbFile: 'intratool.db', initFn: initializeMainDatabase, migrationFn: () => {} },
    { id: 'purchase-requests', name: 'Solicitud de Compra', dbFile: 'requests.db', initFn: initializeRequestsDb, migrationFn: runRequestMigrations },
    { id: 'production-planner', name: 'Gestor de Proyectos', dbFile: 'planner.db', initFn: initializePlannerDb, migrationFn: runPlannerMigrations },
    { id: 'warehouse-management', name: 'Gestión de Almacenes', dbFile: 'warehouse.db', initFn: initializeWarehouseDb, migrationFn: runWarehouseMigrations },
    { id: 'cost-assistant', name: 'Asistente de Costos', dbFile: 'cost-assistant.db', initFn: initializeCostAssistantDb, migrationFn: runCostAssistantMigrations },
    { id: 'tickets', name: 'Soporte Técnico', dbFile: 'tickets.db', initFn: initializeTicketsDb, migrationFn: runTicketMigrations },
    { id: 'licenses', name: 'Gestión de Licencias', dbFile: 'licenses.db', initFn: initializeLicensesDb, migrationFn: runLicensesMigrations },
    { id: 'timesheet', name: 'Hoja de Tiempos', dbFile: 'timesheet.db', initFn: initializeTimesheetDb, migrationFn: runTimesheetMigrations },
];

/**
 * The default user to be created in the database.
 * This ensures there is always at least one administrator.
 */
export const initialUsers: User[] = [
  {
    id: 1,
    name: "Jonathan Ugalde G",
    email: "jonathan@clicsoporte.com",
    password: "LGnexus4*",
    phone: "+(506) 1111-2222",
    whatsapp: "+(506) 1111-2222",
    avatar: "", // Intentionally blank, will use fallback
    role: "admin",
    recentActivity: "Usuario administrador principal.",
    securityQuestion: "¿Cuál es el nombre de mi primera mascota?",
    securityAnswer: "fido",
  },
];

/**
 * Initial company data for the general settings.
 */
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
    locationFilePath: "",
    cabysFilePath: "",
    supportPackages: [],
    servicesCatalog: [],
};

/**
 * List of tools available on the main dashboard.
 */
export const mainTools: Tool[] = [
  {
    id: "quoter",
    name: "Cotizador",
    description: "Crear y gestionar cotizaciones para clientes.",
    href: "/dashboard/quoter",
    icon: Sheet,
    bgColor: "bg-green-500",
    textColor: "text-white",
  },
    {
    id: "cost-assistant",
    name: "Asistente de Costos",
    description: "Procesar facturas de compra XML para calcular precios.",
    href: "/dashboard/cost-assistant",
    icon: FileScan,
    bgColor: "bg-orange-600",
    textColor: "text-white",
  },
  {
    id: "purchase-request",
    name: "Solicitud de Compra",
    description: "Crear y gestionar solicitudes de compra internas.",
    href: "/dashboard/requests",
    icon: ShoppingCart,
    bgColor: "bg-yellow-500",
    textColor: "text-white",
  },
   {
    id: "planner",
    name: "Gestor de Proyectos",
    description: "Gestionar y visualizar proyectos y tareas.",
    href: "/dashboard/planner",
    icon: CalendarCheck,
    bgColor: "bg-purple-500",
    textColor: "text-white",
  },
  {
    id: "tickets",
    name: "Soporte Técnico",
    description: "Gestionar tickets y dar soporte a los clientes.",
    href: "/dashboard/tickets",
    icon: Ticket,
    bgColor: "bg-blue-500",
    textColor: "text-white",
  },
  {
    id: "licenses",
    name: "Licenciamiento",
    description: "Gestionar licencias de software propias y de terceros.",
    href: "/dashboard/licenses",
    icon: KeyRound,
    bgColor: "bg-indigo-500",
    textColor: "text-white",
  },
   {
    id: "warehouse-search",
    name: "Consulta de Almacén",
    description: "Localizar artículos y ver existencias en el almacén.",
    href: "/dashboard/warehouse",
    icon: Warehouse,
    bgColor: "bg-cyan-600",
    textColor: "text-white",
  },
  {
    id: "warehouse-assign",
    name: "Asignar Inventario",
    description: "Mover inventario entre ubicaciones físicas.",
    href: "/dashboard/warehouse/assign",
    icon: PackagePlus,
    bgColor: "bg-teal-600",
    textColor: "text-white",
  },
     {
      id: "hacienda-query",
      name: "Consultas Hacienda",
      description: "Verificar situación tributaria y exoneraciones.",
      href: "/dashboard/hacienda",
      icon: Search,
      bgColor: "bg-blue-600",
      textColor: "text-white",
    },
    {
      id: "analytics",
      name: "Analíticas",
      description: "Ver KPIs y reportes de todos los módulos.",
      href: "/dashboard/analytics",
      icon: AreaChart,
      bgColor: "bg-rose-600",
      textColor: "text-white",
    },
    {
      id: "help",
      name: "Centro de Ayuda",
      description: "Consultar la documentación y guías de uso del sistema.",
      href: "/dashboard/help",
      icon: LifeBuoy,
      bgColor: "bg-orange-500",
      textColor: "text-white",
    },
];

/**
 * Default roles and their permissions.
 */
export const initialRoles: Role[] = [
  {
    id: "admin",
    name: "Admin",
    permissions: [
        "dashboard:access",
        "quotes:create",
        "quotes:generate",
        "quotes:drafts:create",
        "quotes:drafts:read",
        "quotes:drafts:delete",
        "cost-assistant:access",
        "requests:read",
        "requests:create",
        "requests:edit:pending",
        "requests:edit:approved",
        "requests:reopen",
        "requests:status:approve",
        "requests:status:unapprove",
        "requests:status:ordered",
        "requests:status:received",
        "requests:status:cancel",
        "requests:status:cancel-approved",
        "planner:read",
        "planner:create",
        "planner:edit:pending",
        "planner:edit:approved",
        "planner:reopen",
        "planner:receive",
        "planner:schedule",
        "planner:status:approve",
        "planner:status:unapprove",
        "planner:status:unapprove-request",
        "planner:status:in-queue",
        "planner:status:in-progress",
        "planner:status:on-hold",
        "planner:status:completed",
        "planner:status:cancel",
        "planner:status:cancel-approved",
        "planner:priority:update",
        "planner:machine:assign",
        "analytics:read",
        "users:create",
        "users:read",
        "users:update",
        "users:delete",
        "roles:create",
        "roles:read",
        "roles:update",
        "roles:delete",
        "admin:settings:general",
        "admin:settings:api",
        "admin:settings:planner",
        "admin:settings:requests",
        "admin:settings:warehouse",
        "admin:settings:stock",
        "admin:suggestions:read",
        "admin:import:run",
        "admin:import:files",
        "admin:import:sql",
        "admin:import:sql-config",
        "admin:logs:read",
        "admin:logs:clear",
        "admin:maintenance:backup",
        "admin:maintenance:restore",
        "admin:maintenance:reset",
        "warehouse:access",
        "warehouse:inventory:assign",
        "warehouse:locations:manage",
        "hacienda:query",
        "tickets:create",
        "tickets:read:all",
        "tickets:update",
        "tickets:delete",
        "tickets:admin:settings",
        "licenses:read",
        "licenses:manage",
        "licenses:admin:keys",
        "timesheet:create",
        "timesheet:read:all",
        "timesheet:edit:all",
        "timesheet:delete:all"
    ],
  },
  {
    id: "viewer",
    name: "Viewer",
    permissions: ["dashboard:access", "quotes:create", "quotes:drafts:read"],
  },
  {
    id: 'planner-user',
    name: 'Planificador',
    permissions: [
        "dashboard:access",
        "planner:read",
        "planner:create",
        "planner:status:approve",
        "planner:status:in-progress",
        "planner:status:on-hold",
        "planner:status:completed",
        "planner:status:cancel",
        "planner:priority:update",
        "planner:machine:assign",
    ]
  },
   {
    id: 'requester-user',
    name: 'Solicitante',
    permissions: [
        "dashboard:access",
        "requests:read",
        "requests:create",
    ]
  },
  {
    id: 'support-agent',
    name: 'Soporte Técnico',
    permissions: [
        "dashboard:access",
        "tickets:create",
        "tickets:read:all",
        "tickets:update",
        "timesheet:create"
    ]
  }
];
