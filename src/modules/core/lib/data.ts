
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
} from "lucide-react";

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
