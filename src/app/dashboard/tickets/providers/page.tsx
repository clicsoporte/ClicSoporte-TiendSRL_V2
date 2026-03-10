/**
 * @fileoverview Page for managing third-party service providers.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, MoreVertical, Edit, Trash2, Truck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getThirdPartyProviders, addThirdPartyProvider, updateThirdPartyProvider, deleteThirdPartyProvider } from '@/modules/tickets/lib/actions';
import type { ThirdPartyProvider } from '@/modules/core/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

const emptyProvider: Omit<ThirdPartyProvider, 'id' | 'createdAt'> = {
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

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<ThirdPartyProvider | Omit<ThirdPartyProvider, 'id' | 'createdAt'>>(emptyProvider);
    const [providerToDelete, setProviderToDelete] = useState<ThirdPartyProvider | null>(null);
    
    const fetchProviders = async () => {
        setIsLoading(true);
        const data = await getThirdPartyProviders();
        setProviders(data);
        setIsLoading(false);
    };

    useEffect(() => {
        setTitle("Proveedores de Servicios Externos");
        if(isAuthorized) {
            fetchProviders();
        }
    }, [setTitle, isAuthorized]);

    const handleSave = async () => {
        if (!currentProvider.name) {
            toast({ title: "Nombre requerido", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            if (isEditing && 'id' in currentProvider) {
                const updated = await updateThirdPartyProvider(currentProvider as ThirdPartyProvider);
                setProviders(prev => prev.map(p => p.id === updated.id ? updated : p));
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
            const err = error as Error;
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthorized) return null;

    if (isLoading) {
        return <div className="p-8"><Skeleton className="h-full w-full" /></div>;
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Truck className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Catálogo de Proveedores</h1>
                </div>
                <Button onClick={() => setFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Nuevo Proveedor</Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Especialidad</TableHead>
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
                                            <div className="flex flex-col text-xs">
                                                <span>{provider.phone}</span>
                                                <span className="text-muted-foreground">{provider.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => { setCurrentProvider(provider); setIsEditing(true); setFormOpen(true); }}>Editar</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => setProviderToDelete(provider)} className="text-destructive">Eliminar</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {providers.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center">No hay proveedores registrados.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open){ setCurrentProvider(emptyProvider); setIsEditing(false); }}}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Registrar'} Proveedor</DialogTitle>
                        <DialogDescription>Define los servicios que este tercero brinda a tu empresa de TI.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre / Empresa</Label>
                            <Input value={currentProvider.name} onChange={e => setCurrentProvider({...currentProvider, name: e.target.value})} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Especialidad</Label>
                                <Input value={currentProvider.specialty} onChange={e => setCurrentProvider({...currentProvider, specialty: e.target.value})} placeholder="Ej: Hardware, Redes, Software" />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <Input value={currentProvider.phone} onChange={e => setCurrentProvider({...currentProvider, phone: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Correo Electrónico</Label>
                            <Input type="email" value={currentProvider.email} onChange={e => setCurrentProvider({...currentProvider, email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Notas Internas</Label>
                            <Textarea value={currentProvider.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentProvider({...currentProvider, notes: e.target.value})} />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                            Guardar Proveedor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!providerToDelete} onOpenChange={(open) => !open && setProviderToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
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
