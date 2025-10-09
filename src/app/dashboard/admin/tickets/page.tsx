
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect, useState } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/modules/core/hooks/useAuth';

export default function TicketSettingsPage() {
    const { setTitle } = usePageTitle();
    const { users } = useAuth();
    const {
        state,
        actions,
        selectors,
        isAuthorized,
        isLoading
    } = useTicketSettings();
    
    useEffect(() => {
        setTitle("Configuración de Tickets");
    }, [setTitle]);

    if (!isAuthorized) {
        return null;
    }

    if (isLoading) {
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
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Gestión de Temas de Ayuda</CardTitle>
                            <CardDescription>
                                Define los diferentes tipos de problemas o consultas que los usuarios pueden reportar para automatizar la asignación y priorización.
                            </CardDescription>
                        </div>
                         <Dialog open={state.isFormOpen} onOpenChange={(open) => { actions.setFormOpen(open); if (!open) actions.resetForm(); }}>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4"/>Añadir Tema</Button>
                            </DialogTrigger>
                            <DialogContent>
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="default-priority">Prioridad por Defecto</Label>
                                            <Select value={state.currentTopic.defaultPriority || 'medium'} onValueChange={(v) => actions.setCurrentTopic({ ...state.currentTopic, defaultPriority: v as any })}>
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
                                                    {users.map(u => (
                                                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                    <Button onClick={actions.handleSaveTopic}>{state.isEditing ? 'Guardar Cambios' : 'Crear Tema'}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre del Tema</TableHead>
                                    <TableHead>Prioridad por Defecto</TableHead>
                                    <TableHead>Asignado a</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {state.helpTopics.map(topic => {
                                    const assignee = users.find(u => u.id === topic.defaultAssigneeId);
                                    return (
                                        <TableRow key={topic.id}>
                                            <TableCell className="font-medium">{topic.name}</TableCell>
                                            <TableCell>{selectors.priorityConfig[topic.defaultPriority || 'medium'].label}</TableCell>
                                            <TableCell>{assignee?.name || 'Sin asignar'}</TableCell>
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
                </CardContent>
            </Card>

            <AlertDialog open={!!state.topicToDelete} onOpenChange={(open) => !open && actions.setTopicToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Tema de Ayuda?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta acción no se puede deshacer. Se eliminará el tema "{state.topicToDelete?.name}".
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
