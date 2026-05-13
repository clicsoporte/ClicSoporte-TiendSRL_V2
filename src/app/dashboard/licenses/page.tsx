/**
 * @fileoverview Main page for the License Management module.
 * Enhanced for Hybrid Licensing v3.8.3 (Full SDK + Production Hardening).
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
import { PlusCircle, MoreVertical, CalendarIcon, Loader2, Trash2, Download, Edit, ShieldCheck, Boxes, Settings2, Info, Code2, Copy, Check, Terminal, MonitorPlay, ShieldAlert } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
        meta: `v3.8.3 (Hardening & Compliance)`,
        schema: `{
  "success": true,
  "license_file": {
    "license_info": {
      "softwareId": 12,
      "softwareName": "Clic-Turnos",
      "customerName": "Nombre Oficial del Cliente", 
      "customerEmail": "cliente@oficial.com",        
      "customerPhone": "8888-8888",
      "hardwareId": "ABC-123-XYZ",
      "status": "active",
      "isPerpetual": false,
      "expirationDate": "2025-12-31",
      "policies": {
        "syncFrequencyFree": 7,    // Días de gracia sin internet (Free)
        "adRefreshFrequency": 2,   // Días de frescura de anuncios
        "nagScreenTimer": 60,      // Segundos de bloqueo (Nag)
        "allowOfflinePremium": true
      },
      "modules": { "m01": true, "m02": false, ... }
    },
    "signature": "hash_hex_firmado_rsa"
  }
}`,
        verify: `/**
 * PASO 1: VERIFICACIÓN INTELIGENTE (SDK v3.3+)
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
        activation: `/**
 * PASO 2: REGISTRO FREE / ACTIVACIÓN (SDK v3.8+)
 * IMPORTANTE: El servidor tiene Throttling de 1 minuto por correo para OTP.
 * Si recibe error 429, debe indicar al cliente que espere.
 */

