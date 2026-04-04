/**
 * @fileoverview Detailed project view for advancement tracking and documentation.
 * Improved with support for multiple subcontractors and contact info popovers.
 */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    getProjectById, getProjectAdvances, addProjectAdvance, 
    getProjectAttachments, addProjectAttachment, getProjectItems, 
    saveProjectItem, deleteProjectItem, updateProject 
} from '@/modules/planner/lib/actions';
import { getThirdPartyProviders } from '@/modules/tickets/lib/actions';
import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, ProjectStatus, ProjectPriority, ThirdPartyProvider } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Send, Paperclip, Plus, Trash2, FileDown, ArrowLeft, History, Truck, UserCircle, Package, FileText, Info, CheckCircle2, Monitor, Lock, Radio, Briefcase, Zap, Network, Edit, Phone, Mail } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const statusConfig: { [key in ProjectStatus]: { label: string, color: string } } = {
    planning: { label: 'Planeación', color: 'bg-yellow-500' },
    execution: { label: 'Ejecución', color: 'bg-blue-500' },
    testing: { label: 'Pruebas', color: 'bg-purple-500' },
    completed: { label: 'Finalizado', color: 'bg-green-600' },
    canceled: { label: 'Cancelado', color: 'bg-red-600' },
};

const priorityConfig: { [key in ProjectPriority]: { label: string, color: string } } = {
    low: { label: "Baja", color: "bg-slate-100 text-slate-600 border-slate-200" },
    medium: { label: "Media", color: "bg-blue-100 text-blue-700 border-blue-200" },
    high: { label: "Alta", color: "bg-primary text-white border-primary" },
    urgent: { label: "Urgente", color: "bg-red-600 text-white border-red-700" }
};

