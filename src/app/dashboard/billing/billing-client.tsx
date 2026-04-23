'use client';

/**
 * @fileoverview Client component for the Billing Management module.
 * Optimized for financial reconciliation and marking items as invoiced.
 * (Reporting functionality moved to Analytics module).
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
import { Loader2, Receipt, CheckCircle2, Search, History, Clock } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TimeEntry } from '@/modules/core/types';

interface BillingEntry extends TimeEntry {
    ticketConsecutive: string;
    serviceName: string;
    price: number;
    amount: number;
    userName: string;
}

export default function BillingClient() {
    const { toast } = useToast();
    const { customers: allCustomers } = useAuth();
    const [customersWithActivity, setCustomersWithActivity] = useState<PendingCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    const [filterPending, setFilterPending] = useState(true);
    const [filterUpToDate, setFilterUpToDate] = useState(false);

    const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
    const [entries, setEntries] = useState<BillingEntry[]>([]);
    const [historyEntries, setHistoryEntries] = useState<BillingEntry[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
    const [externalInvoice, setExternalInvoice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("pending");

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getCustomersWithPendingBilling();
            setCustomersWithActivity(data);
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
            baseList = allCustomers
                .filter(c => 
                    (c.name || "").toLowerCase().includes(lowerSearch) || 
                    (c.id || "").toLowerCase().includes(lowerSearch)
                )
                .map(c => customersWithActivity.find(ac => ac.id === c.id) || {
                    id: c.id, name: c.name, taxId: c.taxId, pendingCount: 0, totalAmount: 0, currency: 'CRC'
                });
        }

        return baseList.filter(c => {
            if (filterPending && c.pendingCount > 0) return true;
            if (filterUpToDate && c.pendingCount === 0) return true;
            return false;
        });
    }, [customersWithActivity, allCustomers, searchTerm, filterPending, filterUpToDate]);

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
            }
        } catch {
            toast({ title: "Error al cargar detalles", variant: "destructive" });
        } finally {
            setIsLoadingEntries(false);
        }
    };

    const handleSelectCustomer = (customer: PendingCustomer) => {
        if (selectedCustomer?.id === customer.id) return;
        setSelectedCustomer(customer);
        setEntries([]);
        setHistoryEntries([]);
        setSelectedEntryIds([]);
        loadTabEntries(activeTab, customer.id);
    };

    const handleMarkInvoiced = async () => {
        if (!externalInvoice || selectedEntryIds.length === 0) {
            toast({ title: "Faltan datos", description: "Ingrese el número de factura.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await markEntriesAsInvoiced(selectedEntryIds, externalInvoice);
            toast({ title: "Registros Actualizados", description: "Conciliación exitosa." });
            loadData();
            if (selectedCustomer) loadTabEntries('pending', selectedCustomer.id);
            setSelectedEntryIds([]);
            setExternalInvoice("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

    return (
        <main className="flex flex-col h-[calc(100vh-4rem)] bg-muted/20 overflow-hidden">
            <div className="p-4 md:p-6 bg-background border-b flex justify-between items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Conciliación de Facturación</h1>
                    <p className="text-muted-foreground text-sm">Gestiona el cobro de horas extras y servicios adicionales.</p>
                </div>
                <div className="text-right hidden md:block border-l pl-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Pendiente Global</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(customersWithActivity.reduce((acc, c) => acc + c.totalAmount, 0))}</p>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <aside className="w-80 lg:w-96 border-r bg-background flex flex-col shrink-0">
                    <div className="p-4 border-b space-y-4">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" /></div>
                        <div className="flex gap-4 px-1">
                            <div className="flex items-center space-x-2"><Checkbox id="f-p" checked={filterPending} onCheckedChange={v => setFilterPending(!!v)} /><Label htmlFor="f-p" className="text-xs font-bold">Pendientes</Label></div>
                            <div className="flex items-center space-x-2"><Checkbox id="f-u" checked={filterUpToDate} onCheckedChange={v => setFilterUpToDate(!!v)} /><Label htmlFor="f-u" className="text-xs font-bold">Al día</Label></div>
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y">
                            {isLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin inline-block" /></div> : 
                                filteredCustomers.map(c => (
                                    <div key={c.id} onClick={() => handleSelectCustomer(c)} className={cn("p-4 cursor-pointer transition-all hover:bg-muted/50 border-l-4", selectedCustomer?.id === c.id ? "bg-primary/5 border-primary" : "border-transparent")}>
                                        <p className={cn("font-bold text-sm", selectedCustomer?.id === c.id && "text-primary")}>{c.name}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            {c.pendingCount > 0 ? <Badge variant="destructive" className="text-[9px]">{c.pendingCount} pend.</Badge> : <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700">Al día</Badge>}
                                            <p className="text-[10px] font-mono text-muted-foreground">{formatCurrency(c.totalAmount)}</p>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </ScrollArea>
                </aside>

                <section className="flex-1 flex flex-col bg-background overflow-hidden">
                    {selectedCustomer ? (
                        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); loadTabEntries(v, selectedCustomer.id); }} className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-6 border-b bg-muted/5">
                                <TabsList className="bg-transparent h-14 p-0 gap-8">
                                    <TabsTrigger value="pending" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 font-bold flex gap-2"><Clock className="h-4 w-4" /> Cobros Pendientes</TabsTrigger>
                                    <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 font-bold flex gap-2"><History className="h-4 w-4" /> Historial Facturado</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-hidden p-6">
                                <TabsContent value="pending" className="m-0 flex-1 flex flex-col space-y-4 h-full">
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex justify-between items-center">
                                        <div><p className="text-[10px] font-bold text-primary uppercase">Seleccionado para Cobro</p><p className="text-2xl font-black text-primary">{formatCurrency(entries.filter(e => selectedEntryIds.includes(e.id)).reduce((acc, e) => acc + e.amount, 0))}</p></div>
                                        <div className="text-right"><p className="text-[10px] font-bold text-muted-foreground uppercase">Cant. Sesiones</p><p className="text-xl font-bold">{selectedEntryIds.length}</p></div>
                                    </div>
                                    <ScrollArea className="flex-1 border rounded-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead className="w-[40px]"><Checkbox checked={selectedEntryIds.length === entries.length && entries.length > 0} onCheckedChange={v => setSelectedEntryIds(v ? entries.map(e => e.id) : [])} /></TableHead><TableHead className="text-xs">Fecha</TableHead><TableHead className="text-xs">Ticket</TableHead><TableHead className="text-xs">Labor</TableHead><TableHead className="text-right text-xs">Monto</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {isLoadingEntries ? <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin inline-block" /></TableCell></TableRow> : 
                                                    entries.map(e => (
                                                        <TableRow key={e.id} className={cn(selectedEntryIds.includes(e.id) && "bg-primary/5")}>
                                                            <TableCell><Checkbox checked={selectedEntryIds.includes(e.id)} onCheckedChange={() => setSelectedEntryIds(prev => prev.includes(e.id) ? prev.filter(i => i !== e.id) : [...prev, e.id])} /></TableCell>
                                                            <TableCell className="text-xs">{format(parseISO(e.startTime), 'dd/MM/yy')}</TableCell>
                                                            <TableCell className="font-mono text-xs font-bold text-muted-foreground">{e.ticketConsecutive}</TableCell>
                                                            <TableCell><p className="font-semibold text-xs">{e.serviceName}</p><p className="text-[10px] text-muted-foreground line-clamp-1">{e.notes}</p></TableCell>
                                                            <TableCell className="text-right font-bold text-xs">{formatCurrency(e.amount)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                }
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                    <div className="bg-muted/10 p-4 rounded-lg flex flex-col sm:flex-row items-end gap-4 border">
                                        <div className="flex-1 w-full space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase">Nº Factura Generada en ERP</Label><Input value={externalInvoice} onChange={e => setExternalInvoice(e.target.value)} placeholder="Ej: F-001-987" className="bg-background"/></div>
                                        <Button onClick={handleMarkInvoiced} disabled={!externalInvoice || selectedEntryIds.length === 0 || isSubmitting} className="px-8">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" />} Conciliar</Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="m-0 flex-1 h-full">
                                    <ScrollArea className="h-full border rounded-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead className="text-xs">Fecha</TableHead><TableHead className="text-xs">Nº Factura</TableHead><TableHead className="text-xs">Ticket</TableHead><TableHead className="text-xs">Labor</TableHead><TableHead className="text-right text-xs">Total</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {historyEntries.map(e => (
                                                    <TableRow key={e.id}><TableCell className="text-xs">{format(parseISO(e.startTime), 'dd/MM/yy')}</TableCell><TableCell><Badge variant="outline" className="font-mono bg-blue-50 text-blue-700">{e.externalInvoiceNumber}</Badge></TableCell><TableCell className="font-mono text-xs font-bold">{e.ticketConsecutive}</TableCell><TableCell><p className="font-semibold text-xs">{e.serviceName}</p></TableCell><TableCell className="text-right font-bold text-xs">{formatCurrency(e.amount)}</TableCell></TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </TabsContent>
                            </div>
                        </Tabs>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-muted/5 opacity-40"><Receipt className="h-20 w-20 mb-4" /><h3 className="text-lg font-bold">Control de Facturación</h3><p className="text-sm max-w-md">Selecciona un cliente para ver sus sesiones pendientes de cobro y conciliarlas con las facturas del ERP.</p></div>
                    )}
                </section>
            </div>
        </main>
    );
}
