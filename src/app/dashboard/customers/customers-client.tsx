'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlusCircle, Search, Edit, Trash2, Loader2, UserPlus, Users, Building2, Mail, Phone, Briefcase, SearchIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { upsertCustomer, deleteCustomer } from '@/modules/core/lib/data-access-db';
import { getContributorInfo } from '@/modules/hacienda/lib/actions';
import type { Customer, CustomerContact, HaciendaContributorInfo } from '@/modules/core/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

const emptyContact: CustomerContact = {
    id: '',
    name: '',
    email: '',
    department: '',
    position: '',
    officePhone: '',
    whatsapp: '',
    branch: ''
};

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
    isManual: true,
    contacts: [],
    taxActivities: '[]'
};

export default function CustomersClient() {
    const { setTitle } = usePageTitle();
    const { customers, refreshAuth, isAuthReady } = useAuth();
    const { toast } = useToast();
    const { hasPermission } = useAuthorization();

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isHaciendaLoading, setIsHaciendaLoading] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Customer>(emptyCustomer);
    const [isEditing, setIsEditing] = useState(false);
    const [newContact, setNewContact] = useState<CustomerContact>(emptyContact);

    useEffect(() => {
        setTitle("Gestión de Clientes");
    }, [setTitle]);

    // Effect to auto-search Hacienda when taxId is entered
    useEffect(() => {
        if (isEditing || currentCustomer.taxId.length < 9 || currentCustomer.taxId.length > 12) return;

        const timer = setTimeout(async () => {
            setIsHaciendaLoading(true);
            try {
                const info = await getContributorInfo(currentCustomer.taxId);
                if (!('error' in info)) {
                    const data = info as HaciendaContributorInfo;
                    setCurrentCustomer(prev => ({
                        ...prev,
                        name: prev.name || data.nombre,
                        taxRegime: data.regimen.descripcion,
                        taxStatus: data.situacion.estado,
                        isTaxMoroso: data.situacion.moroso === 'SI',
                        isTaxOmiso: data.situacion.omiso === 'SI',
                        taxAdministration: data.administracionTributaria,
                        taxActivities: JSON.stringify(data.actividades)
                    }));
                    toast({ title: "Datos de Hacienda obtenidos", description: data.nombre });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsHaciendaLoading(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [currentCustomer.taxId, isEditing, toast]);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const lowerSearch = searchTerm.toLowerCase();
        return (customers || []).filter(c => 
            c.name.toLowerCase().includes(lowerSearch) || 
            c.id.toLowerCase().includes(lowerSearch) ||
            c.taxId.includes(lowerSearch)
        );
    }, [customers, searchTerm]);

    const handleSave = async () => {
        const requiredPermission = isEditing ? 'customers:update' : 'customers:create';
        if (!hasPermission(requiredPermission)) {
            toast({ title: "Acceso denegado", description: "No tienes permiso para guardar clientes.", variant: "destructive" });
            return;
        }

        if (!currentCustomer.id || !currentCustomer.name || !currentCustomer.taxId) {
            toast({ title: "Datos incompletos", description: "Identificación, Código y Nombre son obligatorios.", variant: "destructive" });
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
        } catch (error: unknown) {
            const err = error as Error;
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (customer: Customer) => {
        setCurrentCustomer({
            ...customer,
            contacts: Array.isArray(customer.contacts) ? customer.contacts : [],
            taxActivities: customer.taxActivities || '[]'
        });
        setIsEditing(true);
        setFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!hasPermission('customers:delete')) {
            toast({ title: "Acceso denegado", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await deleteCustomer(id);
            toast({ title: "Cliente Eliminado", variant: "destructive" });
            await refreshAuth();
        } catch (error: unknown) {
            const err = error as Error;
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddContactToList = () => {
        if (!newContact.name || !newContact.email) {
            toast({ title: "Contacto incompleto", description: "El nombre y el correo son obligatorios.", variant: "destructive" });
            return;
        }
        const contactWithId = { ...newContact, id: Date.now().toString() };
        setCurrentCustomer(prev => ({
            ...prev,
            contacts: [...(prev.contacts || []), contactWithId]
        }));
        setNewContact(emptyContact);
    };

    const handleRemoveContact = (id: string) => {
        setCurrentCustomer(prev => ({
            ...prev,
            contacts: (prev.contacts || []).filter(c => c.id !== id)
        }));
    };

    const taxActivities = useMemo(() => {
        try {
            return JSON.parse(currentCustomer.taxActivities || '[]');
        } catch {
            return [];
        }
    }, [currentCustomer.taxActivities]);

    if (!isAuthReady) {
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
                {hasPermission('customers:create') && (
                    <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open) { setCurrentCustomer(emptyCustomer); setIsEditing(false); setNewContact(emptyContact); }}}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Cliente</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
                            <DialogHeader className="p-6 pb-4 border-b">
                                <DialogTitle>{isEditing ? "Editar Cliente" : "Registrar Nuevo Cliente"}</DialogTitle>
                                <DialogDescription>Completa los datos fiscales y los contactos de la empresa.</DialogDescription>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                                <div className="space-y-8 pr-2">
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <Building2 className="h-5 w-5 text-primary" /> Datos Principales
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2 relative">
                                                <Label htmlFor="cust-taxid">Identificación / Cédula</Label>
                                                <div className="relative">
                                                    <Input 
                                                        id="cust-taxid" 
                                                        value={currentCustomer.taxId} 
                                                        onChange={e => setCurrentCustomer({...currentCustomer, taxId: e.target.value})} 
                                                        placeholder="Cédula jurídica o física"
                                                        className={cn(isHaciendaLoading && "pr-10")}
                                                    />
                                                    {isHaciendaLoading && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">Consulta automática a Hacienda habilitada.</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="cust-id">Código de Cliente (Único)</Label>
                                                <Input id="cust-id" value={currentCustomer.id} onChange={e => setCurrentCustomer({...currentCustomer, id: e.target.value})} disabled={isEditing} placeholder="Ej: C001" />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="cust-name">Nombre Completo o Razón Social</Label>
                                                <Input id="cust-name" value={currentCustomer.name} onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} placeholder="Nombre legal del cliente" />
                                            </div>
                                            
                                            {currentCustomer.taxRegime && (
                                                <div className="md:col-span-2 bg-muted/30 p-4 rounded-lg border border-primary/20 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                                                            <SearchIcon className="h-3 w-3" /> Datos Tributarios (Hacienda)
                                                        </h4>
                                                        <Badge variant={currentCustomer.taxStatus?.toLowerCase().includes('inscrito') ? 'default' : 'destructive'} className="text-[10px] h-5">
                                                            {currentCustomer.taxStatus}
                                                        </Badge>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                                        <div>
                                                            <span className="text-muted-foreground">Régimen:</span>
                                                            <p className="font-semibold">{currentCustomer.taxRegime}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Administración:</span>
                                                            <p className="font-semibold">{currentCustomer.taxAdministration}</p>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                {currentCustomer.isTaxMoroso ? <AlertCircle className="h-3 w-3 text-destructive"/> : <CheckCircle2 className="h-3 w-3 text-green-600"/>}
                                                                <span>Moroso: <strong>{currentCustomer.isTaxMoroso ? 'SÍ' : 'NO'}</strong></span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                {currentCustomer.isTaxOmiso ? <AlertCircle className="h-3 w-3 text-destructive"/> : <CheckCircle2 className="h-3 w-3 text-green-600"/>}
                                                                <span>Omiso: <strong>{currentCustomer.isTaxOmiso ? 'SÍ' : 'NO'}</strong></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {taxActivities.length > 0 && (
                                                        <div className="space-y-1">
                                                            <span className="text-muted-foreground text-[10px]">Actividades Económicas:</span>
                                                            <div className="space-y-1 max-h-24 overflow-y-auto pr-2 scrollbar-thin">
                                                                {taxActivities.map((act: { codigo: string; descripcion: string }) => (
                                                                    <div key={act.codigo} className="p-1.5 bg-background border rounded text-[9px] leading-tight">
                                                                        <strong>{act.codigo}</strong> - {act.descripcion}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="cust-address">Dirección de Entrega</Label>
                                                <Input id="cust-address" value={currentCustomer.address} onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="cust-phone">Teléfono Empresa</Label>
                                                <Input id="cust-phone" value={currentCustomer.phone} onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="cust-email">Correo para Notificaciones</Label>
                                                <Input id="cust-email" type="email" value={currentCustomer.email} onChange={e => setCurrentCustomer({...currentCustomer, email: e.target.value})} />
                                            </div>
                                        </div>
                                    </section>

                                    <Separator />

                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" /> Contactos de la Empresa
                                        </h3>
                                        
                                        <div className="bg-muted/30 p-4 rounded-lg border space-y-4 mb-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-name" className="text-xs">Nombre Completo</Label>
                                                    <Input id="contact-name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} placeholder="Ej: Juan Perez" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-email" className="text-xs">Correo</Label>
                                                    <Input id="contact-email" type="email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} placeholder="juan@ejemplo.com" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-dept" className="text-xs">Departamento / Área</Label>
                                                    <Input id="contact-dept" value={newContact.department} onChange={e => setNewContact({...newContact, department: e.target.value})} placeholder="Ej: TI, RRHH" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-pos" className="text-xs">Puesto</Label>
                                                    <Input id="contact-pos" value={newContact.position} onChange={e => setNewContact({...newContact, position: e.target.value})} placeholder="Ej: Gerente" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-phone" className="text-xs">Tel. Oficina</Label>
                                                    <Input id="contact-phone" value={newContact.officePhone} onChange={e => setNewContact({...newContact, officePhone: e.target.value})} placeholder="2222-3333" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-ws" className="text-xs">WhatsApp</Label>
                                                    <Input id="contact-ws" value={newContact.whatsapp} onChange={e => setNewContact({...newContact, whatsapp: e.target.value})} placeholder="8888-9999" className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="contact-branch" className="text-xs">Sucursal</Label>
                                                    <Input id="contact-branch" value={newContact.branch} onChange={e => setNewContact({...newContact, branch: e.target.value})} placeholder="Ej: San José" className="h-8 text-xs" />
                                                </div>
                                                <div className="flex items-end lg:col-span-2">
                                                    <Button type="button" size="sm" onClick={handleAddContactToList} className="w-full">
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Contacto a la Lista
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {(currentCustomer.contacts || []).map((contact) => (
                                                <div key={contact.id} className="flex items-center justify-between p-3 rounded-md border bg-card text-sm shadow-sm group hover:border-primary transition-colors">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                                        <div>
                                                            <p className="font-bold">{contact.name}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold flex items-center gap-1"><Briefcase className="h-3 w-3" /> {contact.department}</p>
                                                            <p className="text-xs text-muted-foreground">{contact.position}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.officePhone}</p>
                                                            <p className="text-xs text-green-600 font-medium">WS: {contact.whatsapp}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold">Sucursal:</p>
                                                            <p className="text-xs text-muted-foreground">{contact.branch || 'Principal'}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveContact(contact.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {(!currentCustomer.contacts || currentCustomer.contacts.length === 0) && (
                                                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                                                    <p className="text-muted-foreground text-sm">No hay contactos agregados para este cliente.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <div className="p-6 border-t bg-muted/10 flex justify-end gap-2">
                                <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                <Button onClick={handleSave} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Cliente
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
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
                                    <TableHead>Contactos</TableHead>
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
                                                <div className="flex items-center gap-1">
                                                    <Badge variant="secondary" className="h-5 px-1.5">{customer.contacts?.length || 0}</Badge>
                                                    <span className="text-[10px] text-muted-foreground">pers.</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={customer.active === 'S' ? 'default' : 'secondary'}>
                                                    {customer.active === 'S' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {hasPermission('customers:update') && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}><Edit className="h-4 w-4" /></Button>
                                                    )}
                                                    {hasPermission('customers:delete') && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                                                                    <AlertDialogDescription>Esta acción borrará permanentemente a <strong>{customer.name}</strong>.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(customer.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
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
