'use client';

/**
 * @fileoverview Client component for the Billing Management module.
 * Implements a Master-Detail layout for efficient billing reconciliation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCustomersWithPendingBilling, getBillingEntriesForCustomer, markEntriesAsInvoiced, type PendingCustomer } from '@/modules/billing/lib/actions';
import { format, parseISO } from 'date-fns';
import { Loader2, Receipt, CheckCircle2, Search, Download, Mail, UserCircle, ChevronRight, AlertCircle, UserCheck, History, Clock } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { sendBillingStatementByEmail } from '@/modules/billing/lib/email-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TimeEntry } from '@/modules/core/types';
import type { RowInput } from 'jspdf-autotable';

interface BillingEntry extends TimeEntry {
    ticketConsecutive: string;
    serviceName: string;
    price: number;
    amount: number;
}

export default function BillingClient() {
    const { toast } = useToast();
    const { companyData, user: currentUser, customers: allCustomers } = useAuth();
    const [customersWithActivity, setCustomersWithActivity] = useState<PendingCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Selection state
    const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
    const [entries, setEntries] = useState<BillingEntry[]>([]);
    const [historyEntries, setHistoryEntries] = useState<BillingEntry[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
    const [externalInvoice, setExternalInvoice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("pending");

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
        
        // If searching, search in ALL customers from Auth context
        if (lowerSearch) {
            return allCustomers
                .filter(c => 
                    (c.name || "").toLowerCase().includes(lowerSearch) || 
                    (c.id || "").toLowerCase().includes(lowerSearch) ||
                    (c.taxId || "").toLowerCase().includes(lowerSearch)
                )
                .map(c => {
                    // Enrich with existing activity data if present
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
        }
        
        // If not searching, only show those with any activity
        return customersWithActivity;
    }, [customersWithActivity, allCustomers, searchTerm]);

    const linkedCustomerInfo = useMemo(() => {
        if (!selectedCustomer) return null;
        return allCustomers.find(c => c.id === selectedCustomer.id);
    }, [selectedCustomer, allCustomers]);

    const handleSelectCustomer = async (customer: PendingCustomer) => {
        if (selectedCustomer?.id === customer.id) return;
        
        setSelectedCustomer(customer);
        setEntries([]);
        setHistoryEntries([]);
        setSelectedEntryIds([]);
        setIsLoadingEntries(true);
        try {
            const [pending, invoiced] = await Promise.all([
                getBillingEntriesForCustomer(customer.id, 'pending'),
                getBillingEntriesForCustomer(customer.id, 'invoiced')
            ]);
            setEntries(pending);
            setHistoryEntries(invoiced);
            setSelectedEntryIds(pending.map(e => e.id)); // Select all pending by default
            setActiveTab(pending.length > 0 ? "pending" : "history"); 
        } catch {
            toast({ title: "Error al cargar detalles", variant: "destructive" });
        } finally {
            setIsLoadingEntries(false);
        }
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
            
            // Refresh local state and sidebar
            const movedEntries = entries.filter(e => selectedEntryIds.includes(e.id)).map(e => ({ ...e, billingStatus: 'invoiced' as const, externalInvoiceNumber: externalInvoice }));
            const remainingEntries = entries.filter(e => !selectedEntryIds.includes(e.id));
            
            setEntries(remainingEntries);
            setHistoryEntries(prev => [...movedEntries, ...prev]);
            setSelectedEntryIds([]);
            setExternalInvoice("");
            
            // Re-fetch customer list to update sidebar totals
            loadData();
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

    // --- PDF & Email Implementation ---

    const handleGeneratePDF = (isHistory = false) => {
        if (!selectedCustomer || !companyData) return;
        const targetEntries = isHistory ? historyEntries : entries;
        if (targetEntries.length === 0) return;

        setIsGeneratingPDF(true);

        try {
            const tableRows = targetEntries.map(e => [
                format(parseISO(e.startTime), 'dd/MM/yy'),
                e.ticketConsecutive,
                { content: `${e.serviceName}\n${e.notes || ''}`, styles: { fontSize: 8 } },
                { content: (((e.billableDuration || e.duration || 0) / 3600000)).toFixed(2) + ' h', styles: { halign: 'center' as const } },
                { content: formatCurrency(e.amount), styles: { halign: 'right' as const } }
            ]);

            const doc = generateDocument({
                docTitle: isHistory ? "HISTORIAL DE SERVICIOS FACTURADOS" : "ESTADO DE CUENTA DE SERVICIOS",
                docId: isHistory ? "HIST-FACT" : "PEND-ACTUAL",
                companyData,
                meta: [
                    { label: 'Fecha Emisión', value: format(new Date(), 'dd/MM/yyyy') },
                    { label: 'Cliente', value: selectedCustomer.name }
                ],
                blocks: [
                    { title: 'Información del Cliente', content: `Nombre: ${selectedCustomer.name}\nIdentificación: ${selectedCustomer.taxId}` }
                ],
                table: {
                    columns: ["Fecha", "Ticket", "Descripción / Labor", "Horas", "Subtotal"],
                    rows: tableRows as RowInput[],
                    columnStyles: { 4: { halign: 'right' } }
                },
                notes: isHistory 
                    ? "Este documento es un resumen de los servicios de soporte ya conciliados y facturados en el ERP."
                    : "Este documento detalla las horas de soporte técnico que se encuentran pendientes de facturar en el ERP.",
                totals: [
                    { label: isHistory ? 'Total Facturado:' : 'Total Pendiente:', value: formatCurrency(targetEntries.reduce((acc, e) => acc + e.amount, 0)) }
                ]
            });

            doc.save(`${isHistory ? 'historial' : 'estado_cuenta'}_${selectedCustomer.id}.pdf`);
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
            await sendBillingStatementByEmail({
                recipients: selectedEmailRecipients,
                companyData,
                customerName: selectedCustomer.name,
                entries,
                totalAmount: entries.reduce((acc, e) => acc + e.amount, 0),
                sender: currentUser
            });
            toast({ title: "Correo Enviado", description: `Se envió el estado de cuenta a ${selectedEmailRecipients.length} destinatario(s).` });
            setEmailDialogOpen(false);
        } catch (error: unknown) {
            toast({ title: "Error al enviar correo", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <main className="flex flex-col h-[calc(100vh-4rem)] bg-muted/20 overflow-hidden">
            {/* Header Area */}
            <div className="p-4 md:p-6 bg-background border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Receipt className="h-6 w-6 text-primary" /> Gestión de Facturación
                    </h1>
                    <p className="text-muted-foreground text-sm">Audita y concilia las horas de soporte con tu ERP.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block border-r pr-4 mr-4">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Pendiente Global</p>
                        <p className="text-xl font-bold text-primary">
                            {formatCurrency(customersWithActivity.reduce((acc, c) => acc + c.totalAmount, 0))}
                        </p>
                    </div>
                    <Button variant="outline" onClick={loadData} size="sm">
                        Actualizar Lista
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Column 1: Customer List (Master) */}
                <aside className="w-full md:w-80 lg:w-96 border-r bg-background flex flex-col shrink-0">
                    <div className="p-4 border-b bg-muted/10">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar cualquier cliente..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="pl-9 h-10"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y">
                            {isLoading ? (
                                <div className="p-10 text-center"><Loader2 className="animate-spin inline-block h-6 w-6" /></div>
                            ) : filteredCustomers.length > 0 ? (
                                filteredCustomers.map(customer => (
                                    <div 
                                        key={customer.id} 
                                        className={cn(
                                            "p-4 cursor-pointer transition-colors hover:bg-muted/50 flex items-center justify-between group",
                                            selectedCustomer?.id === customer.id ? "bg-primary/5 border-l-4 border-primary" : "border-l-4 border-transparent"
                                        )}
                                        onClick={() => handleSelectCustomer(customer)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("font-bold text-sm truncate", selectedCustomer?.id === customer.id && "text-primary")}>{customer.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">{customer.taxId} | ID: {customer.id}</p>
                                            <div className="mt-1 flex items-center gap-2">
                                                {customer.pendingCount > 0 ? (
                                                    <>
                                                        <Badge variant="destructive" className="text-[9px] h-4">{customer.pendingCount} pendientes</Badge>
                                                        <span className="text-xs font-bold text-primary">{formatCurrency(customer.totalAmount)}</span>
                                                    </>
                                                ) : (
                                                    <Badge variant="outline" className="text-[9px] h-4 text-green-600 border-green-200 bg-green-50">Al día</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedCustomer?.id === customer.id ? "translate-x-1 text-primary" : "opacity-0 group-hover:opacity-100")} />
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 text-center text-muted-foreground italic text-sm">
                                    No se encontraron clientes que coincidan con la búsqueda.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </aside>

                {/* Column 2: Detail View */}
                <section className="flex-1 flex flex-col bg-background overflow-hidden">
                    {selectedCustomer ? (
                        <>
                            {/* Detail Header */}
                            <div className="p-6 border-b flex justify-between items-center bg-muted/5">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <UserCircle className="h-5 w-5 text-primary" />
                                        <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
                                    </div>
                                    <p className="text-sm text-muted-foreground">ID: {selectedCustomer.id} | Cédula: {selectedCustomer.taxId}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleGeneratePDF(activeTab === 'history')} disabled={isGeneratingPDF || (activeTab === 'pending' && entries.length === 0) || (activeTab === 'history' && historyEntries.length === 0)}>
                                        {isGeneratingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                        PDF
                                    </Button>
                                    {activeTab === 'pending' && entries.length > 0 && (
                                        <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)}>
                                            <Mail className="mr-2 h-4 w-4" /> 
                                            Email
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Main Content Area with Tabs */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                                <div className="px-6 border-b bg-muted/5">
                                    <TabsList className="bg-transparent h-14 p-0 gap-8">
                                        <TabsTrigger 
                                            value="pending" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-14 font-bold flex gap-2 hover:text-primary transition-all"
                                        >
                                            <Clock className="h-4 w-4" /> Pendientes de Cobro ({entries.length})
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="history" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-14 font-bold flex gap-2 hover:text-primary transition-all"
                                        >
                                            <History className="h-4 w-4" /> Historial de Facturados ({historyEntries.length})
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
                                    <TabsContent value="pending" className="m-0 flex-1 overflow-hidden flex flex-col space-y-4">
                                        {entries.length > 0 ? (
                                            <>
                                                <div className="flex justify-between items-center bg-primary/5 p-4 rounded-lg border border-primary/10">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-primary uppercase">Monto Seleccionado para Facturar</p>
                                                        <p className="text-2xl font-bold text-primary">{formatCurrency(totalSelected)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Items Seleccionados</p>
                                                        <p className="text-xl font-bold">{selectedEntryIds.length} / {entries.length}</p>
                                                    </div>
                                                </div>

                                                <ScrollArea className="flex-1 border rounded-md bg-card">
                                                    {isLoadingEntries ? (
                                                        <div className="flex flex-col items-center justify-center p-20 gap-2">
                                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                            <p className="text-sm text-muted-foreground">Cargando desglose...</p>
                                                        </div>
                                                    ) : (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/50 sticky top-0 z-10">
                                                                    <TableHead className="w-[40px]">
                                                                        <Checkbox 
                                                                            checked={selectedEntryIds.length === entries.length && entries.length > 0} 
                                                                            onCheckedChange={(checked) => setSelectedEntryIds(checked ? entries.map(e => e.id) : [])}
                                                                        />
                                                                    </TableHead>
                                                                    <TableHead className="text-xs">Fecha</TableHead>
                                                                    <TableHead className="text-xs">Ticket</TableHead>
                                                                    <TableHead className="text-xs">Detalle de Labor</TableHead>
                                                                    <TableHead className="text-right text-xs">Horas</TableHead>
                                                                    <TableHead className="text-right text-xs">Subtotal</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {entries.map(entry => (
                                                                    <TableRow key={entry.id} className={cn(selectedEntryIds.includes(entry.id) && "bg-primary/5")}>
                                                                        <TableCell>
                                                                            <Checkbox checked={selectedEntryIds.includes(entry.id)} onCheckedChange={() => toggleEntrySelection(entry.id)} />
                                                                        </TableCell>
                                                                        <TableCell className="text-xs">{format(parseISO(entry.startTime), 'dd/MM/yy')}</TableCell>
                                                                        <TableCell className="font-mono text-xs font-bold text-muted-foreground">{entry.ticketConsecutive}</TableCell>
                                                                        <TableCell>
                                                                            <p className="font-semibold text-xs">{entry.serviceName}</p>
                                                                            <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{entry.notes || 'Sin descripción'}</p>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-xs font-mono">{( (entry.billableDuration || entry.duration || 0) / 3600000 ).toFixed(2)} h</TableCell>
                                                                        <TableCell className="text-right font-bold text-xs">{formatCurrency(entry.amount)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    )}
                                                </ScrollArea>

                                                {/* Action Bar for Pending */}
                                                <div className="pt-4 border-t bg-muted/10 p-4 rounded-lg">
                                                    <div className="flex flex-col sm:flex-row items-end gap-4 max-w-2xl">
                                                        <div className="flex-1 w-full space-y-1.5">
                                                            <Label htmlFor="external-invoice" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                                <Receipt className="h-3 w-3" /> Nº Factura Generada en ERP
                                                            </Label>
                                                            <Input 
                                                                id="external-invoice"
                                                                value={externalInvoice} 
                                                                onChange={e => setExternalInvoice(e.target.value)} 
                                                                placeholder="Ej: F-001-98765" 
                                                                className="h-10 bg-background" 
                                                            />
                                                        </div>
                                                        <Button 
                                                            onClick={handleMarkInvoiced} 
                                                            disabled={!externalInvoice || selectedEntryIds.length === 0 || isSubmitting}
                                                            className="h-10 px-8 shadow-md"
                                                        >
                                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                            Conciliar y Cerrar Pendientes
                                                        </Button>
                                                    </div>
                                                    <p className="mt-2 text-[10px] text-muted-foreground italic flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" /> Al confirmar, los registros seleccionados se marcarán como facturados y pasarán al historial.
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center border-2 border-dashed rounded-xl bg-muted/10">
                                                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4 opacity-20" />
                                                <h3 className="font-bold text-muted-foreground uppercase tracking-wider">Sin Pendientes</h3>
                                                <p className="text-sm text-muted-foreground max-w-xs mt-2">Este cliente no tiene sesiones de soporte por facturar en este momento.</p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="history" className="m-0 flex-1 overflow-hidden flex flex-col">
                                        <ScrollArea className="flex-1 border rounded-md bg-card">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50 sticky top-0 z-10">
                                                        <TableHead className="text-xs">Fecha</TableHead>
                                                        <TableHead className="text-xs">Nº Factura ERP</TableHead>
                                                        <TableHead className="text-xs">Ticket</TableHead>
                                                        <TableHead className="text-xs">Detalle de Labor</TableHead>
                                                        <TableHead className="text-right text-xs">Horas</TableHead>
                                                        <TableHead className="text-right text-xs">Total Conciliado</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {historyEntries.map(entry => (
                                                        <TableRow key={entry.id}>
                                                            <TableCell className="text-xs">{format(parseISO(entry.startTime), 'dd/MM/yy')}</TableCell>
                                                            <TableCell><Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-200">{entry.externalInvoiceNumber}</Badge></TableCell>
                                                            <TableCell className="font-mono text-xs font-bold text-muted-foreground">{entry.ticketConsecutive}</TableCell>
                                                            <TableCell>
                                                                <p className="font-semibold text-xs">{entry.serviceName}</p>
                                                                <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{entry.notes || 'Sin descripción'}</p>
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs font-mono">{( (entry.billableDuration || entry.duration || 0) / 3600000 ).toFixed(2)} h</TableCell>
                                                            <TableCell className="text-right font-bold text-xs">{formatCurrency(entry.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {historyEntries.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No hay historial de facturación registrado para este cliente.</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-muted/5">
                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Receipt className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold">Auditoría de Cuentas por Cliente</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Selecciona un cliente de la lista para ver su detalle. Puedes buscar cualquier cliente de tu base de datos para consultar su historial de facturación, incluso si no tiene pagos pendientes.
                            </p>
                        </div>
                    )}
                </section>
            </div>

            {/* Email Selection Dialog */}
            <Dialog open={isEmailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            Enviar Estado de Cuenta
                        </DialogTitle>
                        <DialogDescription>
                            Seleccione los destinatarios de <strong>{selectedCustomer?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
                            {linkedCustomerInfo?.contacts && linkedCustomerInfo.contacts.length > 0 ? (
                                linkedCustomerInfo.contacts.map((contact) => (
                                    <div key={contact.id} className="flex items-center space-x-3 p-3 rounded-md border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => {
                                        const email = contact.email;
                                        setSelectedEmailRecipients(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
                                    }}>
                                        <Checkbox 
                                            id={`contact-${contact.id}`} 
                                            checked={selectedEmailRecipients.includes(contact.email)}
                                            onCheckedChange={() => {}}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{contact.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] uppercase font-bold">{contact.department || 'Gral'}</Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                                    <UserCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-xs text-muted-foreground">Este cliente no tiene contactos registrados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail || selectedEmailRecipients.length === 0}>
                            {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Enviar Ahora
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
