/**
 * @fileoverview Page for managing client companies for the support ticket module.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { addClientCompany, getClientCompanies, updateClientCompany, deleteClientCompany } from '@/modules/tickets/lib/actions';
import type { ClientCompany } from '@/modules/core/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const emptyCompany: Omit<ClientCompany, 'id' | 'createdAt'> = {
    name: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
};

export default function TicketCustomersPage() {
    const { isAuthorized, hasPermission } = useAuthorization(['tickets:create']); // Using this permission as a proxy for access
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companies, setCompanies] = useState<ClientCompany[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentCompany, setCurrentCompany] = useState<ClientCompany | Omit<ClientCompany, 'id' | 'createdAt'>>(emptyCompany);
    const [companyToDelete, setCompanyToDelete] = useState<ClientCompany | null>(null);
    
    const fetchCompanies = async () => {
        setIsLoading(true);
        const data = await getClientCompanies();
        setCompanies(data);
        setIsLoading(false);
    };

    useEffect(() => {
        setTitle("Gestión de Clientes de Soporte");
        if(isAuthorized) {
            fetchCompanies();
        }
    }, [setTitle, isAuthorized]);

    const handleCurrentCompanyChange = (field: keyof typeof emptyCompany, value: string) => {
        setCurrentCompany(prev => ({...prev, [field]: value}));
    };

    const handleSaveCompany = async () => {
        if (!currentCompany.name || !currentCompany.taxId) {
            toast({ title: "Datos incompletos", description: "El Nombre y la Cédula Jurídica son requeridos.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            if (isEditing && 'id' in currentCompany) {
                const updated = await updateClientCompany(currentCompany);
                setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
                toast({ title: "Empresa Actualizada" });
            } else {
                const newCompany = await addClientCompany(currentCompany as Omit<ClientCompany, 'id' | 'createdAt'>);
                setCompanies(prev => [...prev, newCompany]);
                toast({ title: "Empresa Creada" });
            }
            setFormOpen(false);
            setCurrentCompany(emptyCompany);
            setIsEditing(false);
        } catch (error: unknown) {
            toast({ title: "Error", description: `No se pudo guardar la empresa: ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditClick = (company: ClientCompany) => {
        setCurrentCompany(company);
        setIsEditing(true);
        setFormOpen(true);
    }
    
    const handleDeleteCompany = async () => {
        if (!companyToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteClientCompany(companyToDelete.id);
            setCompanies(prev => prev.filter(c => c.id !== companyToDelete.id));
            toast({ title: "Empresa Eliminada", variant: "destructive" });
            setCompanyToDelete(null);
        } catch (error: unknown) {
             toast({ title: "Error al Eliminar", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }
    

    if (!isAuthorized) {
        return null;
    }

    if (isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-64"/>
                        <Skeleton className="h-4 w-96 mt-2"/>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                 </Card>
            </main>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Empresas Clientes</CardTitle>
                            <CardDescription>
                            Gestiona las empresas a las que se les brinda soporte técnico.
                            </CardDescription>
                        </div>
                        <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open){ setCurrentCompany(emptyCompany); setIsEditing(false); }}}>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4"/>Nueva Empresa</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>{isEditing ? 'Editar' : 'Añadir Nueva'} Empresa Cliente</DialogTitle>
                                    <DialogDescription>Completa los datos fiscales y de contacto de la empresa.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="company-name">Nombre / Razón Social</Label>
                                            <Input id="company-name" value={currentCompany.name} onChange={e => handleCurrentCompanyChange('name', e.target.value)} required />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="company-taxid">Cédula Jurídica</Label>
                                            <Input id="company-taxid" value={currentCompany.taxId} onChange={e => handleCurrentCompanyChange('taxId', e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="company-address">Dirección</Label>
                                        <Input id="company-address" value={currentCompany.address} onChange={e => handleCurrentCompanyChange('address', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="company-phone">Teléfono</Label>
                                            <Input id="company-phone" value={currentCompany.phone} onChange={e => handleCurrentCompanyChange('phone', e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="company-email">Correo Electrónico</Label>
                                            <Input id="company-email" type="email" value={currentCompany.email} onChange={e => handleCurrentCompanyChange('email', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                    <Button onClick={handleSaveCompany} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                                        {isEditing ? 'Guardar Cambios' : 'Crear Empresa'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre de la Empresa</TableHead>
                                    <TableHead>Cédula Jurídica</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {companies.map(company => (
                                    <TableRow key={company.id}>
                                        <TableCell className="font-medium">{company.name}</TableCell>
                                        <TableCell>{company.taxId}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{company.phone}</span>
                                                <span className="text-xs text-muted-foreground">{company.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {hasPermission('tickets:admin:settings') && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleEditClick(company)}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => setCompanyToDelete(company)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {companies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No hay empresas clientes registradas.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!companyToDelete} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar empresa &quot;{companyToDelete?.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminarán los datos de la empresa, pero los tickets asociados no se verán afectados.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCompany} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                            Sí, eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}
