
/**
 * @fileoverview Main page for IT Technical Notes.
 */
'use client';

import React from 'react';
import { useItNotes } from '@/modules/it-tools/hooks/useItNotes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircle, Edit2, Trash2, Search, FilterX, Loader2, BookCopy, UserCircle, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';

export default function ItNotesPage() {
    const { state, actions, selectors, isAuthorized, hasPermission } = useItNotes();
    const { isLoading, isSubmitting, isFormOpen, searchTerm, noteToEdit, noteToDelete } = state;

    if (!isAuthorized) return null;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader><Skeleton className="h-8 w-64" /><Skeleton className="h-5 w-96 mt-2" /></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </main>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <BookCopy className="h-6 w-6 text-primary" /> Notas Técnicas de TI
                            </CardTitle>
                            <CardDescription>Base de conocimiento para procedimientos y soluciones técnicas por cliente.</CardDescription>
                        </div>
                        {hasPermission('it-tools:notes:create') && (
                            <Button onClick={() => actions.openForm()}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Nueva Nota
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por título o contenido..." value={searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="pl-8" />
                        </div>
                        <Button variant="ghost" onClick={actions.clearFilters}><FilterX className="mr-2 h-4 w-4" /> Limpiar</Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {selectors.filteredNotes.length > 0 ? selectors.filteredNotes.map(note => (
                            <Card key={note.id} className="flex flex-col hover:shadow-md transition-all border-l-4 border-l-primary">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg font-bold line-clamp-1">{note.title}</CardTitle>
                                    {note.customerId && (
                                        <Badge variant="secondary" className="w-fit text-[10px] uppercase font-black tracking-tighter">
                                            <Building2 className="h-3 w-3 mr-1" /> {selectors.getCustomerName(note.customerId)}
                                        </Badge>
                                    )}
                                </CardHeader>
                                <CardContent className="flex-1 pb-3">
                                    <p className="text-sm text-muted-foreground line-clamp-5 whitespace-pre-wrap">{note.content}</p>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center text-[10px] text-muted-foreground border-t pt-3 bg-muted/10">
                                    <div className="flex items-center gap-1 font-bold">
                                        <UserCircle className="h-3 w-3" />
                                        <span>{note.createdBy}</span>
                                        <span className="opacity-50">•</span>
                                        <span>{format(parseISO(note.createdAt), 'dd/MM/yy', { locale: es })}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {hasPermission('it-tools:notes:update') && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.openForm(note)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                        )}
                                        {hasPermission('it-tools:notes:delete') && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.setNoteToDelete(note)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                        )}
                                    </div>
                                </CardFooter>
                            </Card>
                        )) : (
                            <div className="col-span-full text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
                                <BookCopy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No se encontraron notas técnicas registradas.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={actions.setIsFormOpen}>
                <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>{noteToEdit ? 'Editar Nota Técnica' : 'Crear Nueva Nota'}</DialogTitle>
                        <DialogDescription>Detalla el procedimiento o solución técnica.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs font-bold uppercase">Título del Procedimiento</Label>
                            <Input id="title" value={state.currentTitle} onChange={(e) => actions.setCurrentTitle(e.target.value)} placeholder="Ej: Configuración de VPN Site-to-Site..." className="font-bold" />
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Cliente Vinculado (Opcional)</Label>
                            <SearchInput
                                options={selectors.customerOptions}
                                onSelect={actions.handleSelectCompany}
                                value={state.companySearchTerm}
                                onValueChange={actions.setCompanySearchTerm}
                                placeholder="Escribe para buscar cliente..."
                                open={state.isCompanySearchOpen}
                                onOpenChange={actions.setIsCompanySearchOpen}
                            />
                            <p className="text-[10px] text-muted-foreground">Vincula esta nota a un cliente específico para filtrado rápido.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="content" className="text-xs font-bold uppercase">Contenido / Guía Técnica</Label>
                            <Textarea 
                                id="content" 
                                value={state.currentContent} 
                                onChange={(e) => actions.setCurrentContent(e.target.value)} 
                                rows={15} 
                                placeholder="Describe paso a paso la solución o configuración..."
                                className="font-mono text-sm leading-relaxed"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/10">
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {noteToEdit ? 'Guardar Cambios' : 'Crear Nota'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && actions.setNoteToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción eliminará la nota permanentemente y no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={actions.handleDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Eliminar Permanentemente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
