/**
 * @fileoverview Page for managing third-party service providers with rates and geodata.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, MoreVertical, Truck, Trash2, MapPin, Briefcase, Users, Mail, Phone, Building2, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { 
    getThirdPartyProviders, addThirdPartyProvider, updateThirdPartyProvider, deleteThirdPartyProvider,
    getCRGeoData, saveProviderService, deleteProviderService, saveProviderGeoRate, deleteProviderGeoRate 
} from '@/modules/tickets/lib/actions';
import type { ThirdPartyProvider, Province, Canton, District, ProviderService, ProviderGeoRate, CustomerContact } from '@/modules/core/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

const emptyProvider: Omit<ThirdPartyProvider, 'id' | 'createdAt' | 'services' | 'geoRates' | 'contacts'> = {
    name: '',
    email: '',
    phone: '',
    specialty: '',
    notes: ''
};

export default function ProvidersPage() {
    const { isAuthorized, hasPermission } = useAuthorization(['tickets:admin:settings', 'view:provider:costs']);
    const canViewCosts = hasPermission('view:provider:costs');
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);
    const [geoData, setGeoData] = useState<{ provinces: Province[], cantons: Canton[], districts: District[] }>({ provinces: [], cantons: [], districts: [] });
    
    const [isFormOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<ThirdPartyProvider | Omit<ThirdPartyProvider, 'id' | 'createdAt'>>(emptyProvider);
    const [providerToDelete, setProviderToDelete] = useState<ThirdPartyProvider | null>(null);
    const [newContact, setNewContact] = useState<CustomerContact>(emptyContact);

    // Rate Management States
    const [newServiceRate, setNewServiceRate] = useState<Omit<ProviderService, 'id'>>({ 
        providerId: 0, serviceId: '', 
        buyPriceRemote: 0, marginRemote: 0, taxRate: 13, sellPriceRemote: 0,
        buyPriceOnSite: 0, marginOnSite: 0, sellPriceOnSite: 0 
    });
    const [newGeoRate, setNewGeoRate] = useState<Omit<ProviderGeoRate, 'id'>>({ 
        providerId: 0, provinceId: 0, cantonId: 0, districtId: 0, 
        buyTravelPrice: 0, marginTravel: 0, taxRate: 13, sellTravelPrice: 0, locationName: '' 
    });

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [pData, gData] = await Promise.all([getThirdPartyProviders(), getCRGeoData()]);
            setProviders(pData);
            setGeoData(gData);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setTitle("Proveedores de Servicios Externos");
        if(isAuthorized) fetchInitialData();
    }, [setTitle, isAuthorized]);

    // Lógica de cálculo de precios revisada: (Costo * (1+Margen/100)) * (1+IVA/100)
    useEffect(() => {
        const factorMargen = 1 + (newServiceRate.marginRemote / 100);
        const factorIVA = 1 + (newServiceRate.taxRate / 100);
        
        const remoteVenta = (newServiceRate.buyPriceRemote * factorMargen) * factorIVA;
        const onsiteVenta = (newServiceRate.buyPriceOnSite * factorMargen) * factorIVA;
        
        if (Math.abs(remoteVenta - newServiceRate.sellPriceRemote) > 0.01 || Math.abs(onsiteVenta - newServiceRate.sellPriceOnSite) > 0.01) {
            setNewServiceRate(prev => ({ ...prev, sellPriceRemote: remoteVenta, sellPriceOnSite: onsiteVenta }));
        }
    }, [newServiceRate.buyPriceRemote, newServiceRate.marginRemote, newServiceRate.buyPriceOnSite, newServiceRate.marginOnSite, newServiceRate.taxRate, newServiceRate.sellPriceRemote, newServiceRate.sellPriceOnSite]);

    useEffect(() => {
        const factorMargen = 1 + (newGeoRate.marginTravel / 100);
        const factorIVA = 1 + (newGeoRate.taxRate / 100);
        const travelVenta = (newGeoRate.buyTravelPrice * factorMargen) * factorIVA;
        
        if (Math.abs(travelVenta - newGeoRate.sellTravelPrice) > 0.01) {
            setNewGeoRate(prev => ({ ...prev, sellTravelPrice: travelVenta }));
        }
    }, [newGeoRate.buyTravelPrice, newGeoRate.marginTravel, newGeoRate.taxRate, newGeoRate.sellTravelPrice]);

    const handleSaveProvider = async () => {
        if (!currentProvider.name) { toast({ title: "Nombre requerido", variant: "destructive" }); return; }
        setIsSubmitting(true);
        try {
            if (isEditing && 'id' in currentProvider) {
                const updated = await updateThirdPartyProvider(currentProvider as ThirdPartyProvider);
                setProviders(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
                toast({ title: "Proveedor Actualizado" });
            } else {
                const newProvider = await addThirdPartyProvider(currentProvider as Omit<ThirdPartyProvider, 'id' | 'createdAt'>);
                setProviders(prev => [...prev, newProvider]);
                toast({ title: "Proveedor Registrado" });
            }
            setFormOpen(false);
            setCurrentProvider(emptyProvider);
            setIsEditing(false);
        } catch (error: unknown) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    const handleAddServiceRate = async () => {
        if (!newServiceRate.serviceId || !('id' in currentProvider)) return;
        try {
            const saved = await saveProviderService({ ...newServiceRate, providerId: currentProvider.id });
            setCurrentProvider(prev => ({ 
                ...prev, 
                services: [...(prev.services || []), saved] 
            } as ThirdPartyProvider));
            setNewServiceRate({ 
                providerId: 0, serviceId: '', 
                buyPriceRemote: 0, marginRemote: 0, taxRate: 13, sellPriceRemote: 0,
                buyPriceOnSite: 0, marginOnSite: 0, sellPriceOnSite: 0 
            });
            toast({ title: "Tarifa de Servicio Agregada" });
        } catch (e) { console.error(e); }
    };

    const handleDeleteServiceRate = async (id: number) => {
        try {
            await deleteProviderService(id);
            setCurrentProvider(prev => ({ 
                ...prev, 
                services: (prev.services || []).filter(s => s.id !== id) 
            } as ThirdPartyProvider));
        } catch (e) { console.error(e); }
    };

    const handleAddGeoRate = async () => {
        if (!newGeoRate.provinceId || !('id' in currentProvider)) return;
        
        const prov = geoData.provinces.find(p => p.id === newGeoRate.provinceId)?.name || '';
        const cant = geoData.cantons.find(c => c.id === newGeoRate.cantonId)?.name || '';
        const dist = geoData.districts.find(d => d.id === newGeoRate.districtId)?.name || '';
        const locationName = [prov, cant, dist].filter(Boolean).join(' > ');

        try {
            const saved = await saveProviderGeoRate({ ...newGeoRate, providerId: currentProvider.id, locationName });
            setCurrentProvider(prev => ({ 
                ...prev, 
                geoRates: [...(prev.geoRates || []), saved] 
            } as ThirdPartyProvider));
            setNewGeoRate({ 
                providerId: 0, provinceId: 0, cantonId: 0, districtId: 0, 
                buyTravelPrice: 0, marginTravel: 0, taxRate: 13, sellTravelPrice: 0, locationName: '' 
            });
            toast({ title: "Tarifa Geográfica Agregada" });
        } catch (e) { console.error(e); }
    };

    const handleDeleteGeoRate = async (id: number) => {
        try {
            await deleteProviderGeoRate(id);
            setCurrentProvider(prev => ({ 
                ...prev, 
                geoRates: (prev.geoRates || []).filter(g => g.id !== id) 
            } as ThirdPartyProvider));
        } catch (e) { console.error(e); }
    };

    const handleAddContactToList = () => {
        if (!newContact.name || !newContact.email) {
            toast({ title: "Contacto incompleto", description: "El nombre y el correo son obligatorios.", variant: "destructive" });
            return;
        }
        const contactWithId = { ...newContact, id: Date.now().toString() };
        setCurrentProvider(prev => ({
            ...prev,
            contacts: [...(prev.contacts || []), contactWithId]
        } as ThirdPartyProvider));
        setNewContact(emptyContact);
    };

    const handleRemoveContact = (id: string) => {
        setCurrentProvider(prev => ({
            ...prev,
            contacts: (prev.contacts || []).filter(c => c.id !== id)
        } as ThirdPartyProvider));
    };

    const cantonsForProvince = useMemo(() => geoData.cantons.filter(c => c.provinceId === newGeoRate.provinceId), [geoData.cantons, newGeoRate.provinceId]);
    const districtsForCanton = useMemo(() => geoData.districts.filter(d => d.cantonId === newGeoRate.cantonId), [geoData.districts, newGeoRate.cantonId]);

    const formatPrice = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!isAuthorized) return null;
    if (isLoading) return <div className="p-8"><Skeleton className="h-full w-full" /></div>;
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Truck className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Catálogo de Proveedores Inteligente</h1>
                </div>
                <Button onClick={() => setFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Nuevo Proveedor</Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Especialidad</TableHead>
                                <TableHead>Capacidades</TableHead>
                                <TableHead>Contacto</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {providers.map(provider => (
                                <TableRow key={provider.id}>
                                    <TableCell className="font-bold">{provider.name}</TableCell>
                                    <TableCell><Badge variant="secondary">{provider.specialty}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Badge variant="outline" className="text-[10px]">{provider.services?.length || 0} Serv.</Badge>
                                            <Badge variant="outline" className="text-[10px]">{provider.geoRates?.length || 0} Rutas</Badge>
                                            <Badge variant="outline" className="text-[10px]">{provider.contacts?.length || 0} Cont.</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-xs">
                                            <span>{provider.phone}</span>
                                            <span className="text-muted-foreground">{provider.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => { setCurrentProvider(provider); setIsEditing(true); setFormOpen(true); }}>Gestionar Tarifas y Perfil</DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setProviderToDelete(provider)} className="text-destructive">Eliminar</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open){ setCurrentProvider(emptyProvider); setIsEditing(false); setNewContact(emptyContact); }}}>
                <DialogContent className="sm:max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>{isEditing ? 'Gestionar' : 'Registrar'} Proveedor Externo</DialogTitle>
                        <DialogDescription>Define el catálogo de servicios, zonas geográficas y contactos de este colaborador.</DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className="px-6 border-b rounded-none justify-start h-auto py-2">
                            <TabsTrigger value="general" className="px-4">Datos Generales</TabsTrigger>
                            <TabsTrigger value="rates" className="px-4" disabled={!isEditing}>Servicios y Precios</TabsTrigger>
                            <TabsTrigger value="geo" className="px-4" disabled={!isEditing}>Zonas y Viáticos</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            <TabsContent value="general" className="space-y-8 m-0 pr-2">
                                <section>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-primary" /> Información de Empresa
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Nombre Comercial</Label><Input value={currentProvider.name} onChange={e => setCurrentProvider({...currentProvider, name: e.target.value})} required /></div>
                                        <div className="space-y-2"><Label>Especialidad Principal</Label><Input value={currentProvider.specialty} onChange={e => setCurrentProvider({...currentProvider, specialty: e.target.value})} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="space-y-2"><Label>Teléfono Central</Label><Input value={currentProvider.phone} onChange={e => setCurrentProvider({...currentProvider, phone: e.target.value})} /></div>
                                        <div className="space-y-2"><Label>Correo Central</Label><Input type="email" value={currentProvider.email} onChange={e => setCurrentProvider({...currentProvider, email: e.target.value})} /></div>
                                    </div>
                                    <div className="space-y-2 mt-4"><Label>Notas Internas</Label><Textarea value={currentProvider.notes} onChange={e => setCurrentProvider({...currentProvider, notes: e.target.value})} rows={3} /></div>
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
                                                <Input value={newContact.department} onChange={e => setNewContact({...newContact, department: e.target.value})} placeholder="Ej: Técnico, Ventas" className="h-8 text-xs" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Tel. Oficina</Label>
                                                <Input value={newContact.officePhone} onChange={e => setNewContact({...newContact, officePhone: e.target.value})} placeholder="2222-3333" className="h-8 text-xs" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">WhatsApp</Label>
                                                <Input value={newContact.whatsapp} onChange={e => setNewContact({...newContact, whatsapp: e.target.value})} placeholder="8888-9999" className="h-8 text-xs" />
                                            </div>
                                            <div className="flex items-end">
                                                <Button type="button" size="sm" onClick={handleAddContactToList} className="w-full h-8">
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Contacto
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {(currentProvider.contacts || []).map((contact) => (
                                            <div key={contact.id} className="flex items-center justify-between p-3 rounded-md border bg-card text-sm shadow-sm group hover:border-primary transition-colors">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 flex-1">
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
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveContact(contact.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {(!currentProvider.contacts || currentProvider.contacts.length === 0) && (
                                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                                                <p className="text-muted-foreground text-sm">No hay contactos agregados para este proveedor.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <div className="flex justify-end pt-4"><Button onClick={handleSaveProvider} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Guardar Proveedor</Button></div>
                            </TabsContent>

                            <TabsContent value="rates" className="space-y-6 m-0">
                                <div className="bg-muted/30 p-4 rounded-lg border border-dashed space-y-4">
                                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><Briefcase className="h-4 w-4"/> Matriz de Precios por Servicio</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label className="text-xs">Servicio del Catálogo</Label>
                                            <Select value={newServiceRate.serviceId} onValueChange={v => setNewServiceRate({...newServiceRate, serviceId: v})}>
                                                <SelectTrigger className="h-8"><SelectValue placeholder="Seleccione un servicio para asignar tarifas..."/></SelectTrigger>
                                                <SelectContent>
                                                    {companyData?.servicesCatalog.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.billingType === 'task' ? 'Tarea' : 'Hora'})</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Impuesto / IVA (%)</Label>
                                            <div className="relative">
                                                <Input type="number" value={newServiceRate.taxRate} onChange={e => setNewServiceRate({...newServiceRate, taxRate: Number(e.target.value)})} className="h-8 text-xs pr-8" />
                                                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                            </div>
                                        </div>
                                        
                                        {(() => {
                                            const selectedSvc = companyData?.servicesCatalog.find(s => s.id === newServiceRate.serviceId);
                                            const suffix = selectedSvc?.billingType === 'task' ? 'Tarea' : 'Hora';
                                            return (
                                                <>
                                                    <div className="space-y-4 border p-3 rounded-lg bg-background">
                                                        <p className="text-[10px] font-bold uppercase text-primary">Tarifa Remota (Por {suffix})</p>
                                                        {canViewCosts && (
                                                            <>
                                                                <div className="space-y-1"><Label className="text-[10px]">Costo Compra (¢)</Label><Input type="number" value={newServiceRate.buyPriceRemote} onChange={e => setNewServiceRate({...newServiceRate, buyPriceRemote: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                                                <div className="space-y-1"><Label className="text-[10px]">Margen Ganancia (%)</Label><Input type="number" value={newServiceRate.marginRemote} onChange={e => setNewServiceRate({...newServiceRate, marginRemote: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                                            </>
                                                        )}
                                                        <div className="space-y-1"><Label className="text-[10px] font-bold">Venta Sugerida (IVA Inc)</Label><Input type="number" value={newServiceRate.sellPriceRemote} readOnly={canViewCosts} onChange={e => !canViewCosts && setNewServiceRate({...newServiceRate, sellPriceRemote: Number(e.target.value)})} className={cn("h-8 text-xs font-bold", canViewCosts && "bg-muted")} /></div>
                                                    </div>

                                                    <div className="space-y-4 border p-3 rounded-lg bg-background">
                                                        <p className="text-[10px] font-bold uppercase text-primary">Tarifa en Sitio (Por {suffix})</p>
                                                        {canViewCosts && (
                                                            <>
                                                                <div className="space-y-1"><Label className="text-[10px]">Costo Compra (¢)</Label><Input type="number" value={newServiceRate.buyPriceOnSite} onChange={e => setNewServiceRate({...newServiceRate, buyPriceOnSite: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                                                <div className="space-y-1"><Label className="text-[10px]">Margen Ganancia (%)</Label><Input type="number" value={newServiceRate.marginOnSite} onChange={e => setNewServiceRate({...newServiceRate, marginOnSite: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                                            </>
                                                        )}
                                                        <div className="space-y-1"><Label className="text-[10px] font-bold">Venta Sugerida (IVA Inc)</Label><Input type="number" value={newServiceRate.sellPriceOnSite} readOnly={canViewCosts} onChange={e => !canViewCosts && setNewServiceRate({...newServiceRate, sellPriceOnSite: Number(e.target.value)})} className={cn("h-8 text-xs font-bold", canViewCosts && "bg-muted")} /></div>
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        <Button onClick={handleAddServiceRate} className="h-10 w-full"><PlusCircle className="h-4 w-4 mr-2" />Añadir Tarifa</Button>
                                    </div>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Servicio</TableHead>
                                                <TableHead>IVA</TableHead>
                                                {canViewCosts && <TableHead className="text-right">Compra (R/S)</TableHead>}
                                                {canViewCosts && <TableHead className="text-right">Margen</TableHead>}
                                                <TableHead className="text-right">Venta Remota</TableHead>
                                                <TableHead className="text-right">Venta Sitio</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(currentProvider as ThirdPartyProvider).services?.map(s => {
                                                const svc = companyData?.servicesCatalog.find(cat => cat.id === s.serviceId);
                                                return (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="text-sm font-medium">
                                                            <div className="flex flex-col">
                                                                <span>{svc?.name || s.serviceId}</span>
                                                                <Badge variant="outline" className="text-[8px] uppercase w-fit">
                                                                    {svc?.billingType === 'task' ? 'Por Tarea' : 'Por Hora'}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell><span className="text-xs font-bold text-muted-foreground">{s.taxRate || 13}%</span></TableCell>
                                                        {canViewCosts && (
                                                            <TableCell className="text-right text-[10px] font-mono">
                                                                {formatPrice(s.buyPriceRemote)} / {formatPrice(s.buyPriceOnSite)}
                                                            </TableCell>
                                                        )}
                                                        {canViewCosts && (
                                                            <TableCell className="text-right text-[10px] font-mono">
                                                                {s.marginRemote}% / {s.marginOnSite}%
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="text-right text-xs font-bold text-green-600">{formatPrice(s.sellPriceRemote)}</TableCell>
                                                        <TableCell className="text-right text-xs font-bold text-blue-600">{formatPrice(s.sellPriceOnSite)}</TableCell>
                                                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteServiceRate(s.id)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="geo" className="space-y-6 m-0">
                                <div className="bg-muted/30 p-4 rounded-lg border border-dashed space-y-4">
                                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><MapPin className="h-4 w-4"/> Definir Tarifas de Visita (Viáticos)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <div className="space-y-1"><Label className="text-[10px]">Provincia</Label>
                                            <Select value={String(newGeoRate.provinceId)} onValueChange={v => setNewGeoRate({...newGeoRate, provinceId: Number(v), cantonId: 0, districtId: 0})}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prov."/></SelectTrigger>
                                                <SelectContent>{geoData.provinces.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1"><Label className="text-[10px]">Cantón</Label>
                                            <Select value={String(newGeoRate.cantonId)} onValueChange={v => setNewGeoRate({...newGeoRate, cantonId: Number(v), districtId: 0})}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cantón"/></SelectTrigger>
                                                <SelectContent>{cantonsForProvince.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1"><Label className="text-[10px]">Poblado / Distrito</Label>
                                            <Select value={String(newGeoRate.districtId)} onValueChange={v => setNewGeoRate({...newGeoRate, districtId: Number(v)})}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Distrito"/></SelectTrigger>
                                                <SelectContent>{districtsForCanton.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px]">IVA (%)</Label>
                                            <div className="relative">
                                                <Input type="number" value={newGeoRate.taxRate} onChange={e => setNewGeoRate({...newGeoRate, taxRate: Number(e.target.value)})} className="h-8 text-xs pr-8" />
                                                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 border p-3 rounded-lg bg-background">
                                            {canViewCosts && (
                                                <>
                                                    <div className="space-y-1"><Label className="text-[10px]">Costo Compra (¢)</Label><Input type="number" value={newGeoRate.buyTravelPrice} onChange={e => setNewGeoRate({...newGeoRate, buyTravelPrice: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                                    <div className="space-y-1"><Label className="text-[10px]">Ganancia (%)</Label><Input type="number" value={newGeoRate.marginTravel} onChange={e => setNewGeoRate({...newGeoRate, marginTravel: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                                </>
                                            )}
                                            <div className="space-y-1"><Label className="text-[10px] font-bold">Venta Viático (¢)</Label><Input type="number" value={newGeoRate.sellTravelPrice} readOnly={canViewCosts} onChange={e => !canViewCosts && setNewGeoRate({...newGeoRate, sellTravelPrice: Number(e.target.value)})} className={cn("h-8 text-xs font-bold", canViewCosts && "bg-muted")} /></div>
                                        </div>

                                        <Button onClick={handleAddGeoRate} className="h-10 w-full md:col-span-2"><PlusCircle className="h-4 w-4 mr-2" />Añadir Viático</Button>
                                    </div>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Zona de Cobertura</TableHead>
                                                <TableHead>IVA</TableHead>
                                                {canViewCosts && <TableHead className="text-right">Compra</TableHead>}
                                                {canViewCosts && <TableHead className="text-right">Margen</TableHead>}
                                                <TableHead className="text-right">Venta Viático</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(currentProvider as ThirdPartyProvider).geoRates?.map(g => (
                                                <TableRow key={g.id}>
                                                    <TableCell className="text-xs">{g.locationName}</TableCell>
                                                    <TableCell><span className="text-xs font-bold text-muted-foreground">{g.taxRate || 13}%</span></TableCell>
                                                    {canViewCosts && <TableCell className="text-right text-[10px] font-mono">{formatPrice(g.buyTravelPrice)}</TableCell>}
                                                    {canViewCosts && <TableCell className="text-right text-[10px] font-mono">{g.marginTravel}%</TableCell>}
                                                    <TableCell className="text-right font-bold text-xs text-orange-600">{formatPrice(g.sellTravelPrice)}</TableCell>
                                                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGeoRate(g.id)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <DialogFooter className="p-6 border-t bg-muted/10"><DialogClose asChild><Button variant="ghost">Cerrar Panel</Button></DialogClose></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!providerToDelete} onOpenChange={(open) => !open && setProviderToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle><AlertDialogDescription>Esta acción borrará permanentemente al proveedor y todas sus tarifas asociadas.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                            if (providerToDelete) {
                                await deleteThirdPartyProvider(providerToDelete.id);
                                setProviders(prev => prev.filter(p => p.id !== providerToDelete.id));
                                setProviderToDelete(null);
                                toast({ title: "Proveedor eliminado" });
                            }
                        }} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
