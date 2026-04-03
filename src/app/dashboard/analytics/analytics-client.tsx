/**
 * @fileoverview Client Component for the Analytics module.
 * Extracted from the main page to support server-side guarding.
 */
'use client';

import { useAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, CalendarCheck, Hourglass, Ticket, FileText, BadgeAlert, Coins, Receipt } from 'lucide-react';
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

export default function AnalyticsClient() {
    const { state, actions } = useAnalytics();
    const { isAuthReady } = useAuth();
    
    if (!isAuthReady || state.isLoading) {
        return <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-[400px] w-full" />
        </div>;
    }

    const formatCurrency = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

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
                    <TabsTrigger value="billing">Métricas de Facturación</TabsTrigger>
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
                    <div className="grid gap-4 md:grid-cols-2">
                        <StatCard title="Total Facturado (Periodo)" value={formatCurrency(state.kpis?.timeTracking.totalAmountInvoiced || 0)} icon={CheckCircle2} isLoading={state.isLoading} color="text-green-600" />
                        <StatCard title="Total por Cobrar (Pendiente)" value={formatCurrency(state.kpis?.timeTracking.totalAmountPending || 0)} icon={Receipt} isLoading={state.isLoading} color="text-orange-600" />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Facturación por Técnico</CardTitle>
                            <CardDescription>Monto generado por cada técnico basado en horas fuera de contrato.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Técnico</TableHead>
                                        <TableHead className="text-right">Horas Facturables</TableHead>
                                        <TableHead className="text-right">Monto Generado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.kpis?.timeTracking.byUser.map(user => (
                                        <TableRow key={user.userId}>
                                            <TableCell className="font-medium">{user.userName}</TableCell>
                                            <TableCell className="text-right">{user.billable.toFixed(2)} h</TableCell>
                                            <TableCell className="text-right font-bold text-primary">{formatCurrency(user.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
    );
}
