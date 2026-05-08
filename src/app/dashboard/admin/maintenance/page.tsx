/**
 * @fileoverview System maintenance page for administrators.
 * Enhanced with robust error handling and defensive date parsing.
 */
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "../../../../components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "../../../../components/ui/select"
import { useToast } from "../../../../modules/core/hooks/use-toast";
import { logError, logInfo, logWarn } from "../../../../modules/core/lib/logger";
import { UploadCloud, RotateCcw, Loader2, Save, LifeBuoy, Trash2 as TrashIcon, Download, Skull, AlertTriangle, DatabaseZap, SearchCheck, CheckCircle2, XCircle, Database, History } from "lucide-react";
import { useDropzone } from 'react-dropzone';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { Checkbox } from '../../../../components/ui/checkbox';
import { Label } from '../../../../components/ui/label';
import { Input } from '../../../../components/ui/input';
import { restoreAllFromUpdateBackup, listAllUpdateBackups, deleteOldUpdateBackups, uploadBackupFile, backupAllForUpdate, factoryReset, getDbModules } from '../../../../modules/core/lib/maintenance-db';
import type { UpdateBackupInfo, DatabaseModule } from '../../../../modules/core/types';
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { runDatabaseAudit, detectLegacyFiles, runLegacyMigration, type AuditResult } from '@/modules/core/lib/maintenance-actions';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


