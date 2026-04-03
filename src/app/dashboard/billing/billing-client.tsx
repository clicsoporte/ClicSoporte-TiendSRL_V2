'use client';

/**
 * @fileoverview Client component for the Billing Management module.
 * Implements a Master-Detail layout for efficient billing reconciliation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCustomersWithPendingBilling, getPendingEntriesForCustomer, markEntriesAsInvoiced, type PendingCustomer } from '@/modules/billing/lib/actions';
import { format, parseISO } from 'date-fns';
import { Loader2, Receipt, CheckCircle2, Search, Download, Mail, UserCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function BillingClient() {
    const { toast } = useToast();
    const [customers, setCustomers] = useState<PendingCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Selection state
    const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
    const [externalInvoice, setExternalInvoice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getCustomersWithPendingBilling();
            setCustomers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Fixed search logic
    const filteredCustomers = useMemo(() => {
        const lowerSearch = searchTerm.trim().toLowerCase();
        if (!lowerSearch) return customers;
        
        return customers.filter(c => 
            (c.name || "").toLowerCase().includes(lowerSearch) || 
            (c.taxId || "").toLowerCase().includes(lowerSearch) ||
            (c.id || "").toLowerCase().includes(lowerSearch)
        );
    }, [customers, searchTerm]);

    const handleSelectCustomer = async (customer: PendingCustomer) => {
        if (selectedCustomer?.id === customer.id) return;
        
        setSelectedCustomer(customer);
        setEntries([]);
        setSelectedEntryIds([]);
        setIsLoadingEntries(true);
        try {
            const data = await getPendingEntriesForCustomer(customer.id);
            setEntries(data);
            setSelectedEntryIds(data.map(e => e.id)); // Select all by default
        } catch (error) {
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
            setExternalInvoice("");
            // Clear details if everything was invoiced or refresh
            const remainingEntries = entries.filter(e => !selectedEntryIds.includes(e.id));
            if (remainingEntries.length === 0) {
                setSelectedCustomer(null);
                setEntries([]);
            } else {
                setEntries(remainingEntries);
                setSelectedEntryIds([]);
            }
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
                            {formatCurrency(customers.reduce((acc, c) => acc + c.totalAmount, 0))}
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
                                placeholder="Buscar por nombre o ID..." 
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
                                                <Badge variant="outline" className="text-[9px] h-4">{customer.pendingCount} tickets</Badge>
                                                <span className="text-xs font-bold">{formatCurrency(customer.totalAmount)}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedCustomer?.id === customer.id ? "translate-x-1 text-primary" : "opacity-0 group-hover:opacity-100")} />
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 text-center text-muted-foreground italic text-sm">
                                    No se encontraron clientes con saldos.
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
                                    <p className="text-sm text-muted-foreground">Revisión de {entries.length} sesiones pendientes de cobro</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { /* PDF Logic */ }}><Download className="mr-2 h-4 w-4" /> PDF</Button>
                                    <Button variant="outline" size="sm" onClick={() => { /* Email Logic */ }}><Mail className="mr-2 h-4 w-4" /> Email</Button>
                                </div>
                            </div>

                            {/* Entries List */}
                            <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
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
                            </div>

                            {/* Detail Footer (Action Bar) */}
                            <div className="p-6 border-t bg-muted/10 shadow-inner">
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
                                    <AlertCircle className="h-3 w-3" /> Al confirmar, los registros seleccionados se marcarán como facturados y saldrán de los pendientes.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-muted/5">
                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Receipt className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold">Estado de Cuenta por Cliente</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Selecciona un cliente de la lista de la izquierda para ver su detalle de soporte pendiente de facturar, generar reportes o realizar conciliaciones.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
