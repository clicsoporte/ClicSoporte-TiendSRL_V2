/**
 * @fileoverview Page for managing support ticket settings.
 */
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useMemo } from 'react';
import { useTicketSettings } from '@/modules/tickets/hooks/useTicketSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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

    if (!isAuthorized) {
        return null;
    }

    if (isLoading || !companyData) {
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
        )
    }

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
                                <p className="text-muted-foreground">
                                    Define los diferentes tipos de problemas para automatizar la asignación y priorización.
                                </p>
                                <Dialog open={state.isFormOpen} onOpenChange={(open) => { actions.setFormOpen(open); if (!open) actions.resetForm(); }}>
                                    <DialogTrigger asChild>
                                        <Button><PlusCircle className="mr-2 h-4 w-4"/>Añadir Tema</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>{state.isEditing ? 'Editar' : 'Añadir'} Tema de Ayuda</DialogTitle>
                                            <DialogDescription>
                                                Configura el nombre del tema y sus valores por defecto.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="topic-name">Nombre del Tema</Label>
                                                <Input
                                                    id="topic-name"
                                                    value={state.currentTopic.name}
                                                    onChange={(e) => actions.setCurrentTopic({ ...state.currentTopic, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="default-priority">Prioridad por Defecto</Label>
                                                    <Select value={state.currentTopic.defaultPriority || 'medium'} onValueChange={(v) => actions.setCurrentTopic({ ...state.currentTopic, defaultPriority: v as TicketPriority })}>
                                                        <SelectTrigger id="default-priority"><SelectValue/></SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(selectors.priorityConfig).map(([key, config]) => (
                                                                <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="default-assignee">Asignar a (Opcional)</Label>
                                                    <Select value={String(state.currentTopic.defaultAssigneeId || 'null')} onValueChange={(v) => actions.setCurrentTopic({ ...state.currentTopic, defaultAssigneeId: v === 'null' ? null : Number(v) })}>
                                                        <SelectTrigger id="default-assignee"><SelectValue placeholder="Sin asignar"/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="null">Sin asignar</SelectItem>
                                                            {supportUsers && supportUsers.map(u => (
                                                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="default-service">Servicio por Defecto (Opcional)</Label>
                                                <Select value={state.currentTopic.defaultServiceId || 'none'} onValueChange={(v) => actions.setCurrentTopic({ ...state.currentTopic, defaultServiceId: v === 'none' ? null : v })}>
                                                    <SelectTrigger id="default-service"><SelectValue placeholder="Ninguno"/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Ninguno</SelectItem>
                                                        {companyData?.servicesCatalog.map(service => (
                                                            <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">Si se elige, este servicio se seleccionará automáticamente al crear un ticket con este tema.</p>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                            <Button onClick={actions.handleSaveTopic}>{state.isEditing ? 'Guardar Cambios' : 'Crear Tema'}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre del Tema</TableHead>
                                            <TableHead>Prioridad</TableHead>
                                            <TableHead>Asignado a</TableHead>
                                            <TableHead>Servicio por Defecto</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {state.helpTopics.map(topic => {
                                            const assignee = selectors.allUsers?.find(u => u.id === topic.defaultAssigneeId);
                                            const service = companyData?.servicesCatalog.find(s => s.id === topic.defaultServiceId);
                                            return (
                                                <TableRow key={topic.id}>
                                                    <TableCell className="font-medium">{topic.name}</TableCell>
                                                    <TableCell>{selectors.priorityConfig[topic.defaultPriority || 'medium'].label}</TableCell>
                                                    <TableCell>{assignee?.name || 'Sin asignar'}</TableCell>
                                                    <TableCell>{service?.name || 'Ninguno'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onSelect={() => actions.handleEditClick(topic)}>Editar</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-destructive" onSelect={() => actions.setTopicToDelete(topic)}>Eliminar</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Card>

                 <Card>
                    <AccordionItem value="services-catalog">
                        <AccordionTrigger className="p-6 text-lg font-semibold">Catálogo de Servicios</AccordionTrigger>
                        <AccordionContent className="p-6 pt-0">
                            <CardDescription className="mb-4">Defina la lista maestra de todos los servicios de soporte que su empresa ofrece.</CardDescription>
                            <div className="space-y-2">
                                {(companyData.servicesCatalog || []).map(service => (
                                    <div key={service.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <p className="font-medium">{service.name} <span className="font-mono text-xs text-muted-foreground">({service.id})</span></p>
                                    <Button variant="ghost" size="icon" onClick={() => actions.handleDeleteService(service.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Separator className="my-4"/>
                            <div className="flex items-end gap-2">
                                <div className="flex-1 space-y-1.5"><Label htmlFor="service-id">ID Servicio</Label><Input id="service-id" value={state.newService.id} onChange={e => actions.setNewService({...state.newService, id: e.target.value})} placeholder="Ej: soporte-pc"/></div>
                                <div className="flex-1 space-y-1.5"><Label htmlFor="service-name">Nombre Servicio</Label><Input id="service-name" value={state.newService.name} onChange={e => actions.setNewService({...state.newService, name: e.target.value})} placeholder="Ej: Soporte a PC"/></div>
                                <Button size="icon" onClick={actions.handleAddService}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                 </Card>

                <Card>
                    <AccordionItem value="support-packages">
                    <AccordionTrigger className="p-6 text-lg font-semibold">Paquetes de Soporte</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <CardDescription className="mb-4">Cree paquetes de soporte, defina las horas incluidas, y asigne los servicios de su catálogo.</CardDescription>
                        <div className="space-y-4">
                        {(companyData.supportPackages || []).map(pkg => (
                            <Card key={pkg.id}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>{pkg.name} <span className="font-mono text-sm text-muted-foreground">({pkg.id})</span></CardTitle>
                                    <CardDescription>Horas Incluidas: {pkg.defaultHours || 0}</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => actions.handleDeletePackage(pkg.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-medium mb-2">Servicios Incluidos</h4>
                                    <div className="space-y-2">
                                    {(companyData.servicesCatalog || []).map(service => (
                                        <div key={`${pkg.id}-inc-${service.id}`} className="flex items-center space-x-2">
                                        <Checkbox id={`${pkg.id}-inc-${service.id}`} checked={(pkg.includedServices || []).includes(service.id)} onCheckedChange={(checked) => actions.handlePackageServiceToggle(pkg.id, service.id, 'included', !!checked)} />
                                        <Label htmlFor={`${pkg.id}-inc-${service.id}`}>{service.name}</Label>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-2">Servicios Excluidos</h4>
                                    <div className="space-y-2">
                                    {(companyData.servicesCatalog || []).map(service => (
                                        <div key={`${pkg.id}-exc-${service.id}`} className="flex items-center space-x-2">
                                        <Checkbox id={`${pkg.id}-exc-${service.id}`} checked={(pkg.excludedServices || []).includes(service.id)} onCheckedChange={(checked) => actions.handlePackageServiceToggle(pkg.id, service.id, 'excluded', !!checked)} />
                                        <Label htmlFor={`${pkg.id}-exc-${service.id}`}>{service.name}</Label>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                                </div>
                            </CardContent>
                            </Card>
                        ))}
                        </div>
                        <Separator className="my-4"/>
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1.5"><Label htmlFor="package-id">ID Paquete</Label><Input id="package-id" value={state.newPackage.id} onChange={e => actions.setNewPackage({...state.newPackage, id: e.target.value})} placeholder="Ej: alfa"/></div>
                            <div className="flex-1 space-y-1.5"><Label htmlFor="package-name">Nombre Paquete</Label><Input id="package-name" value={state.newPackage.name} onChange={e => actions.setNewPackage({...state.newPackage, name: e.target.value})} placeholder="Ej: Paquete Alfa"/></div>
                            <div className="flex-1 space-y-1.5"><Label htmlFor="package-hours">Horas Incluidas</Label><Input id="package-hours" type="number" value={state.newPackage.defaultHours || ''} onChange={e => actions.setNewPackage({...state.newPackage, defaultHours: Number(e.target.value)})} placeholder="Ej: 10"/></div>
                            <Button size="icon" onClick={actions.handleAddPackage}><PlusCircle className="h-4 w-4"/></Button>
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                </Card>

            </Accordion>
            
            <Card className="mt-6">
                 <CardContent className="p-6">
                    <Button onClick={actions.handleSaveAll}>Guardar Todos los Cambios</Button>
                </CardContent>
            </Card>

            <AlertDialog open={!!state.topicToDelete} onOpenChange={(open) => !open && actions.setTopicToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Tema de Ayuda?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta acción no se puede deshacer. Se eliminará el tema &quot;{state.topicToDelete?.name}&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={actions.handleDeleteTopic}>Sí, eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}