// A. SOLICITAR CÓDIGO (FREE)
export async function requestOtp(email: string) {
    const res = await fetch(\`${SERVER_URL}/api/v1/request-otp\`, {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error); // Puede ser Throttling
    return result;
}

// B. ACTIVAR (CANJEAR TOKEN O OTP)
export async function activateSoftware(payload: {
    taxId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    token?: string // Token Premium o Código OTP Free
}) {
    const hardwareId = await generateHardwareId(); 
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
    if (!res.ok) throw new Error(result.error); // Maneja errores de Multi-PC
    
    return result.license_file; 
}`,
        rsa: `/**
 * PASO 3: VERIFICACIÓN CRIPTOGRÁFICA
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
 * PASO 4: PUBLICIDAD DINÁMICA (SDK v3.8+)
 * Descarga anuncios globales firmados segmentados.
 */
export async function syncGlobalAds(licenseType: 'free' | 'premium') {
    const res = await fetch(\`${SERVER_URL}/api/v1/marketing?software=Clic-Turnos&status=\${licenseType}\`);
    const { payload } = await res.json();
    
    // Validar firma del anuncio antes de mostrarlo
    if (verifyServerSignature(payload, publicKeyPem)) {
        // Estructura: { license_info: { ads: [...] } }
        return payload.license_info.ads; 
    }
    return [];
}`,
        uiPanel: `/**
 * PASO 6: PANEL DE ACTIVACIÓN (EJEMPLO REACT)
 * Implementación de un panel para que el usuario fuerce la sincronización.
 */
import { useState } from 'react';
import { Button } from './ui/button';
import { toast } from './ui/use-toast';

export function LicensePanel() {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            // 1. Re-validar licencia
            const license = await activateSoftware({ ...params });
            // 2. Re-validar firma RSA
            if (verifyServerSignature(license, publicKey)) {
                // 3. Actualizar publicidad
                const ads = await syncGlobalAds(license.license_info.status);
                toast({ title: "Sincronización Exitosa" });
            }
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg">
            <h3 className="font-bold">Estado de Licencia</h3>
            <Button onClick={handleManualSync} disabled={isSyncing}>
                {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
            </Button>
        </div>
    );
}`,
        compliance: `/**
 * PASO 7: ESTRATEGIA DE CUMPLIMIENTO (COMPLIANCE)
 * Blindaje contra manipulación de fecha y falta de anuncios.
 */

// 1. Anti-Clock Tamper (LKT: Last Known Time)
export function validateSystemTime(currentDate) {
    const lkt = localStorage.getItem('LKT_STAMP');
    if (lkt && currentDate < new Date(lkt)) {
        throw new Error("RELOJ ATRASADO DETECTADO: El sistema requiere re-calibrar con el servidor.");
    }
    localStorage.setItem('LKT_STAMP', currentDate.toISOString());
}

// 2. Nag Screen Logic (Para versiones FREE)
// Se dispara si Hoy - LastSync > policies.adRefreshFrequency

// 3. HWID Enforcement
// Se debe comparar el HardwareID del equipo local contra el firmado en la licencia.`
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
                                <CardDescription>Administración central de activaciones y políticas de cumplimiento v3.8.</CardDescription>
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
                                                                    <Label className="flex items-center gap-2">
                                                                        Licencia Perpetua
                                                                        <Tooltip>
                                                                            <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground"/></TooltipTrigger>
                                                                            <TooltipContent><p>Activa el permiso de uso offline ilimitado una vez validada la firma.</p></TooltipContent>
                                                                        </Tooltip>
                                                                    </Label>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox 
                                                                            id="is-perpetual" 
                                                                            checked={state.currentLicense.isPerpetual} 
                                                                            onCheckedChange={(checked) => actions.handleCurrentLicenseChange('isPerpetual', !!checked)} 
                                                                        />
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

                {/* kit de Integración (SDK) */}
                <Dialog open={isSdkDialogOpen} onOpenChange={setSdkDialogOpen}>
                    <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2 border-b">
                            <div className="flex items-center gap-2">
                                <Code2 className="h-5 w-5 text-primary" />
                                <DialogTitle>Kit de Integración (SDK Oficial {sdkCode.meta})</DialogTitle>
                            </div>
                            <DialogDescription>
                                Documentación técnica paso a paso para la integración con sistemas hijos.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <Tabs defaultValue="schema" className="flex-1 overflow-hidden flex flex-col">
                            <TabsList className="px-6 border-b rounded-none bg-muted/20 h-10 overflow-x-auto justify-start flex-nowrap">
                                <TabsTrigger value="schema" className="text-xs font-bold shrink-0"><Terminal className="h-3 w-3 mr-1.5"/> Esquema</TabsTrigger>
                                <TabsTrigger value="verify" className="text-xs font-bold shrink-0">1. Verificación</TabsTrigger>
                                <TabsTrigger value="activation" className="text-xs font-bold shrink-0">2. Activación</TabsTrigger>
                                <TabsTrigger value="rsa" className="text-xs font-bold shrink-0">3. Validación RSA</TabsTrigger>
                                <TabsTrigger value="marketing" className="text-xs font-bold shrink-0">4. Publicidad</TabsTrigger>
                                <TabsTrigger value="uiPanel" className="text-xs font-bold shrink-0"><MonitorPlay className="h-3 w-3 mr-1.5" /> 6. UI: Panel</TabsTrigger>
                                <TabsTrigger value="compliance" className="text-xs font-black uppercase text-red-600 shrink-0"><ShieldAlert className="h-3 w-3 mr-1.5"/> 7. Políticas</TabsTrigger>
                            </TabsList>
                            
                            <div className="flex-1 overflow-y-auto p-0">
                                <TabsContent value="schema" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <p className="text-[11px] text-muted-foreground mb-3 italic">Esquema del objeto JSON firmado. Incluye las políticas de cumplimiento v3.8.</p>
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

                                <TabsContent value="activation" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.activation, 'activation')}>
                                            {copiedSection === 'activation' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'activation' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.activation}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="rsa" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.rsa, 'rsa')}>
                                            {copiedSection === 'rsa' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'rsa' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.rsa}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="marketing" className="m-0 h-full p-4">
                                    <div className="relative">
                                        <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.marketing, 'marketing')}>
                                            {copiedSection === 'marketing' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                            {copiedSection === 'marketing' ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <pre className="bg-slate-950 text-slate-100 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                            {sdkCode.marketing}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="compliance" className="m-0 h-full p-4">
                                    <div className="space-y-4">
                                        <Alert className="bg-blue-50 border-blue-200">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-blue-800 text-xs font-bold uppercase">Contexto de Negocio</AlertTitle>
                                            <AlertDescription className="text-[11px] text-blue-700 leading-relaxed">
                                                Las Políticas Dinámicas (Compliance) actúan como un manual de comportamiento inyectado y firmado. 
                                                Para versiones <b>FREE</b>, son restrictivas (Nag Screen, Sync obligatorio) para incentivar la conversión. 
                                                Para versiones <b>PREMIUM</b>, son permisivas (Uso Offline, HWID Lock) para priorizar la experiencia. 
                                                Al estar dentro del paquete firmado RSA, el hijo tiene una fuente de verdad absoluta e inalterable.
                                            </AlertDescription>
                                        </Alert>
                                        <div className="relative">
                                            <p className="text-[11px] text-muted-foreground mb-3 italic">Implementación de protecciones Anti-Clock e lógica de Nag Screen para versiones Free.</p>
                                            <Button variant="secondary" size="sm" className="absolute top-8 right-2 z-10 h-7 text-[10px]" onClick={() => handleCopy(sdkCode.compliance, 'compliance')}>
                                                {copiedSection === 'compliance' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                                {copiedSection === 'compliance' ? 'Copiado' : 'Copiar'}
                                            </Button>
                                            <pre className="bg-slate-950 text-orange-200 p-6 rounded-lg text-[11px] font-mono overflow-auto">
                                                {sdkCode.compliance}
                                            </pre>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="uiPanel" className="m-0 h-full p-4">
                                    <div className="relative">
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

                {/* Diálogo Catálogo Software */}
                <Dialog open={state.isSoftwareDialogOpen} onOpenChange={actions.setIsSoftwareDialogOpen}>
                    <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0">
                        <DialogHeader className="p-6 pb-2 border-b">
                            <div className="flex items-center gap-2">
                                <Boxes className="h-5 w-5 text-primary" />
                                <DialogTitle>Catálogo de Productos de Software</DialogTitle>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button className="rounded-full h-5 w-5 bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors">?</button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                        <p className="text-xs">Define los productos que tu empresa desarrolla o distribuye. Permite mapear hasta 10 módulos lógicos y configurar políticas de conexión para el SDK hijo.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
                            <div className="p-6 border-r overflow-y-auto space-y-4 bg-muted/5">
                                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest">Listado Maestro</h3>
                                <ScrollArea className="h-[250px] border rounded-md bg-background">
                                    <Table>
                                        <TableBody>
                                            {state.softwareProducts.map(p => (
                                                <TableRow key={p.id} className={cn("cursor-pointer", state.newSoftwareProduct.id === p.id && "bg-primary/5")}>
                                                    <TableCell onClick={() => actions.handleOpenSoftwareEdit(p)}>
                                                        <div className="flex flex-col">
                                                            <p className="font-bold text-sm">{p.name}</p>
                                                            <p className="text-[9px] text-muted-foreground uppercase">{p.isInternal ? `Propio - ${p.currentVersion || 'v1.0'}` : 'Tercero'}</p>
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

                                <div className="space-y-4 border p-4 rounded-xl bg-card shadow-sm">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Nombre</Label><Input value={state.newSoftwareProduct.name} onChange={e => actions.handleNewSoftwareChange('name', e.target.value)} className="h-8 text-xs" /></div>
                                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">Versión</Label><Input value={state.newSoftwareProduct.currentVersion || ''} onChange={e => actions.handleNewSoftwareChange('currentVersion', e.target.value)} className="h-8 text-xs" /></div>
                                    </div>
                                    <div className="flex items-center space-x-2 border-t pt-2"><Checkbox id="is-internal-soft" checked={state.newSoftwareProduct.isInternal} onCheckedChange={checked => actions.handleNewSoftwareChange('isInternal', !!checked)}/><Label htmlFor="is-internal-soft" className="text-xs">Soporte Híbrido (Propio)</Label></div>
                                    
                                    {state.newSoftwareProduct.isInternal && (
                                        <div className="pt-2 space-y-4 border-t">
                                            <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1"><ShieldAlert className="h-3 w-3"/> Políticas Dinámicas (Compliance)</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] uppercase font-bold flex items-center gap-1">
                                                        Sync Gracia Free (Días)
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-2.5 w-2.5 text-muted-foreground"/></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs"><p>Días máximos que una licencia Free puede operar sin reportarse al servidor antes de bloquearse.</p></TooltipContent>
                                                        </Tooltip>
                                                    </Label>
                                                    <Input type="number" value={state.newSoftwareProduct.syncFrequencyFree || 7} onChange={e => actions.handleNewSoftwareChange('syncFrequencyFree', Number(e.target.value))} className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] uppercase font-bold flex items-center gap-1">
                                                        Frescura Anuncios (Días)
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-2.5 w-2.5 text-muted-foreground"/></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs"><p>Días de frescura de la publicidad. Superado este tiempo, se activa el Nag Screen en el hijo.</p></TooltipContent>
                                                        </Tooltip>
                                                    </Label>
                                                    <Input type="number" value={state.newSoftwareProduct.adRefreshFrequency || 2} onChange={e => actions.handleNewSoftwareChange('adRefreshFrequency', Number(e.target.value))} className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] uppercase font-bold flex items-center gap-1">
                                                        Bloqueo Nag Screen (Seg)
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-2.5 w-2.5 text-muted-foreground"/></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs"><p>Segundos que la pantalla permanecerá bloqueada por el Nag Screen cada hora de uso.</p></TooltipContent>
                                                        </Tooltip>
                                                    </Label>
                                                    <Input type="number" value={state.newSoftwareProduct.nagScreenTimer || 60} onChange={e => actions.handleNewSoftwareChange('nagScreenTimer', Number(e.target.value))} className="h-8 text-xs" />
                                                </div>
                                                <div className="flex items-center space-x-2 pt-5">
                                                    <Switch checked={!!state.newSoftwareProduct.allowOfflinePremium} onCheckedChange={val => actions.handleNewSoftwareChange('allowOfflinePremium', val)} />
                                                    <Label className="text-[9px] uppercase font-bold flex items-center gap-1">
                                                        Licencia Perpetua
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-2.5 w-2.5 text-muted-foreground"/></TooltipTrigger>
                                                            <TooltipContent className="max-w-xs"><p>Si se permite el funcionamiento 100% offline para versiones pagas tras la validación inicial.</p></TooltipContent>
                                                        </Tooltip>
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 flex gap-2">
                                        <Button className="flex-1 h-9" onClick={actions.handleSaveSoftware}>{state.isSoftwareEditing ? 'Actualizar' : 'Añadir'}</Button>
                                        {state.isSoftwareEditing && <Button variant="ghost" className="h-9 px-3" onClick={() => { actions.setSoftwareEditing(false); actions.handleNewSoftwareChange('name', ''); }}>X</Button>}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4">
                                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <Settings2 className="h-4 w-4" /> Mapeo de Protocolo (m01 - m10)
                                </h3>
                                {state.newSoftwareProduct.isInternal ? (
                                    <div className="grid gap-3">
                                        {moduleKeys.map((key, i) => {
                                            const productRec = state.newSoftwareProduct as unknown as Record<string, string>;
                                            return (
                                                <div key={key} className="space-y-1.5 p-3 rounded-lg border bg-background shadow-sm group hover:border-primary/50 transition-colors">
                                                    <Label className="text-[9px] font-bold text-primary uppercase">Módulo {i+1} (ID: {key.toUpperCase()})</Label>
                                                    <Input 
                                                        value={productRec[`${key}_name`] || ''} 
                                                        onChange={e => actions.handleNewSoftwareChange(`${key}_name` as keyof SoftwareProduct, e.target.value)}
                                                        placeholder="Nombre comercial del módulo..."
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[400px] text-center p-10 border-2 border-dashed rounded-xl opacity-20 bg-muted/50">
                                        <Settings2 className="h-10 w-10 mb-2" />
                                        <p className="text-[10px] font-bold uppercase">Mapeo Desactivado para Terceros</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter className="p-4 border-t bg-muted/10"><DialogClose asChild><Button variant="ghost">Cerrar Catálogo</Button></DialogClose></DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Confirmación Doble Licencia Perpetua */}
                <AlertDialog open={state.showPerpetualConfirm} onOpenChange={(v) => actions.setShowPerpetualConfirm(v)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-primary">
                                <ShieldAlert /> ¡AUTORIZACIÓN DE LICENCIA PERPETUA!
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                                <p className="font-bold text-foreground">Estás a punto de marcar esta licencia como PERPETUA (Offline Ilimitado).</p>
                                <p>Esto otorgará al software hijo el permiso de funcionar <b>para siempre sin conexión al API</b> una vez validada la firma inicial.</p>
                                <p className="text-xs text-muted-foreground italic">Esta acción es crítica y solo debe realizarse para clientes con pago único finalizado.</p>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => actions.setShowPerpetualConfirm(false)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={actions.confirmPerpetual} className="bg-primary text-white">Entiendo, Proceder</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

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
