/**
 * @fileoverview Page for managing support ticket settings.
 * Now includes management for the Costa Rica Geographic Module.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useMemo, useState } from 'react';
import { useTicketSettings } from '@/modules/tickets/hooks/useTicketSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Map as MapIcon, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { TicketPriority } from '@/modules/core/types';

export default function TicketSettingsPage() {
    const { setTitle } = usePageTitle();
    const { companyData } = useAuth();
    const {
        state,
        actions,
        selectors,
        isAuthorized,
        isLoading
    } = useTicketSettings();

    // Geographic selection state
    const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
    const [selectedCantonId, setSelectedCantonId] = useState<number | null>(null);
    const [geoEditName, setGeoEditName] = useState("");
    const [isGeoEditOpen, setGeoEditOpen] = useState(false);
    const [geoEditType, setGeoEditType] = useState<'province' | 'canton' | 'district'>('province');
    const [geoEditTarget, setGeoEditTarget] = useState<any>(null);

    const supportUsers = useMemo(() => {
        if (!selectors.allUsers) return [];
        const supportRoleIds = (selectors.allRoles || [])
            .filter(r => r.permissions.includes('tickets:read:all'))
            .map(r => r.id);
        
        return selectors.allUsers.filter(u => u.role && supportRoleIds.includes(u.role));
    }, [selectors.allUsers, selectors.allRoles]);
    
    useEffect(() => {
        setTitle("Configuración de Tickets");
    }, [setTitle]);

    const openGeoEdit = (type: 'province' | 'canton' | 'district', target?: any) => {
        setGeoEditType(type);
        setGeoEditTarget(target || null);
        setGeoEditName(target?.name || "");
        setGeoEditOpen(true);
    };

    const handleGeoSave = async () => {
        if (!geoEditName.trim()) return;
        const action = geoEditTarget ? 'update' : 'add';
        const data = geoEditTarget ? { ...geoEditTarget, name: geoEditName } : { name: geoEditName };
        
        if (action === 'add') {
            if (geoEditType === 'canton') (data as any).provinceId = selectedProvinceId;
            if (geoEditType === 'district') (data as any).cantonId = selectedCantonId;
        }

        await actions.handleGeoAction(geoEditType, action, data);
        setGeoEditOpen(false);
    };

    if (!isAuthorized) {
        return null;
    }

    if (isLoading || !companyData) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
                 <Skeleton className="h-12 w-full"/>
                 <Skeleton className="h-[600px] w-full" />
            </main>
        )
    }

    const cantonsForProvince = state.cantons.filter(c => c.provinceId === selectedProvinceId);
    const districtsForCanton = state.districts.filter(d => d.cantonId === selectedCantonId);

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Accordion type="multiple" defaultValue={['help-topics']} className="w-full space-y-6">
                <Card>
                    <AccordionItem value="help-topics">
                        <AccordionTrigger className="p-6 text-lg font-semibold">
                            Gestión de Temas de Ayuda
                        </AccordionTrigger>
                        <AccordionContent className="p-6 pt-0">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-muted-foreground text-sm">
                                    Define los diferentes tipos de problemas para automatizar la asignación y priorización.
                                </p>
                                <Dialog open={state.isFormOpen} onOpenChange={(open) => { actions.setFormOpen(open); if (!open) actions.resetForm(); }}>
                                    <DialogTrigger asChild>
                                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Añadir Tema</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>{state.isEditing ? 'Editar' : 'Añadir'} Tema de Ayuda</DialogTitle>
                                            <DialogDescription>Configura el nombre del tema y sus valores por defecto.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Nombre del Tema</Label>
                                                <Input value={state.currentTopic.name} onChange={(e) => actions.setCurrentTopic({ ...state.currentTopic, name: e.target.value })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Prioridad por Defecto</Label>
                                                    <Select value={state.currentTopic.defaultPriority || 'medium'} onValueChange={(v) => actions.setCurrentTopic({ ...state.currentTopic, defaultPriority: v as TicketPriority })}>
                                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                                        <SelectContent>{Object.entries(selectors.priorityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Asignar a</Label>
                                                    <Select value={String(state.currentTopic.defaultAssigneeId || 'null')} onValueChange={(v) => actions.setCurrentTopic({ ...state.currentTopic, defaultAssigneeId: v === 'null' ? null : Number(v) })}>
                                                        <SelectTrigger><SelectValue placeholder="Sin asignar"/></SelectTrigger>
                                                        <SelectContent><SelectItem value="null">Sin asignar</SelectItem>{supportUsers.map(u => (<SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={actions.handleSaveTopic}>{state.isEditing ? 'Guardar Cambios' : 'Crear Tema'}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Prioridad</TableHead>
                                            <TableHead>Técnico</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {state.helpTopics.map(topic => (
                                            <TableRow key={topic.id}>
                                                <TableCell className="font-medium">{topic.name}</TableCell>
                                                <TableCell>{selectors.priorityConfig[topic.defaultPriority || 'medium'].label}</TableCell>
                                                <TableCell>{selectors.allUsers?.find(u => u.id === topic.defaultAssigneeId)?.name || 'Sin asignar'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => actions.handleEditClick(topic)}><Edit className="h-4 w-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => actions.setTopicToDelete(topic)}><Trash2 className="h-4 w-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Card>

                {/* --- MÓDULO GEOGRÁFICO DE COSTA RICA --- */}
                <Card>
                    <AccordionItem value="geographic-data">
                        <AccordionTrigger className="p-6 text-lg font-semibold flex gap-2">
                            <MapIcon className="h-5 w-5 text-primary" /> División Territorial (Costa Rica)
                        </AccordionTrigger>
                        <AccordionContent className="p-6 pt-0 space-y-6">
                            <CardDescription>Administra las provincias, cantones y distritos para el cálculo de viáticos de proveedores.</CardDescription>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Columna Provincias */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold uppercase tracking-tight">1. Provincias</h4>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openGeoEdit('province')}><PlusCircle className="h-4 w-4"/></Button>
                                    </div>
                                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto bg-card">
                                        {state.provinces.map(p => (
                                            <div key={p.id} className={cn("p-2 text-sm flex items-center justify-between cursor-pointer group", selectedProvinceId === p.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted")} onClick={() => { setSelectedProvinceId(p.id); setSelectedCantonId(null); }}>
                                                <span className={cn(selectedProvinceId === p.id && "font-bold text-primary")}>{p.name}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openGeoEdit('province', p); }}><Edit className="h-3 w-3"/></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); actions.handleGeoAction('province', 'delete', p); }}><Trash2 className="h-3 w-3"/></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Columna Cantones */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold uppercase tracking-tight">2. Cantones</h4>
                                        {selectedProvinceId && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openGeoEdit('canton')}><PlusCircle className="h-4 w-4"/></Button>
                                        )}
                                    </div>
                                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto bg-card">
                                        {selectedProvinceId ? (
                                            cantonsForProvince.length > 0 ? (
                                                cantonsForProvince.map(c => (
                                                    <div key={c.id} className={cn("p-2 text-sm flex items-center justify-between cursor-pointer group", selectedCantonId === c.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted")} onClick={() => setSelectedCantonId(c.id)}>
                                                        <span className={cn(selectedCantonId === c.id && "font-bold text-primary")}>{c.name}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openGeoEdit('canton', c); }}><Edit className="h-3 w-3"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); actions.handleGeoAction('canton', 'delete', c); }}><Trash2 className="h-3 w-3"/></Button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : <div className="p-4 text-xs text-muted-foreground italic text-center">No hay cantones.</div>
                                        ) : <div className="p-4 text-xs text-muted-foreground italic text-center">Selecciona una provincia.</div>}
                                    </div>
                                </div>

                                {/* Columna Distritos */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold uppercase tracking-tight">3. Distritos</h4>
                                        {selectedCantonId && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openGeoEdit('district')}><PlusCircle className="h-4 w-4"/></Button>
                                        )}
                                    </div>
                                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto bg-card">
                                        {selectedCantonId ? (
                                            districtsForCanton.length > 0 ? (
                                                districtsForCanton.map(d => (
                                                    <div key={d.id} className="p-2 text-sm flex items-center justify-between group hover:bg-muted">
                                                        <span>{d.name}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openGeoEdit('district', d)}><Edit className="h-3 w-3"/></Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => actions.handleGeoAction('district', 'delete', d)}><Trash2 className="h-3 w-3"/></Button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : <div className="p-4 text-xs text-muted-foreground italic text-center">No hay distritos.</div>
                                        ) : <div className="p-4 text-xs text-muted-foreground italic text-center">Selecciona un cantón.</div>}
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Card>

                {/* --- OTROS ACORDEONES --- */}
                <Card>
                    <AccordionItem value="services-catalog">
                        <AccordionTrigger className="p-6 text-lg font-semibold">Catálogo de Servicios</AccordionTrigger>
                        <AccordionContent className="p-6 pt-0">
                            <CardDescription className="mb-4">Precios base por hora para servicios técnicos.</CardDescription>
                            <div className="space-y-2">
                                {(companyData.servicesCatalog || []).map(service => (
                                    <div key={service.id} className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="flex-1">
                                            <p className="font-medium">{service.name} <span className="font-mono text-xs text-muted-foreground">({service.id})</span></p>
                                            <p className="text-xs text-green-600 font-bold">Precio/Hora: ¢{(service.price || 0).toLocaleString()}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => actions.handleDeleteService(service.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex flex-col sm:flex-row items-end gap-2">
                                <div className="flex-1 space-y-1.5"><Label className="text-xs">ID</Label><Input value={state.newService.id} onChange={e => actions.setNewService({...state.newService, id: e.target.value})} placeholder="Ej: soporte-remoto"/></div>
                                <div className="flex-1 space-y-1.5"><Label className="text-xs">Nombre</Label><Input value={state.newService.name} onChange={e => actions.setNewService({...state.newService, name: e.target.value})} placeholder="Ej: Soporte Remoto Básico"/></div>
                                <div className="w-full sm:w-32 space-y-1.5"><Label className="text-xs">Precio</Label><Input type="number" value={state.newService.price || ''} onChange={e => actions.setNewService({...state.newService, price: Number(e.target.value)})} /></div>
                                <Button size="icon" onClick={actions.handleAddService}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Card>
            </Accordion>
            
            <div className="mt-8 flex justify-end">
                <Button onClick={actions.handleSaveAll} size="lg" className="px-10 shadow-lg">Guardar Configuración General</Button>
            </div>

            {/* Diálogo de Edición Geográfica */}
            <Dialog open={isGeoEditOpen} onOpenChange={setGeoEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{geoEditTarget ? 'Editar' : 'Añadir'} {geoEditType === 'province' ? 'Provincia' : geoEditType === 'canton' ? 'Cantón' : 'Distrito'}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input value={geoEditName} onChange={(e) => setGeoEditName(e.target.value)} placeholder="Ej: Heredia" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleGeoSave()} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setGeoEditOpen(false)}>Cancelar</Button>
                        <Button onClick={handleGeoSave}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Alerta de eliminación de temas */}
            <AlertDialog open={!!state.topicToDelete} onOpenChange={(open) => !open && actions.setTopicToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar Tema?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={actions.handleDeleteTopic}>Sí, eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}
