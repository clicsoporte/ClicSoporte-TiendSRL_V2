/**
 * @fileoverview Detailed project view for advancement tracking and documentation.
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    getProjectById, getProjectAdvances, addProjectAdvance, 
    getProjectAttachments, addProjectAttachment, getProjectItems, 
    saveProjectItem, deleteProjectItem, updateProject 
} from '@/modules/planner/lib/actions';
import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, ProjectStatus } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Send, Paperclip, Plus, Trash2, FileDown, ArrowLeft, CheckCircle2, History, Truck, UserCircle, Briefcase, Package } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { generateDocument } from '@/modules/core/lib/pdf-generator';

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
    
    // Form states
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
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProjectData();
    }, [loadProjectData]);

    const handleAddAdvance = async () => {
        if (!newAdvance.trim() || !user) return;
        setIsSubmitting(true);
        try {
            const added = await addProjectAdvance({ projectId, content: newAdvance, userId: user.id, userName: user.name });
            setAdvances([...advances, added]);
            setNewAdvance("");
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
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
                setAttachments([added, ...attachments]);
                toast({ title: "Archivo Adjuntado" });
            } catch (e) {
                toast({ title: "Error al subir", variant: "destructive" });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAddItem = async () => {
        if (!newItem.description) return;
        try {
            const saved = await saveProjectItem({ ...newItem, projectId });
            setItems([...items, saved]);
            setNewItem({ description: '', quantity: 1, unitPrice: 0, type: 'material' });
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    const handleStatusChange = async (newStatus: ProjectStatus) => {
        if (!project) return;
        const updated = { ...project, status: newStatus };
        try {
            await updateProject(updated);
            setProject(updated);
            toast({ title: `Proyecto movido a ${newStatus}` });
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    const handleGenerateDeliveryPDF = async () => {
        if (!project || !companyData) return;
        
        const materials = items.filter(i => i.type === 'material');
        const services = items.filter(i => i.type === 'service');
        const total = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

        const tableRows = items.map(item => [
            item.type === 'material' ? '[M]' : '[S]',
            item.description,
            item.quantity.toString(),
            `¢${item.unitPrice.toLocaleString('es-CR')}`,
            `¢${(item.quantity * item.unitPrice).toLocaleString('es-CR')}`
        ]);

        const doc = generateDocument({
            docTitle: "ACTA DE ENTREGA FINAL / PROFORMA",
            docId: project.consecutive,
            companyData,
            meta: [
                { label: 'Fecha Entrega', value: format(new Date(), 'dd/MM/yyyy') },
                { label: 'Cliente', value: project.customerName }
            ],
            blocks: [
                { title: "Detalles del Proyecto", content: project.name + "\n" + project.description },
                { title: "Resumen de Ejecución", content: `Inicio: ${project.startDate}\nFin: ${project.endDate}\nCoordinador: ${user?.name}` }
            ],
            table: {
                columns: ["Tipo", "Descripción del Ítem", "Cant.", "Precio Unit.", "Subtotal"],
                rows: tableRows,
                columnStyles: { 0: { cellWidth: 30 }, 4: { halign: 'right' } }
            },
            notes: "Este documento certifica la entrega satisfactoria de los activos y servicios detallados anteriormente.",
            totals: [
                { label: "Monto Total Proyecto:", value: `¢${total.toLocaleString('es-CR')}` }
            ]
        });

        doc.save(`entrega_${project.consecutive}.pdf`);
    };

    if (isLoading || !project) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-muted/20 min-h-screen">
            <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleGenerateDeliveryPDF}><FileDown className="mr-2 h-4 w-4" /> Generar Acta de Entrega</Button>
                    <Select value={project.status} onValueChange={(v) => handleStatusChange(v as ProjectStatus)}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="planning">Planeación</SelectItem>
                            <SelectItem value="execution">Ejecución</SelectItem>
                            <SelectItem value="testing">Pruebas</SelectItem>
                            <SelectItem value="completed">Finalizar</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between">
                                <CardTitle className="text-3xl font-bold">{project.name}</CardTitle>
                                <Badge variant="outline" className="font-mono">{project.consecutive}</Badge>
                            </div>
                            <CardDescription className="text-lg">{project.customerName}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">Prioridad</span><Badge className="w-fit">{project.priority}</Badge></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">Inicio</span><span className="text-sm font-medium">{format(parseISO(project.startDate), 'dd/MM/yyyy')}</span></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">Finalización Est.</span><span className="text-sm font-medium text-destructive">{format(parseISO(project.endDate), 'dd/MM/yyyy')}</span></div>
                                <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">Facturación</span><Badge variant={project.billingStatus === 'invoiced' ? 'default' : 'outline'}>{project.billingStatus === 'invoiced' ? 'Facturado' : 'Pendiente'}</Badge></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="advances" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="advances" className="flex gap-2"><History className="h-4 w-4" /> Bitácora</TabsTrigger>
                            <TabsTrigger value="items" className="flex gap-2"><Package className="h-4 w-4" /> Materiales y Servicios</TabsTrigger>
                            <TabsTrigger value="files" className="flex gap-2"><Paperclip className="h-4 w-4" /> Documentos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="advances" className="space-y-4 py-4">
                            <div className="flex gap-2">
                                <Textarea value={newAdvance} onChange={e => setNewAdvance(e.target.value)} placeholder="Escribe un avance o hito del proyecto..." className="flex-1" />
                                <Button onClick={handleAddAdvance} disabled={isSubmitting} className="self-end h-full"><Send className="h-4 w-4" /></Button>
                            </div>
                            <div className="space-y-4">
                                {advances.map(adv => (
                                    <div key={adv.id} className="p-4 border rounded-lg bg-card shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-primary uppercase">{adv.userName}</span>
                                            <span className="text-[10px] text-muted-foreground">{format(parseISO(adv.timestamp), 'dd/MM HH:mm')}</span>
                                        </div>
                                        <p className="text-sm">{adv.content}</p>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="items" className="space-y-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end bg-muted/30 p-4 rounded-lg border">
                                <div className="md:col-span-2 space-y-1"><Label>Descripción</Label><Input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Material o Servicio..." /></div>
                                <div className="space-y-1"><Label>Cant.</Label><Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} /></div>
                                <div className="space-y-1"><Label>Tipo</Label>
                                    <Select value={newItem.type} onValueChange={v => setNewItem({...newItem, type: v as any})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="material">Material</SelectItem><SelectItem value="service">Servicio/Mano Obra</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Precio Unit.</Label><Input type="number" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} /></div>
                                <Button onClick={handleAddItem} className="md:col-start-4"><Plus className="h-4 w-4 mr-2" /> Agregar</Button>
                            </div>
                            <Table>
                                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead><TableHead>Cant.</TableHead><TableHead>Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {items.map(i => (
                                        <TableRow key={i.id}>
                                            <TableCell>{i.type === 'material' ? <Package className="h-4 w-4 text-muted-foreground" /> : <Briefcase className="h-4 w-4 text-blue-500" />}</TableCell>
                                            <TableCell className="font-medium">{i.description}</TableCell>
                                            <TableCell>{i.quantity}</TableCell>
                                            <TableCell>¢{(i.quantity * i.unitPrice).toLocaleString()}</TableCell>
                                            <TableCell><Button variant="ghost" size="icon" onClick={() => deleteProjectItem(i.id).then(loadProjectData)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TabsContent>

                        <TabsContent value="files" className="space-y-4 py-4">
                            <div className="flex items-center gap-4">
                                <Button variant="outline" asChild><label className="cursor-pointer"><Plus className="mr-2 h-4 w-4" /> Adjuntar Foto o Documento<input type="file" className="hidden" onChange={handleFileUpload} /></label></Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {attachments.map(att => (
                                    <div key={att.id} className="group relative border rounded-lg overflow-hidden bg-card aspect-square flex flex-col items-center justify-center p-2 text-center">
                                        {att.fileType.startsWith('image/') ? (
                                            <img src={att.data} alt={att.name} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-10 transition-opacity" />
                                        ) : <FileText className="h-12 w-12 text-muted-foreground mb-2" />}
                                        <span className="text-[10px] font-bold truncate w-full">{att.name}</span>
                                        <span className="text-[8px] text-muted-foreground">Por: {att.uploadedBy}</span>
                                        <a href={att.data} download={att.fileName} className="mt-2"><Button size="sm" variant="secondary" className="h-6 text-[10px]">Descargar</Button></a>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Involucrados</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><UserCircle className="h-6 w-6" /></div>
                                <div><p className="text-xs text-muted-foreground">Coordinador Interno</p><p className="text-sm font-bold">{user?.name}</p></div>
                            </div>
                            {project.subcontractorId && (
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><Truck className="h-6 w-6" /></div>
                                    <div><p className="text-xs text-muted-foreground">Subcontratista Externo</p><p className="text-sm font-bold">Proveedor Asignado</p></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground">
                        <CardHeader><CardTitle className="text-sm font-bold uppercase opacity-80">Monto Facturable</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">¢{items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toLocaleString('es-CR')}</p>
                            <p className="text-xs opacity-70 mt-2">Basado en materiales y mano de obra registrados.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
