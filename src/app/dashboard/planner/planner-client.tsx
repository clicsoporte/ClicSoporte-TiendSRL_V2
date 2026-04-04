/**
 * @fileoverview Client-side component for TI Project Manager.
 * Handles project creation and listing with robust validation.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Calendar as CalendarIcon, Users, FileText, ChevronRight, Loader2, Briefcase, Truck, Network, Radio, Monitor, Zap, Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getProjects, createProject } from '@/modules/planner/lib/actions';
import type { TIProject, ProjectStatus, ProjectPriority, ProjectCategory, ThirdPartyProvider } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { SearchInput } from '@/components/ui/search-input';
import { useDebounce } from 'use-debounce';
import Link from 'next/link';
import { getThirdPartyProviders } from '@/modules/tickets/lib/actions';
import { cn } from '@/lib/utils';

const statusConfig: { [key in ProjectStatus]: { label: string, color: string } } = {
    planning: { label: 'Planeación', color: 'bg-yellow-500' },
    execution: { label: 'Ejecución', color: 'bg-blue-500' },
    testing: { label: 'Pruebas', color: 'bg-purple-500' },
    completed: { label: 'Finalizado', color: 'bg-green-600' },
    canceled: { label: 'Cancelado', color: 'bg-red-600' },
};

const categoryConfig: { [key in ProjectCategory]: { label: string, icon: React.ElementType, color: string } } = {
    cctv: { label: 'Video Vigilancia (CCTV)', icon: Monitor, color: 'text-blue-600' },
    alarms: { label: 'Seguridad (Alarmas)', icon: Lock, color: 'text-red-600' },
    wireless: { label: 'Redes Inalámbricas', icon: Radio, color: 'text-cyan-600' },
    pos: { label: 'Puntos de Venta (POS)', icon: Briefcase, color: 'text-orange-600' },
    fencing: { label: 'Cercados Perimetrales', icon: Zap, color: 'text-yellow-600' },
    server: { label: 'Infraestructura Servidores', icon: Network, color: 'text-indigo-600' },
    networking: { label: 'Cableado Estructurado', icon: Network, color: 'text-emerald-600' },
    telephony: { label: 'Telefonía IP', icon: Network, color: 'text-violet-600' },
    other: { label: 'Otro Servicio TI', icon: FileText, color: 'text-gray-600' },
};

const priorityConfig: { [key in ProjectPriority]: { label: string, color: string } } = {
    low: { label: 'Baja', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    medium: { label: 'Media', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    high: { label: 'Alta', color: 'bg-orange-500 text-white border-orange-600' },
    urgent: { label: 'Urgente', color: 'bg-red-600 text-white border-red-700' },
};

interface NewProjectState extends Omit<TIProject, 'id' | 'consecutive' | 'createdAt' | 'updatedAt' | 'billingStatus' | 'coordinatorId'> {
    coordinatorId: number | null;
}

const initialNewProject: NewProjectState = {
    name: '',
    customerId: '',
    customerName: '',
    category: 'other',
    status: 'planning',
    priority: 'medium',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
    coordinatorId: null,
    subcontractorId: null,
    description: '',
    notes: '',
};

export default function PlannerClient() {
    const { customers, users, companyData } = useAuth();
    const { toast } = useToast();

    const [projects, setProjects] = useState<TIProject[]>([]);
    const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [debouncedCustomerSearch] = useDebounce(customerSearch, companyData?.searchDebounceTime ?? 500);

    const [newProject, setNewProject] = useState<NewProjectState>(initialNewProject);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [pData, provData] = await Promise.all([
                getProjects(),
                getThirdPartyProviders()
            ]);
            setProjects(pData);
            setProviders(provData);
        } catch (e) {
            console.error("Error fetching planner data:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            setNewProject(prev => ({ ...prev, customerId: id, customerName: customer.name }));
            setCustomerSearch(customer.name);
            setCustomerSearchOpen(false);
        }
    };

    const handleCreate = async () => {
        // Strict validation
        if (!newProject.customerId) {
            toast({ title: "Falta Cliente", description: "Debe seleccionar un cliente de la lista de sugerencias.", variant: "destructive" });
            return;
        }
        if (!newProject.name.trim()) {
            toast({ title: "Falta Nombre", description: "El nombre del proyecto es obligatorio.", variant: "destructive" });
            return;
        }
        if (newProject.coordinatorId === null || newProject.coordinatorId === 0) {
            toast({ title: "Falta Coordinador", description: "Debe asignar a un técnico responsable del proyecto.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            await createProject(newProject as any);
            toast({ title: "Proyecto Iniciado", description: `El proyecto "${newProject.name}" ha sido creado con éxito.` });
            await fetchData();
            setFormOpen(false);
            setNewProject(initialNewProject);
            setCustomerSearch('');
        } catch (error: unknown) {
            const err = error as Error;
            toast({ title: "Error al crear", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-muted/10">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse font-medium">Cargando proyectos TI...</p>
                </div>
            </div>
        );
    }

    const coordinators = users.filter(u => u.role === 'admin' || u.role === 'support-agent');

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Network className="h-6 w-6 text-primary" /> Proyectos TI Llave en Mano
                    </h1>
                    <p className="text-sm text-muted-foreground">Administra ejecuciones de infraestructura, redes y seguridad.</p>
                </div>
                <Dialog open={isFormOpen} onOpenChange={(open) => { setFormOpen(open); if(!open) setNewProject(initialNewProject); }}>
                    <DialogTrigger asChild>
                        <Button className="shadow-md"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Proyecto</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Iniciar Proyecto TI Integral</DialogTitle>
                            <DialogDescription>Define el alcance técnico, los equipos y el personal involucrado.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Categoría de Servicio</Label>
                                    <Select value={newProject.category} onValueChange={v => setNewProject({...newProject, category: v as ProjectCategory})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(categoryConfig).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>
                                                    <div className="flex items-center gap-2">
                                                        <config.icon className={cn("h-4 w-4", config.color)} />
                                                        <span>{config.label}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Cliente</Label>
                                    <SearchInput 
                                        options={customerOptions}
                                        onSelect={handleSelectCustomer}
                                        value={customerSearch}
                                        onValueChange={setCustomerSearch}
                                        open={isCustomerSearchOpen}
                                        onOpenChange={setCustomerSearchOpen}
                                        placeholder="Escribe para buscar cliente..."
                                    />
                                    {newProject.customerId && (
                                        <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> Cliente seleccionado correctamente
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Nombre del Proyecto</Label>
                                    <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Ej: Sistema Paradox Central" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Fecha Inicio</Label>
                                        <Input type="date" value={newProject.startDate} onChange={e => setNewProject({...newProject, startDate: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Fecha Compromiso</Label>
                                        <Input type="date" value={newProject.endDate} onChange={e => setNewProject({...newProject, endDate: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Coordinador Interno (Soporte)</Label>
                                    <Select 
                                        value={newProject.coordinatorId ? String(newProject.coordinatorId) : ""} 
                                        onValueChange={v => setNewProject({...newProject, coordinatorId: Number(v)})}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Selecciona un técnico..." /></SelectTrigger>
                                        <SelectContent>
                                            {coordinators.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Subcontratista (Instalador Externo)</Label>
                                    <Select value={String(newProject.subcontractorId || 'none')} onValueChange={v => setNewProject({...newProject, subcontractorId: v === 'none' ? null : Number(v)})}>
                                        <SelectTrigger><SelectValue placeholder="Gestión Interna Completa" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Gestión Interna Completa</SelectItem>
                                            {providers.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción de Alcance</Label>
                                    <Textarea value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} rows={4} placeholder="Detalla los entregables finales, configuración y equipos clave..." />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-4 border-t">
                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                            <Button onClick={handleCreate} disabled={isSubmitting} className="min-w-[150px]">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                Abrir Proyecto
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map(project => {
                    const catInfo = categoryConfig[project.category] || categoryConfig.other;
                    const CategoryIcon = catInfo.icon;
                    
                    return (
                        <Link key={project.id} href={`/dashboard/planner/${project.id}`}>
                            <Card className="hover:shadow-lg transition-all cursor-pointer group border-l-4 h-full flex flex-col" style={{ borderLeftColor: 'currentColor' }}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("p-2 rounded-lg bg-muted", catInfo.color.replace('text-', 'bg-').replace('600', '100'))}>
                                                <CategoryIcon className={cn("h-4 w-4", catInfo.color)} />
                                            </div>
                                            <Badge variant="secondary" className="font-mono text-[10px]">{project.consecutive}</Badge>
                                        </div>
                                        <Badge className={cn("text-[10px] uppercase font-bold text-white", statusConfig[project.status].color)}>
                                            {statusConfig[project.status].label}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">{project.name}</CardTitle>
                                    <CardDescription className="font-bold text-foreground/80">{project.customerName}</CardDescription>
                                </CardHeader>
                                <CardContent className="py-2 space-y-3 flex-1">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CalendarIcon className="h-3 w-3" />
                                        <span>{format(parseISO(project.startDate), 'dd/MM/yy')} al {format(parseISO(project.endDate), 'dd/MM/yy')}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                            <Users className="h-3 w-3" /> 
                                            {users.find(u => u.id === project.coordinatorId)?.name.split(' ')[0] || 'Técnico'}
                                        </div>
                                        {project.subcontractorId && (
                                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                                <Truck className="h-3 w-3" /> 
                                                {providers.find(p => p.id === project.subcontractorId)?.name || 'Externo'}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-2 border-t text-[10px] flex justify-between items-center bg-muted/5">
                                    <Badge className={cn("font-black uppercase tracking-wider", priorityConfig[project.priority].color)}>
                                        Prioridad {priorityConfig[project.priority].label}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                </CardFooter>
                            </Card>
                        </Link>
                    )
                })}
                {projects.length === 0 && (
                    <div className="col-span-full py-32 text-center border-2 border-dashed rounded-xl bg-muted/20">
                        <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-bold text-muted-foreground">Sin Proyectos Activos</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Comienza registrando un nuevo proyecto TI llave en mano para dar seguimiento a tus ejecuciones.</p>
                    </div>
                )}
            </div>
        </main>
    );
}