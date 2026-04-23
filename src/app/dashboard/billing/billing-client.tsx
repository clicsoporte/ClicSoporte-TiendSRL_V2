'use client';

/**
 * @fileoverview Client component for the Billing Management module.
 * Implements a Master-Detail layout for efficient billing reconciliation.
 * Enhanced with Multi-Ticket Activity Reports for clients.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCustomersWithPendingBilling, getBillingEntriesForCustomer, markEntriesAsInvoiced, getServiceReportEntries, type PendingCustomer } from '@/modules/billing/lib/actions';
import { format, parseISO, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Receipt, CheckCircle2, Search, Download, Mail, UserCircle, ChevronRight, AlertCircle, UserCheck, History, Clock, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { sendBillingStatementByEmail, sendServiceReportByEmail } from '@/modules/billing/lib/email-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { TimeEntry, DateRange } from '@/modules/core/types';
import type { RowInput } from 'jspdf-autotable';

interface BillingEntry extends TimeEntry {
    ticketConsecutive: string;
    serviceName: string;
    price: number;
    amount: number;
    userName: string;
}

export default function BillingClient() {
    const { toast } = useToast();
    const { companyData, user: currentUser, customers: allCustomers } = useAuth();
    const [customersWithActivity, setCustomersWithActivity] = useState<PendingCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Filters state
    const [filterPending, setFilterPending] = useState(true);
    const [filterUpToDate, setFilterUpToDate] = useState(false);

    // Selection state
    const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
    const [entries, setEntries] = useState<BillingEntry[]>([]);
    const [historyEntries, setHistoryEntries] = useState<BillingEntry[]>([]);
    const [reportEntries, setReportEntries] = useState<(TimeEntry & { ticketConsecutive: string, serviceName: string, userName: string })[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
    const [externalInvoice, setExternalInvoice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("pending");

    // Report Range State
    const [reportRange, setReportRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    // PDF & Email States
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isEmailDialogOpen, setEmailDialogOpen] = useState(false);
    const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getCustomersWithPendingBilling();
            setCustomersWithActivity(data);
        } catch {
            // Error logged by action
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredCustomers = useMemo(() => {
        const lowerSearch = searchTerm.trim().toLowerCase();
        
        let baseList = customersWithActivity;

        if (lowerSearch) {
            const searchBase = allCustomers
                .filter(c => 
                    (c.name || "").toLowerCase().includes(lowerSearch) || 
                    (c.id || "").toLowerCase().includes(lowerSearch) ||
                    (c.taxId || "").toLowerCase().includes(lowerSearch)
                )
                .map(c => {
                    const active = customersWithActivity.find(ac => ac.id === c.id);
                    return active || {
                        id: c.id,
                        name: c.name,
                        taxId: c.taxId,
                        pendingCount: 0,
                        totalAmount: 0,
                        currency: 'CRC'
                    };
                });
            baseList = searchBase;
        }

        return baseList.filter(c => {
            if (filterPending && c.pendingCount > 0) return true;
            if (filterUpToDate && c.pendingCount === 0) return true;
            return false;
        });
    }, [customersWithActivity, allCustomers, searchTerm, filterPending, filterUpToDate]);

    const linkedCustomerInfo = useMemo(() => {
        if (!selectedCustomer) return null;
        return allCustomers.find(c => c.id === selectedCustomer.id);
    }, [selectedCustomer, allCustomers]);

    const loadTabEntries = async (tab: string, customerId: string) => {
        setIsLoadingEntries(true);
        try {
            if (tab === 'pending') {
                const pending = await getBillingEntriesForCustomer(customerId, 'pending');
                setEntries(pending);
                setSelectedEntryIds(pending.map(e => e.id));
            } else if (tab === 'history') {
                const invoiced = await getBillingEntriesForCustomer(customerId, 'invoiced');
                setHistoryEntries(invoiced);
            } else if (tab === 'report' && reportRange?.from && reportRange?.to) {
                const activities = await getServiceReportEntries(
                    customerId, 
                    reportRange.from.toISOString(), 
                    reportRange.to.toISOString()
                );
                setReportEntries(activities);
            }
        } catch {
            toast({ title: "Error al cargar detalles", variant: "destructive" });
        } finally {
            setIsLoadingEntries(false);
        }
    };

    useEffect(() => {
        if (selectedCustomer && activeTab === 'report') {
            loadTabEntries('report', selectedCustomer.id);
        }
    }, [reportRange, selectedCustomer, activeTab]);

    const handleSelectCustomer = (customer: PendingCustomer) => {
        if (selectedCustomer?.id === customer.id) return;
        setSelectedCustomer(customer);
        setEntries([]);
        setHistoryEntries([]);
        setReportEntries([]);
        setSelectedEntryIds([]);
        loadTabEntries(activeTab, customer.id);
    };

    const handleMarkInvoiced = async () => {
        if (!externalInvoice || selectedEntryIds.length === 0) {
            toast({ title: "Faltan datos", description: "Ingrese el número de factura y seleccione al menos un item.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await markEntriesAsInvoiced(selectedEntryIds, externalInvoice);
            toast({ title: "Registros Actualizados", description: `Se marcaron ${selectedEntryIds.length} sesiones como facturadas.` });
            loadData();
            if (selectedCustomer) loadTabEntries('pending', selectedCustomer.id);
            setSelectedEntryIds([]);
            setExternalInvoice("");
        } catch {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleEntrySelection = (id: number) => {
        setSelectedEntryIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const totalSelected = useMemo(() => {
        return entries
            .filter(e => selectedEntryIds.includes(e.id))
            .reduce((acc, e) => acc + e.amount, 0);
    }, [entries, selectedEntryIds]);

    const formatCurrency = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleGeneratePDF = (tab: string) => {
        if (!selectedCustomer || !companyData) return;
        
        setIsGeneratingPDF(true);

        try {
            let docTitle = "";
            let tableRows: RowInput[] = [];
            let columns: string[] = [];
            let totalsList: { label: string, value: string }[] = [];
            let notes = "";

            if (tab === 'pending' || tab === 'history') {
                const targetEntries = tab === 'history' ? historyEntries : entries;
                docTitle = tab === 'history' ? "HISTORIAL DE SERVICIOS FACTURADOS" : "ESTADO DE CUENTA DE SERVICIOS";
                columns = ["Fecha", "Ticket", "Descripción / Labor", "Horas", "Subtotal"];
                tableRows = targetEntries.map(e => [
                    format(parseISO(e.startTime), 'dd/MM/yy'),
                    e.ticketConsecutive,
                    { content: `${e.serviceName}\n${e.notes || ''}`, styles: { fontSize: 8 } },
                    { content: (((e.billableDuration || e.duration || 0) / 3600000)).toFixed(2) + ' h', styles: { halign: 'center' as const } },
                    { content: formatCurrency(e.amount), styles: { halign: 'right' as const } }
                ]);
                totalsList = [{ label: tab === 'history' ? 'Total Facturado:' : 'Total Pendiente:', value: formatCurrency(targetEntries.reduce((acc, e) => acc + e.amount, 0)) }];
                notes = tab === 'history' ? "Resumen de servicios ya conciliados." : "Horas pendientes de facturar.";
            } else if (tab === 'report') {
                docTitle = "REPORTE DE ACTIVIDADES TÉCNICAS";
                columns = ["Fecha/Hora", "Ticket", "Labor / Actividad", "Técnico", "Cobertura", "Duración"];
                tableRows = reportEntries.map(e => [
                    format(parseISO(e.startTime), 'dd/MM/yy HH:mm'),
                    e.ticketConsecutive,
                    { content: `${e.serviceName}\n${e.notes || ''}`, styles: { fontSize: 8 } },
                    e.userName,
                    e.isBillable ? 'EXTRA' : 'CONTRATO',
                    { content: ((e.duration || 0) / 3600000).toFixed(2) + ' h', styles: { halign: 'right' as const } }
                ]);
                totalsList = [{ label: 'Total Horas Invertidas:', value: (reportEntries.reduce((acc, e) => acc + (e.duration || 0), 0) / 3600000).toFixed(2) + ' h' }];
                notes = `Reporte consolidado del periodo: ${format(reportRange?.from!, 'dd/MM/yyyy')} al ${format(reportRange?.to!, 'dd/MM/yyyy')}.`;
            }

            const doc = generateDocument({
                docTitle,
                docId: selectedCustomer.id,
                companyData,
                meta: [
                    { label: 'Fecha Emisión', value: format(new Date(), 'dd/MM/yyyy') },
                    { label: 'Cliente', value: selectedCustomer.name }
                ],
                blocks: [
                    { title: 'Información del Cliente', content: `Nombre: ${selectedCustomer.name}\nIdentificación: ${selectedCustomer.taxId}` }
                ],
                table: {
                    columns,
                    rows: tableRows,
                    columnStyles: tab === 'report' ? { 5: { halign: 'right' } } : { 4: { halign: 'right' } }
                },
                notes,
                totals: totalsList
            });

            doc.save(`${tab}_${selectedCustomer.id}.pdf`);
            toast({ title: "PDF Descargado" });
        } catch {
            toast({ title: "Error al generar PDF", variant: "destructive" });
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSendEmail = async () => {
        if (!selectedCustomer || selectedEmailRecipients.length === 0 || !companyData || !currentUser) return;
        
        setIsSendingEmail(true);
        try {
            if (activeTab === 'report') {
                await sendServiceReportByEmail({
                    recipients: selectedEmailRecipients,
                    companyData,
                    customerName: selectedCustomer.name,
                    entries: reportEntries,
                    dateRange: { 
                        from: format(reportRange?.from!, 'dd/MM/yyyy'), 
                        to: format(reportRange?.to!, 'dd/MM/yyyy') 
                    },
                    sender: currentUser
                });
            } else {
                await sendBillingStatementByEmail({
                    recipients: selectedEmailRecipients,
                    companyData,
                    customerName: selectedCustomer.name,
                    entries: activeTab === 'history' ? historyEntries : entries,
                    totalAmount: (activeTab === 'history' ? historyEntries : entries).reduce((acc, e) => acc + e.amount, 0),
                    sender: currentUser
                });
            }
            toast({ title: "Correo Enviado", description: `Se envió el reporte a ${selectedEmailRecipients.length} destinatario(s).` });
            setEmailDialogOpen(false);
        } catch (error: unknown) {
            toast({ title: "Error al enviar correo", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <main className="flex flex-col h-[calc(100vh-4rem)] bg-muted/20 overflow-hidden">
            <div className="p-4 md:p-6 bg-background border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Receipt className="h-6 w-6 text-primary" /> Auditoría y Reportes
                    </h1>
                    <p className="text-muted-foreground text-sm">Gestiona la facturación y genera reportes de actividad para clientes.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block border-r pr-4 mr-4">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Pendiente Global</p>
                        <p className="text-xl font-bold text-primary">
                            {formatCurrency(customersWithActivity.reduce((acc, c) => acc + c.totalAmount, 0))}
                        </p>
                    </div>
                    <Button variant="outline" onClick={loadData} size="sm">Actualizar</Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <aside className="w-full md:w-80 lg:w-96 border-r bg-background flex flex-col shrink-0">
                    <div className="p-4 border-b bg-muted/10 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 px-1">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="filter-pending" checked={filterPending} onCheckedChange={(checked) => setFilterPending(!!checked)} />
                                <Label htmlFor="filter-pending" className="text-xs font-bold cursor-pointer">Pendientes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="filter-uptodate" checked={filterUpToDate} onCheckedChange={(checked) => setFilterUpToDate(!!checked)} />
                                <Label htmlFor="filter-uptodate" className="text-xs font-bold cursor-pointer">Al día</Label>
                            </div>
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y">
                            {isLoading ? (
                                <div className="p-10 text-center"><Loader2 className="animate-spin inline-block h-6 w-6" /></div>
                            ) : filteredCustomers.length > 0 ? (
                                filteredCustomers.map(customer => (
                                    <div key={customer.id} className={cn("p-4 cursor-pointer transition-colors hover:bg-muted/50 flex items-center justify-between group", selectedCustomer?.id === customer.id ? "bg-primary/5 border-l-4 border-primary" : "border-l-4 border-transparent")} onClick={() => handleSelectCustomer(customer)}>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("font-bold text-sm truncate", selectedCustomer?.id === customer.id && "text-primary")}>{customer.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">{customer.taxId} | ID: {customer.id}</p>
                                            <div className="mt-1">
                                                {customer.pendingCount > 0 ? <Badge variant="destructive" className="text-[9px] h-4">{customer.pendingCount} pendientes</Badge> : <Badge variant="outline" className="text-[9px] h-4 text-green-600 border-green-200 bg-green-50">Al día</Badge>}
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedCustomer?.id === customer.id ? "translate-x-1 text-primary" : "opacity-0 group-hover:opacity-100")} />
                                    </div>
                                ))
                            ) : <div className="p-10 text-center text-muted-foreground italic text-sm">No hay resultados.</div>}
                        </div>
                    </ScrollArea>
                </aside>

                <section className="flex-1 flex flex-col bg-background overflow-hidden">
                    {selectedCustomer ? (
                        <>
                            <div className="p-6 border-b flex justify-between items-center bg-muted/5">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <UserCircle className="h-5 w-5 text-primary" />
                                        <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
                                    </div>
                                    <p className="text-xs text-muted-foreground">ID: {selectedCustomer.id} | Cédula: {selectedCustomer.taxId}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleGeneratePDF(activeTab)} disabled={isGeneratingPDF || isLoadingEntries}>
                                        {isGeneratingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                        PDF
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => { setSelectedEmailRecipients([]); setEmailDialogOpen(true); }} disabled={isLoadingEntries}>
                                        <Mail className="mr-2 h-4 w-4" /> Email
                                    </Button>
                                </div>
                            </div>

                            <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); loadTabEntries(val, selectedCustomer.id); }} className="flex-1 overflow-hidden flex flex-col">
                                <div className="px-6 border-b bg-muted/5">
                                    <TabsList className="bg-transparent h-14 p-0 gap-8">
                                        <TabsTrigger value="pending" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-14 font-bold flex gap-2">
                                            <Clock className="h-4 w-4" /> Pendientes
                                        </TabsTrigger>
                                        <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-14 font-bold flex gap-2">
                                            <History className="h-4 w-4" /> Facturados
                                        </TabsTrigger>
                                        <TabsTrigger value="report" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-14 font-bold flex gap-2 text-blue-600 data-[state=active]:text-blue-600">
                                            <FileText className="h-4 w-4" /> Reporte de Actividades
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
                                    <TabsContent value="pending" className="m-0 flex-1 overflow-hidden flex flex-col space-y-4">
                                        <div className="flex justify-between items-center bg-primary/5 p-4 rounded-lg border border-primary/10">
                                            <div>
                                                <p className="text-[10px] font-bold text-primary uppercase">Monto Seleccionado</p>
                                                <p className="text-2xl font-bold text-primary">{formatCurrency(totalSelected)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Items</p>
                                                <p className="text-xl font-bold">{selectedEntryIds.length} / {entries.length}</p>
                                            </div>
                                        </div>
                                        <ScrollArea className="flex-1 border rounded-md">
                                            {isLoadingEntries ? <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div> : (
                                                <Table>
                                                    <TableHeader className="bg-muted/50 sticky top-0 z-10"><TableRow><TableHead className="w-[40px]"><Checkbox checked={selectedEntryIds.length === entries.length && entries.length > 0} onCheckedChange={c => setSelectedEntryIds(c ? entries.map(e => e.id) : [])}/></TableHead><TableHead className="text-xs">Fecha</TableHead><TableHead className="text-xs">Ticket</TableHead><TableHead className="text-xs">Labor</TableHead><TableHead className="text-right text-xs">Horas</TableHead><TableHead className="text-right text-xs">Subtotal</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {entries.map(e => (
                                                            <TableRow key={e.id} className={cn(selectedEntryIds.includes(e.id) && "bg-primary/5")}>
                                                                <TableCell><Checkbox checked={selectedEntryIds.includes(e.id)} onCheckedChange={() => toggleEntrySelection(e.id)} /></TableCell>
                                                                <TableCell className="text-xs">{format(parseISO(e.startTime), 'dd/MM/yy')}</TableCell>
                                                                <TableCell className="font-mono text-xs font-bold text-muted-foreground">{e.ticketConsecutive}</TableCell>
                                                                <TableCell><p className="font-semibold text-xs">{e.serviceName}</p><p className="text-[10px] text-muted-foreground italic line-clamp-1">{e.notes}</p></TableCell>
                                                                <TableCell className="text-right text-xs font-mono">{((e.billableDuration || e.duration || 0) / 3600000).toFixed(2)}h</TableCell>
                                                                <TableCell className="text-right font-bold text-xs">{formatCurrency(e.amount)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </ScrollArea>
                                        <div className="pt-4 border-t bg-muted/10 p-4 rounded-lg flex flex-col sm:flex-row items-end gap-4">
                                            <div className="flex-1 w-full space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase">Nº Factura ERP</Label><Input value={externalInvoice} onChange={e => setExternalInvoice(e.target.value)} placeholder="Ej: F-001-98765" className="bg-background"/></div>
                                            <Button onClick={handleMarkInvoiced} disabled={!externalInvoice || selectedEntryIds.length === 0 || isSubmitting} className="px-8">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" />} Conciliar</Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="history" className="m-0 flex-1 overflow-hidden flex flex-col">
                                        <ScrollArea className="flex-1 border rounded-md">
                                            <Table>
                                                <TableHeader className="bg-muted/50 sticky top-0 z-10"><TableRow><TableHead className="text-xs">Fecha</TableHead><TableHead className="text-xs">Nº Factura</TableHead><TableHead className="text-xs">Ticket</TableHead><TableHead className="text-xs">Labor</TableHead><TableHead className="text-xs">Técnico</TableHead><TableHead className="text-right text-xs">Horas</TableHead><TableHead className="text-right text-xs">Total</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {historyEntries.map(e => (
                                                        <TableRow key={e.id}><TableCell className="text-xs">{format(parseISO(e.startTime), 'dd/MM/yy')}</TableCell><TableCell><Badge variant="outline" className="font-mono bg-blue-50 text-blue-700">{e.externalInvoiceNumber}</Badge></TableCell><TableCell className="font-mono text-xs font-bold">{e.ticketConsecutive}</TableCell><TableCell><p className="font-semibold text-xs">{e.serviceName}</p><p className="text-[10px] text-muted-foreground">{e.notes}</p></TableCell><TableCell className="text-xs">{e.userName}</TableCell><TableCell className="text-right text-xs">{( (e.billableDuration || e.duration || 0) / 3600000 ).toFixed(2)}h</TableCell><TableCell className="text-right font-bold text-xs">{formatCurrency(e.amount)}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="report" className="m-0 flex-1 overflow-hidden flex flex-col space-y-4">
                                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                            <div className="flex items-center gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-blue-700 uppercase">Periodo del Reporte</p>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" size="sm" className="h-9 gap-2">
                                                                <CalendarIcon className="h-4 w-4" />
                                                                {reportRange?.from ? (reportRange.to ? <>{format(reportRange.from, "dd/MM/yy")} - {format(reportRange.to, "dd/MM/yy")}</> : format(reportRange.from, "dd/MM/yy")) : "Rango de fechas"}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar mode="range" selected={reportRange} onSelect={setReportRange} numberOfMonths={2} locale={es} />
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="h-10 w-px bg-blue-200" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-blue-700 uppercase">Resumen</p>
                                                    <p className="text-sm font-bold text-blue-900">{reportEntries.length} labores encontradas</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setReportRange({ from: subDays(new Date(), 7), to: new Date() })} className="text-[10px] h-7 uppercase font-bold">Últimos 7 días</Button>
                                                <Button variant="ghost" size="sm" onClick={() => setReportRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })} className="text-[10px] h-7 uppercase font-bold">Mes Actual</Button>
                                            </div>
                                        </div>

                                        <ScrollArea className="flex-1 border rounded-md">
                                            {isLoadingEntries ? <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div> : (
                                                <Table>
                                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                        <TableRow>
                                                            <TableHead className="text-xs">Fecha/Hora</TableHead>
                                                            <TableHead className="text-xs">Ticket</TableHead>
                                                            <TableHead className="text-xs">Labor Realizada</TableHead>
                                                            <TableHead className="text-xs">Técnico</TableHead>
                                                            <TableHead className="text-xs">Cobertura</TableHead>
                                                            <TableHead className="text-right text-xs">Duración</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {reportEntries.map(e => (
                                                            <TableRow key={e.id}>
                                                                <TableCell className="text-xs">{format(parseISO(e.startTime), 'dd/MM HH:mm')}</TableCell>
                                                                <TableCell className="font-mono text-xs font-bold text-muted-foreground">{e.ticketConsecutive}</TableCell>
                                                                <TableCell><p className="font-semibold text-xs">{e.serviceName}</p><p className="text-[10px] text-muted-foreground line-clamp-1 italic">{e.notes}</p></TableCell>
                                                                <TableCell className="text-xs">{e.userName}</TableCell>
                                                                <TableCell><Badge variant={e.isBillable ? "destructive" : "secondary"} className="text-[9px] h-4 uppercase">{e.isBillable ? 'Extra' : 'Contrato'}</Badge></TableCell>
                                                                <TableCell className="text-right text-xs font-mono">{((e.duration || 0) / 3600000).toFixed(2)}h</TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {reportEntries.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No se encontraron actividades en el rango seleccionado.</TableCell></TableRow>}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </ScrollArea>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-muted/5">
                            <Receipt className="h-20 w-20 text-muted-foreground opacity-20 mb-4" />
                            <h3 className="text-lg font-bold">Auditoría de Cuentas y Actividades</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">Selecciona un cliente para gestionar sus cobros pendientes o generar reportes mensuales de servicio.</p>
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={isEmailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Enviar Informe por Correo</DialogTitle>
                        <DialogDescription>Seleccione los destinatarios de <strong>{selectedCustomer?.name}</strong>.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <ScrollArea className="max-h-60 pr-2">
                            {linkedCustomerInfo?.contacts && linkedCustomerInfo.contacts.length > 0 ? linkedCustomerInfo.contacts.map(c => (
                                <div key={c.id} className="flex items-center space-x-3 p-3 rounded-md border mb-2 hover:bg-muted/50 cursor-pointer" onClick={() => toggleRecipient(c.email)}>
                                    <Checkbox checked={selectedEmailRecipients.includes(c.email)} onCheckedChange={() => {}}/>
                                    <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{c.name}</p><p className="text-xs text-muted-foreground truncate">{c.email}</p></div>
                                </div>
                            )) : <div className="text-center py-6 text-xs text-muted-foreground border-2 border-dashed rounded-lg">Sin contactos.</div>}
                        </ScrollArea>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose><Button onClick={handleSendEmail} disabled={isSendingEmail || selectedEmailRecipients.length === 0}>{isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Enviar</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}