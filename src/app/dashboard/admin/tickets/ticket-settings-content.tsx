/**
 * @fileoverview Client Component logic for managing support ticket settings.
 * Extracted to resolve ESLint and circular dependency issues.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useMemo, useState } from 'react';
import { useTicketSettings } from '@/modules/tickets/hooks/useTicketSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Map as MapIcon, Edit, Hash, Package, ShieldCheck, Check, Clock, Zap, DollarSign, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TicketPriority, Province, Canton, District, Role } from '@/modules/core/types';
import { checkPermissionInTree } from '@/modules/core/lib/permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function TicketSettingsPageContent() {
    const { setTitle } = usePageTitle();
    const { companyData, allRoles } = useAuth();
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
    const [geoEditTarget, setGeoEditTarget] = useState<Province | Canton | District | null>(null);

    const supportUsers = useMemo(() => {
        if (!selectors.allUsers) return [];
        // Hierarchical filtering: any role that has or inherits 'tickets:read:all'
        return selectors.allUsers.filter(u => {
            const role = (allRoles || []).find((r: Role) => r.id === u.role);
            if (!role) return false;
            return checkPermissionInTree(role.permissions, 'tickets:read:all');
        });
    }, [selectors.allUsers, allRoles]);
    
    useEffect(() => {
        setTitle("Configuración de Tickets");
    }, [setTitle]);

    const openGeoEdit = (type: 'province' | 'canton' | 'district', target?: Province | Canton | District) => {
        setGeoEditType(type);
        setGeoEditTarget(target || null);
        setGeoEditName(target?.name || "");
        setGeoEditOpen(true);
    };

    const handleGeoSave = async () => {
        if (!geoEditName.trim()) return;
        const action = geoEditTarget ? 'update' : 'add';
        
        let finalData: Province | Canton | District;

        if (action === 'add') {
            if (geoEditType === 'canton') {
                finalData = { id: 0, provinceId: selectedProvinceId || 0, name: geoEditName } as Canton;
            } else if (geoEditType === 'district') {
                finalData = { id: 0, cantonId: selectedCantonId || 0, name: geoEditName } as District;
            } else {
                finalData = { id: 0, name: geoEditName } as Province;
            }
        } else {
            finalData = { ...(geoEditTarget as Province | Canton | District), name: geoEditName };
        }

        await actions.handleGeoAction(geoEditType, action, finalData);
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

    const cantonsForProvince = state.provinces ? state.cantons.filter(c => c.provinceId === selectedProvinceId) : [];
    const districtsForCanton = state.cantons ? state.districts.filter(d => d.cantonId === selectedCantonId) : [];

    return (
        <TooltipProvider>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Accordion type="multiple" defaultValue={['help-topics', 'consecutive-settings', 'services-catalog']} className="w-full space-y-6">
                    
                    {/* --- CONFIGURACIÓN DE CONSECUTIVOS --- */}
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                        <AccordionItem value="consecutive-settings">
                            <AccordionTrigger className="p-6 text-lg font-semibold">
                                <div className="flex items-center gap-2">
                                    <Hash className="h-5 w-5 text-primary" /> Numeración y Consecutivos
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="ticketPrefix">Prefijo de Ticket</Label>
                                        <Input 
                                            id="ticketPrefix" 
                                            value={state.ticketPrefix} 
                                            onChange={(e) => actions.setTicketPrefix(e.target.value)}
                                            placeholder="Ej: CAS-"
                                        />
                                        <p className="text-xs text-muted-foreground">Texto que precede al número (ej: CAS-000001).</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nextTicketNumber">Siguiente Número</Label>
                                        <Input 
                                            id="nextTicketNumber" 
                                            type="number"
                                            value={state.nextTicketNumber} 
                                            onChange={(e) => actions.setNextTicketNumber(Number(e.target.value))}
                                        />
                                        <p className="text-xs text-muted-foreground">El número correlativo que se asignará al próximo ticket.</p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </div>

                    {/* --- TEMAS DE AYUDA --- */}
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                        <AccordionItem value="help-topics">
                            <AccordionTrigger className="p-6 text-lg font-semibold">
                                Gestión de Temas de Ayuda
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-muted-foreground text-sm">
                                        Define los tipos de problemas para automatizar la asignación y priorización inicial.
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
                    </div>

                    {/* --- MÓDULO GEOGRÁFICO DE COSTA RICA --- */}
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                        <AccordionItem value="geographic-data">
                            <AccordionTrigger className="p-6 text-lg font-semibold flex gap-2">
                                <MapIcon className="h-5 w-5 text-primary" /> División Territorial (Costa Rica)
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0 space-y-6">
                                <p className="text-sm text-muted-foreground">Administra las provincias, cantones y distritos para el cálculo de viáticos de proveedores.</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    </div>

                    {/* --- PAQUETES DE SOPORTE (SLA / SLA LOGIC) --- */}
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                        <AccordionItem value="support-packages">
                            <AccordionTrigger className="p-6 text-lg font-semibold flex gap-2">
                                <Package className="h-5 w-5 text-primary" /> Paquetes de Soporte (SLA)
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0 space-y-6">
                                <p className="text-sm text-muted-foreground mb-4">Configura los planes mensuales, periodos de gracia y lógica de redondeo inteligente para el cobro de horas.</p>
                                
                                <div className="space-y-6">
                                    {(companyData.supportPackages || []).map(pkg => (
                                        <div key={pkg.id} className="border rounded-xl p-6 bg-card shadow-sm space-y-6">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1 flex-1">
                                                    <Input 
                                                        className="text-lg font-bold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
                                                        value={pkg.name}
                                                        onChange={e => actions.handlePackagePropChange(pkg.id, 'name', e.target.value)}
                                                    />
                                                    <p className="text-xs text-muted-foreground font-mono">ID Interno: {pkg.id}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => actions.handleDeletePackage(pkg.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-5 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase">Precio Base Sugerido</Label>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                        <Input type="number" className="pl-7" value={pkg.basePrice || ''} onChange={e => actions.handlePackagePropChange(pkg.id, 'basePrice', Number(e.target.value))} placeholder="¢0.00" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase">Horas Incluidas</Label>
                                                    <Input type="number" value={pkg.defaultHours || ''} onChange={e => actions.handlePackagePropChange(pkg.id, 'defaultHours', Number(e.target.value))} placeholder="Ej: 10" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold uppercase">Bloque Redondeo (min)</Label>
                                                    <Select value={String(pkg.roundingMultiple)} onValueChange={v => actions.handlePackagePropChange(pkg.id, 'roundingMultiple', Number(v))}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="1">Sin Redondeo</SelectItem>
                                                            <SelectItem value="15">Cada 15 min</SelectItem>
                                                            <SelectItem value="30">Cada 30 min</SelectItem>
                                                            <SelectItem value="60">Cada 60 min</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <Label className="text-xs font-bold uppercase">Gracia Inicial (min)</Label>
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground"/></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs"><p>Si la labor dura menos que este tiempo, no se cobra nada (0 min).</p></TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                    <Input type="number" value={pkg.graceMinutes || ''} onChange={e => actions.handlePackagePropChange(pkg.id, 'graceMinutes', Number(e.target.value))} placeholder="Ej: 5" />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <Label className="text-xs font-bold uppercase">Tolerancia Exceso (min)</Label>
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground"/></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs"><p>Si los minutos sobran sobre un bloque completo son menores a esto, no se redondea hacia arriba.</p></TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                    <Input type="number" value={pkg.graceFinal || 0} onChange={e => actions.handlePackagePropChange(pkg.id, 'graceFinal', Number(e.target.value))} placeholder="Ej: 5" />
                                                </div>
                                            </div>

                                            <Separator />

                                            <div className="space-y-3">
                                                <Label className="text-xs font-bold uppercase flex items-center gap-2">
                                                    <ShieldCheck className="h-3 w-3" /> Cobertura de Servicios
                                                </Label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2">
                                                    {(companyData.servicesCatalog || []).map(service => {
                                                        const isIncluded = pkg.includedServices.includes(service.id);
                                                        const isExcluded = pkg.excludedServices.includes(service.id);
                                                        return (
                                                            <div key={service.id} className="p-3 rounded-lg border bg-muted/20 flex flex-col gap-2">
                                                                <span className="text-xs font-medium truncate" title={service.name}>{service.name}</span>
                                                                <div className="flex gap-4">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox 
                                                                            id={`inc-${pkg.id}-${service.id}`} 
                                                                            checked={isIncluded}
                                                                            onCheckedChange={(checked) => actions.handlePackageServiceToggle(pkg.id, service.id, 'included', !!checked)}
                                                                        />
                                                                        <Label htmlFor={`inc-${pkg.id}-${service.id}`} className="text-[10px] font-bold uppercase text-green-600">Incluido</Label>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox 
                                                                            id={`exc-${pkg.id}-${service.id}`}
                                                                            checked={isExcluded}
                                                                            onCheckedChange={(checked) => actions.handlePackageServiceToggle(pkg.id, service.id, 'excluded', !!checked)}
                                                                        />
                                                                        <Label htmlFor={`exc-${pkg.id}-${service.id}`} className="text-[10px] font-bold uppercase text-red-600">Extra</Label>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <Separator className="my-6" />
                                    <div className="bg-muted/30 p-6 rounded-xl border-2 border-dashed space-y-4">
                                        <h4 className="font-bold text-sm">Nuevo Paquete de Soporte</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                            <div className="space-y-1.5"><Label className="text-xs">ID</Label><Input value={state.newPackage.id} onChange={e => actions.setNewPackage({...state.newPackage, id: e.target.value})} placeholder="Ej: GOLD"/></div>
                                            <div className="space-y-1.5"><Label className="text-xs">Nombre</Label><Input value={state.newPackage.name} onChange={e => actions.setNewPackage({...state.newPackage, name: e.target.value})} placeholder="Ej: Plan Corporativo Oro"/></div>
                                            <div className="space-y-1.5"><Label className="text-xs">Precio Base Sugerido</Label><Input type="number" value={state.newPackage.basePrice || ''} onChange={e => actions.setNewPackage({...state.newPackage, basePrice: Number(e.target.value)})} placeholder="¢0.00" /></div>
                                            <div className="space-y-1.5"><Label className="text-xs">Horas Base</Label><Input type="number" value={state.newPackage.defaultHours || ''} onChange={e => actions.setNewPackage({...state.newPackage, defaultHours: Number(e.target.value)})} /></div>
                                            <Button onClick={actions.handleAddPackage} className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Crear Paquete</Button>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </div>

                    {/* --- CATÁLOGO DE SERVICIOS --- */}
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                        <AccordionItem value="services-catalog">
                            <AccordionTrigger className="p-6 text-lg font-semibold">Catálogo de Servicios</AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <p className="text-sm text-muted-foreground mb-4">Gestiona los servicios técnicos disponibles y sus modalidades de cobro.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(companyData.servicesCatalog || []).map(service => (
                                        <div key={service.id} className="flex items-center justify-between rounded-lg border p-4 bg-card group hover:border-primary transition-colors">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm">{service.name}</p>
                                                    <Badge variant="outline" className="text-[10px] uppercase">
                                                        {service.billingType === 'task' ? <Zap className="h-2 w-2 mr-1"/> : <Clock className="h-2 w-2 mr-1"/>}
                                                        {service.billingType === 'task' ? 'Por Tarea' : 'Por Hora'}
                                                    </Badge>
                                                </div>
                                                <p className="font-mono text-[10px] text-muted-foreground">{service.id}</p>
                                                <p className="text-xs text-green-600 font-black mt-1">
                                                    ¢{(service.price || 0).toLocaleString()}
                                                    <span className="text-[10px] font-normal text-muted-foreground"> {service.billingType === 'task' ? '/tarea' : '/hora'}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditServiceClick(service)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => actions.handleDeleteService(service.id)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-6"/>
                                <div className="bg-muted/30 p-6 rounded-xl border-2 border-dashed space-y-4">
                                    <h4 className="font-bold text-sm">Añadir Servicio al Catálogo</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                        <div className="space-y-1.5 lg:col-span-1"><Label className="text-xs">ID Único</Label><Input value={state.newService.id} onChange={e => actions.setNewService({...state.newService, id: e.target.value})} placeholder="Ej: soporte-remoto"/></div>
                                        <div className="space-y-1.5 lg:col-span-1"><Label className="text-xs">Nombre Comercial</Label><Input value={state.newService.name} onChange={e => actions.setNewService({...state.newService, name: e.target.value})} placeholder="Ej: Soporte Remoto Nivel 1"/></div>
                                        <div className="space-y-1.5 lg:col-span-1">
                                            <Label className="text-xs">Tipo de Cobro</Label>
                                            <Select value={state.newService.billingType} onValueChange={(v: 'hour' | 'task') => actions.setNewService({...state.newService, billingType: v})}>
                                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="hour">Por Hora</SelectItem>
                                                    <SelectItem value="task">Por Tarea (Fijo)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5 lg:col-span-1"><Label className="text-xs">Precio Sugerido</Label><Input type="number" value={state.newService.price || ''} onChange={e => actions.setNewService({...state.newService, price: Number(e.target.value)})} /></div>
                                        <Button onClick={actions.handleAddService} className="h-10"><PlusCircle className="mr-2 h-4 w-4"/> Añadir</Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </div>
                </Accordion>
                
                <div className="mt-8 flex justify-end">
                    <Button onClick={actions.handleSaveAll} size="lg" className="px-10 shadow-lg gap-2">
                        <Check className="h-5 w-5" />
                        Guardar Configuración General
                    </Button>
                </div>

                <Dialog open={state.isServiceFormOpen} onOpenChange={actions.setIsServiceFormOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar Servicio</DialogTitle>
                            <DialogDescription>Modifica los detalles del servicio del catálogo.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre Comercial</Label>
                                <Input value={state.newService.name} onChange={e => actions.setNewService({...state.newService, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Cobro</Label>
                                    <Select value={state.newService.billingType} onValueChange={(v: 'hour' | 'task') => actions.setNewService({...state.newService, billingType: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hour">Por Hora</SelectItem>
                                            <SelectItem value="task">Por Tarea (Fijo)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Precio Sugerido</Label>
                                    <Input type="number" value={state.newService.price || ''} onChange={e => actions.setNewService({...state.newService, price: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => actions.setIsServiceFormOpen(false)}>Cancelar</Button>
                            <Button onClick={actions.handleSaveServiceEdit}>Guardar Cambios</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

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
        </TooltipProvider>
    )
}
