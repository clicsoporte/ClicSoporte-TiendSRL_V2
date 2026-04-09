
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlusCircle, Search, Edit, Trash2, Loader2, UserPlus, Users, Building2, Mail, Phone, Briefcase, SearchIcon, CheckCircle2, AlertCircle, MapPin, ShieldCheck, Send, RefreshCw } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { upsertCustomer, deleteCustomer } from '@/modules/core/lib/data-access-db';
import { getContributorInfo } from '@/modules/hacienda/lib/actions';
import { getCRGeoData } from '@/modules/tickets/lib/actions';
import type { Customer, CustomerContact, HaciendaContributorInfo, Province, Canton, District } from '@/modules/core/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    phone: '',
    branch: ''
};

const emptyCustomer: Customer = {
    id: '',
    name: '',
    commercialName: '',
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
    taxActivities: '[]',
    provinceId: null,
    cantonId: null,
    districtId: null,
    supportPackageId: null,
    telegramChatId: ''
};

export default function CustomersClient() {
    const { setTitle } = usePageTitle();
    const { customers, refreshAuth, isAuthReady, companyData } = useAuth();
    const { toast } = useToast();
    const { hasPermission } = useAuthorization();

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isHaciendaLoading, setIsHaciendaLoading] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Customer>(emptyCustomer);
    const [isEditing, setIsEditing] = useState(false);
    const [newContact, setNewContact] = useState<CustomerContact>(emptyContact);

    const [geoData, setGeoData] = useState<{ provinces: Province[], cantons: Canton[], districts: District[] }>({ provinces: [], cantons: [], districts: [] });

    useEffect(() => {
        setTitle("Gestión de Clientes");
        const fetchGeo = async () => {
            try {
                const data = await getCRGeoData();
                setGeoData(data);
            } catch (e) {
                console.error("Failed to load geographic data", e);
            }
        };
        fetchGeo();
    }, [setTitle]);

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
            (c.commercialName || "").toLowerCase().includes(lowerSearch) ||
            c.id.toLowerCase().includes(lowerSearch) ||
            c.taxId.includes(lowerSearch)
        );
    }, [customers, searchTerm]);

    const cantonsForProvince = useMemo(() => geoData.cantons.filter(c => c.provinceId === currentCustomer.provinceId), [geoData.cantons, currentCustomer.provinceId]);
    const districtsForCanton = useMemo(() => geoData.districts.filter(d => d.cantonId === currentCustomer.cantonId), [geoData.districts, currentCustomer.cantonId]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshAuth();
            toast({ title: "Datos Sincronizados", description: "Consumo de horas y saldos actualizados." });
        } catch {
            toast({ title: "Error", description: "No se pudieron actualizar los datos.", variant: "destructive" });
        } finally {
            setIsRefreshing(false);
        }
    };

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
            taxActivities: customer.taxActivities || '[]',
            supportPackageId: customer.supportPackageId || null,
            telegramChatId: customer.telegramChatId || ''
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
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={handleManualRefresh} disabled={isRefreshing} className="flex-1 sm:flex-none">
                        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Recalcular Horas
                    </Button>
                    {hasPermission('customers:create') && (
                        <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open) { setCurrentCustomer(emptyCustomer); setIsEditing(false); setNewContact(emptyContact); }}}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 sm:flex-none"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Cliente</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
                                <DialogHeader className="p-6 pb-4 border-b">
                                    <DialogTitle>{isEditing ? "Editar" : "Registrar Nuevo"} Cliente</DialogTitle>
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
                                                <div className="space-y-2">
                                                    <Label htmlFor="cust-name">Nombre Completo o Razón Social</Label>
                                                    <Input id="cust-name" value={currentCustomer.name} onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} placeholder="Nombre legal del cliente" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="cust-commercial">Nombre Comercial / Alias</Label>
                                                    <Input id="cust-commercial" value={currentCustomer.commercialName || ''} onChange={e => setCurrentCustomer({...currentCustomer, commercialName: e.target.value})} placeholder="Nombre para búsqueda rápida" />
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
                                                    </div>
                                                )}

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
                                                <Send className="h-5 w-5 text-primary" /> Notificaciones Directas
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="cust-telegram">Telegram Chat ID (Personal o Grupo)</Label>
                                                    <div className="relative">
                                                        <Input id="cust-telegram" value={currentCustomer.telegramChatId || ''} onChange={e => setCurrentCustomer({...currentCustomer, telegramChatId: e.target.value})} placeholder="Ej: 123456789" />
                                                        <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold">OPCIONAL</Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">Si se completa, el sistema podrá enviar alertas automáticas vía Telegram a este destino.</p>
                                                </div>
                                            </div>
                                        </section>

                                        <Separator />

                                        <section>
                                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <ShieldCheck className="h-5 w-5 text-primary" /> Plan de Soporte Técnico
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Paquete de Soporte Mensual</Label>
                                                    <Select 
                                                        value={currentCustomer.supportPackageId || 'none'} 
                                                        onValueChange={v => setCurrentCustomer({...currentCustomer, supportPackageId: v === 'none' ? null : v})}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Sin plan asignado"/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sin plan (Soporte por evento)</SelectItem>
                                                            {(companyData?.supportPackages || []).map(pkg => (
                                                                <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[10px] text-muted-foreground">Define la lógica de redondeo y servicios incluidos para este cliente.</p>
                                                </div>
                                            </div>
                                        </section>

                                        <Separator />

                                        <section>
                                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <MapPin className="h-5 w-5 text-primary" /> Ubicación Geográfica
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div className="space-y-2">
                                                    <Label>Provincia</Label>
                                                    <Select 
                                                        value={String(currentCustomer.provinceId || '')} 
                                                        onValueChange={v => setCurrentCustomer({...currentCustomer, provinceId: Number(v), cantonId: null, districtId: null})}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                                        <SelectContent>
                                                            {geoData.provinces.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Cantón</Label>
                                                    <Select 
                                                        value={String(currentCustomer.cantonId || '')} 
                                                        onValueChange={v => setCurrentCustomer({...currentCustomer, cantonId: Number(v), districtId: null})}
                                                        disabled={!currentCustomer.provinceId}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                                        <SelectContent>
                                                            {cantonsForProvince.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Distrito</Label>
                                                    <Select 
                                                        value={String(currentCustomer.districtId || '')} 
                                                        onValueChange={v => setCurrentCustomer({...currentCustomer, districtId: Number(v)})}
                                                        disabled={!currentCustomer.cantonId}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                                        <SelectContent>
                                                            {districtsForCanton.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="cust-address">Dirección Exacta (Señas)</Label>
                                                <Textarea id="cust-address" value={currentCustomer.address || ''} onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})} placeholder="Ej: 100m norte de la escuela, casa color verde..." />
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
                                                        <Label className="text-xs">Nombre Completo</Label>
                                                        <Input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} placeholder="Ej: Juan Perez" className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Correo</Label>
                                                        <Input type="email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} placeholder="juan@ejemplo.com" className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Departamento</Label>
                                                        <Input value={newContact.department} onChange={e => setNewContact({...newContact, department: e.target.value})} placeholder="Ej: TI, RRHH" className="h-8 text-xs" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Teléfono</Label>
                                                        <Input value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} placeholder="Ej: 8888-7777" className="h-8 text-xs" />
                                                    </div>
                                                    <div className="flex items-end lg:col-span-2">
                                                        <Button type="button" size="sm" onClick={handleAddContactToList} className="w-full h-8">
                                                            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Contacto
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {(currentCustomer.contacts || []).map((contact) => (
                                                    <div key={contact.id} className="flex items-center justify-between p-3 rounded-md border bg-card text-sm shadow-sm group hover:border-primary transition-colors">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                                                            <div>
                                                                <p className="font-bold">{contact.name}</p>
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold flex items-center gap-1"><Briefcase className="h-3 w-3" /> {contact.department}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.phone || contact.officePhone || contact.whatsapp || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveContact(contact.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
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
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por nombre, comercial, código o cédula..." 
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
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[80px]">Código</TableHead>
                                    <TableHead>Cliente / Comercial</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Plan de Soporte</TableHead>
                                    <TableHead className="text-center">Hrs. Mes</TableHead>
                                    <TableHead className="text-center">Consumido</TableHead>
                                    <TableHead className="text-center">Saldo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => {
                                        const pkg = companyData?.supportPackages.find(p => p.id === customer.supportPackageId);
                                        const consumed = customer.consumedHours || 0;
                                        const available = customer.availableHours || 0;
                                        const balance = available - consumed;
                                        const percentageUsed = available > 0 ? (consumed / available) * 100 : 0;

                                        return (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-mono text-xs">{customer.id}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{customer.name}</span>
                                                        {customer.commercialName && (
                                                            <span className="text-[10px] text-primary font-black uppercase tracking-tighter">★ {customer.commercialName}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{customer.taxId}</TableCell>
                                                <TableCell>
                                                    {pkg ? (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                                            <ShieldCheck className="h-3 w-3 mr-1" /> {pkg.name}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">Soporte por Evento</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold text-xs">{available > 0 ? `${available}h` : '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={cn("font-mono text-xs", consumed > 0 ? "font-bold" : "text-muted-foreground")}>{consumed.toFixed(1)}h</span>
                                                        {available > 0 && (
                                                            <div className="w-12 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                                                <div 
                                                                    className={cn("h-full", percentageUsed > 90 ? "bg-red-500" : percentageUsed > 70 ? "bg-orange-500" : "bg-green-500")} 
                                                                    style={{ width: `${Math.min(percentageUsed, 100)}%` }} 
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {available > 0 ? (
                                                        <Badge variant={balance < 0 ? "destructive" : "secondary"} className={cn("text-[10px] h-5", balance > 0 && "bg-green-50 text-green-700 border-green-200")}>
                                                            {balance.toFixed(1)}h
                                                        </Badge>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={customer.active === 'S' ? 'default' : 'secondary'} className="text-[10px] h-5">
                                                        {customer.active === 'S' ? 'ACTIVO' : 'INACTIVO'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {hasPermission('customers:update') && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(customer)}><Edit className="h-4 w-4" /></Button>
                                                        )}
                                                        {hasPermission('customers:delete') && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">No se encontraron clientes.</TableCell>
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
