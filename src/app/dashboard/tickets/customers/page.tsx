/**
 * @fileoverview Page for managing client companies for the support ticket module.
 */
'use client';

import { useTickets } from '@/modules/tickets/hooks/useTickets';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { addClientCompany, getClientCompanies } from '@/modules/tickets/lib/actions';
import type { ClientCompany } from '@/modules/core/types';

const emptyCompany: Omit<ClientCompany, 'id' | 'createdAt'> = {
    name: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
};

export default function TicketCustomersPage() {
    const { isAuthorized } = useAuthorization(['tickets:create']); // Using this permission as a proxy for access
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companies, setCompanies] = useState<ClientCompany[]>([]);
    const [isNewCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);
    const [newCompany, setNewCompany] = useState(emptyCompany);
    
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

    const handleNewCompanyChange = (field: keyof typeof emptyCompany, value: string) => {
        setNewCompany(prev => ({...prev, [field]: value}));
    };

    const handleCreateCompany = async () => {
        if (!newCompany.name || !newCompany.taxId) {
            toast({ title: "Datos incompletos", description: "El Nombre y la Cédula Jurídica son requeridos.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await addClientCompany(newCompany);
            toast({ title: "Empresa Creada", description: "La nueva empresa cliente ha sido añadida." });
            setNewCompanyDialogOpen(false);
            setNewCompany(emptyCompany);
            await fetchCompanies();
        } catch (error: any) {
            toast({ title: "Error", description: `No se pudo crear la empresa: ${error.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    

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
                        <Dialog open={isNewCompanyDialogOpen} onOpenChange={setNewCompanyDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4"/>Nueva Empresa</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>Añadir Nueva Empresa Cliente</DialogTitle>
                                    <DialogDescription>Completa los datos fiscales y de contacto de la nueva empresa.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="company-name">Nombre / Razón Social</Label>
                                            <Input id="company-name" value={newCompany.name} onChange={e => handleNewCompanyChange('name', e.target.value)} required />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="company-taxid">Cédula Jurídica</Label>
                                            <Input id="company-taxid" value={newCompany.taxId} onChange={e => handleNewCompanyChange('taxId', e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="company-address">Dirección</Label>
                                        <Input id="company-address" value={newCompany.address} onChange={e => handleNewCompanyChange('address', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="company-phone">Teléfono</Label>
                                            <Input id="company-phone" value={newCompany.phone} onChange={e => handleNewCompanyChange('phone', e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="company-email">Correo Electrónico</Label>
                                            <Input id="company-email" type="email" value={newCompany.email} onChange={e => handleNewCompanyChange('email', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                    <Button onClick={handleCreateCompany} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 animate-spin"/>}
                                        Crear Empresa
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
                                    </TableRow>
                                ))}
                                {companies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">No hay empresas clientes registradas.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
