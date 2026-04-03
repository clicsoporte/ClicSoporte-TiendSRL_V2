'use client';

/**
 * @fileoverview Client component for the Billing Management module.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCustomersWithPendingBilling, getPendingEntriesForCustomer, markEntriesAsInvoiced, type PendingCustomer } from '@/modules/billing/lib/actions';
import { format, parseISO } from 'date-fns';
import { Loader2, Receipt, FileText, CheckCircle2, ChevronRight, Search, Download, Mail } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function BillingClient() {
    const { toast } = useToast();
    const [customers, setCustomers] = useState<PendingCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Details dialog
    const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [selectedEntryIds, setSelectedEmailIds] = useState<number[]>([]);
    const [externalInvoice, setExternalInvoice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        const data = await getCustomersWithPendingBilling();
        setCustomers(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.taxId.includes(searchTerm)
        );
    }, [customers, searchTerm]);

    const handleOpenDetails = async (customer: PendingCustomer) => {
        setSelectedCustomer(customer);
        setIsLoadingEntries(true);
        const data = await getPendingEntriesForCustomer(customer.id);
        setEntries(data);
        setSelectedEmailIds(data.map(e => e.id)); // Select all by default
        setIsLoadingEntries(false);
    };

    const handleMarkInvoiced = async () => {
        if (!externalInvoice || selectedEntryIds.length === 0) return;
        setIsSubmitting(true);
        try {
            await markEntriesAsInvoiced(selectedEntryIds, externalInvoice);
            toast({ title: "Registros Actualizados", description: `Se marcaron ${selectedEntryIds.length} sesiones como facturadas.` });
            setExternalInvoice("");
            setSelectedCustomer(null);
            loadData();
        } catch {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleEntrySelection = (id: number) => {
        setSelectedEmailIds(prev => 
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
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Receipt className="h-6 w-6 text-primary" /> Gestión de Facturación
                    </h1>
                    <p className="text-muted-foreground text-sm">Concilia las horas de soporte registradas con tus facturas del ERP.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Total Pendiente</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-2xl font-bold text-primary">
                        {formatCurrency(customers.reduce((acc, c) => acc + c.totalAmount, 0))}
                    </CardContent>
                </Card>
                <Card><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Clientes con Saldo</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold">{customers.length}</CardContent></Card>
                <Card><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Tickets por Cobrar</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold">{customers.reduce((acc, c) => acc + c.pendingCount, 0)}</CardContent></Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2 max-w-sm">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Identificación</TableHead>
                                    <TableHead className="text-center">Sesiones Pend.</TableHead>
                                    <TableHead className="text-right">Monto Estimado</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Cargando...</TableCell></TableRow>
                                ) : filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => (
                                        <TableRow key={customer.id} className="group hover:bg-muted/30 cursor-pointer" onClick={() => handleOpenDetails(customer)}>
                                            <TableCell className="font-bold">{customer.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{customer.taxId}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">{customer.pendingCount}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-primary">
                                                {formatCurrency(customer.totalAmount)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                                                    Conciliar <ChevronRight className="ml-1 h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">No hay facturación pendiente.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
                <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b">
                        <DialogTitle>Estado de Cuenta: {selectedCustomer?.name}</DialogTitle>
                        <DialogDescription>Selecciona los items que deseas marcar como facturados.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                        <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase">Total Seleccionado</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(totalSelected)}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Bajar PDF</Button>
                                <Button variant="outline" size="sm"><Mail className="mr-2 h-4 w-4" /> Enviar por Email</Button>
                            </div>
                        </div>

                        <ScrollArea className="flex-1 border rounded-md">
                            {isLoadingEntries ? (
                                <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[40px]"></TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Ticket</TableHead>
                                            <TableHead>Labor Realizada</TableHead>
                                            <TableHead className="text-right">Horas</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {entries.map(entry => (
                                            <TableRow key={entry.id} className={cn(selectedEntryIds.includes(entry.id) && "bg-primary/5")}>
                                                <TableCell>
                                                    <Checkbox checked={selectedEntryIds.includes(entry.id)} onCheckedChange={() => toggleEntrySelection(entry.id)} />
                                                </TableCell>
                                                <TableCell className="text-xs">{format(parseISO(entry.startTime), 'dd/MM/yy')}</TableCell>
                                                <TableCell className="font-mono text-xs font-bold">{entry.ticketConsecutive}</TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-sm">{entry.serviceName}</p>
                                                    <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{entry.notes || 'Sin descripción'}</p>
                                                </TableCell>
                                                <TableCell className="text-right text-xs">{( (entry.billableDuration || entry.duration || 0) / 3600000 ).toFixed(2)} h</TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(entry.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </ScrollArea>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/10">
                        <div className="flex flex-1 items-center gap-4">
                            <div className="flex-1 max-w-xs space-y-1.5">
                                <Label className="text-xs font-bold">Nº Factura Externa (ERP)</Label>
                                <Input value={externalInvoice} onChange={e => setExternalInvoice(e.target.value)} placeholder="Ej: F-001-12345" className="h-9" />
                            </div>
                            <Button onClick={handleMarkInvoiced} disabled={!externalInvoice || selectedEntryIds.length === 0 || isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Marcar como Facturado
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
