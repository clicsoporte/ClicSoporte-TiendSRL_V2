/**
 * @fileoverview Client Component for managing support contracts.
 * Extracted from the main page to support server-side guarding.
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Edit, Trash2, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getContracts, saveContract, updateContract, deleteContract } from '@/modules/contracts/lib/actions';
import type { Contract, Customer } from '@/modules/core/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { SearchInput } from '@/components/ui/search-input';
import { useDebounce } from 'use-debounce';

const emptyContract: Omit<Contract, 'id' | 'consecutive' | 'createdAt'> = {
    name: '',
    customerId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    status: 'active',
    includedServices: [],
    excludedServices: [],
    monthlyHours: 0,
    price: 0,
    currency: 'CRC',
    notes: ''
};

export default function ContractsClient() {
    const { setTitle } = usePageTitle();
    const { customers, companyData, isAuthReady } = useAuth();
    const { toast } = useToast();

    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentContract, setCurrentContract] = useState<Omit<Contract, 'id' | 'consecutive' | 'createdAt'> | Contract>(emptyContract);
    const [isEditing, setIsEditing] = useState(false);
    
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    const [debouncedCustomerSearch] = useDebounce(customerSearchTerm, 500);

    const fetchContracts = async () => {
        setIsLoading(true);
        const data = await getContracts();
        setContracts(data);
        setIsLoading(false);
    };

    useEffect(() => {
        setTitle("Administración de Contratos");
        fetchContracts();
    }, [setTitle]);

    const customerOptions = useMemo(() => {
        if (debouncedCustomerSearch.length < 2) return [];
        return (customers || []).filter(c => 
            c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) || 
            c.id.toLowerCase().includes(debouncedCustomerSearch.toLowerCase())
        ).map(c => ({ value: c.id, label: `${c.name} (${c.id})` }));
    }, [customers, debouncedCustomerSearch]);

    const handleSelectCustomer = (id: string) => {
        const customer = customers.find(c => c.id === id);
        setCurrentContract(prev => ({ ...prev, customerId: id }));
        setCustomerSearchTerm(customer ? customer.name : '');
        setIsCustomerSearchOpen(false);
    };

    const toggleService = (serviceId: string, type: 'included' | 'excluded') => {
        const targetKey = type === 'included' ? 'includedServices' : 'excludedServices';
        const otherKey = type === 'included' ? 'excludedServices' : 'includedServices';
        
        setCurrentContract(prev => {
            const currentTarget = (prev as any)[targetKey] || [];
            const currentOther = (prev as any)[otherKey] || [];
            
            let newTarget = [...currentTarget];
            let newOther = [...currentOther];

            if (newTarget.includes(serviceId)) {
                newTarget = newTarget.filter(id => id !== serviceId);
            } else {
                newTarget.push(serviceId);
                newOther = newOther.filter(id => id !== serviceId);
            }

            return {
                ...prev,
                [targetKey]: newTarget,
                [otherKey]: newOther
            };
        });
    };

    const handleSave = async () => {
        if (!currentContract.customerId || !currentContract.name) {
            toast({ title: "Datos faltantes", description: "El nombre y el cliente son requeridos.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            if (isEditing && 'id' in currentContract) {
                await updateContract(currentContract as Contract);
                toast({ title: "Contrato actualizado" });
            } else {
                await saveContract(currentContract);
                toast({ title: "Contrato creado" });
            }
            await fetchContracts();
            setFormOpen(false);
            setCurrentContract(emptyContract);
            setIsEditing(false);
            setCustomerSearchTerm('');
        } catch (error: unknown) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (contract: Contract) => {
        const customer = customers.find(c => c.id === contract.customerId);
        setCurrentContract(contract);
        setCustomerSearchTerm(customer ? customer.name : contract.customerId);
        setIsEditing(true);
        setFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este contrato?")) return;
        try {
            await deleteContract(id);
            toast({ title: "Contrato eliminado", variant: "destructive" });
            await fetchContracts();
        } catch (error: unknown) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        }
    };

    if (!isAuthReady || isLoading) {
        return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Contratos de Soporte</h1>
                </div>
                <Button onClick={() => setFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Contrato</Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Consecutivo</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Vigencia</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {contracts.map(contract => {
                                    const customer = customers.find((c: Customer) => c.id === contract.customerId);
                                    return (
                                        <TableRow key={contract.id}>
                                            <TableCell className="font-mono font-bold">{contract.consecutive}</TableCell>
                                            <TableCell>{contract.name}</TableCell>
                                            <TableCell>{customer?.name || contract.customerId}</TableCell>
                                            <TableCell className="text-xs">
                                                {format(parseISO(contract.startDate), 'dd/MM/yy')} al {format(parseISO(contract.endDate), 'dd/MM/yy')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                                                    {contract.status === 'active' ? 'Vigente' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(contract)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(contract.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {contracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10">No hay contratos registrados.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Editar Contrato" : "Crear Nuevo Contrato"}</DialogTitle>
                        <DialogDescription>Define los términos, fechas y servicios cubiertos.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <SearchInput 
                                    options={customerOptions}
                                    onSelect={handleSelectCustomer}
                                    value={customerSearchTerm}
                                    onValueChange={setCustomerSearchTerm}
                                    open={isCustomerSearchOpen}
                                    onOpenChange={setIsCustomerSearchOpen}
                                    placeholder="Buscar cliente..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nombre del Contrato</Label>
                                <Input value={currentContract.name} onChange={e => setCurrentContract({...currentContract, name: e.target.value})} placeholder="Ej: Contrato Soporte Oro 2024" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha Inicio</Label>
                                    <Input type="date" value={currentContract.startDate} onChange={e => setCurrentContract({...currentContract, startDate: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Vencimiento</Label>
                                    <Input type="date" value={currentContract.endDate} onChange={e => setCurrentContract({...currentContract, endDate: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Horas Mensuales</Label>
                                    <Input type="number" value={currentContract.monthlyHours} onChange={e => setCurrentContract({...currentContract, monthlyHours: Number(e.target.value)})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Precio Mensual</Label>
                                    <Input type="number" value={currentContract.price} onChange={e => setCurrentContract({...currentContract, price: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-lg font-bold">Cobertura de Servicios</Label>
                            <ScrollArea className="h-[300px] rounded-md border p-4">
                                <div className="space-y-4">
                                    {companyData?.servicesCatalog.map(service => (
                                        <div key={service.id} className="flex items-center justify-between p-2 border-b last:border-0">
                                            <span className="text-sm font-medium">{service.name}</span>
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-1">
                                                    <Checkbox 
                                                        id={`inc-${service.id}`} 
                                                        checked={currentContract.includedServices.includes(service.id)}
                                                        onCheckedChange={() => toggleService(service.id, 'included')}
                                                    />
                                                    <Label htmlFor={`inc-${service.id}`} className="text-[10px] text-green-600">Incluido</Label>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Checkbox 
                                                        id={`exc-${service.id}`}
                                                        checked={currentContract.excludedServices.includes(service.id)}
                                                        onCheckedChange={() => toggleService(service.id, 'excluded')}
                                                    />
                                                    <Label htmlFor={`exc-${service.id}`} className="text-[10px] text-red-600">Facturable</Label>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Contrato
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
