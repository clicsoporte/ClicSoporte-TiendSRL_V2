/**
 * @fileoverview Detailed project view for advancement tracking and documentation.
 * Improved with Profitability Shield to prevent financial losses.
 */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Loader2, Send, Paperclip, Plus, Trash2, FileDown, ArrowLeft, History, Truck, UserCircle, Package, Briefcase, FileText, AlertTriangle, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { generateDocument } from '@/modules/core/lib/pdf-generator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RowInput } from 'jspdf-autotable';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

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
    const { hasPermission } = useAuthorization();
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    const [project, setProject] = useState<TIProject | null>(null);
    const [advances, setAdvances] = useState<ProjectAdvance[]>([]);
    const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
    const [items, setItems] = useState<ProjectItem[]>([]);
    const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [newAdvance, setNewAdvance] = useState("");
    const [newItem, setNewItem] = useState<{ description: string; quantity: number; unitPrice: number; type: 'material' | 'service' }>({ description: '', quantity: 1, unitPrice: 0, type: 'material' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canViewFinancials = hasPermission('view:provider:costs');

    const loadProjectData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
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
        } catch (error) {
            console.error("Failed to load project data:", error);
            toast({ title: "Error de carga", description: "No se pudo obtener la información del proyecto.", variant: "destructive" });
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [projectId, toast]);

    useEffect(() => {
        setTitle("Detalles del Proyecto");
        loadProjectData();
    }, [loadProjectData, setTitle]);

    // Financial Analysis Logic
    const financials = useMemo(() => {
        if (!project) return null;
        
        const totalMaterials = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
        const internalLaborCost = (advances.length * 0.5) * (companyData?.internalHourCost || 5000); // 30 min per advance estimate
        
        // Sum subcontractor estimated buy prices from provider data
        let subcontractorCosts = 0;
        const assignedSubcontractors = providers.filter(p => (project.subcontractorIds || []).includes(p.id));
        assignedSubcontractors.forEach(sub => {
            const onsiteRate = sub.services?.find(s => s.serviceId.includes('sitio'))?.buyPriceOnSite || 0;
            subcontractorCosts += onsiteRate;
        });

        const totalCost = totalMaterials + internalLaborCost + subcontractorCosts;
        const budget = project.estimatedBudget || 0;
        const margin = budget - totalCost;
        const marginPercentage = budget > 0 ? (margin / budget) * 100 : 0;
        const burnRate = budget > 0 ? (totalCost / budget) * 100 : 0;

        return { totalMaterials, internalLaborCost, subcontractorCosts, totalCost, budget, margin, marginPercentage, burnRate };
    }, [project, items, advances, companyData, providers]);

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
        
        // Loss prevention check
        if (financials && financials.burnRate >= 100) {
            toast({ title: "Presupuesto Agotado", description: "El proyecto ha superado el 100% de los costos. Requiere aprobación gerencial para más materiales.", variant: "destructive" });
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
            await loadProjectData(true); 
            toast({ title: "Estado Actualizado" });
        } catch {
            toast({ title: "Error", description: "No se pudo actualizar el estado del proyecto.", variant: "destructive" });
        }
    };

    const handleGenerateDeliveryPDF = async () => {
        if (!project || !companyData) return;
        
        const tableRows: RowInput[] = items.map(item => [
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
                { title: "Alcance Ejecutado", content: project.description }
            ],
            table: {
                columns: ["Tipo", "Descripción", "Cant.", "Precio Unit.", "Subtotal"],
                rows: tableRows,
                columnStyles: { 0: { cellWidth: 30 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
            },
            notes: "Al firmar este documento, el cliente manifiesta su entera satisfacción con la instalación y configuración de los equipos detallados.",
            totals: [
                { label: "Monto Total Invertido:", value: `¢${items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toLocaleString('es-CR')}` }
            ]
        });

        doc.save(`acta_entrega_${project.consecutive}.pdf`);
        toast({ title: "Acta de Entrega Generada" });
    };

    if (isLoading) return <div className="p-8"><Skeleton className="h-[600px] w-full" /></div>;
    if (!project || !financials) return <div>No se encontró el proyecto.</div>;

    const assignedCoordinator = users.find(u => u.id === project.coordinatorId);
    const assignedSubcontractors = providers.filter(p => (project.subcontractorIds || []).includes(p.id));

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-muted/20 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="shadow-sm">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
                <div className="flex flex-wrap items-center gap-4">
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

            {/* --- Profitability Shield Alerts (Only for Managers) --- */}
            {canViewFinancials && financials.burnRate > 80 && (
                <Alert variant={financials.burnRate >= 100 ? "destructive" : "default"} className={cn("border-2 shadow-md", financials.burnRate < 100 && "bg-amber-50 border-amber-200")}>
                    <AlertTriangle className={cn("h-5 w-5", financials.burnRate >= 100 ? "text-white" : "text-amber-600")} />
                    <AlertTitle className="font-black uppercase tracking-wider">
                        {financials.burnRate >= 100 ? "¡Pérdida Crítica Detectada!" : "Alerta de Rentabilidad (Umbral 80%)"}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                        {financials.burnRate >= 100 
                            ? `Los costos reales (¢${financials.totalCost.toLocaleString()}) han superado el presupuesto de venta (¢${financials.budget.toLocaleString()}). Cada gasto adicional es pérdida directa.`
                            : `Se ha consumido el ${financials.burnRate.toFixed(1)}% del presupuesto. Revise el inventario y horas pendientes.`}
                    </AlertDescription>
                </Alert>
            )}

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
                                {canViewFinancials && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Presupuesto Venta</p>
                                        <p className="text-xl font-black text-primary">¢{financials.budget.toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="p-4 bg-muted/30 rounded-lg border text-sm text-muted-foreground leading-relaxed">
                                {project.description}
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
                                                    <span className="text-[10px] font-bold text-muted-foreground">{format(parseISO(adv.timestamp), 'dd/MM HH:mm')}</span>
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
                                            <Label className="text-[10px] font-bold uppercase">Descripción de Material/Servicio</Label>
                                            <Input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Item..." />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Cant.</Label>
                                            <Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">{canViewFinancials ? 'Costo Compra' : 'Unidad'}</Label>
                                            <Input type="number" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} disabled={!canViewFinancials} />
                                        </div>
                                        <Button onClick={handleAddItem} className="w-full h-10"><Plus className="h-4 w-4 mr-2" /> Agregar</Button>
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead>Descripción</TableHead>
                                                    <TableHead className="text-center">Cant.</TableHead>
                                                    {canViewFinancials && <TableHead className="text-right">Costo Unit.</TableHead>}
                                                    {canViewFinancials && <TableHead className="text-right">Subtotal</TableHead>}
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map(i => (
                                                    <TableRow key={i.id} className="group">
                                                        <TableCell className="font-bold text-sm">{i.description}</TableCell>
                                                        <TableCell className="text-center">{i.quantity}</TableCell>
                                                        {canViewFinancials && <TableCell className="text-right">¢{i.unitPrice.toLocaleString()}</TableCell>}
                                                        {canViewFinancials && <TableCell className="text-right font-bold">¢{(i.quantity * i.unitPrice).toLocaleString()}</TableCell>}
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" onClick={() => deleteProjectItem(i.id).then(() => loadProjectData(true))} className="text-destructive">
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

                {/* --- Financial Sidebar (Restricted to Managers) --- */}
                <div className="space-y-6">
                    {canViewFinancials && (
                        <Card className={cn("shadow-md border-none overflow-hidden", financials.burnRate >= 100 ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black uppercase opacity-80 tracking-widest flex items-center gap-2">
                                    <Wallet className="h-3 w-3"/> Salud Financiera del Proyecto
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-4xl font-black">¢{financials.margin.toLocaleString()}</p>
                                    <p className="text-[10px] uppercase font-bold opacity-80">Margen de Contribución Real</p>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                        <span>Consumo de Presupuesto</span>
                                        <span>{financials.burnRate.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                                        <div 
                                            className={cn("h-full transition-all duration-500", financials.burnRate > 90 ? "bg-red-400" : "bg-white")} 
                                            style={{ width: `${Math.min(financials.burnRate, 100)}%` }} 
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-white/20" />
                                
                                <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase opacity-90">
                                    <div><p className="opacity-60">Materiales</p><p>¢{financials.totalMaterials.toLocaleString()}</p></div>
                                    <div><p className="opacity-60">Subcontratos</p><p>¢{financials.subcontractorCosts.toLocaleString()}</p></div>
                                    <div><p className="opacity-60">Mano de Obra</p><p>¢{financials.internalLaborCost.toLocaleString()}</p></div>
                                    <div><p className="opacity-60">Gasto Total</p><p>¢{financials.totalCost.toLocaleString()}</p></div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-black/10 py-3">
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-tighter">
                                    {financials.margin > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                    {financials.marginPercentage.toFixed(1)}% Rentabilidad Neta
                                </div>
                            </CardFooter>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <UserCircle className="h-4 w-4"/> Equipo Responsable
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><UserCircle className="h-6 w-6" /></div>
                                <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Coordinador</p><p className="text-sm font-black">{assignedCoordinator?.name || 'Técnico Asignado'}</p></div>
                            </div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Subcontratistas</p>
                            {assignedSubcontractors.map(sub => (
                                <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50">
                                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><Truck className="h-4 w-4" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black truncate">{sub.name}</p>
                                        <p className="text-[9px] text-amber-600 font-bold uppercase">{sub.specialty}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
