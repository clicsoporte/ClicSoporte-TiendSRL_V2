/**
 * @fileoverview The main dashboard page, providing an operational snapshot and tool access.
 */
'use client';

import { mainTools } from "../../modules/core/lib/data";
import { ToolCard } from "../../components/dashboard/tool-card";
import { useEffect, useState, useCallback } from "react";
import type { Tool, DashboardStats } from "../../modules/core/types";
import { Skeleton } from "../../components/ui/skeleton";
import { usePageTitle } from "../../modules/core/hooks/usePageTitle";
import { Wrench, Ticket, CalendarCheck, FileText, AlertCircle, Plus } from "lucide-react";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/modules/analytics/lib/actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const StatWidget = ({ title, value, subValue, icon: Icon, colorClass, href }: { title: string, value: number, subValue?: string, icon: any, colorClass: string, href: string }) => (
    <Link href={href} className="block transition-transform hover:scale-[1.02]">
        <Card className="overflow-hidden border-none shadow-md bg-white">
            <div className={cn("h-1 w-full", colorClass)}></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
                <Icon className={cn("h-4 w-4", colorClass.replace('bg-', 'text-'))} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {subValue && <p className="text-[10px] text-muted-foreground mt-1">{subValue}</p>}
            </CardContent>
        </Card>
    </Link>
);

export default function DashboardPage() {
  const { userRole, isLoading: isAuthLoading, unreadSuggestionsCount } = useAuth();
  const [visibleTools, setVisibleTools] = useState<Tool[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  const fetchStats = useCallback(async () => {
      try {
          const data = await getDashboardStats();
          setStats(data);
      } finally {
          setIsStatsLoading(false);
      }
  }, []);

  useEffect(() => {
    setTitle("Panel Principal");
    fetchStats();
    
    if (userRole) {
      const tools = [...mainTools];
      const hasAdminAccess = userRole.id === 'admin' || userRole.permissions?.some(p => p.startsWith('admin:'));

      if (hasAdminAccess) {
        tools.push({
          id: "admin",
          name: "Administración",
          description: "Gestionar usuarios, roles y sistema.",
          href: "/dashboard/admin",
          icon: Wrench,
          bgColor: "bg-slate-600",
          textColor: "text-white",
        });
      }
      setVisibleTools(tools);
    }
  }, [setTitle, userRole, fetchStats]);


  if (isAuthLoading) {
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
        </main>
    )
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Resumen de Operaciones
                </h2>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                        <Link href="/dashboard/tickets"><Plus className="mr-1 h-3 w-3"/> Ticket</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                        <Link href="/dashboard/quoter"><Plus className="mr-1 h-3 w-3"/> Cotización</Link>
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {isStatsLoading ? (
                    [1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full" />)
                ) : (
                    <>
                        <StatWidget 
                            title="Soporte Activo" 
                            value={stats?.activeTickets || 0} 
                            subValue={stats?.urgentTickets ? `${stats.urgentTickets} Urgentes` : 'Sin casos críticos'}
                            icon={Ticket} 
                            colorClass={stats?.urgentTickets ? "bg-red-600" : "bg-blue-500"} 
                            href="/dashboard/tickets"
                        />
                        <StatWidget 
                            title="Proyectos TI" 
                            value={stats?.activeProjects || 0} 
                            subValue="En ejecución / pruebas"
                            icon={CalendarCheck} 
                            colorClass="bg-purple-600" 
                            href="/dashboard/planner"
                        />
                        <StatWidget 
                            title="Contratos por Vencer" 
                            value={stats?.expiringContracts || 0} 
                            subValue="Próximos 30 días"
                            icon={FileText} 
                            colorClass={stats?.expiringContracts ? "bg-orange-500" : "bg-green-600"} 
                            href="/dashboard/contracts"
                        />
                        <StatWidget 
                            title="Sugerencias" 
                            value={unreadSuggestionsCount} 
                            subValue="Feedback del equipo"
                            icon={AlertCircle} 
                            colorClass="bg-emerald-600" 
                            href="/dashboard/admin/suggestions"
                        />
                    </>
                )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Accesos Directos
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTools.map((tool) => {
                const isAdminTool = tool.id === 'admin';
                const badgeCount = isAdminTool ? unreadSuggestionsCount : 0;
                return <ToolCard key={tool.id} tool={tool} badgeCount={badgeCount} />
              })}
            </div>
          </section>
        </div>
      </main>
  );
}
