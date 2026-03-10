/**
 * @fileoverview Analytics page with Billing Report focus.
 */
'use client';

import { useAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, CalendarCheck, Hourglass, Ticket, FileText, BadgeAlert, Coins } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ title, value, icon: Icon, isLoading, color = "text-muted-foreground" }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean, color?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-tight text-muted-foreground">{title}</CardTitle>
            <Icon className={cn("h-4 w-4", color)} />
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

export default function AnalyticsPage() {
    const { state, actions } = useAnalytics();
    const { isLoading: isAuthLoading } = useAuth();
    
    if (isAuthLoading || state.isLoading) {
        return <div className="p-8"><Skeleton className="h-full w-full" /></div>;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <AreaChart className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Inteligencia de Negocio</h1>
                        <p className="text-xs text-muted-foreground">Monitoreo de carga de trabajo y facturación.</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} size="sm" className={cn("w-[280px] justify-start text-left font-normal", !state.dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {state.dateRange?.from ? (
                                    state.dateRange.to ? (
                                        <>{format(state.dateRange.from, "dd LLL", { locale: es })} - {format(state.dateRange.to, "dd LLL, y", { locale: es })}</>
                                    ) : (format(state.dateRange.from, "dd LLL, y", { locale: es }))
                                ) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar initialFocus mode="range" defaultMonth={state.dateRange?.from} selected={state.dateRange} onSelect={actions.setDateRange} numberOfMonths={2} locale={es} />
                        </PopoverContent>
                    </Popover>
                    <Button size="sm" variant="ghost" onClick={() => actions.setDateRange(undefined)}>Limpiar</Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Resumen Operativo</TabsTrigger>
                    <TabsTrigger value="billing">Reporte de Facturación</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Tickets Abiertos" value={state.kpis?.tickets.open || 0} icon={Ticket} isLoading={state.isLoading} color="text-green-600" />
                        <StatCard title="En Progreso" value={state.kpis?.tickets.in_progress || 0} icon={Hourglass} isLoading={state.isLoading} color="text-blue-600" />
                        <StatCard title="Proyectos Activos" value={state.kpis?.projects.in_progress || 0} icon={CalendarCheck} isLoading={state.isLoading} color="text-purple-600" />
                        <StatCard title="Facturables Pendientes" value={state.kpis?.tickets.billable_pending || 0} icon={BadgeAlert} isLoading={state.isLoading} color="text-destructive" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader><CardTitle>Carga de Trabajo por Técnico (Horas)</CardTitle></CardHeader>
                            <CardContent className="h-80">
                                <ChartContainer config={{}} className="h-full w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={state.kpis?.timeTracking.byUser}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="userName" tickLine={false} tickMargin={10} axisLine={false} />
                                            <YAxis />
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Legend />
                                            <Bar dataKey="billable" fill="var(--color-chart-2)" radius={4} name="Contrato" />
                                            <Bar dataKey="nonBillable" fill="var(--color-chart-5)" radius={4} name="Fuera de Contrato" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                        <Card className="col-span-3">
                            <CardHeader><CardTitle>Distribución de Tiempo</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 border rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><FileText className="h-5 w-5" /></div>
                                        <div><p className="text-xs text-muted-foreground uppercase font-bold">Total Bajo Contrato</p><p className="text-xl font-bold">{(state.kpis?.timeTracking.totalBillable || 0).toFixed(1)} h</p></div>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive"><Coins className="h-5 w-5" /></div>
                                        <div><p className="text-xs text-muted-foreground uppercase font-bold">Total Facturable Extra</p><p className="text-xl font-bold">{(state.kpis?.timeTracking.totalNonBillable || 0).toFixed(1)} h</p></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="billing" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tickets Facturables Fuera de Contrato</CardTitle>
                            <CardDescription>Estos casos no están cubiertos por los contratos de soporte y deben ser cobrados por separado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Caso</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Servicio</TableHead>
                                        <TableHead>Horas</TableHead>
                                        <TableHead>Tercero</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Mocking billing data for demonstration as it requires complex aggregation */}
                                    <TableRow>
                                        <TableCell className="font-mono">CAS-000124</TableCell>
                                        <TableCell>Corporación ABC</TableCell>
                                        <TableCell>Configuración Router</TableCell>
                                        <TableCell>2.5 h</TableCell>
                                        <TableCell>Ninguno</TableCell>
                                        <TableCell><Badge variant="outline">Pendiente</Badge></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-mono">CAS-000130</TableCell>
                                        <TableCell>Tienda El Sol</TableCell>
                                        <TableCell>Reparación Hardware</TableCell>
                                        <TableCell>1.0 h</TableCell>
                                        <TableCell>Dell Support</TableCell>
                                        <TableCell><Badge variant="outline">Pendiente</Badge></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
    );
}