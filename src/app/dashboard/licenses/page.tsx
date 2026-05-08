/**
 * @fileoverview Main page for the License Management module.
 * Enhanced for Hybrid Licensing v3.6 (Standardized UI & Forced Sync).
 */
'use client';

import React, { useState } from 'react';
import { useLicenses } from '@/modules/licenses/hooks/useLicenses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/search-input';
import { PlusCircle, MoreVertical, CalendarIcon, Loader2, Trash2, Download, Edit, ShieldCheck, Boxes, Settings2, Info, Code2, Copy, Check, KeyRound, Eye, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { License, SoftwareProduct } from '@/modules/core/types';

export default function LicensesPage() {
    const { state, actions, selectors } = useLicenses();
    const { isAuthorized, hasPermission } = useAuthorization(['licenses:read']);
    const [isSdkDialogOpen, setSdkDialogOpen] = useState(false);
    const [copiedSection, setCopiedSection] = useState<string | null>(null);

    const selectedSoftware = state.currentLicense.softwareId
        ? state.softwareProducts.find(p => p.id === state.currentLicense.softwareId)
        : null;
    
    const handleCopy = (text: string, section: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    if (!isAuthorized) {
        return null;
    }

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

    const moduleKeys = Array.from({ length: 10 }, (_, i) => `m${(i + 1).toString().padStart(2, '0')}`);

    const SERVER_URL = state.companyData?.publicUrl || 'https://soporte.clicsoporte.com';

    const sdkCode = {
        meta: `version: v3.6 fecha: 25/05/2024`,
        schema: `{
  "success": true,
  "license_file": {
    "license_info": {
      "softwareId": 12,
      "softwareName": "Clic-Turnos",
      "customerName": "Nombre Oficial del Cliente", // Inyectado por Servidor
      "customerEmail": "cliente@oficial.com",        // Inyectado por Servidor
      "customerPhone": "8888-8888",
      "hardwareId": "ABC-123-XYZ",
      "status": "active",
      "isPerpetual": false,
      "expirationDate": "2025-12-31",
      "modules": {
        "m01": true,
        "m02": false,
        ...
      }
    },
    "signature": "hash_hex_firmado_rsa"
  }
}`,
        verify: `/**
 * PASO 1: VERIFICACIÓN INTELIGENTE (SDK v3.6)
 * El cliente ingresa su Cédula y obtenemos sus datos oficiales para evitar doble registro.
 */
export async function verifyClientInfo(taxId: string) {
    const res = await fetch(\`${SERVER_URL}/api/v1/verify-client?taxId=\${taxId}\`);
    const result = await res.json();
    
    if (result.exists) {
        return { 
            found: true, 
            data: result.data, 
            isLocal: result.source === 'local' 
        };
    }
    return { found: false };
}`,
        actions: `'use server';
/**
 * PASO 2: ACTIVACIÓN (SDK v3.6)
 * El servidor devuelve un objeto estructurado. Ya NO es necesario JSON.parse(result.license_file).
 */
export async function activateSoftware(payload: {
    taxId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    token?: string
}) {
    const hardwareId = await generateHardwareId(); // Fingerprint local
    const endpoint = payload.token ? 'activate' : 'register-free';
    
    const res = await fetch(\`${SERVER_URL}/api/v1/\${endpoint}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            softwareName: 'Clic-Turnos',
            hardwareId,
            activationToken: payload.token,
            ...payload 
        })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    
    // result.license_file ya es un OBJETO con license_info y signature
    return result.license_file; 
}`,
        rsa: `/**
 * PASO 4: VERIFICACIÓN CRIPTOGRÁFICA (SDK v3.6)
 * Validamos que el servidor sea quien dice ser usando la clave pública PEM.
 */
import crypto from 'crypto';

export function verifyServerSignature(licenseFile, publicKeyPem) {
    const { license_info, signature } = licenseFile;
    
    // IMPORTANTE: Ordenar llaves alfabéticamente para coincidir con la firma del servidor
    const message = JSON.stringify(license_info, Object.keys(license_info).sort());
    
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message);
    
    return verifier.verify(publicKeyPem, signature, 'hex');
}`,
        marketing: `/**
 * PASO 6: PUBLICIDAD DINÁMICA (SDK v3.6)
 * Descarga anuncios globales firmados segmentados por tipo de licencia.
 */
export async function syncGlobalAds(licenseType: 'free' | 'premium') {
    const res = await fetch(\`${SERVER_URL}/api/v1/marketing?software=Clic-Turnos&status=\${licenseType}\`);
    const { payload } = await res.json();
    
    // Validar firma del anuncio antes de mostrarlo
    if (verifyServerSignature(payload, publicKeyPem)) {
        return payload.license_info.ads; 
    }
    return [];
}`,
        frontend: `/**
 * PASO 5: INTERFAZ Y BOTÓN DE ACCIÓN (SDK v3.6 ESTÁNDAR)
 * Implementación recomendada para el bloque de gestión de licencia en el cliente.
 */

// A) Lógica del Handler
const handleSyncLicense = async () => {
    const taxId = form.getValues('taxId');
    const token = form.getValues('licenseKey');

    if (!taxId) {
        toast({ title: "Falta Identificación", description: "Ingrese su Cédula/RUC para sincronizar.", variant: "destructive" });
        return;
    }

    setIsSyncing(true);
    try {
        const result = await activateSoftware({
            taxId,
            token,
            customerName: form.getValues('companyName'),
            customerEmail: form.getValues('email'),
            customerPhone: form.getValues('phone')
        });

        if (result.license_info) {
            toast({ title: "Sincronización Exitosa", description: "Licencia actualizada desde el servidor." });
            await fetchLicenseInfo(); // Función que refresca el estado visual local
        }
    } catch (error) {
        toast({ title: "Fallo de Conexión", description: error.message, variant: "destructive" });
    } finally {
        setIsSyncing(false);
    }
};

// B) Componente UI (JSX)
<div className='p-4 bg-muted/30 rounded-lg space-y-3 border'>
    <div className='flex justify-between items-center'>
        <span className='font-bold text-xs uppercase text-muted-foreground'>Estado de Licencia:</span>
        <Badge variant={license?.isValid ? "default" : "destructive"}>
            {license?.status || 'SIN ACTIVAR'}
        </Badge>
    </div>
    
    <div className='text-[10px] space-y-1 font-mono text-muted-foreground'>
        <p>TIPO: {license?.type?.toUpperCase() || 'N/A'}</p>
        <p className='break-all'>HARDWARE ID: {license?.hardwareId || 'PENDIENTE'}</p>
        {license?.expiresAt && <p>EXPIRA: {new Date(license.expiresAt).toLocaleDateString()}</p>}
    </div>
    
    <Separator />
    
    <div className='space-y-2'>
        <p className='text-[9px] text-muted-foreground italic'>Forzar sincronización con el servidor de licencias central.</p>
        <Button 
            type="button" 
            onClick={handleSyncLicense} 
            disabled={isSyncing} 
            variant="secondary" 
            className='w-full h-9 text-xs'
        >
            {isSyncing ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <RefreshCw className='mr-2 h-4 w-4' />}
            Sincronizar y Forzar Activación
        </Button>
    </div>
</div>`
    };

    return (
        <TooltipProvider>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                    <ShieldCheck className="h-6 w-6 text-primary" /> Gestión de Licenciamiento Híbrido
                                </CardTitle>
                                <CardDescription>Administración central de activaciones internas y llaves de terceros.</CardDescription>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <Button variant="outline" onClick={() => setSdkDialogOpen(true)}>
                                    <Code2 className="mr-2 h-4 w-4" /> Kit de Integración (SDK)
                                </Button>
                                {hasPermission('licenses:manage') && (
                                    <Button variant="outline" onClick={() => actions.setIsSoftwareDialogOpen(true)}>
                                        <Boxes className="mr-2 h-4 w-4" /> Catálogo de Software
                                    </Button>
                                )}
                                {hasPermission('licenses:manage') && (
                                    <Dialog open={state.isFormOpen} onOpenChange={(open) => { actions.setIsFormOpen(open); if (!open) actions.resetCurrentLicense(); }}>
                                        <DialogTrigger asChild>
                                            <Button className="shadow-md"><PlusCircle className="mr-2 h-4 w-4" /> Nueva Activación</Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0">
                                            <form onSubmit={(e) => { e.preventDefault(); actions.handleSaveLicense(); }} className="flex flex-col h-full">
                                                <DialogHeader className="p-6 pb-4 border-b">
                                                    <DialogTitle>{state.isEditing ? "Editar" : "Emitir Nueva"} Licencia</DialogTitle>
                                                    <DialogDescription>Define el cliente, producto y los módulos activos para esta licencia.</DialogDescription>
                                                </DialogHeader>
                                                
                                                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pr-2">
                                                        <div className="space-y-6">
                                                            <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
                                                                <div className="space-y-2">
                                                                    <Label>Cliente Propietario</Label>
                                                                    <SearchInput
                                                                        options={selectors.clientCustomerOptions}
                                                                        onSelect={actions.handleSelectCompany}
                                                                        value={state.companySearchTerm}
                                                                        onValueChange={actions.setCompanySearchTerm}
                                                                        placeholder="Buscar cliente por nombre o alias..."
                                                                        open={state.isCompanySearchOpen}
                                                                        onOpenChange={actions.setIsCompanySearchOpen}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Producto de Software</Label>
                                                                    <Select value={String(state.currentLicense.softwareId)} onValueChange={(val) => actions.handleCurrentLicenseChange('softwareId', Number(val))} required>
                                                                        <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                                                        <SelectContent>
                                                                            {state.softwareProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} {p.isInternal ? '(Propio)' : '(Terceros)'}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            {selectedSoftware?.isInternal ? (
                                                                <div className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="flex items-center gap-2">
                                                                            Hardware ID (Fingerprint)
                                                                            <Tooltip>
                                                                                <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground"/></TooltipTrigger>
                                                                                <TooltipContent><p className="max-w-xs">Identificador único generado por el software hijo en la PC del cliente.</p></TooltipContent>
                                                                            </Tooltip>
                                                                        </Label>
                                                                        <Input
                                                                            value={state.currentLicense.hardwareId || ''}
                                                                            onChange={(e) => actions.handleCurrentLicenseChange('hardwareId', e.target.value)}
                                                                            placeholder="Vinculará el hardware tras la primera activación API"
                                                                            className="font-mono text-xs"
                                                                        />
                                                                    </div>
                                                                    {state.currentLicense.activationToken && (
                                                                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-center">
                                                                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Token de Activación</p>
                                                                            <p className="text-2xl font-black font-mono text-primary">{state.currentLicense.activationToken}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : selectedSoftware && (
                                                                <div className="space-y-2">
                                                                    <Label>Llave de Licencia (Terceros)</Label>
                                                                    <Input
                                                                        value={state.currentLicense.licenseKey || ''}
                                                                        onChange={(e) => actions.handleCurrentLicenseChange('licenseKey', e.target.value)}
                                                                        placeholder="Ingrese serial del fabricante..."
                                                                        required
                                                                    />
                                                                </div>
                                                            )}

                                                            <div className="space-y-4 pt-2">
                                                                <div className="flex items-center justify-between">
                                                                    <Label>Vencimiento de Licencia</Label>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox id="is-perpetual" checked={state.currentLicense.isPerpetual} onCheckedChange={(checked) => actions.handleCurrentLicenseChange('isPerpetual', !!checked)} />
                                                                        <Label htmlFor="is-perpetual" className="text-xs">Sin vencimiento</Label>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !state.currentLicense.expirationDate && "text-muted-foreground")} disabled={state.currentLicense.isPerpetual}>
                                                                                <CalendarIcon className="mr-2 h-4 w-4"/>
                                                                                {state.currentLicense.expirationDate ? format(parseISO(state.currentLicense.expirationDate), 'dd/MM/yyyy') : <span>Seleccionar fecha...</span>}
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={state.currentLicense.expirationDate ? parseISO(state.currentLicense.expirationDate) : undefined} onSelect={(date) => actions.handleCurrentLicenseChange('expirationDate', date?.toISOString().split('T')[0] || '')} initialFocus/></PopoverContent>
                                                                    </Popover>
                                                                </div>

                                                                {!state.currentLicense.isPerpetual && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <Button type="button" variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => actions.setExpirationDatePreset(30)}>+1 Mes</Button>
                                                                        <Button type="button" variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => actions.setExpirationDatePreset(90)}>+3 Meses</Button>
                                                                        <Button type="button" variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => actions.setExpirationDatePreset(180)}>+6 Meses</Button>
                                                                        <Button type="button" variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={() => actions.setExpirationDatePreset(365)}>+1 Año</Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {selectedSoftware?.isInternal ? (
                                                            <div className="space-y-4">
                                                                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                                                    <Settings2 className="h-4 w-4" /> Módulos Disponibles
                                                                </h3>
                                                                <div className="grid grid-cols-1 gap-2 bg-muted/10 p-4 rounded-xl border max-h-[400px] overflow-y-auto">
                                                                    {moduleKeys.map((key) => {
                                                                        const softwareRec = selectedSoftware as unknown as Record<string, string>;
                                                                        const moduleName = softwareRec[`${key}_name`];
                                                                        const valKey = `${key}_val` as keyof License;
                                                                        if (!moduleName) return null;
                                                                        
                                                                        const currentLicenseRec = state.currentLicense as unknown as Record<string, boolean>;
                                                                        
                                                                        return (
                                                                            <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm hover:border-primary/50 transition-colors">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-sm font-bold">{moduleName}</span>
                                                                                    <span className="text-[9px] font-mono uppercase text-muted-foreground">ID Lógico: {key.toUpperCase()}</span>
                                                                                </div>
                                                                                <Switch 
                                                                                    checked={!!currentLicenseRec[valKey]} 
                                                                                    onCheckedChange={(checked) => actions.handleCurrentLicenseChange(valKey, checked)} 
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground italic border-t pt-2">
                                                                    * Estándar: Para aplicaciones simples, active siempre el <b>Módulo 1</b> como disparador de activación global.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center h-full text-center p-10 border-2 border-dashed rounded-2xl opacity-40">
                                                                <KeyRound className="h-20 w-20 mb-4" />
                                                                <p className="text-sm font-bold">Licencia de Tercero</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <DialogFooter className="p-6 border-t bg-muted/10">
                                                    <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                                                    <Button type="submit" disabled={state.isSubmitting}>
                                                        {state.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                                        {state.isEditing ? "Guardar Cambios" : "Emitir Licencia"}
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 text-[11px] uppercase font-bold">
                                        <TableHead>Software</TableHead>
                                        <TableHead>Código Cliente</TableHead>
                                        <TableHead>Identificación / Cédula</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Token / Serial</TableHead>
                                        <TableHead>Vencimiento</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectors.filteredLicenses.map(license => {
                                        const software = selectors.getSoftwareProduct(license.softwareId);
                                        const client = selectors.getCustomer(license.customerId);
                                        const { label, variant } = selectors.getLicenseStatus(license);
                                        return (
                                            <TableRow key={license.id} className="hover:bg-muted/30 group">
                                                <TableCell className="font-bold">
                                                    <div className="flex flex-col">
                                                        <span>{software?.name || 'Desconocido'}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                                                            {software?.isInternal ? 'Soporte Híbrido' : 'Licencia Tercero'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{client?.id || 'N/A'}</TableCell>
                                                <TableCell className="text-xs">{client?.taxId || 'N/A'}</TableCell>
                                                <TableCell className="text-sm font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{client?.name || license.customerId || 'No asignado'}</span>
                                                        {client?.commercialName && <span className="text-[9px] text-primary font-bold uppercase">{client.commercialName}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {software?.isInternal ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-xs font-black text-primary">{license.activationToken}</span>
                                                            <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">HWID: {license.hardwareId || '(Pendiente)'}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded truncate max-w-[150px] inline-block">{license.licenseKey}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">{license.isPerpetual ? 'Perpetua' : license.expirationDate ? format(parseISO(license.expirationDate), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                                <TableCell><Badge variant={variant} className="text-[10px] h-5 uppercase">{label}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => actions.downloadLicenseFile(license)} disabled={!software?.isInternal}>
                                                                <Download className="mr-2 h-4 w-4" />Bajar JSON (Offline)
                                                            </DropdownMenuItem>
                                                            {hasPermission('licenses:manage') && <DropdownMenuItem onSelect={() => actions.handleEditLicense(license)}><Edit className="mr-2 h-4 w-4"/>Editar Cobertura</DropdownMenuItem>}
                                                            {hasPermission('licenses:manage') && <DropdownMenuItem className="text-destructive" onSelect={() => actions.setLicenseToDelete(license)}><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={isSdkDialogOpen} onOpenChange={setSdkDialogOpen}>
                    <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2 border-b">
                            <div className="flex items-center justify-between w-full pr-8">
                                <div className="flex items-center gap-2">
                                    <Code2 className="h-5 w-5 text-primary" />
                                    <DialogTitle>Kit de Integración (SDK Estándar {sdkCode.meta})</DialogTitle>
                                </div>
                            </div>
                            <DialogDescription>
                                Implementa la inyección de identidad, validación de firma y sincronización forzada en tus software hijos.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <Tabs defaultValue="schema" className="flex-1 overflow-hidden flex flex-col">
                            <TabsList className="px-6 border-b rounded-none bg-muted/20 h-10 overflow-x-auto justify-start">
                                <TabsTrigger value="schema" className="text-xs font-bold text-orange-600">Esquema</TabsTrigger>
                                <TabsTrigger value="verify" className="text-xs font-bold text-primary">1. Verificación</TabsTrigger>
                                <TabsTrigger value="actions" className="text-xs">2. Activación</TabsTrigger>
                                <TabsTrigger value="rsa" className="text-xs font-bold text-red-600">3. RSA</TabsTrigger>
                                <TabsTrigger value="marketing" className="text-xs font-bold text-purple-600">4. Publicidad</TabsTrigger>
                                <TabsTrigger value="frontend" className="text-xs font-bold text-green-600">5. Botón & UI</TabsTrigger>
                            </TabsList>
                            
                            <div className="flex-1 overflow-y-auto p-0">
                                <TabsContent value="schema" className="m-0 h-full">
                                    <div className="p-4 relative">
                                        <p className="text-[11px] text-muted-foreground mb-3 italic">Contrato de datos que recibe el cliente tras una activación exitosa.</p>
                                        <Button variant="secondary" size="sm" className="absolute top-12 right-6 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.schema, 'schema')}>
                                            {copiedSection === 'schema' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'schema' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-orange-200 p-6 rounded-lg text-[11px] font-mono overflow-auto max-h-[600px]">
                                            {sdkCode.schema}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="verify" className="m-0 h-full">
                                    <div className="p-4 relative">
                                        <Button variant="secondary" size="sm" className="absolute top-6 right-6 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.verify, 'verify')}>
                                            {copiedSection === 'verify' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'verify' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto max-h-[600px]">
                                            {sdkCode.verify}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="actions" className="m-0 h-full">
                                    <div className="p-4 relative">
                                        <Button variant="secondary" size="sm" className="absolute top-6 right-6 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.actions, 'actions')}>
                                            {copiedSection === 'actions' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'actions' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto max-h-[600px]">
                                            {sdkCode.actions}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="rsa" className="m-0 h-full">
                                    <div className="p-4 relative">
                                        <Button variant="secondary" size="sm" className="absolute top-6 right-6 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.rsa, 'rsa')}>
                                            {copiedSection === 'rsa' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'rsa' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto max-h-[600px]">
                                            {sdkCode.rsa}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="marketing" className="m-0 h-full">
                                    <div className="p-4 relative">
                                        <Button variant="secondary" size="sm" className="absolute top-6 right-6 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.marketing, 'marketing')}>
                                            {copiedSection === 'marketing' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'marketing' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto max-h-[600px]">
                                            {sdkCode.marketing}
                                        </pre>
                                    </div>
                                </TabsContent>
                                <TabsContent value="frontend" className="m-0 h-full">
                                    <div className="p-4 relative">
                                        <p className="text-[11px] text-muted-foreground mb-3 italic">Implementación estándar del bloque de sincronización forzada en el cliente.</p>
                                        <Button variant="secondary" size="sm" className="absolute top-12 right-6 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.frontend, 'frontend')}>
                                            {copiedSection === 'frontend' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'frontend' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-green-200 p-6 rounded-lg text-[11px] font-mono overflow-auto max-h-[600px]">
                                            {sdkCode.frontend}
                                        </pre>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                        
                        <DialogFooter className="p-6 border-t bg-muted/10">
                            <DialogClose asChild><Button variant="outline">Cerrar SDK</Button></DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={state.isSoftwareDialogOpen} onOpenChange={actions.setIsSoftwareDialogOpen}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Catálogo de Productos de Software</DialogTitle>
                            <DialogDescription>Define los nombres de los módulos para cada programa de tu autoría.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                                <ScrollArea className="h-64 border rounded-md">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {state.softwareProducts.map(p => (
                                                <TableRow key={p.id} className={cn("cursor-pointer", state.newSoftwareProduct.id === p.id && "bg-primary/5")}>
                                                    <TableCell onClick={() => actions.handleOpenSoftwareEdit(p)}>
                                                        <div className="flex flex-col">
                                                            <p className="font-bold text-sm">{p.name}</p>
                                                            <p className="text-[10px] text-muted-foreground uppercase">{p.isInternal ? `Propio - ${p.currentVersion || 'v1.0'}` : 'Tercero'}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => actions.handleDeleteSoftware(p.id)}><Trash2 className="h-4 w-4"/></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>

                                <div className="space-y-4 border p-4 rounded-lg bg-muted/10">
                                    <div className="space-y-2">
                                        <Label>Nombre del Software</Label>
                                        <Input value={state.newSoftwareProduct.name} onChange={e => actions.handleNewSoftwareChange('name', e.target.value)} placeholder="Ej: Clic-POS Pro" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Versión Actual (Centralizada)</Label>
                                        <Input value={state.newSoftwareProduct.currentVersion || ''} onChange={e => actions.handleNewSoftwareChange('currentVersion', e.target.value)} placeholder="Ej: 2.5.0" />
                                        <p className="text-[10px] text-muted-foreground italic">Al cambiar la versión aquí, todos los clientes recibirán el aviso de actualización.</p>
                                    </div>
                                    <div className="flex items-center space-x-2 pb-2"><Checkbox id="is-internal-soft" checked={state.newSoftwareProduct.isInternal} onCheckedChange={checked => actions.handleNewSoftwareChange('isInternal', !!checked)}/><Label htmlFor="is-internal-soft" className="text-xs">Es Software Propio (Permite Módulos)</Label></div>
                                    <Button className="w-full" onClick={actions.handleSaveSoftware}>
                                        {state.isSoftwareEditing ? 'Actualizar Producto' : 'Añadir al Catálogo'}
                                    </Button>
                                    {state.isSoftwareEditing && <Button variant="ghost" className="w-full text-xs" onClick={() => { actions.setSoftwareEditing(false); actions.handleNewSoftwareChange('name', ''); }}>Cancelar Edición</Button>}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                                    <Settings2 className="h-3 w-3" /> Mapeo de Protocolo (m01 - m10)
                                </Label>
                                {state.newSoftwareProduct.isInternal ? (
                                    <ScrollArea className="h-[400px] pr-4">
                                        <div className="grid gap-4">
                                            {moduleKeys.map((key, i) => {
                                                const productRec = state.newSoftwareProduct as unknown as Record<string, string>;
                                                return (
                                                    <div key={key} className="space-y-1.5 p-3 rounded-lg border bg-background">
                                                        <Label className="text-[10px] font-bold text-primary uppercase">Nombre del Módulo {i+1} (ID: {key.toUpperCase()})</Label>
                                                        <Input 
                                                            value={productRec[`${key}_name`] || ''} 
                                                            onChange={e => actions.handleNewSoftwareChange(`${key}_name` as keyof SoftwareProduct, e.target.value)}
                                                            placeholder="Ej: Facturación, Inventarios..."
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[400px] text-center p-10 border-2 border-dashed rounded-xl opacity-20 bg-muted/50">
                                        <Settings2 className="h-10 w-10 mb-2" />
                                        <p className="text-[10px] font-bold uppercase">Mapeo Desactivado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={!!state.licenseToDelete} onOpenChange={(open) => !open && actions.setLicenseToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar Licencia?</AlertDialogTitle><AlertDialogDescription>Esta acción borrará permanentemente la licencia y todos sus datos asociados.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={actions.handleDeleteLicense}>Sí, eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </TooltipProvider>
    );
}
