/**
 * @fileoverview Page for managing clients manually.
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlusCircle, Search, Edit, Trash2, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { upsertCustomer, deleteCustomer } from '@/modules/core/lib/data-access-db';
import type { Customer } from '@/modules/core/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const emptyCustomer: Customer = {
    id: '',
    name: '',
    address: '',
    phone: '',
    taxId: '',
    currency: 'CRC',
    creditLimit: 0,
    paymentCondition: '0',
    salesperson: '',
    active: 'S',
    email: '',
    electronicDocEmail: '',
    isManual: true
};

export default function CustomersPage() {
    const { setTitle } = usePageTitle();
    const { customers, refreshAuth, isLoading } = useAuth();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Customer>(emptyCustomer);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setTitle("Gestión de Clientes");
    }, [setTitle]);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const lowerSearch = searchTerm.toLowerCase();
        return customers.filter(c => 
            c.name.toLowerCase().includes(lowerSearch) || 
            c.id.toLowerCase().includes(lowerSearch) ||
            c.taxId.includes(lowerSearch)
        );
    }, [customers, searchTerm]);

    const handleSave = async () => {
        if (!currentCustomer.id || !currentCustomer.name || !currentCustomer.taxId) {
            toast({ title: "Datos incompletos", description: "Código, Nombre y Cédula son obligatorios.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await upsertCustomer(currentCustomer);
            toast({ title: isEditing ? "Cliente Actualizado" : "Cliente Creado" });
            await refreshAuth();
            setFormOpen(false);
            setCurrentCustomer(emptyCustomer);
            setIsEditing(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (customer: Customer) => {
        setCurrentCustomer(customer);
        setIsEditing(true);
        setFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        setIsSubmitting(true);
        try {
            await deleteCustomer(id);
            toast({ title: "Cliente Eliminado", variant: "destructive" });
            await refreshAuth();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Skeleton className="h-10 w-64 mb-6" />
                <Card>
                    <CardHeader><Skeleton className="h-20 w-full" /></CardHeader>
                    <CardContent><Skeleton className="h-64 w-full" /></CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <UserPlus className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Base de Clientes</h1>
                </div>
                <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open) { setCurrentCustomer(emptyCustomer); setIsEditing(false); }}}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Cliente</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{isEditing ? "Editar Cliente" : "Registrar Nuevo Cliente"}</DialogTitle>
                            <DialogDescription>Completa los datos fiscales y de contacto del cliente.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="cust-id">Código de Cliente (Único)</Label>
                                <Input id="cust-id" value={currentCustomer.id} onChange={e => setCurrentCustomer({...currentCustomer, id: e.target.value})} disabled={isEditing} placeholder="Ej: C001" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cust-taxid">Identificación / Cédula</Label>
                                <Input id="cust-taxid" value={currentCustomer.taxId} onChange={e => setCurrentCustomer({...currentCustomer, taxId: e.target.value})} placeholder="Cédula jurídica o física" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="cust-name">Nombre Completo o Razón Social</Label>
                                <Input id="cust-name" value={currentCustomer.name} onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} placeholder="Nombre legal del cliente" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="cust-address">Dirección de Entrega</Label>
                                <Input id="cust-address" value={currentCustomer.address} onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cust-phone">Teléfono</Label>
                                <Input id="cust-phone" value={currentCustomer.phone} onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cust-email">Correo para Notificaciones</Label>
                                <Input id="cust-email" type="email" value={currentCustomer.email} onChange={e => setCurrentCustomer({...currentCustomer, email: e.target.value})} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <Button onClick={handleSave} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cliente
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por nombre, código o cédula..." 
                            className="pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => (
                                        <TableRow key={customer.id}>
                                            <TableCell className="font-mono text-xs">{customer.id}</TableCell>
                                            <TableCell className="font-medium">
                                                {customer.name}
                                                {customer.isManual && <Badge variant="outline" className="ml-2 text-[10px]">Local</Badge>}
                                            </TableCell>
                                            <TableCell>{customer.taxId}</TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    <p>{customer.phone}</p>
                                                    <p className="text-muted-foreground">{customer.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={customer.active === 'S' ? 'default' : 'secondary'}>
                                                    {customer.active === 'S' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}><Edit className="h-4 w-4" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                                                                <AlertDialogDescription>Esta acción borrará permanentemente a <strong>{customer.name}</strong>. Se recomienda marcar como inactivo en su lugar.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(customer.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No se encontraron clientes.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