export default function ProjectDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = Number(params.id);
    const { user, companyData, users } = useAuth();
    const { toast } = useToast();

    const [project, setProject] = useState<TIProject | null>(null);
    const [advances, setAdvances] = useState<ProjectAdvance[]>([]);
    const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [newAdvance, setNewAdvance] = useState("");
    const [newItem, setNewItem] = useState({ description: '', quantity: 1, unitPrice: 0, type: 'material' as 'material' | 'service' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Team State
    const [isEditTeamOpen, setEditTeamOpen] = useState(false);
    const [teamForm, setTeamForm] = useState({ coordinatorId: 0, subcontractorIds: [] as number[] });

    const loadProjectData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [p, adv, att, its, provs] = await Promise.all([
                getProjectById(projectId),
                getProjectAdvances(projectId),
                getProjectAttachments(projectId),
                getProjectItems(projectId),
                getThirdPartyProviders()
            ]);
            setProject(p);
            setAdvances(adv);
            setAttachments(att);
            setItems(its);
            setProviders(provs);
            if (p) setTeamForm({ coordinatorId: p.coordinatorId, subcontractorIds: p.subcontractorIds || [] });
        } catch (error) {
            console.error("Failed to load project data:", error);
            toast({ title: "Error de carga", description: "No se pudo obtener la información del proyecto.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [projectId, toast]);

    useEffect(() => {
        loadProjectData();
    }, [loadProjectData]);

    const handleAddAdvance = async () => {
        if (!newAdvance.trim() || !user) return;
        setIsSubmitting(true);
        try {
            const added = await addProjectAdvance({ projectId, content: newAdvance, userId: user.id, userName: user.name });
            setAdvances(prev => [...prev, added]);
            setNewAdvance("");
            toast({ title: "Avance Registrado" });
        } catch {
            toast({ title: "Error", description: "No se pudo guardar el avance.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result as string;
            try {
                const added = await addProjectAttachment({
                    projectId,
                    name: file.name,
                    fileName: file.name,
                    fileType: file.type,
                    data: base64,
                    uploadedBy: user.name
                });
                setAttachments(prev => [added, ...prev]);
                toast({ title: "Archivo Adjuntado", description: file.name });
            } catch {
                toast({ title: "Error al subir", variant: "destructive" });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAddItem = async () => {
        if (!newItem.description.trim()) {
            toast({ title: "Descripción requerida", variant: "destructive" });
            return;
        }
        try {
            const saved = await saveProjectItem({ ...newItem, projectId });
            setItems(prev => [...prev, saved]);
            setNewItem({ description: '', quantity: 1, unitPrice: 0, type: 'material' });
            toast({ title: "Item Agregado" });
        } catch {
            toast({ title: "Error", description: "No se pudo guardar el material o servicio.", variant: "destructive" });
        }
    };

    const handleStatusChange = async (newStatus: ProjectStatus) => {
        if (!project || !user) return;
        const updated = { ...project, status: newStatus };
        try {
            await updateProject(updated);
            setProject(updated);
            await addProjectAdvance({ 
                projectId, 
                content: `CAMBIO DE ESTADO: El proyecto ha pasado a fase de "${statusConfig[newStatus].label.toUpperCase()}"`, 
                userId: user.id, 
                userName: user.name 
            });
            await loadProjectData();
            toast({ title: "Estado Actualizado" });
        } catch {
            toast({ title: "Error", description: "No se pudo actualizar el estado del proyecto.", variant: "destructive" });
        }
    };

    const handlePriorityChange = async (newPriority: ProjectPriority) => {
        if (!project) return;
        const updated = { ...project, priority: newPriority };
        try {
            await updateProject(updated);
            setProject(updated);
            toast({ title: "Prioridad Actualizada" });
        } catch {
            toast({ title: "Error", description: "No se pudo actualizar la prioridad.", variant: "destructive" });
        }
    };

    const toggleSubcontractor = (id: number) => {
        setTeamForm(prev => {
            const ids = prev.subcontractorIds.includes(id) 
                ? prev.subcontractorIds.filter(i => i !== id)
                : [...prev.subcontractorIds, id];
            return { ...prev, subcontractorIds: ids };
        });
    };

    const handleUpdateTeam = async () => {
        if (!project || !user) return;
        setIsSubmitting(true);
        try {
            const updated = { 
                ...project, 
                coordinatorId: Number(teamForm.coordinatorId), 
                subcontractorIds: teamForm.subcontractorIds.map(id => Number(id))
            };
            await updateProject(updated);
            
            const oldCoordinator = users.find(u => u.id === project.coordinatorId)?.name || 'N/A';
            const newCoordinator = users.find(u => u.id === teamForm.coordinatorId)?.name || 'N/A';
            
            const oldSubs = providers.filter(p => (project.subcontractorIds || []).includes(p.id)).map(p => p.name).join(', ') || 'Ninguno';
            const newSubs = providers.filter(p => teamForm.subcontractorIds.includes(p.id)).map(p => p.name).join(', ') || 'Ninguno';

            let logMsg = '';
            if (oldCoordinator !== newCoordinator) logMsg += `Coordinador (${oldCoordinator} -> ${newCoordinator}). `;
            if (oldSubs !== newSubs) logMsg += `Subcontratistas (${oldSubs} -> ${newSubs}).`;

            if (logMsg) {
                await addProjectAdvance({ 
                    projectId, 
                    content: `ACTUALIZACIÓN DE EQUIPO: ${logMsg}`, 
                    userId: user.id, 
                    userName: user.name 
                });
            }

            await loadProjectData();
            setEditTeamOpen(false);
            toast({ title: "Equipo Actualizado" });
        } catch {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const projectTotals = useMemo(() => {
        const subtotal = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
        const tax = subtotal * 0.13;
        const total = subtotal + tax;
        return { subtotal, tax, total };
    }, [items]);

    const handleGenerateDeliveryPDF = async () => {
        if (!project || !companyData) return;
        
        const { subtotal, tax, total } = projectTotals;

        const tableRows = items.map(item => [
            item.type === 'material' ? '[M]' : '[S]',
            item.description,
            item.quantity.toLocaleString('es-CR'),
            `¢${item.unitPrice.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`,
            `¢${(item.quantity * item.unitPrice).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`
        ]);

        const doc = generateDocument({
            docTitle: "ACTA DE ENTREGA TÉCNICA",
            docId: project.consecutive,
            companyData,
            meta: [
                { label: 'Fecha Entrega', value: format(new Date(), 'dd/MM/yyyy') },
                { label: 'Cliente', value: project.customerName }
            ],
            blocks: [
                { title: "Proyecto", content: project.name },
                { title: "Alcance Ejecutado", content: project.description },
                { title: "Coordinador", content: user?.name || 'Gestión Interna' }
            ],
            table: {
                columns: ["Tipo", "Descripción", "Cant.", "Precio Unit.", "Subtotal"],
                rows: tableRows as any[],
                columnStyles: { 0: { cellWidth: 30 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
            },
            notes: "Al firmar este documento, el cliente manifiesta su entera satisfacción con la instalación y configuración de los equipos detallados. Se entrega manual de usuario y capacitación básica.",
            totals: [
                { label: "Subtotal:", value: `¢${subtotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
                { label: "I.V.A (13%):", value: `¢${tax.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
                { label: "Monto Total:", value: `¢${total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` }
            ]
        });

        doc.save(`acta_entrega_${project.consecutive}.pdf`);
        toast({ title: "Acta de Entrega Generada", description: "El archivo PDF ha sido descargado." });
    };

    if (isLoading) {
        return (
            <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-muted/10 min-h-screen">
                <Skeleton className="h-10 w-24" />
                <Card><CardContent className="p-10"><Skeleton className="h-40 w-full" /></CardContent></Card>
                <div className="grid grid-cols-3 gap-6">
                    <Skeleton className="h-96 col-span-2" />
                    <Skeleton className="h-96 col-span-1" />
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <Info className="h-16 w-16 text-muted-foreground opacity-20" />
                <h2 className="text-xl font-bold">Proyecto no encontrado</h2>
                <Button onClick={() => router.push('/dashboard/planner')}>Ir al listado</Button>
            </div>
        );
    }

    const assignedCoordinator = users.find(u => u.id === project.coordinatorId);
    const assignedSubcontractors = providers.filter(p => (project.subcontractorIds || []).includes(p.id));
    const supportUsers = users.filter(u => u.role === 'admin' || u.role === 'support-agent');

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-muted/20 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="shadow-sm">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1">Prioridad</Label>
                        <Select value={project.priority} onValueChange={(v: ProjectPriority) => handlePriorityChange(v)}>
                            <SelectTrigger className="w-[120px] h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Baja</SelectItem>
                                <SelectItem value="medium">Media</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="urgent">Urgente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1">Estado Fase</Label>
                        <Select value={project.status} onValueChange={(v: ProjectStatus) => handleStatusChange(v)}>
                            <SelectTrigger className="w-[160px] h-8 text-xs font-bold bg-primary text-primary-foreground"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="planning">Planeación</SelectItem>
                                <SelectItem value="execution">Ejecución</SelectItem>
                                <SelectItem value="testing">Pruebas</SelectItem>
                                <SelectItem value="completed">Finalizado</SelectItem>
                                <SelectItem value="canceled">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="default" size="sm" onClick={handleGenerateDeliveryPDF} className="h-8">
                        <FileDown className="mr-2 h-4 w-4" /> Acta Entrega
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-md border-none overflow-hidden">
                        <div className="h-1.5 w-full bg-primary" />
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="font-mono text-xs">{project.consecutive}</Badge>
                                        <Badge className={cn("text-[10px] uppercase", priorityConfig[project.priority].color)}>
                                            {priorityConfig[project.priority].label}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-3xl font-black text-foreground">{project.name}</CardTitle>
                                    <CardDescription className="text-lg font-bold text-primary flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" /> {project.customerName}
                                    </CardDescription>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Inicio</p>
                                    <p className="text-sm font-black">{format(parseISO(project.startDate), 'dd MMM, yyyy', { locale: es })}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted/30 rounded-lg border text-sm italic leading-relaxed text-muted-foreground">
                                "{project.description}"
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-muted-foreground">Estado</span><Badge className={cn("w-fit mt-1 text-white", statusConfig[project.status].color)}>{statusConfig[project.status].label}</Badge></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-muted-foreground">Entrega Estimada</span><span className="text-sm font-black text-destructive mt-1">{format(parseISO(project.endDate), 'dd/MM/yyyy')}</span></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="advances" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                            <TabsTrigger value="advances" className="flex gap-2"><History className="h-4 w-4" /> Bitácora</TabsTrigger>
                            <TabsTrigger value="items" className="flex gap-2"><Package className="h-4 w-4" /> Materiales</TabsTrigger>
                            <TabsTrigger value="files" className="flex gap-2"><Paperclip className="h-4 w-4" /> Archivos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="advances" className="space-y-4 py-4">
                            <Card>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex gap-2">
                                        <Textarea 
                                            value={newAdvance} 
                                            onChange={e => setNewAdvance(e.target.value)} 
                                            placeholder="Registra un avance hoy..." 
                                            className="flex-1 min-h-[80px]" 
                                        />
                                        <Button onClick={handleAddAdvance} disabled={isSubmitting || !newAdvance.trim()} className="self-stretch h-auto px-6">
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                        {advances.map(adv => (
                                            <div key={adv.id} className="p-4 border-l-4 border-primary rounded-r-lg bg-card shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <UserCircle className="h-4 w-4 text-primary" />
                                                        <span className="text-xs font-black text-primary uppercase">{adv.userName}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                        {format(parseISO(adv.timestamp), 'dd/MM HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="text-sm">{adv.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="items" className="space-y-4 py-4">
                            <Card>
                                <CardContent className="p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-muted/30 p-4 rounded-lg border">
                                        <div className="md:col-span-2 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Descripción</Label>
                                            <Input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Item o Servicio..." />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Cant.</Label>
                                            <Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Precio (s/IVA)</Label>
                                            <Input type="number" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} />
                                        </div>
                                        <Button onClick={handleAddItem} className="w-full"><Plus className="h-4 w-4 mr-2" /> Agregar</Button>
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead>Descripción</TableHead>
                                                    <TableHead className="text-center">Cant.</TableHead>
                                                    <TableHead className="text-right">Unitario</TableHead>
                                                    <TableHead className="text-right">Subtotal</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map(i => (
                                                    <TableRow key={i.id} className="group">
                                                        <TableCell className="font-bold text-sm">{i.description}</TableCell>
                                                        <TableCell className="text-center">{i.quantity}</TableCell>
                                                        <TableCell className="text-right">¢{i.unitPrice.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-bold">¢{(i.quantity * i.unitPrice).toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" onClick={() => deleteProjectItem(i.id).then(loadProjectData)} className="text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="files" className="space-y-4 py-4">
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold flex items-center gap-2"><Paperclip className="h-5 w-5 text-primary"/> Archivos Adjuntos</h3>
                                        <Button variant="outline" asChild>
                                            <label className="cursor-pointer">
                                                <Plus className="mr-2 h-4 w-4" /> Subir
                                                <input type="file" className="hidden" onChange={handleFileUpload} />
                                            </label>
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {attachments.map(att => (
                                            <div key={att.id} className="group relative border rounded-xl overflow-hidden bg-card aspect-square flex flex-col items-center justify-center p-3 text-center">
                                                {att.fileType.startsWith('image/') ? (
                                                    <div className="absolute inset-0 w-full h-full opacity-30">
                                                        <Image src={att.data} alt={att.name} fill className="object-cover" />
                                                    </div>
                                                ) : <FileText className="h-16 w-16 text-muted-foreground/20 mb-2" />}
                                                <span className="text-[10px] font-black truncate w-full relative z-10 uppercase">{att.name}</span>
                                                <a href={att.data} download={att.fileName} className="mt-3 relative z-10">
                                                    <Button size="sm" variant="secondary" className="h-7 text-[10px]">BAJAR</Button>
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="space-y-6">
                    <Card className="shadow-md border-none overflow-hidden">
                        <CardHeader className="bg-primary/10 pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <UserCircle className="h-4 w-4"/> Equipo Responsable
                            </CardTitle>
                            <Dialog open={isEditTeamOpen} onOpenChange={setEditTeamOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-primary"><Edit className="h-3 w-3"/></Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Editar Equipo de Trabajo</DialogTitle>
                                        <DialogDescription>Modifica los responsables técnicos y subcontratistas.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6 py-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Técnico Coordinador Interno</Label>
                                            <Select value={String(teamForm.coordinatorId)} onValueChange={v => setTeamForm({...teamForm, coordinatorId: Number(v)})}>
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    {supportUsers.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Subcontratistas Externos</Label>
                                            <ScrollArea className="h-48 border rounded-md p-2">
                                                <div className="space-y-2">
                                                    {providers.map(p => (
                                                        <div key={p.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleSubcontractor(p.id)}>
                                                            <Checkbox 
                                                                checked={teamForm.subcontractorIds.includes(p.id)} 
                                                                onCheckedChange={() => toggleSubcontractor(p.id)}
                                                            />
                                                            <div className="flex-1">
                                                                <p className="text-sm font-bold leading-none">{p.name}</p>
                                                                <p className="text-[10px] text-muted-foreground mt-1">{p.specialty}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                        <Button onClick={handleUpdateTeam} disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4"/>}
                                            Guardar Cambios
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><UserCircle className="h-6 w-6" /></div>
                                <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Coordinador</p><p className="text-sm font-black">{assignedCoordinator?.name || 'Técnico Asignado'}</p></div>
                            </div>
                            
                            <Separator className="my-2" />
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Subcontratistas</p>
                            
                            {assignedSubcontractors.length > 0 ? (
                                <div className="space-y-2">
                                    {assignedSubcontractors.map(sub => (
                                        <Popover key={sub.id}>
                                            <PopoverTrigger asChild>
                                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors">
                                                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><Truck className="h-4 w-4" /></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black truncate">{sub.name}</p>
                                                        <p className="text-[9px] text-amber-600 font-bold uppercase">{sub.specialty}</p>
                                                    </div>
                                                    <Info className="h-4 w-4 text-amber-400" />
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64" align="end">
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-sm border-b pb-1">Datos de Contacto</h4>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <Phone className="h-3 w-3 text-primary"/>
                                                            <span>{sub.phone || 'No registrado'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <Mail className="h-3 w-3 text-primary"/>
                                                            <span className="truncate">{sub.email || 'No registrado'}</span>
                                                        </div>
                                                        <div className="bg-muted p-2 rounded text-[10px] text-muted-foreground mt-2 italic">
                                                            "{sub.notes || 'Servicios TI'}"
                                                        </div>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 opacity-50 italic">
                                    <Truck className="h-6 w-6 text-muted-foreground" />
                                    <p className="text-xs">Sin subcontratos asignados</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground shadow-xl border-none">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase opacity-80 tracking-widest">Inversión Proyectada</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-4xl font-black">¢{projectTotals.total.toLocaleString('es-CR')}</p>
                            <div className="mt-4 pt-4 border-t border-white/20 space-y-1 text-[10px] font-bold uppercase opacity-80">
                                <div className="flex justify-between"><span>Subtotal:</span><span>¢{projectTotals.subtotal.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span>I.V.A (13%):</span><span>¢{projectTotals.tax.toLocaleString()}</span></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