export default function MaintenancePage() {
    const { isAuthorized, hasPermission } = useAuthorization(['admin:maintenance:backup', 'admin:maintenance:restore', 'admin:maintenance:reset']);
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const { setTitle } = usePageTitle();

    // Audit & Migration State
    const [auditResults, setAuditResults] = useState<AuditResult[] | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [legacyFiles, setLegacyFiles] = useState<string[]>([]);
    const [isMigrating, setIsMigrating] = useState(false);

    // State for update backups
    const [updateBackups, setUpdateBackups] = useState<UpdateBackupInfo[]>([]);
    const [dbModules, setDbModules] = useState<Omit<DatabaseModule, 'initFn' | 'migrationFn'>[]>([]);
    const [isRestoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
    const [isClearBackupsConfirmOpen, setClearBackupsConfirmOpen] = useState(false);
    
    // State for module reset
    const [isResetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetStep, setResetStep] = useState(0);
    const [resetConfirmationText, setResetConfirmationText] = useState('');
    const [moduleToReset, setModuleToReset] = useState<string>('');

    // State for full reset
    const [isFullResetConfirmOpen, setFullResetConfirmOpen] = useState(false);
    const [fullResetStep, setFullResetStep] = useState(0);
    const [fullResetConfirmationText, setFullResetConfirmationText] = useState('');

    const [showAllRestorePoints, setShowAllRestorePoints] = useState(false);
    const [selectedRestoreTimestamp, setSelectedRestoreTimestamp] = useState<string>('');


    const fetchMaintenanceData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [backups, modules, legacy] = await Promise.all([
                listAllUpdateBackups(),
                getDbModules(),
                detectLegacyFiles()
            ]);
            setUpdateBackups(backups || []);
            setDbModules(modules || []);
            setLegacyFiles(legacy || []);
            
            if (backups && backups.length > 0) {
                const latestTimestamp = backups.reduce((latest: string, current: UpdateBackupInfo) => {
                    const latestDate = new Date(latest);
                    const currentDate = new Date(current.date);
                    return isValid(currentDate) && currentDate > latestDate ? current.date : latest;
                }, backups[0].date);
                setSelectedRestoreTimestamp(latestTimestamp);
            }
        } catch(error: unknown) {
            console.error("Maintenance Data Error:", error);
            logError("Error fetching maintenance data", { error: (error as Error).message });
            toast({ 
                title: "Error de Datos", 
                description: "No se pudieron cargar los datos de mantenimiento. Revise la consola del servidor.", 
                variant: "destructive" 
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setTitle("Mantenimiento del Sistema");
        if(isAuthorized) {
            fetchMaintenanceData();
        }
    }, [setTitle, fetchMaintenanceData, isAuthorized]);

    const handleRunAudit = async () => {
        setIsAuditing(true);
        try {
            const results = await runDatabaseAudit();
            setAuditResults(results);
            const issues = (results || []).filter(r => r.status !== 'ok').length;
            if (issues === 0) {
                toast({ title: "Auditoría Exitosa", description: "La base de datos está íntegra y actualizada." });
            } else {
                toast({ title: "Problemas detectados", description: `Se encontraron ${issues} discrepancias en el esquema.`, variant: "destructive" });
            }
        } catch {
            toast({ title: "Error en Auditoría", variant: "destructive" });
        } finally {
            setIsAuditing(false);
        }
    };

    const handleLegacyMigration = async () => {
        setIsMigrating(true);
        try {
            const result = await runLegacyMigration();
            if (result.success) {
                toast({ title: "Migración Exitosa", description: result.message });
                fetchMaintenanceData();
            } else {
                toast({ title: "Falla en Migración", description: result.message, variant: "destructive" });
            }
        } catch (e: unknown) {
            toast({ title: "Error Crítico", description: (e as Error).message, variant: "destructive" });
        } finally {
            setIsMigrating(false);
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        setIsProcessing(true);
        setProcessingAction('upload');
        const formData = new FormData();
        acceptedFiles.forEach(file => {
            formData.append('backupFiles', file);
        });

        try {
            const uploadedCount = await uploadBackupFile(formData);
            await logInfo(`User ${user?.name} uploaded ${uploadedCount} backup file(s).`, { files: acceptedFiles.map(f => f.name) });
            toast({
                title: "Archivos Subidos",
                description: `${uploadedCount} archivo(s) de backup se han subido correctamente.`
            });
            await fetchMaintenanceData();
        } catch (error: unknown) {
             toast({
                title: "Error al Subir",
                description: `No se pudieron subir los archivos. Error: ${(error as Error).message}`,
                variant: "destructive"
            });
        } finally {
             setIsProcessing(false);
             setProcessingAction(null);
        }

    }, [fetchMaintenanceData, toast, user]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'], 'application/octet-stream': ['.db', '.sqlite', '.sqlite3'] },
    });
    
    const handleFullBackup = async () => {
        setIsProcessing(true);
        setProcessingAction('full-backup');
        try {
            await backupAllForUpdate();
            await fetchMaintenanceData();
            toast({
                title: "Backup Completo Creado",
                description: `Se creó un nuevo punto de restauración para la actualización.`
            });
            await logInfo(`User ${user?.name} created a new full backup for update.`);
        } catch (error: unknown) {
             toast({
                title: "Error de Backup",
                description: `No se pudo crear el backup completo. ${(error as Error).message}`,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    };
    
    const handleFullRestore = async () => {
        if (!selectedRestoreTimestamp) {
            toast({ title: "Error", description: "Debe seleccionar un punto de restauración.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        setProcessingAction('full-restore');
        try {
            await restoreAllFromUpdateBackup(selectedRestoreTimestamp);
            await logWarn(`System restored by ${user?.name} from backup point ${selectedRestoreTimestamp}. The system will restart.`);
            toast({
                title: "Restauración Completada",
                description: `Se han restaurado los datos. La página se recargará en 5 segundos.`,
                duration: 5000,
            });
            setTimeout(() => window.location.reload(), 5000);
        } catch (error: unknown) {
             toast({
                title: "Error de Restauración",
                description: `No se pudo completar la restauración. ${(error as Error).message}`,
                variant: "destructive"
            });
             setIsProcessing(false);
            setProcessingAction(null);
        }
    };

    const handleClearOldBackups = async () => {
        if (uniqueTimestamps.length <= 1) {
            toast({ title: "Acción no necesaria", description: "No hay backups antiguos para eliminar.", variant: "default"});
            return;
        }

        setIsProcessing(true);
        setProcessingAction('clear-backups');
        try {
            const count = await deleteOldUpdateBackups();
            await fetchMaintenanceData();
            await logInfo(`User ${user?.name} cleared ${count} old backup sets.`);
            toast({
                title: "Limpieza Completada",
                description: `Se han eliminado ${count} puntos de restauración antiguos.`
            });
        } catch (error: unknown) {
             toast({
                title: "Error al Limpiar",
                description: `No se pudieron eliminar los backups. ${(error as Error).message}`,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
            setProcessingAction(null);
        }
    };

    const handleFactoryReset = async () => {
        if (resetStep !== 2 || resetConfirmationText !== 'RESETEAR' || !moduleToReset) {
            toast({ title: "Confirmación requerida", description: "Debe seleccionar un módulo y seguir los pasos para confirmar la acción.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        setProcessingAction('factory-reset');
        try {
            await factoryReset();
            const moduleName = dbModules.find(m => m.id === moduleToReset)?.name || moduleToReset;
            await logWarn(`MODULE FACTORY RESET initiated by user ${user?.name} for module ${moduleName}. El sistema se reiniciará.`);
            toast({
                title: "Módulo Reseteado",
                description: `Se ha borrado la base de datos de "${moduleName}". La aplicación se recargará en 5 segundos para reinicializarla.`,
                duration: 5000,
            });
            setTimeout(() => window.location.reload(), 5000);
        } catch (error: unknown) {
            toast({ title: "Error en el Reseteo", description: (error as Error).message, variant: "destructive" });
            logError("Factory reset failed.", { error: (error as Error).message, module: moduleToReset });
            setIsProcessing(false);
            setProcessingAction(null);
        }
    }
    
    const handleFullFactoryReset = async () => {
        if (fullResetStep !== 2 || fullResetConfirmationText !== 'RESETEAR TODO') {
            toast({ title: "Confirmación Estricta Requerida", description: "Debe seguir todos los pasos para confirmar esta acción irreversible.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        setProcessingAction('full-factory-reset');
        try {
            await factoryReset(); 
            await logWarn(`FULL SYSTEM FACTORY RESET initiated by user ${user?.name}. All data will be wiped. The application will restart.`);
            toast({
                title: "Reseteo de Fábrica Completado",
                description: "Se han borrado todas las bases de datos. La aplicación se recargará en 5 segundos para reinicializar.",
                duration: 5000,
            });
            setTimeout(() => window.location.reload(), 5000);
        } catch (error: unknown) {
            toast({ title: "Error en el Reseteo Total", description: (error as Error).message, variant: "destructive" });
            logError("Full factory reset failed.", { error: (error as Error).message });
            setIsProcessing(false);
            setProcessingAction(null);
        }
    };
    
    const uniqueTimestamps = [...new Set(updateBackups.map(b => b.date))].sort((a,b) => new Date(b).getTime() - new Date(a).getTime());

    const oldBackupsCount = uniqueTimestamps.length > 1 ? uniqueTimestamps.length - 1 : 0;
    
    if (isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-8">
                    <Skeleton className="h-96 w-full" />
                </div>
            </main>
        )
    }

    if (!isAuthorized) {
        return null;
    }


    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-8">

                {/* --- Centro de Actualización y Verificación --- */}
                <Card className="border-blue-200 bg-blue-50/20">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <SearchCheck className="h-8 w-8 text-blue-600" />
                            <div>
                                <CardTitle>Centro de Actualización y Verificación</CardTitle>
                                <CardDescription>Auditoría de integridad de base de datos y esquema maestro.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={handleRunAudit} disabled={isAuditing} className="bg-blue-600 hover:bg-blue-700">
                                {isAuditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4" />}
                                Ejecutar Auditoría de Sistema
                            </Button>
                            <p className="text-xs text-muted-foreground self-center">
                                Compara la estructura actual contra el diseño oficial v2.2.0.
                            </p>
                        </div>

                        {auditResults && (
                            <div className="space-y-4 pt-4 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {auditResults.map(r => (
                                        <div key={r.table} className={cn(
                                            "p-3 rounded-lg border text-xs flex flex-col justify-between h-full",
                                            r.status === 'ok' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
                                        )}>
                                            <div className="flex items-center justify-between font-bold mb-1">
                                                <span className="uppercase">{r.table}</span>
                                                {r.status === 'ok' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                            </div>
                                            {r.status !== 'ok' && (
                                                <div className="mt-2 space-y-1">
                                                    <p className="font-bold">Faltan:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {r.missingColumns.map(c => <Badge key={c} variant="destructive" className="text-[8px] h-4">{c}</Badge>)}
                                                    </div>
                                                </div>
                                            )}
                                            {r.status === 'ok' && <p className="text-[10px] opacity-70">Esquema correcto.</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* --- Migrador de Legado (Para versiones anteriores) --- */}
                {legacyFiles.length > 0 && (
                    <Alert className="border-amber-500 bg-amber-50 shadow-md">
                        <History className="h-5 w-5 text-amber-600" />
                        <AlertTitle className="font-black text-amber-800 uppercase tracking-wider">¡SISTEMA ANTERIOR DETECTADO!</AlertTitle>
                        <AlertDescription className="space-y-4 pt-2">
                            <p className="text-sm text-amber-700">
                                Se han detectado {legacyFiles.length} archivos de base de datos de una arquitectura anterior fragmentada. 
                                Para asegurar que el sistema funcione correctamente con la base de datos unificada, debe migrar estos registros.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {legacyFiles.map(f => <Badge key={f} variant="outline" className="bg-white/50">{f}</Badge>)}
                            </div>
                            <Button 
                                onClick={handleLegacyMigration} 
                                disabled={isMigrating} 
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            >
                                {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Database className="mr-2 h-4 w-4" />}
                                Iniciar Migración a Base de Datos Unificada
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                 <Card className="border-primary/50">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <LifeBuoy className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Gestión de Backups y Actualizaciones</CardTitle>
                                <CardDescription>
                                Herramientas para crear puntos de restauración, restaurar el sistema y gestionar archivos de backup.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold">Crear Backup</h3>
                                <p className="text-sm text-muted-foreground">
                                    Crea una copia de seguridad de todas las bases de datos en un nuevo punto de restauración. Ideal antes de una actualización.
                                </p>
                                <Button onClick={handleFullBackup} disabled={isProcessing} className="w-full">
                                    {processingAction === 'full-backup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Crear Punto de Restauración
                                </Button>
                            </div>
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold">Restaurar Sistema</h3>
                                 <div className="space-y-2">
                                    <Label>Punto de Restauración a Usar</Label>
                                     <Select value={selectedRestoreTimestamp} onValueChange={setSelectedRestoreTimestamp} disabled={isProcessing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione un punto de restauración..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {uniqueTimestamps.slice(0, showAllRestorePoints ? undefined : 5).map(ts => {
                                                const d = new Date(ts);
                                                const label = isValid(d) ? format(d, "dd/MM/yyyy 'a las' HH:mm:ss", { locale: es }) : ts;
                                                return <SelectItem key={ts} value={ts}>{label}</SelectItem>
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox id="show-all-restore-points" checked={showAllRestorePoints} onCheckedChange={(checked) => setShowAllRestorePoints(checked as boolean)} />
                                        <Label htmlFor="show-all-restore-points" className="text-sm font-normal">Mostrar todos los puntos de restauración</Label>
                                    </div>
                                </div>
                                <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={isProcessing || !selectedRestoreTimestamp} className="w-full">
                                            {processingAction === 'full-restore' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                                            Restaurar desde Selección
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmar Restauración?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción reemplazará todas las bases de datos actuales con los datos del punto de restauración seleccionado. La aplicación se reiniciará. Esta acción no se puede deshacer.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleFullRestore}>Sí, restaurar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                         <Card>
                            <CardHeader>
                                <CardTitle>Archivos de Backup</CardTitle>
                                <CardDescription>Sube backups desde tu computadora o descarga los existentes.</CardDescription>
                            </CardHeader>
                             <CardContent className="space-y-4">
                                <div {...getRootProps()} className={cn("flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors", isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')}>
                                    <input {...getInputProps()} disabled={isProcessing}/>
                                    <UploadCloud className="w-12 h-12 text-muted-foreground" />
                                    <p className="mt-4 text-center text-muted-foreground">
                                        {isDragActive ? "Suelta los archivos aquí..." : "Arrastra archivos .db aquí o haz clic para seleccionar"}
                                    </p>
                                </div>
                                <ScrollArea className="h-60 w-full rounded-md border p-2">
                                     {updateBackups.length > 0 ? (
                                        <div className="space-y-2">
                                            {updateBackups.map(b => {
                                                const d = new Date(b.date);
                                                const dateLabel = isValid(d) ? format(d, "dd/MM/yyyy HH:mm:ss", { locale: es }) : b.date;
                                                return (
                                                    <div key={b.fileName} className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
                                                        <div>
                                                            <p className="font-semibold text-sm">{b.moduleName}</p>
                                                            <p className="text-xs text-muted-foreground">{dateLabel}</p>
                                                        </div>
                                                        <a href={`/api/temp-backups?file=${encodeURIComponent(b.fileName)}`} download={b.fileName}>
                                                            <Button variant="ghost" size="icon"><Download className="h-4 w-4"/></Button>
                                                        </a>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                     ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <p className="text-muted-foreground text-sm">No hay archivos de backup.</p>
                                        </div>
                                     )}
                                </ScrollArea>
                            </CardContent>
                            <CardFooter>
                                <AlertDialog open={isClearBackupsConfirmOpen} onOpenChange={setClearBackupsConfirmOpen}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" disabled={isProcessing || oldBackupsCount === 0} className="w-full sm:w-auto">
                                                {processingAction === 'clear-backups' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <TrashIcon className="mr-2 h-4 w-4" />}
                                                Limpiar {oldBackupsCount > 0 ? `${oldBackupsCount} Puntos de Restauración` : 'Backups'} Antiguos
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Limpiar Backups Antiguos?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción eliminará todos los puntos de restauración excepto el más reciente para liberar espacio. Esta acción no se puede deshacer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleClearOldBackups}>Sí, limpiar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                             </CardFooter>
                         </Card>
                    </CardContent>
                </Card>
                 {hasPermission('admin:maintenance:reset') && (
                     <Card className="border-destructive">
                        <CardHeader>
                             <div className="flex items-center gap-4">
                                <Skull className="h-8 w-8 text-destructive" />
                                <div>
                                    <CardTitle>Zona de Peligro</CardTitle>
                                    <CardDescription>
                                    Acciones críticas e irreversibles. Usar con extrema precaución.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className='flex flex-wrap gap-4'>
                                 <div className="flex-1 min-w-[250px] space-y-2">
                                    <Label htmlFor="reset-module-select">Resetear Módulo Específico</Label>
                                    <Select value={moduleToReset} onValueChange={setModuleToReset}>
                                        <SelectTrigger id="reset-module-select">
                                            <SelectValue placeholder="Seleccionar un módulo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {dbModules.map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="flex items-end">
                                     <AlertDialog open={isResetConfirmOpen} onOpenChange={(open) => { setResetConfirmOpen(open); if(!open) { setResetStep(0); setResetConfirmationText(''); }}}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" disabled={isProcessing || !moduleToReset}>
                                                <TrashIcon className="mr-2 h-4 w-4" />
                                                Resetear Módulo
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle/>Confirmación Final Requerida</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción borrará **TODA** la información del módulo seleccionado (&quot;{dbModules.find(m => m.id === moduleToReset)?.name || ''}&quot;). La aplicación lo reinicializará en blanco. La página se recargará. Esta acción no se puede deshacer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                             <div className="py-4 space-y-4">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox id="reset-confirm-checkbox" onCheckedChange={(checked) => setResetStep(checked ? 1 : 0)} />
                                                    <Label htmlFor="reset-confirm-checkbox" className="font-medium text-destructive">Entiendo las consecuencias y deseo continuar.</Label>
                                                </div>
                                                {resetStep > 0 && (
                                                    <div className="space-y-2">
                                                        <Label htmlFor="reset-confirmation-text">Para confirmar, escribe &quot;RESETEAR&quot; en el campo:</Label>
                                                        <Input id="reset-confirmation-text" value={resetConfirmationText} onChange={(e) => { setResetConfirmationText(e.target.value.toUpperCase()); if (e.target.value.toUpperCase() === 'RESETEAR') {setResetStep(2);} else {setResetStep(1);}}} className="border-destructive focus-visible:ring-destructive" />
                                                    </div>
                                                )}
                                            </div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleFactoryReset} disabled={isProcessing || resetStep !== 2 || resetConfirmationText !== 'RESETEAR'}>
                                                    {processingAction === 'factory-reset' ? <Loader2 className="mr-2 animate-spin"/> : <TrashIcon className="mr-2"/>}
                                                    Sí, Borrar Módulo
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                 </div>
                             </div>
                             <div className="flex items-end">
                                <AlertDialog open={isFullResetConfirmOpen} onOpenChange={(open) => { setFullResetConfirmOpen(open); if(!open) { setFullResetStep(0); setFullResetConfirmationText(''); }}}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className='w-full'>
                                            <Skull className="mr-2 h-4 w-4" />
                                            Resetear Todo el Sistema de Fábrica
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle/>¡ACCIÓN IRREVERSIBLE!</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción borrará **TODAS LAS BASES DE DATOS** y devolverá la aplicación a su estado de fábrica. Perderá todos los usuarios, roles, configuraciones y datos de los módulos. La aplicación se reiniciará.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="py-4 space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="full-reset-confirm-checkbox" onCheckedChange={(checked) => setFullResetStep(checked ? 1 : 0)} />
                                                <Label htmlFor="full-reset-confirm-checkbox" className="font-medium text-destructive">Entiendo que esto borrará toda la información.</Label>
                                            </div>
                                            {fullResetStep > 0 && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="full-reset-confirmation-text">Para confirmar, escribe &quot;RESETEAR TODO&quot; en el campo:</Label>
                                                    <Input id="full-reset-confirmation-text" value={fullResetConfirmationText} onChange={(e) => { setFullResetConfirmationText(e.target.value.toUpperCase()); if (e.target.value.toUpperCase() === 'RESETEAR TODO') {setFullResetStep(2);} else {setFullResetStep(1);}}} className="border-destructive focus-visible:ring-destructive" />
                                                </div>
                                            )}
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleFullFactoryReset} disabled={isProcessing || fullResetStep !== 2 || fullResetConfirmationText !== 'RESETEAR TODO'}>
                                                {processingAction === 'full-factory-reset' ? <Loader2 className="mr-2 animate-spin"/> : <Skull className="mr-2"/>}
                                                Sí, Borrar Todo
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             </div>
                        </CardContent>
                     </Card>
                 )}
            </div>
            
            {(isProcessing) && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-primary p-3 text-primary-foreground shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Procesando...</span>
                </div>
            )}
        </main>
    );
}
