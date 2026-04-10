
/**
 * @fileoverview Sidebar component for the main application layout.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
  useSidebar,
} from "../ui/sidebar";
import {
  Settings,
  Wrench,
  LayoutDashboard,
  LifeBuoy,
  CalendarCheck,
  Search,
  Ticket,
  KeyRound,
  FileScan,
  AreaChart,
  Network,
  Sheet as SheetIcon,
  Users,
  FileText,
  Receipt,
  Wallet,
  BookCopy
} from "lucide-react";
import type { Tool } from "../../modules/core/types";
import { UserNav } from "./user-nav";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";

export function AppSidebar() {
  const pathname = usePathname();
  const { user: currentUser, companyData, userRole, isLoading, unreadSuggestionsCount, hasPermission } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
        return pathname === href;
    }
    return pathname.startsWith(href);
  };
  
  const hasAdminAccess = userRole?.permissions.some(p => p.startsWith('admin:'));

  if (isLoading) {
    return (
        <div className="hidden md:flex flex-col w-64 border-r p-4 gap-4 bg-sidebar text-sidebar-foreground">
            <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg"/>
                <Skeleton className="h-6 w-32"/>
            </div>
            <div className="space-y-2 flex-1">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="mt-auto space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
  }

  const navLinks: (Tool & { permission?: string })[] = [
    {
      id: "dashboard",
      name: "Panel",
      description: "Visión general de las herramientas y actividad.",
      href: "/dashboard",
      icon: LayoutDashboard,
      bgColor: "bg-blue-500",
      textColor: "text-white",
      permission: "dashboard:access"
    },
    {
      id: "tickets",
      name: "Soporte Técnico",
      description: "Gestionar tickets y dar soporte a los clientes.",
      href: "/dashboard/tickets",
      icon: Ticket,
      bgColor: "bg-blue-500",
      textColor: "text-white",
      permission: "tickets:read:all"
    },
    {
      id: "customers",
      name: "Clientes",
      description: "Administrar base de clientes.",
      href: "/dashboard/customers",
      icon: Users,
      bgColor: "bg-amber-600",
      textColor: "text-white",
      permission: "customers:read"
    },
    {
      id: "contracts",
      name: "Contratos",
      description: "Contratos de soporte.",
      href: "/dashboard/contracts",
      icon: FileText,
      bgColor: "bg-indigo-600",
      textColor: "text-white",
      permission: "contracts:read"
    },
    {
      id: "licenses",
      name: "Licenciamiento",
      description: "Gestionar licencias de software.",
      href: "/dashboard/licenses",
      icon: KeyRound,
      bgColor: "bg-indigo-500",
      textColor: "text-white",
      permission: "licenses:read"
    },
     {
      id: "planner",
      name: "Gestor de Proyectos",
      description: "Gestionar y visualizar proyectos y tareas.",
      href: "/dashboard/planner",
      icon: CalendarCheck,
      bgColor: "bg-purple-500",
      textColor: "text-white",
      permission: "planner:read"
    },
    {
      id: "it-notes",
      name: "Notas de TI",
      description: "Base de conocimientos técnica.",
      href: "/dashboard/it-tools/notes",
      icon: BookCopy,
      bgColor: "bg-slate-700",
      textColor: "text-white",
      permission: "it-tools:access"
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
    {
      id: "analytics",
      name: "Analíticas",
      description: "Ver KPIs y reportes de todos los módulos.",
      href: "/dashboard/analytics",
      icon: AreaChart,
      bgColor: "bg-rose-600",
      textColor: "text-white",
      permission: "analytics:read"
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

  const financeLinks: (Tool & { permission: string })[] = [
    {
      id: "billing",
      name: "Facturación",
      description: "Gestionar horas cobrables.",
      href: "/dashboard/billing",
      icon: Receipt,
      bgColor: "bg-emerald-600",
      textColor: "text-white",
      permission: "billing:manage"
    },
    {
        id: "quoter",
        name: "Cotizador",
        description: "Crear cotizaciones.",
        href: "/dashboard/quoter",
        icon: SheetIcon,
        bgColor: "bg-green-500",
        textColor: "text-white",
        permission: "quotes:create"
    },
    {
        id: "cost-assistant",
        name: "Asistente de Costos",
        description: "Procesar XMLs.",
        href: "/dashboard/cost-assistant",
        icon: FileScan,
        bgColor: "bg-orange-600",
        textColor: "text-white",
        permission: "cost-assistant:access"
    },
  ];

  const visibleNavLinks = navLinks.filter(link => !link.permission || hasPermission(link.permission));
  const visibleFinanceLinks = financeLinks.filter(link => hasPermission(link.permission));

  return (
      <Sidebar collapsible="icon" className="border-r z-20">
        <SidebarHeader>
          <Button variant="ghost" size="icon" className="size-10" asChild>
            <Link href="/dashboard" onClick={handleLinkClick}>
              <Network />
            </Link>
          </Button>
          <h2 className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            {companyData?.systemName || 'Clic-Soporte'}
          </h2>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {visibleNavLinks.map((item) => (
                <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.name}
                    >
                    <Link href={item.href} onClick={handleLinkClick}>
                        <item.icon />
                        <span>{item.name}</span>
                    </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              )
            )}
          </SidebarMenu>

          {visibleFinanceLinks.length > 0 && (
            <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2 px-2 text-[10px] uppercase font-bold tracking-widest text-sidebar-foreground/40">
                    <Wallet className="h-3 w-3" />
                    <span>Gestión Financiera</span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {visibleFinanceLinks.map((item) => (
                            <SidebarMenuItem key={item.id}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive(item.href)}
                                    tooltip={item.name}
                                >
                                    <Link href={item.href} onClick={handleLinkClick}>
                                        <item.icon />
                                        <span>{item.name}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                asChild
                isActive={isActive("/dashboard/settings")}
                tooltip="Mi Perfil"
                >
                <Link href="/dashboard/settings" onClick={handleLinkClick}>
                    <Settings />
                    <span>Mi Perfil</span>
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            
            {hasAdminAccess && (
                 <SidebarMenuItem>
                    <SidebarMenuButton
                        asChild
                        isActive={isActive("/dashboard/admin")}
                        tooltip={{ children: "Administración", badgeCount: unreadSuggestionsCount }}
                    >
                        <Link href="/dashboard/admin" onClick={handleLinkClick} className="relative">
                           <Wrench />
                           <span>Administración</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            )}
          </SidebarMenu>
          <div className="flex items-center gap-2 p-2 mt-4 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <UserNav user={currentUser} />
            <div className="flex flex-col text-sm">
              <span className="font-semibold text-sidebar-foreground">
                {currentUser?.name}
              </span>
              <span className="text-sidebar-foreground/70">
                {currentUser?.email}
              </span>
            </div>
          </div>
           <div className="text-center text-xs text-sidebar-foreground/50 p-2 group-data-[collapsible=icon]:hidden">
                Clic-Soporte v2.0
           </div>
        </SidebarFooter>
      </Sidebar>
  );
}
