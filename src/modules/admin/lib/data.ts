
/**
 * @fileoverview This file contains the configuration data for the admin section tools.
 * It defines the tools that appear on the administration dashboard.
 */
import type { Tool } from "@/modules/core/types";
import { Users, ShieldCheck, Briefcase, MessageSquare, DollarSign, FileUp, ServerCog, Network, Factory, Store, Map, Boxes, Ticket, FileTerminal } from "lucide-react";

/**
 * List of tools available in the admin section.
 */
export const adminTools: Tool[] = [
    {
        id: "user-management",
        name: "Gestión de Usuarios",
        description: "Añadir, editar y gestionar usuarios y sus roles.",
        href: "/dashboard/admin/users",
        icon: Users,
        bgColor: "bg-blue-500",
        textColor: "text-white",
      },
      {
        id: "role-management",
        name: "Gestión de Roles",
        description: "Definir roles y asignar permisos granulares.",
        href: "/dashboard/admin/roles",
        icon: ShieldCheck,
        bgColor: "bg-green-500",
        textColor: "text-white",
      },
      {
        id: "general-settings",
        name: "Configuración General",
        description: "Gestionar los datos de la empresa y logo.",
        href: "/dashboard/admin/general",
        icon: Briefcase,
        bgColor: "bg-orange-500",
        textColor: "text-white",
      },
      {
        id: "suggestions-viewer",
        name: "Buzón de Sugerencias",
        description: "Revisar el feedback enviado por los usuarios.",
        href: "/dashboard/admin/suggestions",
        icon: MessageSquare,
        bgColor: "bg-green-600",
        textColor: "text-white",
      },
      {
        id: "quoter-settings",
        name: "Config. Cotizador",
        description: "Gestionar prefijos y consecutivos del cotizador.",
        href: "/dashboard/admin/quoter", 
        icon: DollarSign,
        bgColor: "bg-emerald-600",
        textColor: "text-white",
      },
      {
        id: "import-data",
        name: "Importar Datos",
        description: "Cargar clientes, productos, exoneraciones y existencias.",
        href: "/dashboard/admin/import",
        icon: FileUp,
        bgColor: "bg-cyan-700",
        textColor: "text-white",
      },
       {
        id: "maintenance",
        name: "Mantenimiento",
        description: "Backup, restauración y reseteo del sistema.",
        href: "/dashboard/admin/maintenance",
        icon: ServerCog,
        bgColor: "bg-red-600",
        textColor: "text-white",
      },
      {
        id: "api-settings",
        name: "Configuración de API",
        description: "Gestionar URLs y claves de APIs externas.",
        href: "/dashboard/admin/api",
        icon: Network,
        bgColor: "bg-indigo-700",
        textColor: "text-white",
      },
       {
        id: "planner-settings",
        name: "Config. Gestor de Proyectos",
        description: "Gestionar máquinas y otros ajustes del planificador.",
        href: "/dashboard/admin/planner",
        icon: Factory,
        bgColor: "bg-purple-700",
        textColor: "text-white",
      },
       {
        id: "requests-settings",
        name: "Config. Compras",
        description: "Gestionar rutas y otros ajustes de compras.",
        href: "/dashboard/admin/requests",
        icon: Store,
        bgColor: "bg-amber-700",
        textColor: "text-white",
      },
      {
        id: "warehouse-settings",
        name: "Config. Almacenes",
        description: "Definir niveles y estructura de ubicaciones físicas.",
        href: "/dashboard/admin/warehouse",
        icon: Map,
        bgColor: "bg-teal-700",
        textColor: "text-white",
      },
      {
        id: "stock-settings",
        name: "Config. Inventario",
        description: "Gestionar bodegas y ajustes de existencias.",
        href: "/dashboard/admin/stock",
        icon: Boxes,
        bgColor: "bg-green-700",
        textColor: "text-white",
      },
       {
        id: "tickets-settings",
        name: "Config. Soporte Técnico",
        description: "Gestionar temas de ayuda y automatizaciones.",
        href: "/dashboard/admin/tickets",
        icon: Ticket,
        bgColor: "bg-blue-700",
        textColor: "text-white",
      },
      {
        id: "log-viewer",
        name: "Visor de Eventos",
        description: "Revisar los registros y errores del sistema.",
        href: "/dashboard/admin/logs",
        icon: FileTerminal,
        bgColor: "bg-slate-600",
        textColor: "text-white",
      }
];
