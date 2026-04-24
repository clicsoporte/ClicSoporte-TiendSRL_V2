/**
 * @fileoverview Client Component for the Analytics module.
 * Redesigned to centralize Management reporting and Operational reports for clients.
 */
'use client';

import { useAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Ticket, Coins, Receipt, CheckCircle2, PieChart as PieIcon, BarChart3, Users, Wrench, FileText, Calendar as CalendarIcon, Download, Mail, Loader2, UserCircle, Search, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Customer, TimeEntry, DateRange, Consumable } from '@/modules/core/types';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { getServiceReportEntries } from '@/modules/billing/lib/actions';
import { getConsumablesReport } from '@/modules/analytics/lib/actions';
import { useToast } from '@/modules/core/hooks/use-toast';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { sendServiceReportByEmail } from '@/modules/billing/lib/email-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { RowInput } from 'jspdf-autotable';

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
    const { isAuthReady, customers: allCustomers, companyData, user: currentUser } = useAuth();
    const { hasPermission } = useAuthorization();
    const { toast } = useToast();
    
    // Service Reporting States
    const [selectedCustomerForReport, setSelectedCustomerForReport] = useState<Customer | null>(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [reportEntries, setReportEntries] = useState<(TimeEntry & { ticketConsecutive: string, serviceName: string, userName: string })[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportRange, setReportRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    // Consumables Reporting States
    const [consumablesData, setConsumablesData] = useState<(Consumable & { clientId: string, customerName: string, equipmentName: string })[]>([]);
    const [isLoadingConsumables, setIsLoadingConsumables] = useState(false);
    const [consumableSearch, setConsumablesSearch] = useState("");

    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return allCustomers;
        const lower = customerSearchTerm.toLowerCase();
        return allCustomers.filter(c => 
            c.name.toLowerCase().includes(lower) || 
            (c.id && c.id.toLowerCase().includes(lower))
        );
    }, [allCustomers, customerSearchTerm]);

    const fetchReportData = useCallback(async () => {
        if (!selectedCustomerForReport || !reportRange?.from || !reportRange?.to) return;
        setIsLoadingReport(true);
        try {
            const data = await getServiceReportEntries(
                selectedCustomerForReport.id,
                reportRange.from.toISOString(),
                reportRange.to.toISOString()
            );
            setReportEntries(data);
        } catch {
            toast({ title: "Error al cargar reporte", variant: "destructive" });
        } finally {
            setIsLoadingReport(false);
        }
    }, [selectedCustomerForReport, reportRange, toast]);

    const fetchConsumables = useCallback(async () => {
        setIsLoadingConsumables(true);
        try {
            const data = await getConsumablesReport();
            setConsumablesData(data || []);
        } catch (e) {
            console.error(e);
            setConsumablesData([]);
        } finally {
            setIsLoadingConsumables(false);
        }
    }, []);

    useEffect(() => {
        if (selectedCustomerForReport && reportRange?.from && reportRange?.to) {
            fetchReportData();
        }
    }, [selectedCustomerForReport, reportRange, fetchReportData]);

    const filteredConsumables = useMemo(() => {
        if (!consumableSearch) return consumablesData;
        const lower = consumableSearch.toLowerCase();
        return consumablesData.filter(c => 
            (c.customerName || "").toLowerCase().includes(lower) || 
            (c.description || "").toLowerCase().includes(lower) || 
            (c.partNumber || "").toLowerCase().includes(lower) || 
            (c.equipmentName || "").toLowerCase().includes(lower)
        );
    }, [consumablesData, consumableSearch]);

    const handleGeneratePDF = () => {
        if (!selectedCustomerForReport || !companyData || !reportRange?.from || !reportRange?.to) return;
        setIsGeneratingPDF(true);
        try {
            const columns = ["Fecha/Hora", "Ticket", "Labor / Actividad", "Técnico", "Cobertura", "Duración"];
            const tableRows: RowInput[] = reportEntries.map(e => [
                format(parseISO(e.startTime), 'dd/MM/yy HH:mm'),
                e.ticketConsecutive,
                { content: `${e.serviceName}\n${e.notes || ''}`, styles: { fontSize: 8 } },
                e.userName,
                e.isBillable ? 'EXTRA' : 'CONTRATO',
                { content: ((e.duration || 0) / 3600000).toFixed(2) + ' h', styles: { halign: 'right' as const } }
            ]);

            const doc = generateDocument({
                docTitle: "REPORTE DE ACTIVIDADES TÉCNICAS",
                docId: selectedCustomerForReport.id,
                companyData,
                meta: [
                    { label: 'Fecha Emisión', value: format(new Date(), 'dd/MM/yyyy') },
                    { label: 'Cliente', value: selectedCustomerForReport.name },
                    { label: 'Periodo', value: `${format(reportRange.from, 'dd/MM/yy')} al ${format(reportRange.to, 'dd/MM/yy')}` }
                ],
                blocks: [
                    { title: 'Información del Cliente', content: `Nombre: ${selectedCustomerForReport.name}\nIdentificación: ${selectedCustomerForReport.taxId}` }
                ],
                table: {
                    columns,
                    rows: tableRows,
                    columnStyles: { 5: { halign: 'right' } }
                },
                notes: `Reporte consolidado generado desde el panel de analíticas.`,
                totals: [{ label: 'Total Horas Invertidas:', value: (reportEntries.reduce((acc, e) => acc + (e.duration || 0), 0) / 3600000).toFixed(2) + ' h' }]
            });

            doc.save(`reporte_actividades_${selectedCustomerForReport.id}.pdf`);
            toast({ title: "PDF Descargado" });
        } catch {
            toast({ title: "Error al generar PDF", variant: "destructive" });
        } finally {
            setIsGeneratingReport(false); // Correct variable name
            setIsGeneratingPDF(false);
        }
    };

    const handleGenerateConsumablesPDF = () => {
        if (!companyData) return;
        setIsGeneratingPDF(true);
        try {
            const columns = ["Cliente", "Equipo", "Tipo", "Descripción", "Número de Parte"];
            const tableRows: RowInput[] = filteredConsumables.map(c => [
                c.customerName,
                c.equipmentName,
                c.type.toUpperCase(),
                c.description,
                { content: c.partNumber, styles: { font: 'courier' } }
            ]);

            const doc = generateDocument({
                docTitle: "AUDITORÍA DE CONSUMIBLES POR CLIENTE",
                docId: "REPORTE-INSUMOS",
                companyData,
                meta: [{ label: 'Fecha Emisión', value: format(new Date(), 'dd/MM/yyyy') }],
                blocks: [{ title: 'Resumen', content: `Este reporte detalla los consumibles e insumos críticos vinculados a los equipos de hardware de la cartera de clientes.` }],
                table: {
                    columns,
                    rows: tableRows,
                    columnStyles: { 4: { fontStyle: 'bold' } }
                },
                notes: "Listado informativo para gestión de compras y preventa de insumos.",
                totals: [{ label: 'Total Insumos Listados:', value: filteredConsumables.length.toString() }]
            });

            doc.save(`auditoria_consumibles_${format(new Date(), 'yyyyMMdd')}.pdf`);
            toast({ title: "PDF Generado" });
        } catch {
            toast({ title: "Error al generar PDF", variant: "destructive" });
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Email/PDF Reporting States
    const [isEmailDialogOpen, setEmailDialogOpen] = useState(false);
    const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const handleSendEmail = async () => {
        if (!selectedCustomerForReport || selectedEmailRecipients.length === 0 || !companyData || !currentUser || !reportRange?.from || !reportRange?.to) return;
        setIsSendingEmail(true);
        try {
            await sendServiceReportByEmail({
                recipients: selectedEmailRecipients,
                companyData,
                customerName: selectedCustomerForReport.name,
                entries: reportEntries,
                dateRange: { 
                    from: format(reportRange.from, 'dd/MM/yyyy'), 
                    to: format(reportRange.to, 'dd/MM/yyyy') 
                },
                sender: currentUser
            });
            toast({ title: "Correo Enviado", description: `Se envió el reporte a ${selectedEmailRecipients.length} destinatario(s).` });
            setEmailDialogOpen(false);
        } catch (error: unknown) {
            toast({ title: "Error al enviar correo", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSendingEmail(false);
        }
    };

    // Flickering Prevention Logic: Only show skeleton on first data load
    const isInitialLoading = !isAuthReady || (state.isLoading && !state.kpis);

    if (isInitialLoading) {
        return (
            <div className="p-8 space-y-6">
                <div className="flex justify-between items-center"><Skeleton className="h-10 w-64" /><Skeleton className="h-10 w-48" /></div>
                <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    const canViewFinancials = hasPermission('view:provider:costs');
    const formatCurrency = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 relative">
            {/* Subtle Refresh Indicator to prevent skeleton swap */}
            {state.isRefreshing && (
                <div className="absolute top-2 right-8 z-50 flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold animate-in fade-in slide-in-from-top-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Actualizando datos...
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <AreaChart className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Centro de Inteligencia y Reportes</h1>
                        <p className="text-xs text-muted-foreground">Analíticas globales y generación de informes para clientes.</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button type="button" variant={"outline"} size="sm" className={cn("w-[280px] justify-start text-left font-normal", !state.dateRange && "text-muted-foreground")}>
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
                    <Button type="button" size="sm" variant="ghost" onClick={() => actions.setDateRange(undefined)}>Limpiar</Button>
                </div>
            </div>

            <div className={cn("transition-opacity duration-300", state.isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100")}>
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-muted p-1 flex flex-wrap h-auto gap-1">
                        <TabsTrigger value="overview" className="flex items-center gap-2"><PieIcon className="h-4 w-4"/> Resumen General</TabsTrigger>
                        {canViewFinancials && <TabsTrigger value="billing" className="flex items-center gap-2"><Coins className="h-4 w-4"/> Rentabilidad</TabsTrigger>}
                        <TabsTrigger value="efficiency" className="flex items-center gap-2"><BarChart3 className="h-4 w-4"/> Eficiencia</TabsTrigger>
                        <TabsTrigger value="client-reports" className="flex items-center gap-2 text-blue-600 data-[state=active]:text-blue-600"><FileText className="h-4 w-4"/> Reportes de Cliente</TabsTrigger>
                        <TabsTrigger value="consumables" onClick={fetchConsumables} className="flex items-center gap-2 text-orange-600 data-[state=active]:text-orange-600"><Package className="h-4 w-4"/> Consumibles</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Total de Casos" value={state.kpis?.tickets.total || 0} icon={Ticket} isLoading={state.isLoading} color="text-primary" />
                            <StatCard title="Proyectos TI" value={state.kpis?.projects.total || 0} icon={AreaChart} isLoading={state.isLoading} color="text-purple-600" />
                            <StatCard title="Tickets Abiertos" value={state.kpis?.tickets.open || 0} icon={CheckCircle2} isLoading={state.isLoading} color="text-blue-600" />
                            <StatCard title="Casos Resueltos" value={state.kpis?.tickets.completed || 0} icon={CheckCircle2} isLoading={state.isLoading} color="text-green-600" />
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary"/> Top 10 Clientes por Volumen</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={state.kpis?.byCustomer || []} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" hide /><YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#F97316" radius={[0, 4, 4, 0]} name="Tickets" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4 text-primary"/> Distribución por Tema</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={state.kpis?.byTopic || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="label" label={({ label }) => label}>
                                                {(state.kpis?.byTopic || []).map((_entry, index: number) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {canViewFinancials && (
                        <TabsContent value="billing" className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <StatCard title="Facturación Realizada" value={formatCurrency(state.kpis?.timeTracking.totalAmountInvoiced || 0)} icon={CheckCircle2} isLoading={state.isLoading} color="text-green-600" />
                                <StatCard title="Pendiente por Cobrar" value={formatCurrency(state.kpis?.timeTracking.totalAmountPending || 0)} icon={Receipt} isLoading={state.isLoading} color="text-orange-600" />
                            </div>
                            <div className="grid gap-6 md:grid-cols-3">
                                <Card className="md:col-span-1">
                                    <CardHeader><CardTitle className="text-base">Mix de Modalidades</CardTitle></CardHeader>
                                    <CardContent className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={state.kpis?.byBillingType || []} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                                                    {(state.kpis?.byBillingType || []).map((_entry, index: number) => (<Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#10B981'} />))}
                                                </Pie>
                                                <Tooltip /><Legend verticalAlign="bottom" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                                <Card className="md:col-span-2">
                                    <CardHeader><CardTitle className="text-base">Productividad por Técnico</CardTitle></CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Técnico</TableHead><TableHead className="text-right">Horas Bajo Contrato</TableHead><TableHead className="text-right">Monto Facturable</TableHead></TableRow></TableHeader>
                                            <TableBody>{(state.kpis?.timeTracking.byUser || []).map((u) => (<TableRow key={u.userId}><TableCell className="font-medium">{u.userName}</TableCell><TableCell className="text-right font-mono">{u.billable.toFixed(2)} h</TableCell><TableCell className="text-right font-bold text-primary">{formatCurrency(u.amount)}</TableCell></TableRow>))}</TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="efficiency" className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-7">
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle className="text-base">Inversión de Tiempo por Técnico</CardTitle>
                                </CardHeader>
                                <CardContent className="h-80">
                                    <ChartContainer config={{}} className="h-full w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={state.kpis?.timeTracking.byUser || []}>
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
                                <CardHeader><CardTitle className="text-base">Desglose Global de Tiempo</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 border rounded-lg bg-green-50/50 flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600"><Coins className="h-5 w-5" /></div><div><p className="text-[10px] text-muted-foreground uppercase font-black">Bajo Contrato</p><p className="text-xl font-black">{(state.kpis?.timeTracking.totalBillable || 0).toFixed(1)} h</p></div></div></div>
                                    <div className="p-4 border rounded-lg bg-orange-50/50 flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><Coins className="h-5 w-5" /></div><div><p className="text-[10px] text-muted-foreground uppercase font-black">Fuera de Contrato</p><p className="text-xl font-black">{(state.kpis?.timeTracking.totalNonBillable || 0).toFixed(1)} h</p></div></div></div>
                                    <div className="p-4 border rounded-lg bg-blue-50/50 flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><AreaChart className="h-5 w-5" /></div><div><p className="text-[10px] text-muted-foreground uppercase font-black">Total Invertido</p><p className="text-xl font-black">{(state.kpis?.timeTracking.totalHours || 0).toFixed(1)} h</p></div></div></div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="client-reports" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <Card className="lg:col-span-1">
                                <CardHeader><CardTitle className="text-sm uppercase font-black">1. Seleccionar Cliente</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={customerSearchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearchTerm(e.target.value)} className="pl-8" /></div>
                                    <ScrollArea className="h-[400px] pr-2">
                                        {filteredCustomers.map(c => (
                                            <div key={c.id} onClick={() => setSelectedCustomerForReport(c)} className={cn("p-3 border rounded-md mb-2 cursor-pointer transition-colors hover:bg-muted/50", selectedCustomerForReport?.id === c.id ? "border-primary bg-primary/5" : "border-transparent")}>
                                                <p className="text-xs font-bold truncate">{c.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono">{c.id}</p>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <div className="lg:col-span-3 space-y-6">
                                {selectedCustomerForReport ? (
                                    <>
                                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
                                            <div className="flex items-center gap-4">
                                                <UserCircle className="h-10 w-10 text-blue-600" />
                                                <div><p className="text-[10px] font-bold text-blue-700 uppercase">Cliente Seleccionado</p><p className="font-black text-blue-900">{selectedCustomerForReport.name}</p></div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-9 gap-2"><CalendarIcon className="h-4 w-4" /> {reportRange?.from ? (reportRange.to ? <>{format(reportRange.from, "dd/MM/yy")} - {format(reportRange.to, "dd/MM/yy")}</> : format(reportRange.from, "dd/MM/yy")) : "Rango"}</Button></PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="end"><Calendar mode="range" selected={reportRange} onSelect={setReportRange} numberOfMonths={2} locale={es} /></PopoverContent>
                                                </Popover>
                                                <Button type="button" size="sm" variant="outline" onClick={handleGeneratePDF} disabled={isGeneratingPDF}>{isGeneratingPDF ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4 mr-2" />} PDF</Button>
                                                <Button type="button" size="sm" onClick={() => { setSelectedEmailRecipients([]); setEmailDialogOpen(true); }}><Mail className="h-4 w-4 mr-2" /> Email</Button>
                                            </div>
                                        </div>

                                        <Card>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-xs">Fecha/Hora</TableHead><TableHead className="text-xs">Ticket</TableHead><TableHead className="text-xs">Actividad</TableHead><TableHead className="text-xs">Técnico</TableHead><TableHead className="text-xs">Cobertura</TableHead><TableHead className="text-right text-xs">Duración</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {isLoadingReport ? <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="animate-spin inline-block" /></TableCell></TableRow> : (
                                                            reportEntries.length > 0 ? reportEntries.map(e => (
                                                                <TableRow key={e.id}><TableCell className="text-[11px]">{format(parseISO(e.startTime), 'dd/MM HH:mm')}</TableCell><TableCell className="font-mono text-[11px] font-bold">{e.ticketConsecutive}</TableCell><TableCell><p className="text-xs font-bold">{e.serviceName}</p><p className="text-[10px] text-muted-foreground italic line-clamp-1">{e.notes}</p></TableCell><TableCell className="text-[11px]">{e.userName}</TableCell><TableCell><Badge variant={e.isBillable ? "destructive" : "secondary"} className="text-[9px] h-4 uppercase">{e.isBillable ? 'Extra' : 'Contrato'}</Badge></TableCell><TableCell className="text-right text-[11px] font-mono">{((e.duration || 0) / 3600000).toFixed(2)}h</TableCell></TableRow>
                                                            )) : <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic">No hay actividades en este rango.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                            <CardFooter className="bg-muted/10 p-4 border-t flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Total Invertido en Periodo:</span><span className="text-xl font-black text-primary">{(reportEntries.reduce((acc, e) => acc + (e.duration || 0), 0) / 3600000).toFixed(2)} horas</span></CardFooter>
                                        </Card>
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-20 border-2 border-dashed rounded-2xl opacity-40"><FileText className="h-20 w-20 mb-4" /><p className="text-lg font-bold">Generador de Reportes de Servicio</p><p className="text-sm">Seleccione un cliente a la izquierda para ver su historial y generar informes.</p></div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="consumables" className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-orange-600"/> Reporte Maestro de Consumibles</CardTitle>
                                    <CardDescription>Listado de insumos y piezas críticas por cliente y equipo de hardware.</CardDescription>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={handleGenerateConsumablesPDF} disabled={isGeneratingPDF || filteredConsumables.length === 0}>
                                    {isGeneratingPDF ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4 mr-2" />} Exportar PDF
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="relative max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar por cliente, consumible o P/N..." 
                                        value={consumableSearch} 
                                        onChange={e => setConsumablesSearch(e.target.value)} 
                                        className="pl-9"
                                    />
                                </div>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="text-xs">Cliente</TableHead>
                                                <TableHead className="text-xs">Equipo</TableHead>
                                                <TableHead className="text-xs">Tipo Insumo</TableHead>
                                                <TableHead className="text-xs">Descripción</TableHead>
                                                <TableHead className="text-xs">Número de Parte (P/N)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingConsumables ? (
                                                <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader2 className="animate-spin inline-block" /></TableCell></TableRow>
                                            ) : filteredConsumables.length > 0 ? (
                                                filteredConsumables.map((c, idx) => (
                                                    <TableRow key={`${c.id}-${idx}`} className="group hover:bg-muted/30">
                                                        <TableCell className="text-xs font-bold">{c.customerName}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{c.equipmentName}</TableCell>
                                                        <TableCell><Badge variant="secondary" className="text-[10px] uppercase">{c.type}</Badge></TableCell>
                                                        <TableCell className="text-xs font-medium">{c.description}</TableCell>
                                                        <TableCell className="font-mono text-xs font-black text-primary">{c.partNumber}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">No se encontraron consumibles registrados.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t p-4 flex justify-between items-center">
                                <span className="text-xs font-bold text-muted-foreground uppercase">Total de Insumos Registrados:</span>
                                <span className="text-xl font-black text-orange-600">{filteredConsumables.length}</span>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={isEmailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Enviar Reporte</DialogTitle><DialogDescription>Seleccione los destinatarios de <strong>{selectedCustomerForReport?.name}</strong>.</DialogDescription></DialogHeader>
                    <div className="py-4"><ScrollArea className="max-h-60 pr-2">{selectedCustomerForReport?.contacts && selectedCustomerForReport.contacts.length > 0 ? selectedCustomerForReport.contacts.map(c => (<div key={c.id} className="flex items-center space-x-3 p-3 rounded-md border mb-2 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedEmailRecipients(prev => prev.includes(c.email) ? prev.filter(e => e !== c.email) : [...prev, c.email])}><Checkbox checked={selectedEmailRecipients.includes(c.email)} /><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{c.name}</p><p className="text-xs text-muted-foreground truncate">{c.email}</p></div></div>)) : <div className="text-center py-6 text-xs text-muted-foreground italic border-2 border-dashed rounded-lg">Sin contactos registrados.</div>}</ScrollArea></div>
                    <DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button type="button" onClick={handleSendEmail} disabled={isSendingEmail || selectedEmailRecipients.length === 0}>{isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Enviar Informe</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
