/**
 * @fileoverview Main page for the License Management module.
 * Enhanced for Hybrid Licensing v3.7.3 (Full SDK with OTP, RSA, Ads and Manual Sync UI).
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
import { PlusCircle, MoreVertical, CalendarIcon, Loader2, Trash2, Download, Edit, ShieldCheck, Boxes, Settings2, Info, Code2, Copy, Check, Megaphone, Terminal, MonitorPlay } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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
        meta: `v3.7.3 (Final Shield) - Ref: docs/Botonlic.txt`,
        schema: `{
  "success": true,
  "license_file": {
    "license_info": {
      "softwareId": 12,
      "softwareName": "Nombre-Software",
      "customerName": "Nombre Oficial del Cliente", // Inyectado por Servidor
      "customerEmail": "cliente@oficial.com",        // Inyectado por Servidor
      "hardwareId": "ABC-123-XYZ",
      "status": "active",
      "isPerpetual": false,
      "expirationDate": "2025-12-31",
      "modules": { "m01": true, "m02": false, ... }
    },
    "signature": "hash_hex_firmado_rsa"
  }
}`,
        verify: `/**
 * PASO 1: VERIFICACIÓN INTELIGENTE (v3.7)
 * Consulta si el cliente existe para evitar duplicados.
 */
export async function verifyClientInfo(taxId: string) {
    const res = await fetch(\`${SERVER_URL}/api/v1/verify-client?taxId=\${taxId}\`);
    const result = await res.json();
    if (result.exists) {
        return { found: true, data: result.data, source: result.source };
    }
    return { found: false };
}`,
        requestOtp: `/**
 * PASO 2.1: SOLICITAR OTP (Handshake)
 * Envía un código de 8 caracteres al correo del usuario.
 */
export async function requestValidationCode(email: string) {
    const res = await fetch(\`${SERVER_URL}/api/v1/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
    });
    return await res.json();
}`,
        register: `/**
 * PASO 2.2: REGISTRO CON OTP (Free/Lead)
 * Crea el prospecto y entrega la licencia firmada.
 */
export async function registerFreeLicense(payload: {
    taxId: string,
    customerName: string,
    customerEmail: string,
    otpCode: string, 
    hardwareId: string
}) {
    const res = await fetch(\`${SERVER_URL}/api/v1/register-free\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ softwareName: 'Tu-Software', ...payload })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    return result.license_file; // Objeto con info y firma
}`,
        activate: `/**
 * PASO 3: ACTIVACIÓN PREMIUM (Tokens)
 * Para licencias pagas vendidas manualmente en el Dashboard.
 */
export async function activatePremiumLicense(token: string, hardwareId: string) {
    const res = await fetch(\`${SERVER_URL}/api/v1/activate\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            activationToken: token.toUpperCase(), 
            hardwareId, 
            softwareName: 'Tu-Software' 
        })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    return result.license_file;
}`,
        rsa: `/**
 * PASO 4: VALIDACIÓN CRIPTOGRÁFICA (Seguridad)
 * Verifica que el servidor firmó la licencia con RSA-SHA256.
 */
import crypto from 'crypto';

export function verifyServerSignature(licenseFile, publicKeyPem) {
    const { license_info, signature } = licenseFile;
    // IMPORTANTE: Ordenar llaves para coincidir con la firma del servidor
    const message = JSON.stringify(license_info, Object.keys(license_info).sort());
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message);
    return verifier.verify(publicKeyPem, signature, 'hex');
}`,
        marketing: `/**
 * PASO 5: PUBLICIDAD DINÁMICA FIRMADA
 * Descarga anuncios globales segmentados por 'free' o 'premium'.
 */
export async function fetchMarketingAds(licenseStatus: 'free' | 'premium') {
    const res = await fetch(\`${SERVER_URL}/api/v1/marketing?software=Tu-Software&status=\${licenseStatus}\`);
    const { payload } = await res.json();
    
    // El 'payload' viene firmado. Validar antes de mostrar.
    if (verifyServerSignature(payload, publicKeyPem)) {
        return payload.license_info.ads; 
    }
    return [];
}`,
        uiPanel: `/**
 * PASO 6: PANEL DE ACTIVACIÓN (UI RECOMENDADA)
 * Implementación de un botón de sincronización forzada en el software hijo.
 */
const handleManualSync = async () => {
    setIsSyncing(true);
    try {
        // 1. Forzar re-activación (actualiza módulos y fechas)
        const newLicense = await activatePremiumLicense(savedToken, localHardwareId);
        
        // 2. Validar firma inmediatamente
        const isValid = verifyServerSignature(newLicense, publicKey);
        if (isValid) {
            saveLicenseLocally(newLicense);
            toast({ title: "Sincronización Exitosa", description: "Datos de licencia actualizados." });
        }

        // 3. Forzar actualización de publicidad
        const status = newLicense.license_info.activationToken === 'FREE-LICENSE' ? 'free' : 'premium';
        const freshAds = await fetchMarketingAds(status);
        updateLocalAds(freshAds);

    } catch (e) {
        toast({ title: "Error de Conexión", description: "No se pudo contactar al servidor central.", variant: "destructive" });
    } finally {
        setIsSyncing(false);
    }
};

// JSX SUGERIDO PARA EL HIJO:
<Card className="border-primary/20">
    <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4"/> Licencia de Software</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
            <span className="text-xs font-bold uppercase">Estado:</span>
            <Badge variant={isLocalLicenseValid ? 'default' : 'destructive'}>
                {isLocalLicenseValid ? 'ACTIVA' : 'INVALIDA'}
            </Badge>
        </div>
        <Button onClick={handleManualSync} disabled={isSyncing} className="w-full">
            {isSyncing ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
            Sincronizar y Forzar Actualización
        </Button>
    </CardContent>
</Card>`
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
                                                                        onValueChange={state.companySearchTerm ? () => {} : actions.setCompanySearchTerm}
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
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center h-full text-center p-10 border-2 border-dashed rounded-2xl opacity-40">
                                                                <ShieldCheck className="h-20 w-20 mb-4" />
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
                                                <TableCell className="text-xs font-mono">{client?.taxId || 'N/A'}</TableCell>
                                                <TableCell className="text-sm font-medium">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{client?.name || license.customerId || 'No asignado'}</span>
                                                            {client?.isLead && <Badge className="bg-orange-100 text-orange-700 text-[8px] h-3.5 border-none">PROSPECTO</Badge>}
                                                        </div>
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
                    <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2 border-b">
                            <div className="flex items-center gap-2">
                                <Code2 className="h-5 w-5 text-primary" />
                                <DialogTitle>Kit de Integración (SDK Oficial {sdkCode.meta})</DialogTitle>
                            </div>
                            <DialogDescription>
                                Implementa la arquitectura híbrida de verificación, activación y marketing dinámico firmado.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <Tabs defaultValue="schema" className="flex-1 overflow-hidden flex flex-col">
                            <TabsList className="px-6 border-b rounded-none bg-muted/20 h-10 overflow-x-auto justify-start">
                                <TabsTrigger value="schema" className="text-xs font-bold flex gap-1.5"><Terminal className="h-3 w-3"/> Respuesta</TabsTrigger>
                                <TabsTrigger value="verify" className="text-xs font-bold">1. Verificación</TabsTrigger>
                                <TabsTrigger value="register" className="text-xs font-bold">2. Registro Free (OTP)</TabsTrigger>
                                <TabsTrigger value="activate" className="text-xs font-bold">3. Activación Premium</TabsTrigger>
                                <TabsTrigger value="rsa" className="text-xs font-bold">4. Validación RSA</TabsTrigger>
                                <TabsTrigger value="marketing" className="text-xs font-bold text-primary flex gap-1.5"><Megaphone className="h-3 w-3" /> 5. Marketing</TabsTrigger>
                                <TabsTrigger value="uiPanel" className="text-xs font-black uppercase text-indigo-600 flex gap-1.5"><MonitorPlay className="h-3 w-3" /> 6. UI: Panel Activación</TabsTrigger>
                            </TabsList>
                            
                            <div className="flex-1 overflow-y-auto p-0">
                                <TabsContent value="schema" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <p className="text-[11px] text-muted-foreground mb-3 italic">Estructura del archivo de licencia devuelto por el servidor.</p>
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.schema, 'schema')}>
                                            {copiedSection === 'schema' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'schema' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-emerald-400 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.schema}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="verify" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.verify, 'verify')}>
                                            {copiedSection === 'verify' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'verify' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.verify}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="register" className="m-0 h-full p-4">
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-primary mb-2">Paso 1: Solicitar Código OTP</p>
                                            <Button variant="secondary" size="sm" className="absolute top-6 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.requestOtp, 'otp')}>
                                                {copiedSection === 'otp' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                                {copiedSection === 'otp' ? 'Copiado' : 'Copiar'}
                                            </Button>
                                            <pre className="bg-slate-950 text-orange-200 p-4 rounded-lg text-[11px] font-mono overflow-auto">
                                                {sdkCode.requestOtp}
                                            </pre>
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-primary mb-2">Paso 2: Finalizar Registro</p>
                                            <Button variant="secondary" size="sm" className="absolute top-6 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.register, 'reg')}>
                                                {copiedSection === 'reg' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                                {copiedSection === 'reg' ? 'Copiado' : 'Copiar'}
                                            </Button>
                                            <pre className="bg-slate-950 text-slate-100 p-4 rounded-lg text-[11px] font-mono overflow-auto">
                                                {sdkCode.register}
                                            </pre>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="activate" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.activate, 'activate')}>
                                            {copiedSection === 'activate' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'activate' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.activate}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="rsa" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.rsa, 'rsa')}>
                                            {copiedSection === 'rsa' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'rsa' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-yellow-100 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.rsa}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="marketing" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <p className="text-[11px] text-muted-foreground mb-3 italic">Consumo de anuncios dinámicos segmentados y validados criptográficamente.</p>
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.marketing, 'marketing')}>
                                            {copiedSection === 'marketing' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'marketing' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-blue-200 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.marketing}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="uiPanel" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <p className="text-[11px] text-muted-foreground mb-3 italic">Lógica sugerida para el Panel de Control del software hijo (Sincronización Manual).</p>
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.uiPanel, 'uipanel')}>
                                            {copiedSection === 'uipanel' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'uipanel' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-indigo-200 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.uiPanel}
                                        </pre>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                        
                        <DialogFooter className="p-6 border-t bg-muted/10">
                            <DialogClose asChild><Button variant="outline">Cerrar Kit</Button></DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={state.isSoftwareDialogOpen} onOpenChange={actions.setIsSoftwareDialogOpen}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Catálogo de Productos de Software</DialogTitle>
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
