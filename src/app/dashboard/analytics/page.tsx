
/**
 * @fileoverview Main page for the Analytics module.
 * Displays key performance indicators and visualizations from across the application.
 */
'use client';

import { useAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, BarChart as BarChartIcon, Bell, Box, CalendarCheck, FileText, Hourglass, Ticket, Users } from 'lucide-react';
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

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
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
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
                 <div className="flex justify-between items-center">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-10 w-80" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-1">
                    <Skeleton className="h-96 w-full" />
                </div>
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <AreaChart className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold">Analíticas y Reportes</h1>
                </div>
                 <div className="flex items-center gap-2">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-[300px] justify-start text-left font-normal",
                                !state.dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {state.dateRange?.from ? (
                                state.dateRange.to ? (
                                    <>
                                    {format(state.dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                    {format(state.dateRange.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(state.dateRange.from, "LLL dd, y", { locale: es })
                                )
                                ) : (
                                <span>Seleccionar rango de fechas</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={state.dateRange?.from}
                                selected={state.dateRange}
                                onSelect={actions.setDateRange}
                                numberOfMonths={2}
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={() => actions.setDateRange(undefined)}>Limpiar</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Tickets Abiertos" value={state.kpis?.tickets.open || 0} icon={Ticket} isLoading={state.isLoading} />
                <StatCard title="Tickets en Progreso" value={state.kpis?.tickets.in_progress || 0} icon={Hourglass} isLoading={state.isLoading} />
                <StatCard title="Proyectos Activos" value={state.kpis?.projects.in_progress || 0} icon={CalendarCheck} isLoading={state.isLoading} />
                <StatCard title="Compras Pendientes" value={state.kpis?.requests.pending || 0} icon={Bell} isLoading={state.isLoading} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Horas Registradas por Técnico</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ChartContainer config={{}} className="h-80 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={state.kpis?.timeTracking.byUser}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="userName" tickLine={false} tickMargin={10} axisLine={false} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend />
                                    <Bar dataKey="billable" fill="var(--color-chart-2)" radius={4} name="Facturable" />
                                    <Bar dataKey="nonBillable" fill="var(--color-chart-5)" radius={4} name="No Facturable" />
                                </BarChart>
                             </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                 <Card className="col-span-1 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Resumen General de Tiempos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <Hourglass className="h-6 w-6 text-blue-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Horas Facturables</p>
                                    <p className="text-2xl font-bold">{(state.kpis?.timeTracking.totalBillable || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                         <div className="flex justify-between items-center p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <Box className="h-6 w-6 text-orange-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Horas No Facturables</p>
                                    <p className="text-2xl font-bold">{(state.kpis?.timeTracking.totalNonBillable || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-4 border bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Users className="h-6 w-6 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Horas Totales Registradas</p>
                                    <p className="text-2xl font-bold">{(state.kpis?.timeTracking.totalHours || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
