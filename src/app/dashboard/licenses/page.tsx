/**
 * @fileoverview Main page for the License Management module.
 */
'use client';

import React from 'react';
import { useLicenses } from '@/modules/licenses/hooks/useLicenses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/search-input';
import { PlusCircle, MoreVertical, KeyRound, Copy, CalendarIcon, Loader2, FilterX, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';

export default function LicensesPage() {
    const { state, actions, selectors } = useLicenses();
    const { hasPermission } = useAuth();
    
    if (state.isLoading) {
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
                            <CardTitle>Gestión de Licencias</CardTitle>
                            <CardDescription>Administra las licencias de software de tus clientes.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={() => actions.setIsSoftwareDialogOpen(true)}>Gestionar Software</Button>
                            {hasPermission('licenses:manage') && (
                                <Dialog open={state.isFormOpen} onOpenChange={(open) => { actions.setIsFormOpen(open); if (!open) actions.resetCurrentLicense(); }}>
                                    <DialogTrigger asChild>
                                        <Button><PlusCircle className="mr-2 h-4 w-4" /> Nueva Licencia</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <form onSubmit={(e) => { e.preventDefault(); actions.handleSaveLicense(); }}>
                                            <DialogHeader>
                                                <DialogTitle>{state.isEditing ? "Editar" : "Crear"} Licencia</DialogTitle>
                                                <DialogDescription>Completa los detalles de la licencia.</DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="client-company-search">Cliente</Label>
                                                        <SearchInput
                                                            options={selectors.clientCompanyOptions}
                                                            onSelect={actions.handleSelectCompany}
                                                            value={state.companySearchTerm}
                                                            onValueChange={actions.setCompanySearchTerm}
                                                            placeholder="Buscar empresa cliente..."
                                                            open={state.isCompanySearchOpen}
                                                            onOpenChange={actions.setIsCompanySearchOpen}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="software-product">Producto de Software</Label>
                                                        <Select value={String(state.currentLicense.softwareId)} onValueChange={(val) => actions.handleCurrentLicenseChange('softwareId', Number(val))} required>
                                                            <SelectTrigger id="software-product"><SelectValue placeholder="Selecciona un producto..."/></SelectTrigger>
                                                            <SelectContent>
                                                                {state.softwareProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="license-key">Clave de Licencia</Label>
                                                    <Textarea id="license-key" value={state.currentLicense.licenseKey} onChange={(e) => actions.handleCurrentLicenseChange('licenseKey', e.target.value)} placeholder="Pega aquí la clave de licencia, o deja en blanco para generar una."/>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                                     <div className="space-y-2">
                                                        <Label htmlFor="expiration-date">Fecha de Vencimiento</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !state.currentLicense.expirationDate && "text-muted-foreground")} disabled={state.currentLicense.isPerpetual}>
                                                                    <CalendarIcon className="mr-2 h-4 w-4"/>
                                                                    {state.currentLicense.expirationDate ? format(parseISO(state.currentLicense.expirationDate), 'dd/MM/yyyy') : <span>Selecciona fecha</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={state.currentLicense.expirationDate ? parseISO(state.currentLicense.expirationDate) : undefined} onSelect={(date) => actions.handleCurrentLicenseChange('expirationDate', date?.toISOString().split('T')[0] || '')} initialFocus/></PopoverContent>
                                                        </Popover>
                                                    </div>
                                                     <div className="flex items-center space-x-2 pb-2">
                                                        <Checkbox id="is-perpetual" checked={state.currentLicense.isPerpetual} onCheckedChange={(checked) => actions.handleCurrentLicenseChange('isPerpetual', !!checked)} />
                                                        <Label htmlFor="is-perpetual">Licencia Perpetua</Label>
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <DialogClose asChild><Button variant="ghost" type="button">Cancelar</Button></DialogClose>
                                                <Button type="submit" disabled={state.isSubmitting}>{state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{state.isEditing ? "Guardar Cambios" : "Crear Licencia"}</Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Software</TableHead>
                                    <TableHead>Clave</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectors.filteredLicenses.map(license => {
                                    const software = selectors.getSoftwareProduct(license.softwareId);
                                    const client = selectors.getClientCompany(license.clientCompanyId);
                                    const { label, variant } = selectors.getLicenseStatus(license);
                                    return (
                                        <TableRow key={license.id}>
                                            <TableCell className="font-medium">{software?.name || 'Desconocido'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs truncate max-w-[150px]">{license.licenseKey}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(license.licenseKey)}><Copy className="h-3 w-3"/></Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>{client?.name || 'No asignado'}</TableCell>
                                            <TableCell>{license.isPerpetual ? 'Perpetua' : license.expirationDate ? format(parseISO(license.expirationDate), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                            <TableCell><Badge variant={variant}>{label}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                {hasPermission('licenses:manage') && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => actions.handleEditLicense(license)}>Editar</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onSelect={() => actions.setLicenseToDelete(license)}>Eliminar</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {selectors.filteredLicenses.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No hay licencias que coincidan con los filtros.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={state.isSoftwareDialogOpen} onOpenChange={actions.setIsSoftwareDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Gestionar Productos de Software</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border max-h-64 overflow-y-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {state.softwareProducts.map(p => (
                                        <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.isInternal ? 'Propio' : 'De Terceros'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => actions.handleDeleteSoftware(p.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex items-end gap-2 pt-4">
                            <div className="flex-1 grid gap-2">
                                <Label htmlFor="new-software-name">Nombre del Nuevo Software</Label>
                                <Input id="new-software-name" value={state.newSoftwareProduct.name} onChange={e => actions.handleNewSoftwareChange('name', e.target.value)} />
                            </div>
                            <div className="flex items-center space-x-2 pb-2">
                                <Checkbox id="is-internal" checked={state.newSoftwareProduct.isInternal} onCheckedChange={checked => actions.handleNewSoftwareChange('isInternal', !!checked)}/>
                                <Label htmlFor="is-internal">Es Software Propio</Label>
                            </div>
                            <Button size="icon" onClick={actions.handleCreateSoftware}><PlusCircle className="h-4 w-4"/></Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

             <AlertDialog open={!!state.licenseToDelete} onOpenChange={(open) => !open && actions.setLicenseToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar Licencia?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={actions.handleDeleteLicense}>Sí, eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}

    