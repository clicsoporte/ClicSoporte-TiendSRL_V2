/**
 * @fileoverview Client Component for the Analytics module.
 * Redesigned for comprehensive Management Reporting (Volume, Profitability, and Operations).
 */
'use client';

import { useAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, CalendarCheck, Ticket, FileText, Coins, Receipt, CheckCircle2, PieChart as PieIcon, BarChart3, Users, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
import type { VolumeKpi } from '@/modules/core/types';

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

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#F59E0B', '#6366F1'];

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
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <Skeleton className="h-[400px] w-full" />
        </div>;
    }

    const formatCurrency = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header / Date Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <AreaChart className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Inteligencia de Negocio</h1>
                        <p className="text-xs text-muted-foreground">Desempeño operativo y métricas financieras.</p>
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
                <TabsList className="bg-muted p-1">
                    <TabsTrigger value="overview" className="flex items-center gap-2"><PieIcon className="h-4 w-4"/> Casos y Volumen</TabsTrigger>
                    <TabsTrigger value="billing" className="flex items-center gap-2"><Coins className="h-4 w-4"/> Rentabilidad</TabsTrigger>
                    <TabsTrigger value="efficiency" className="flex items-center gap-2"><BarChart3 className="h-4 w-4"/> Eficiencia Técnica</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: CASOS Y VOLUMEN --- */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total de Casos" value={state.kpis?.tickets.total || 0} icon={Ticket} isLoading={state.isLoading} color="text-primary" />
                        <StatCard title="Proyectos TI" value={state.kpis?.projects.total || 0} icon={CalendarCheck} isLoading={state.isLoading} color="text-purple-600" />
                        <StatCard title="Tickets Abiertos" value={state.kpis?.tickets.open || 0} icon={CheckCircle2} isLoading={state.isLoading} color="text-blue-600" />
                        <StatCard title="Casos Resueltos" value={state.kpis?.tickets.completed || 0} icon={CheckCircle2} isLoading={state.isLoading} color="text-green-600" />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Top Clientes */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary"/> Top 10 Clientes por Volumen</CardTitle>
                                <CardDescription>Empresas con mayor demanda de soporte.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={state.kpis?.byCustomer} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#F97316" radius={[0, 4, 4, 0]} name="Tickets" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Distribución por Tema */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4 text-primary"/> Distribución por Tema de Ayuda</CardTitle>
                                <CardDescription>Categorías de problemas más comunes.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={state.kpis?.byTopic}
                                            cx="50%" cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            nameKey="label"
                                            label={({ label }: VolumeKpi) => label}
                                        >
                                            {state.kpis?.byTopic.map((_entry: VolumeKpi, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- TAB 2: RENTABILIDAD --- */}
                <TabsContent value="billing" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <StatCard title="Facturación Realizada" value={formatCurrency(state.kpis?.timeTracking.totalAmountInvoiced || 0)} icon={CheckCircle2} isLoading={state.isLoading} color="text-green-600" />
                        <StatCard title="Pendiente por Cobrar" value={formatCurrency(state.kpis?.timeTracking.totalAmountPending || 0)} icon={Receipt} isLoading={state.isLoading} color="text-orange-600" />
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {/* Mix de Cobro */}
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-base">Mix de Modalidades</CardTitle>
                                <CardDescription>Proporción Hora vs Tarea.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={state.kpis?.byBillingType}
                                            cx="50%" cy="50%"
                                            outerRadius={80}
                                            dataKey="value"
                                            label
                                        >
                                            {state.kpis?.byBillingType.map((_entry: VolumeKpi, index: number) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#10B981'} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Facturación por Técnico */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base">Productividad Financiera por Técnico</CardTitle>
                                <CardDescription>Monto facturable generado por cada colaborador.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Técnico</TableHead>
                                            <TableHead className="text-right">Horas Bajo Contrato</TableHead>
                                            <TableHead className="text-right">Monto Facturable (Extra)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {state.kpis?.timeTracking.byUser.map((user: { userId: number; userName: string; billable: number; nonBillable: number; amount: number }) => (
                                            <TableRow key={user.userId}>
                                                <TableCell className="font-medium">{user.userName}</TableCell>
                                                <TableCell className="text-right font-mono">{user.billable.toFixed(2)} h</TableCell>
                                                <TableCell className="text-right font-bold text-primary">{formatCurrency(user.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- TAB 3: EFICIENCIA TÉCNICA --- */}
                <TabsContent value="efficiency" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle className="text-base">Consumo de Horas por Técnico</CardTitle>
                                <CardDescription>Comparativa de tiempo invertido.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-80">
                                <ChartContainer config={{}} className="h-full w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={state.kpis?.timeTracking.byUser}>
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                            <XAxis dataKey="userName" tick={{ fontSize: 10 }} axisLine={false} />
                                            <YAxis />
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Legend />
                                            <Bar dataKey="billable" fill="#10B981" radius={4} name="Bajo Contrato" />
                                            <Bar dataKey="nonBillable" fill="#F97316" radius={4} name="Fuera de Contrato" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                        
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle className="text-base">Desglose de Tiempo Global</CardTitle>
                                <CardDescription>Total de la operación en el periodo.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 border rounded-lg bg-green-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600"><FileText className="h-5 w-5" /></div>
                                        <div><p className="text-[10px] text-muted-foreground uppercase font-black">Bajo Contrato</p><p className="text-xl font-black">{(state.kpis?.timeTracking.totalBillable || 0).toFixed(1)} h</p></div>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg bg-orange-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><FileText className="h-5 w-5" /></div>
                                        <div><p className="text-[10px] text-muted-foreground uppercase font-black">Fuera de Contrato</p><p className="text-xl font-black">{(state.kpis?.timeTracking.totalNonBillable || 0).toFixed(1)} h</p></div>
                                    </div>
                                </div>
                                <div className="p-4 border rounded-lg bg-blue-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><AreaChart className="h-5 w-5" /></div>
                                        <div><p className="text-[10px] text-muted-foreground uppercase font-black">Total Invertido</p><p className="text-xl font-black">{(state.kpis?.timeTracking.totalHours || 0).toFixed(1)} h</p></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </main>
    );
}
