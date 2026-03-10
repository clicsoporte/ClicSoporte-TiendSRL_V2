/**
 * @fileoverview Main page for the redesigned TI Project Manager module.
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Search, Calendar as CalendarIcon, Users, Settings, FileText, ChevronRight, Loader2, Briefcase, Truck, HardDrive, Network, ShieldCheck } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getProjects, createProject } from '@/modules/planner/lib/actions';
import type { TIProject, Customer, ProjectStatus, ProjectPriority, User, ThirdPartyProvider } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SearchInput } from '@/components/ui/search-input';
import { useDebounce } from 'use-debounce';
import Link from 'next/link';
import { getThirdPartyProviders } from '@/modules/tickets/lib/actions';

const statusConfig: { [key in ProjectStatus]: { label: string, color: string, icon: any } } = {
    planning: { label: 'Planeación', color: 'bg-yellow-500', icon: FileText },
    execution: { label: 'Ejecución', color: 'bg-blue-500', icon: Briefcase },
    testing: { label: 'Pruebas', color: 'bg-purple-500', icon: ShieldCheck },
    completed: { label: 'Finalizado', color: 'bg-green-600', icon: ShieldCheck },
    canceled: { label: 'Cancelado', color: 'bg-red-600', icon: ShieldCheck },
};

const priorityConfig: { [key in ProjectPriority]: { label: string, color: string } } = {
    low: { label: 'Baja', color: 'bg-gray-400' },
    medium: { label: 'Media', color: 'bg-blue-400' },
    high: { label: 'Alta', color: 'bg-orange-500' },
    urgent: { label: 'Urgente', color: 'bg-red-600' },
};

export default function TIPlannerPage() {
    const { setTitle } = usePageTitle();
    const { customers, users, isLoading: isAuthLoading } = useAuth();
    const { toast } = useToast();

    const [projects, setProjects] = useState<TIProject[]>([]);
    const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Search states
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [debouncedCustomerSearch] = useDebounce(customerSearch, 500);

    const [newProject, setNewProject] = useState<Omit<TIProject, 'id' | 'consecutive' | 'createdAt' | 'updatedAt' | 'billingStatus'>>({
        name: '',
        customerId: '',
        customerName: '',
        status: 'planning',
        priority: 'medium',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
        coordinatorId: 0,
        subcontractorId: null,
        description: '',
        notes: '',
    });

    useEffect(() => {
        setTitle("Gestor de Proyectos TI");
        fetchData();
    }, [setTitle]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [pData, provData] = await Promise.all([
                getProjects(),
                getThirdPartyProviders()
            ]);
            setProjects(pData);
            setProviders(provData);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const customerOptions = useMemo(() => {
        if (debouncedCustomerSearch.length < 2) return [];
        return customers.filter(c => 
            c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) || 
            c.id.toLowerCase().includes(debouncedCustomerSearch.toLowerCase())
        ).map(c => ({ value: c.id, label: `${c.name} (${c.id})` }));
    }, [customers, debouncedCustomerSearch]);

    const handleSelectCustomer = (id: string) => {
        const customer = customers.find(c => c.id === id);
        if (customer) {
            setNewProject({ ...newProject, customerId: id, customerName: customer.name });
            setCustomerSearch(customer.name);
            setCustomerSearchOpen(false);
        }
    };

    const handleCreate = async () => {
        if (!newProject.customerId || !newProject.name || !newProject.coordinatorId) {
            toast({ title: "Datos insuficientes", description: "Cliente, nombre y coordinador son requeridos.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await createProject(newProject);
            toast({ title: "Proyecto Iniciado" });
            fetchData();
            setFormOpen(false);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || isAuthLoading) {
        return <div className="p-8 space-y-4"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /></div>;
    }

    const coordinators = users.filter(u => u.role === 'admin' || u.role === 'support-agent');

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Network className="h-6 w-6 text-primary" /> Proyectos TI Activos
                </h1>
                <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Proyecto</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Iniciar Nuevo Proyecto TI</DialogTitle>
                            <DialogDescription>Define el alcance, responsables y cronograma inicial.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Cliente</Label>
                                    <SearchInput 
                                        options={customerOptions}
                                        onSelect={handleSelectCustomer}
                                        value={customerSearch}
                                        onValueChange={setCustomerSearch}
                                        open={isCustomerSearchOpen}
                                        onOpenChange={setCustomerSearchOpen}
                                        placeholder="Buscar cliente..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nombre del Proyecto</Label>
                                    <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Ej: Instalación de Cámaras de Seguridad" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Fecha Inicio</Label>
                                        <Input type="date" value={newProject.startDate} onChange={e => setNewProject({...newProject, startDate: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha Compromiso</Label>
                                        <Input type="date" value={newProject.endDate} onChange={e => setNewProject({...newProject, endDate: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Coordinador Interno (Soporte)</Label>
                                    <Select value={String(newProject.coordinatorId)} onValueChange={v => setNewProject({...newProject, coordinatorId: Number(v)})}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona un técnico..." /></SelectTrigger>
                                        <SelectContent>
                                            {coordinators.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Subcontratista (Opcional)</Label>
                                    <Select value={String(newProject.subcontractorId || 'none')} onValueChange={v => setNewProject({...newProject, subcontractorId: v === 'none' ? null : Number(v)})}>
                                        <SelectTrigger><SelectValue placeholder="Sin tercero externo" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Gestión Interna</SelectItem>
                                            {providers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Alcance / Descripción Inicial</Label>
                                    <Textarea value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} rows={3} placeholder="Detalla los objetivos del proyecto..." />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <Button onClick={handleCreate} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear e Iniciar Planeación
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map(project => (
                    <Link key={project.id} href={`/dashboard/planner/${project.id}`}>
                        <Card className="hover:shadow-md transition-all cursor-pointer group">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className="font-mono text-[10px]">{project.consecutive}</Badge>
                                    <Badge className={statusConfig[project.status].color}>{statusConfig[project.status].label}</Badge>
                                </div>
                                <CardTitle className="text-lg group-hover:text-primary transition-colors">{project.name}</CardTitle>
                                <CardDescription>{project.customerName}</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2 space-y-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <CalendarIcon className="h-3 w-3" />
                                    <span>{format(parseISO(project.startDate), 'dd/MM/yy')} al {format(parseISO(project.endDate), 'dd/MM/yy')}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
                                        <Users className="h-3 w-3" /> 
                                        {users.find(u => u.id === project.coordinatorId)?.name.split(' ')[0]}
                                    </div>
                                    {project.subcontractorId && (
                                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600">
                                            <Truck className="h-3 w-3" /> 
                                            Ext.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2 border-t text-xs flex justify-between">
                                <span className={cn("font-bold", priorityConfig[project.priority].color.replace('bg-', 'text-'))}>Prioridad {priorityConfig[project.priority].label}</span>
                                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </CardFooter>
                        </Card>
                    </Link>
                ))}
                {projects.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg bg-muted/20">
                        <p className="text-muted-foreground">No hay proyectos registrados en este momento.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
