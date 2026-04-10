
/**
 * @fileoverview Main tool definitions for the application dashboards.
 */
import type { Tool } from "@/modules/core/types";
import {
  Sheet,
  CalendarCheck,
  LifeBuoy,
  FileScan,
  Ticket,
  KeyRound,
  AreaChart,
  Search,
  Users,
  FileText,
  Receipt,
  BookCopy
} from "lucide-react";

/**
 * List of tools available on the main dashboard (Technical/Operational).
 */
export const mainTools: Tool[] = [
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
    id: "customers",
    name: "Clientes",
    description: "Administrar base de clientes y contactos.",
    href: "/dashboard/customers",
    icon: Users,
    bgColor: "bg-amber-600",
    textColor: "text-white",
  },
  {
    id: "contracts",
    name: "Contratos",
    description: "Gestionar contratos de soporte y coberturas.",
    href: "/dashboard/contracts",
    icon: FileText,
    bgColor: "bg-indigo-600",
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
    id: "it-notes",
    name: "Notas de TI",
    description: "Documentación técnica y bitácoras por cliente.",
    href: "/dashboard/it-tools/notes",
    icon: BookCopy,
    bgColor: "bg-slate-700",
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
 * List of financial tools grouped for the "Financial Module" card.
 */
export const financeTools: (Tool & { permission: string })[] = [
    {
        id: "billing",
        name: "Facturación",
        description: "Gestionar horas cobrables y conciliación con ERP.",
        href: "/dashboard/billing",
        icon: Receipt,
        bgColor: "bg-emerald-600",
        textColor: "text-white",
        permission: "billing:manage"
    },
    {
        id: "quoter",
        name: "Cotizador",
        description: "Crear y gestionar cotizaciones para clientes.",
        href: "/dashboard/quoter",
        icon: Sheet,
        bgColor: "bg-green-500",
        textColor: "text-white",
        permission: "quotes:create"
    },
    {
        id: "cost-assistant",
        name: "Asistente de Costos",
        description: "Procesar facturas de compra XML para calcular precios.",
        href: "/dashboard/cost-assistant",
        icon: FileScan,
        bgColor: "bg-orange-600",
        textColor: "text-white",
        permission: "cost-assistant:access"
    },
    {
      id: "hacienda-query",
      name: "Consultas Hacienda",
      description: "Verificar situación tributaria y exoneraciones.",
      href: "/dashboard/hacienda",
      icon: Search,
      bgColor: "bg-blue-600",
      textColor: "text-white",
      permission: "hacienda:query"
    },
];

export const itTools: Tool[] = [
    {
        id: "it-notes",
        name: "Notas de TI",
        description: "Gestionar procedimientos y guías técnicas.",
        href: "/dashboard/it-tools/notes",
        icon: BookCopy,
        bgColor: "bg-slate-700",
        textColor: "text-white",
    }
];
