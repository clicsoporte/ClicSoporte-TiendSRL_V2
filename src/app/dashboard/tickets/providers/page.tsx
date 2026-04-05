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
import { PlusCircle, Loader2, MoreVertical, Truck, Trash2, MapPin, DollarSign, Briefcase } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { 
    getThirdPartyProviders, addThirdPartyProvider, updateThirdPartyProvider, deleteThirdPartyProvider,
    getCRGeoData, saveProviderService, deleteProviderService, saveProviderGeoRate, deleteProviderGeoRate 
} from '@/modules/tickets/lib/actions';
import type { ThirdPartyProvider, Province, Canton, District, ProviderService, ProviderGeoRate } from '@/modules/core/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/modules/core/hooks/useAuth';

const emptyProvider: Omit<ThirdPartyProvider, 'id' | 'createdAt' | 'services' | 'geoRates'> = {
    name: '',
    email: '',
    phone: '',
    specialty: '',
    notes: ''
};

export default function ProvidersPage() {
    const { isAuthorized } = useAuthorization(['tickets:admin:settings']);
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

    // Rate Management States
    const [newServiceRate, setNewServiceRate] = useState<Omit<ProviderService, 'id'>>({ providerId: 0, serviceId: '', priceRemote: 0, priceOnSite: 0 });
    const [newGeoRate, setNewGeoRate] = useState<Omit<ProviderGeoRate, 'id'>>({ providerId: 0, provinceId: 0, cantonId: 0, districtId: 0, travelPrice: 0, locationName: '' });

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
            setNewServiceRate({ providerId: 0, serviceId: '', priceRemote: 0, priceOnSite: 0 });
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
            setNewGeoRate({ providerId: 0, provinceId: 0, cantonId: 0, districtId: 0, travelPrice: 0, locationName: '' });
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

    const cantonsForProvince = useMemo(() => geoData.cantons.filter(c => c.provinceId === newGeoRate.provinceId), [geoData.cantons, newGeoRate.provinceId]);
    const districtsForCanton = useMemo(() => geoData.districts.filter(d => d.cantonId === newGeoRate.cantonId), [geoData.districts, newGeoRate.cantonId]);

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

            <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open){ setCurrentProvider(emptyProvider); setIsEditing(false); }}}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>{isEditing ? 'Gestionar' : 'Registrar'} Proveedor Externo</DialogTitle>
                        <DialogDescription>Define el catálogo de servicios y zonas geográficas de este colaborador.</DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className="px-6 border-b rounded-none justify-start h-auto py-2">
                            <TabsTrigger value="general" className="px-4">Datos Generales</TabsTrigger>
                            <TabsTrigger value="rates" className="px-4" disabled={!isEditing}>Servicios y Precios</TabsTrigger>
                            <TabsTrigger value="geo" className="px-4" disabled={!isEditing}>Zonas y Viáticos</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto p-6">
                            <TabsContent value="general" className="space-y-4 m-0">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Nombre Comercial</Label><Input value={currentProvider.name} onChange={e => setCurrentProvider({...currentProvider, name: e.target.value})} required /></div>
                                    <div className="space-y-2"><Label>Especialidad Principal</Label><Input value={currentProvider.specialty} onChange={e => setCurrentProvider({...currentProvider, specialty: e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Teléfono</Label><Input value={currentProvider.phone} onChange={e => setCurrentProvider({...currentProvider, phone: e.target.value})} /></div>
                                    <div className="space-y-2"><Label>Correo Electrónico</Label><Input type="email" value={currentProvider.email} onChange={e => setCurrentProvider({...currentProvider, email: e.target.value})} /></div>
                                </div>
                                <div className="space-y-2"><Label>Notas Internas</Label><Textarea value={currentProvider.notes} onChange={e => setCurrentProvider({...currentProvider, notes: e.target.value})} rows={4} /></div>
                                <div className="flex justify-end pt-4"><Button onClick={handleSaveProvider} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin"/>}Guardar Datos Generales</Button></div>
                            </TabsContent>

                            <TabsContent value="rates" className="space-y-6 m-0">
                                <div className="bg-muted/30 p-4 rounded-lg border border-dashed">
                                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><Briefcase className="h-4 w-4"/> Vincular Servicio del Catálogo</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                        <div className="md:col-span-1 space-y-1.5">
                                            <Label className="text-xs">Servicio</Label>
                                            <Select value={newServiceRate.serviceId} onValueChange={v => setNewServiceRate({...newServiceRate, serviceId: v})}>
                                                <SelectTrigger className="h-8"><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                                <SelectContent>
                                                    {companyData?.servicesCatalog.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5"><Label className="text-xs">Precio Remoto</Label><Input type="number" value={newServiceRate.priceRemote} onChange={e => setNewServiceRate({...newServiceRate, priceRemote: Number(e.target.value)})} className="h-8" /></div>
                                        <div className="space-y-1.5"><Label className="text-xs">Precio Sitio (Labor)</Label><Input type="number" value={newServiceRate.priceOnSite} onChange={e => setNewServiceRate({...newServiceRate, priceOnSite: Number(e.target.value)})} className="h-8" /></div>
                                        <Button onClick={handleAddServiceRate} size="sm" className="h-8"><PlusCircle className="h-4 w-4 mr-2" />Añadir</Button>
                                    </div>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50"><TableRow><TableHead>Servicio</TableHead><TableHead className="text-right">Remoto</TableHead><TableHead className="text-right">Sitio</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {(currentProvider as ThirdPartyProvider).services?.map(s => (
                                                <TableRow key={s.id}>
                                                    <TableCell className="text-sm font-medium">{companyData?.servicesCatalog.find(cat => cat.id === s.serviceId)?.name || s.serviceId}</TableCell>
                                                    <TableCell className="text-right text-xs">¢{s.priceRemote.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-xs">¢{s.priceOnSite.toLocaleString()}</TableCell>
                                                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteServiceRate(s.id)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="geo" className="space-y-6 m-0">
                                <div className="bg-muted/30 p-4 rounded-lg border border-dashed">
                                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><MapPin className="h-4 w-4"/> Definir Tarifas de Visita (Costa Rica)</h4>
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
                                        <div className="space-y-1"><Label className="text-[10px]">Costo Transporte (¢)</Label><Input type="number" value={newGeoRate.travelPrice} onChange={e => setNewGeoRate({...newGeoRate, travelPrice: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                        <Button onClick={handleAddGeoRate} size="sm" className="h-8"><PlusCircle className="h-4 w-4 mr-2" />Añadir</Button>
                                    </div>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50"><TableRow><TableHead>Zona de Cobertura</TableHead><TableHead className="text-right">Viático</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {(currentProvider as ThirdPartyProvider).geoRates?.map(g => (
                                                <TableRow key={g.id}>
                                                    <TableCell className="text-xs">{g.locationName}</TableCell>
                                                    <TableCell className="text-right font-bold text-xs">¢{g.travelPrice.toLocaleString()}</TableCell>
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
