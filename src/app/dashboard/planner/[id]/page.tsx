/**
 * @fileoverview Detailed project view for advancement tracking and documentation.
 * Improved with better status handling and total calculations.
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
import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, ProjectStatus, ProjectPriority } from '@/modules/core/types';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Send, Paperclip, Plus, Trash2, FileDown, ArrowLeft, History, Truck, UserCircle, Package, FileText, Info, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = Number(params.id);
    const { user, companyData } = useAuth();
    const { toast } = useToast();

    const [project, setProject] = useState<TIProject | null>(null);
    const [advances, setAdvances] = useState<ProjectAdvance[]>([]);
    const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [newAdvance, setNewAdvance] = useState("");
    const [newItem, setNewItem] = useState({ description: '', quantity: 1, unitPrice: 0, type: 'material' as 'material' | 'service' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadProjectData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [p, adv, att, its] = await Promise.all([
                getProjectById(projectId),
                getProjectAdvances(projectId),
                getProjectAttachments(projectId),
                getProjectItems(projectId)
            ]);
            setProject(p);
            setAdvances(adv);
            setAttachments(att);
            setItems(its);
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
            // Log status change in history
            await addProjectAdvance({ 
                projectId, 
                content: `CAMBIO DE ESTADO: El proyecto ha pasado a fase de "${newStatus.toUpperCase()}"`, 
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
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-24" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
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

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-muted/20 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="shadow-sm">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Listado
                </Button>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Prioridad Proyecto</Label>
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
                        <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Estado de Avance</Label>
                        <Select value={project.status} onValueChange={(v: ProjectStatus) => handleStatusChange(v)}>
                            <SelectTrigger className="w-[160px] h-8 text-xs font-bold bg-primary text-primary-foreground"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="planning">Fase: Planeación</SelectItem>
                                <SelectItem value="execution">Fase: Ejecución</SelectItem>
                                <SelectItem value="testing">Fase: Pruebas</SelectItem>
                                <SelectItem value="completed">Proyecto Terminado</SelectItem>
                                <SelectItem value="canceled" className="text-destructive">Anular Proyecto</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="default" size="sm" onClick={handleGenerateDeliveryPDF} className="h-8 shadow-md">
                        <FileDown className="mr-2 h-4 w-4" /> Acta de Entrega
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
                                        <Badge className={cn("text-[10px] uppercase", project.priority === 'urgent' ? 'bg-red-600' : 'bg-primary')}>
                                            {project.priority}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-3xl font-black text-foreground">{project.name}</CardTitle>
                                    <CardDescription className="text-lg font-bold text-primary flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" /> {project.customerName}
                                    </CardDescription>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Inicio Proyecto</p>
                                    <p className="text-sm font-black">{format(parseISO(project.startDate), 'dd MMMM, yyyy', { locale: es })}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted/30 rounded-lg border text-sm italic leading-relaxed text-muted-foreground">
                                &quot;{project.description}&quot;
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-muted-foreground">Categoría</span><Badge variant="secondary" className="w-fit mt-1">{project.category}</Badge></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-muted-foreground">Estado Actual</span><Badge className={cn("w-fit mt-1", statusConfig[project.status].color)}>{statusConfig[project.status].label}</Badge></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-muted-foreground">Fecha Límite</span><span className="text-sm font-black text-destructive mt-1">{format(parseISO(project.endDate), 'dd/MM/yyyy')}</span></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-muted-foreground">Facturación</span><Badge variant={project.billingStatus === 'invoiced' ? 'default' : 'outline'} className="w-fit mt-1">{project.billingStatus === 'invoiced' ? 'Facturado' : 'Pendiente'}</Badge></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="advances" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                            <TabsTrigger value="advances" className="flex gap-2"><History className="h-4 w-4" /> Bitácora Técnica</TabsTrigger>
                            <TabsTrigger value="items" className="flex gap-2"><Package className="h-4 w-4" /> Materiales y Mano de Obra</TabsTrigger>
                            <TabsTrigger value="files" className="flex gap-2"><Paperclip className="h-4 w-4" /> Documentación</TabsTrigger>
                        </TabsList>

                        <TabsContent value="advances" className="space-y-4 py-4">
                            <Card>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex gap-2">
                                        <Textarea 
                                            value={newAdvance} 
                                            onChange={e => setNewAdvance(e.target.value)} 
                                            placeholder="Registra un hito, problema técnico o avance hoy..." 
                                            className="flex-1 min-h-[80px]" 
                                        />
                                        <Button onClick={handleAddAdvance} disabled={isSubmitting || !newAdvance.trim()} className="self-stretch h-auto px-6">
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                        {advances.length > 0 ? advances.map(adv => (
                                            <div key={adv.id} className="p-4 border-l-4 border-primary rounded-r-lg bg-card shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <UserCircle className="h-4 w-4 text-primary" />
                                                        <span className="text-xs font-black text-primary uppercase">{adv.userName}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                        {format(parseISO(adv.timestamp), 'dd/MM HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="text-sm leading-relaxed">{adv.content}</p>
                                            </div>
                                        )) : (
                                            <div className="text-center py-10 opacity-30">
                                                <History className="h-10 w-10 mx-auto mb-2" />
                                                <p className="text-sm">No hay registros en la bitácora aún.</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="items" className="space-y-4 py-4">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center gap-3">
                                <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-amber-800 font-medium">Los precios unitarios se ingresan <strong>SIN IVA</strong>. El sistema sumará el 13% automáticamente en los reportes finales.</p>
                            </div>
                            <Card>
                                <CardContent className="p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-muted/30 p-4 rounded-lg border">
                                        <div className="md:col-span-2 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Descripción del Item</Label>
                                            <Input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Ej: Cámara IP 4MP / Configuración de NVR..." />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Cantidad</Label>
                                            <Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Tipo</Label>
                                            <Select value={newItem.type} onValueChange={(v: 'material' | 'service') => setNewItem({...newItem, type: v})}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="material">Material / Equipo</SelectItem><SelectItem value="service">Mano de Obra / Servicio</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Precio Unit. (s/IVA)</Label>
                                            <Input type="number" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} />
                                        </div>
                                        <div className="md:col-start-4">
                                            <Button onClick={handleAddItem} className="w-full shadow-sm"><Plus className="h-4 w-4 mr-2" /> Añadir a la Lista</Button>
                                        </div>
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-10">T.</TableHead>
                                                    <TableHead>Descripción</TableHead>
                                                    <TableHead className="text-center">Cant.</TableHead>
                                                    <TableHead className="text-right">Unitario</TableHead>
                                                    <TableHead className="text-right">Subtotal</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.length > 0 ? items.map(i => (
                                                    <TableRow key={i.id} className="group">
                                                        <TableCell>{i.type === 'material' ? <Package className="h-4 w-4 text-muted-foreground" /> : <Wrench className="h-4 w-4 text-blue-500" />}</TableCell>
                                                        <TableCell className="font-bold text-sm">{i.description}</TableCell>
                                                        <TableCell className="text-center font-mono">{i.quantity}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs">¢{i.unitPrice.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-bold text-primary">¢{(i.quantity * i.unitPrice).toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" onClick={() => deleteProjectItem(i.id).then(loadProjectData)} className="opacity-0 group-hover:opacity-100 text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">No se han registrado materiales o servicios para este proyecto.</TableCell></TableRow>
                                                )}
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
                                        <Button variant="outline" asChild className="cursor-pointer shadow-sm">
                                            <label>
                                                <Plus className="mr-2 h-4 w-4" /> Subir Evidencia
                                                <input type="file" className="hidden" onChange={handleFileUpload} />
                                            </label>
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {attachments.map(att => (
                                            <div key={att.id} className="group relative border rounded-xl overflow-hidden bg-card aspect-square flex flex-col items-center justify-center p-3 text-center hover:border-primary transition-colors">
                                                {att.fileType.startsWith('image/') ? (
                                                    <div className="absolute inset-0 w-full h-full opacity-30 group-hover:opacity-10 transition-opacity">
                                                        <Image src={att.data} alt={att.name} fill className="object-cover" />
                                                    </div>
                                                ) : <FileText className="h-16 w-16 text-muted-foreground/20 mb-2" />}
                                                <span className="text-[10px] font-black truncate w-full relative z-10 uppercase px-1">{att.name}</span>
                                                <span className="text-[8px] text-muted-foreground relative z-10 font-bold">Por: {att.uploadedBy}</span>
                                                <a href={att.data} download={att.fileName} className="mt-3 relative z-10">
                                                    <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold px-4">DESCARGAR</Button>
                                                </a>
                                            </div>
                                        ))}
                                        {attachments.length === 0 && (
                                            <div className="col-span-full py-16 text-center border-2 border-dashed rounded-xl bg-muted/10 opacity-20">
                                                <FileText className="h-12 w-12 mx-auto" />
                                                <p className="text-xs font-bold mt-2">SIN ARCHIVOS ADJUNTOS</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="space-y-6">
                    <Card className="shadow-md border-none overflow-hidden">
                        <CardHeader className="bg-primary/10 pb-4"><CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2"><UserCircle className="h-4 w-4"/> Equipo Responsable</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><UserCircle className="h-6 w-6" /></div>
                                <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Coordinador Principal</p><p className="text-sm font-black">{project.coordinatorId ? (useAuth().users.find(u => u.id === project.coordinatorId)?.name || 'Técnico Asignado') : 'No asignado'}</p></div>
                            </div>
                            {project.subcontractorId && (
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 border-amber-100">
                                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200"><Truck className="h-6 w-6" /></div>
                                    <div><p className="text-[10px] font-bold uppercase text-amber-600">Subcontratista Externo</p><p className="text-sm font-black">Proveedor Externo</p></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground shadow-xl border-none relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <DollarSignIcon className="h-24 w-24" />
                        </div>
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase opacity-80 tracking-widest">Inversión Proyectada</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-4xl font-black">¢{projectTotals.total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</p>
                            <div className="mt-4 pt-4 border-t border-white/20 space-y-1 text-[10px] font-bold uppercase opacity-80">
                                <div className="flex justify-between"><span>Subtotal s/IVA:</span><span>¢{projectTotals.subtotal.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span>Impuesto (13%):</span><span>¢{projectTotals.tax.toLocaleString()}</span></div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    {project.status === 'completed' && (
                        <Card className="bg-green-600 text-white border-none shadow-lg">
                            <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                                <CheckCircle2 className="h-12 w-12" />
                                <h3 className="text-xl font-black uppercase">Proyecto Finalizado</h3>
                                <p className="text-xs opacity-90 font-medium">Este proyecto ha sido entregado satisfactoriamente al cliente.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </main>
    );
}

function Wrench({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    );
}

function DollarSignIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    );
}
