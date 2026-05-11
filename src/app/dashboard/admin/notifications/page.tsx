'use client';

/**
 * @fileoverview Administration page for managing the Notifications and Automations Engine.
 * Enhanced with Visual Template Editor (HTML/Telegram).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Edit, BellRing, Clock, Send, Loader2, Mail, RefreshCw, Play, LayoutTemplate, Info, Save, ChevronRight, Eye } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { NotificationRule, ScheduledTask, NotificationServiceConfig, EmailSettings, NotificationTemplate } from '@/modules/core/types';
import { 
    getAllNotificationRules, saveNotificationRule, deleteNotificationRule,
    getAllScheduledTasks, saveScheduledTask, deleteScheduledTask,
    getNotificationServiceSettings, saveNotificationServiceSettings,
    testTelegram, fetchTelegramChatId, testNotificationRule,
    getAllNotificationTemplates, saveNotificationTemplate
} from '@/modules/notifications/lib/actions';
import { getEmailSettings, saveEmailSettings, testEmailSettings } from '@/modules/core/lib/email-service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const eventLabels: Record<string, string> = {
    onTicketCreated: 'Nuevo Ticket (Apertura)',
    onTicketStatusChanged: 'Cambio de Estado Ticket',
    onTicketCompleted: 'Ticket Resuelto (Completado)',
    onTicketCanceled: 'Ticket Anulado / Cancelado',
    onTicketReplyAdded: 'Nueva Respuesta en Ticket',
    onTicketPriorityUrgent: 'Prioridad Urgente',
    onTicketVisitScheduled: 'Visita Técnica Programada',
    onContractExpiring: 'Contrato por Vencer',
    onContractAutoRenewed: 'Contrato Auto-Renovado',
    onLicenseExpiring: 'Licencia por Vencer',
    onLicenseAssigned: 'Nueva Licencia Asignada',
    onProjectCompleted: 'Proyecto TI Terminado',
    onNewSuggestion: 'Nueva Sugerencia'
};

const eventVariables: Record<string, string[]> = {
    onTicketCreated: ['consecutive', 'subject', 'customerName', 'companyName', 'serviceName', 'assigneeName', 'isBillable', 'formattedPrice', 'formattedDateTime'],
    onTicketStatusChanged: ['consecutive', 'companyName', 'customerName', 'status', 'assigneeName'],
    onTicketCompleted: ['consecutive', 'customerName', 'companyName', 'content', 'userName'],
    onTicketCanceled: ['consecutive', 'customerName', 'companyName', 'content'],
    onTicketReplyAdded: ['consecutive', 'userName', 'content'],
    onTicketPriorityUrgent: ['consecutive', 'companyName', 'subject'],
    onTicketVisitScheduled: ['consecutive', 'serviceName', 'customerName', 'technicianName', 'visitDate', 'visitTime', 'companyName'],
    onContractExpiring: ['name', 'customerName', 'daysLeft', 'endDate'],
    onContractAutoRenewed: ['consecutive', 'customerName', 'endDate'],
    onLicenseExpiring: ['softwareName', 'customerName', 'expirationDate', 'daysLeft'],
    onLicenseAssigned: ['softwareName', 'customerName', 'licenseStatus', 'type', 'expirationDate', 'hardwareId'],
    onProjectCompleted: ['consecutive', 'name', 'customerName'],
    onNewSuggestion: ['userName', 'content']
};

export default function AutomationManagerPage() {
    const { isAuthorized } = useAuthorization(['admin:access']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [telegramSettings, setTelegramSettings] = useState<NotificationServiceConfig['telegram']>({ botToken: '', chatId: '' });
    const [emailSettings, setEmailSettings] = useState<EmailSettings>({
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
        smtpSecure: true,
        recoveryEmailSubject: 'Recuperación de Contraseña',
        recoveryEmailBody: '',
    });
    
    const [isRuleDialogOpen, setRuleDialogOpen] = useState(false);
    const [isTaskDialogOpen, setTaskDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [isTestingTelegram, setIsTestingTelegram] = useState(false);
    const [isTestingRule, setIsTestingRule] = useState<number | null>(null);
    const [isFetchingChatId, setIsFetchingChatId] = useState(false);

    const [currentRule, setCurrentRule] = useState<Partial<NotificationRule>>({
        name: '', event: 'onTicketCreated', action: 'sendEmail', recipients: [], enabled: true
    });
    const [currentTask, setCurrentTask] = useState<Partial<ScheduledTask>>({
        name: '', schedule: '0 0 * * *', taskId: 'erp-sync', enabled: true
    });

    // Template Editor State
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
    const [isPreviewOpen, setPreviewOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rulesData, tasksData, settings, savedEmail, templatesData] = await Promise.all([
                getAllNotificationRules(),
                getAllScheduledTasks(),
                getNotificationServiceSettings('telegram'),
                getEmailSettings(),
                getAllNotificationTemplates()
            ]);
            setRules(rulesData);
            setTasks(tasksData);
            setTemplates(templatesData);
            if (settings.telegram) setTelegramSettings(settings.telegram);
            if (savedEmail) setEmailSettings(prev => ({ ...prev, ...savedEmail as EmailSettings }));
            
            if (templatesData.length > 0 && !selectedTemplateId) {
                setSelectedTemplateId(templatesData[0].eventId);
                setEditingTemplate(templatesData[0]);
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las automatizaciones.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast, selectedTemplateId]);

    useEffect(() => {
        setTitle('Gestor de Automatizaciones');
        if (isAuthorized) fetchData();
    }, [isAuthorized, setTitle, fetchData]);

    const handleSaveRule = async () => {
        if (!currentRule.name || !currentRule.event) return;
        setIsSaving(true);
        try {
            await saveNotificationRule(currentRule as NotificationRule);
            toast({ title: 'Regla Guardada' });
            fetchData();
            setRuleDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestRuleAction = async (ruleId: number) => {
        setIsTestingRule(ruleId);
        try {
            const res = await testNotificationRule(ruleId);
            if (res.success) {
                toast({ title: 'Prueba Exitosa', description: res.message });
            } else {
                toast({ title: 'Fallo en Prueba', description: res.message, variant: 'destructive' });
            }
        } catch (error: unknown) {
            const err = error as Error;
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setIsTestingRule(null);
        }
    };

    const handleSaveTask = async () => {
        if (!currentTask.name || !currentTask.schedule) return;
        setIsSaving(true);
        try {
            await saveScheduledTask(currentTask as ScheduledTask);
            toast({ title: 'Tarea Programada Guardada' });
            fetchData();
            setTaskDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTelegram = async () => {
        setIsSaving(true);
        try {
            await saveNotificationServiceSettings('telegram', { telegram: telegramSettings });
            toast({ title: 'Configuración de Telegram Guardada' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestTelegram = async () => {
        if (!telegramSettings?.botToken || !telegramSettings?.chatId) {
            toast({ title: "Faltan datos", description: "Configura el token y el ID antes de probar.", variant: "destructive" });
            return;
        }
        setIsTestingTelegram(true);
        try {
            const res = await testTelegram(telegramSettings.chatId);
            if (res.success) {
                toast({ title: "Mensaje Enviado", description: "Revisa tu aplicación de Telegram." });
            } else {
                throw new Error(res.message);
            }
        } catch (error: unknown) {
            toast({ title: "Error en Telegram", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsTestingTelegram(false);
        }
    };

    const handleFetchChatId = async () => {
        if (!telegramSettings?.botToken) {
            toast({ title: "Token requerido", description: "Ingresa el bot token primero.", variant: "destructive" });
            return;
        }
        setIsFetchingChatId(true);
        try {
            const chat = await fetchTelegramChatId();
            setTelegramSettings({ ...telegramSettings, chatId: chat.id });
            toast({ title: "Chat Detectado", description: `Se encontró: ${chat.name}` });
        } catch (error: unknown) {
            toast({ title: "Búsqueda Fallida", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsFetchingChatId(false);
        }
    };

    const handleSaveEmail = async () => {
        setIsSaving(true);
        try {
            await saveEmailSettings(emailSettings);
            toast({ title: 'Configuración de Correo Guardada' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error al Guardar Correo', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!emailSettings.smtpHost || !emailSettings.smtpUser || !user?.email) {
            toast({ title: "Faltan datos", description: "Completa la configuración SMTP y asegúrate de tener un correo en tu perfil.", variant: "destructive" });
            return;
        }
        setIsTestingEmail(true);
        try {
            await testEmailSettings(emailSettings, [user.email]);
            toast({ title: "Correo Enviado", description: `Se envió un mensaje de prueba a ${user.email}.` });
        } catch (error: unknown) {
            const err = error as Error;
            toast({ title: "Error en Prueba", description: err.message, variant: "destructive" });
        } finally {
            setIsTestingEmail(false);
        }
    };

    const handleSelectTemplate = (id: string) => {
        const t = templates.find(temp => temp.eventId === id);
        if (t) {
            setSelectedTemplateId(id);
            setEditingTemplate({ ...t });
        }
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;
        setIsSaving(true);
        try {
            await saveNotificationTemplate(editingTemplate);
            toast({ title: "Plantilla Actualizada", description: "Los cambios se aplicarán en los próximos envíos." });
            // Refresh local list
            setTemplates(prev => prev.map(t => t.eventId === editingTemplate.eventId ? editingTemplate : t));
        } catch (error: unknown) {
            toast({ title: "Error al Guardar", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleRuleStatus = async (rule: NotificationRule) => {
        try {
            await saveNotificationRule({ ...rule, enabled: !rule.enabled });
            fetchData();
        } catch {
            toast({ title: 'Error al cambiar estado', variant: 'destructive' });
        }
    };

    const toggleTaskStatus = async (task: ScheduledTask) => {
        try {
            await saveScheduledTask({ ...task, enabled: !task.enabled });
            fetchData();
        } catch {
            toast({ title: 'Error al cambiar estado', variant: 'destructive' });
        }
    };

    if (!isAuthorized) return null;

    if (isLoading) return <main className="flex-1 p-8"><Skeleton className="h-96 w-full" /></main>;

    return (
        <TooltipProvider>
            <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Automatizaciones y Alertas</h1>
                        <p className="text-muted-foreground text-sm">Gestiona el motor de eventos, plantillas y tareas programadas de la plataforma.</p>
                    </div>
                </div>

                <Tabs defaultValue="scheduled">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="scheduled" className="flex gap-2"><Clock className="h-4 w-4" /> Tareas Cron</TabsTrigger>
                        <TabsTrigger value="rules" className="flex gap-2"><BellRing className="h-4 w-4" /> Reglas de Envío</TabsTrigger>
                        <TabsTrigger value="templates" className="flex gap-2 text-primary font-black uppercase tracking-tighter"><LayoutTemplate className="h-4 w-4" /> Diseño Mensajes</TabsTrigger>
                        <TabsTrigger value="services" className="flex gap-2"><Send className="h-4 w-4" /> Servicios Externos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="rules" className="space-y-4 pt-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Reglas de Notificación</CardTitle>
                                    <CardDescription>Define qué eventos disparan alertas por Email o Telegram.</CardDescription>
                                </div>
                                <Button onClick={() => { setCurrentRule({ name: '', event: 'onTicketCreated', action: 'sendEmail', recipients: [], enabled: true }); setRuleDialogOpen(true); }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Nueva Regla
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Evento</TableHead>
                                            <TableHead>Acción</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rules.map(rule => (
                                            <TableRow key={rule.id}>
                                                <TableCell className="font-bold">{rule.name}</TableCell>
                                                <TableCell><Badge variant="outline">{eventLabels[rule.event] || rule.event}</Badge></TableCell>
                                                <TableCell className="capitalize">
                                                    <div className="flex items-center gap-2">
                                                        {rule.action === 'sendEmail' ? <Mail className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                                                        {rule.action === 'sendEmail' ? 'Email' : 'Telegram'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Switch checked={rule.enabled} onCheckedChange={() => toggleRuleStatus(rule)} />
                                                </TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-blue-600"
                                                        title="Enviar notificación de prueba"
                                                        disabled={isTestingRule !== null}
                                                        onClick={() => handleTestRuleAction(rule.id)}
                                                    >
                                                        {isTestingRule === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentRule(rule); setRuleDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNotificationRule(rule.id).then(fetchData)}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {rules.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No hay reglas configuradas.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="templates" className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <Card className="lg:col-span-1 border-primary/20">
                                <CardHeader className="p-4 border-b bg-primary/5">
                                    <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                        <BellRing className="h-4 w-4 text-primary" /> Eventos Disponibles
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[600px]">
                                        <div className="divide-y">
                                            {templates.map((temp) => (
                                                <div 
                                                    key={temp.eventId} 
                                                    onClick={() => handleSelectTemplate(temp.eventId)}
                                                    className={cn(
                                                        "p-4 cursor-pointer transition-colors hover:bg-muted group flex items-center justify-between",
                                                        selectedTemplateId === temp.eventId ? "bg-primary/10 border-l-4 border-primary" : "border-l-4 border-transparent"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn("text-xs font-bold truncate", selectedTemplateId === temp.eventId && "text-primary")}>
                                                            {eventLabels[temp.eventId] || temp.eventId}
                                                        </p>
                                                        <p className="text-[9px] font-mono text-muted-foreground uppercase">{temp.eventId}</p>
                                                    </div>
                                                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <div className="lg:col-span-3 space-y-6">
                                {editingTemplate ? (
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-xl border">
                                            <div>
                                                <h3 className="text-lg font-black text-primary uppercase tracking-tighter">Editor de Formato</h3>
                                                <p className="text-xs text-muted-foreground">Personaliza el diseño visual de: <strong>{eventLabels[editingTemplate.eventId]}</strong></p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Dialog open={isPreviewOpen} onOpenChange={setPreviewOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-9">
                                                            <Eye className="h-4 w-4 mr-2" /> Previsualizar
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col p-0">
                                                        <DialogHeader className="p-6 border-b"><DialogTitle>Vista Previa de Correo HTML</DialogTitle></DialogHeader>
                                                        <div className="flex-1 bg-white p-8 overflow-auto">
                                                            <div dangerouslySetInnerHTML={{ __html: editingTemplate.body }} />
                                                        </div>
                                                        <DialogFooter className="p-4 border-t bg-muted/10">
                                                            <DialogClose asChild><Button variant="ghost">Cerrar</Button></DialogClose>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                                <Button onClick={handleSaveTemplate} size="sm" disabled={isSaving} className="h-9 px-6 font-bold shadow-md">
                                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                    Guardar Plantilla
                                                </Button>
                                            </div>
                                        </div>

                                        <Tabs defaultValue="email">
                                            <TabsList className="bg-muted w-fit mb-4">
                                                <TabsTrigger value="email" className="flex gap-2"><Mail className="h-3 w-3" /> Correo Electrónico</TabsTrigger>
                                                <TabsTrigger value="telegram" className="flex gap-2"><Send className="h-3 w-3" /> Telegram Bot</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="email" className="space-y-6">
                                                <Card>
                                                    <CardContent className="pt-6 space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-black uppercase">Asunto del Correo (Soporta variables)</Label>
                                                            <Input 
                                                                value={editingTemplate.subject} 
                                                                onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})} 
                                                                className="font-bold"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-xs font-black uppercase">Cuerpo del Mensaje (HTML)</Label>
                                                                <Badge variant="secondary" className="text-[9px] uppercase">Engine: Handlebars</Badge>
                                                            </div>
                                                            <Textarea 
                                                                value={editingTemplate.body} 
                                                                onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})} 
                                                                rows={20}
                                                                className="font-mono text-xs leading-relaxed bg-slate-950 text-emerald-400 p-6 selection:bg-emerald-900"
                                                            />
                                                            <p className="text-[10px] text-muted-foreground italic">Usa etiquetas HTML estándar (div, table, p, style) para el diseño responsivo.</p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>

                                            <TabsContent value="telegram">
                                                <Card>
                                                    <CardContent className="pt-6 space-y-4">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-xs font-black uppercase">Formato de Texto Telegram</Label>
                                                                <Badge variant="secondary" className="text-[9px] uppercase">HTML Parse Mode</Badge>
                                                            </div>
                                                            <Textarea 
                                                                value={editingTemplate.telegram} 
                                                                onChange={e => setEditingTemplate({...editingTemplate, telegram: e.target.value})} 
                                                                rows={12}
                                                                className="font-mono text-xs bg-slate-950 text-blue-300 p-6"
                                                                placeholder="🆕 NUEVO TICKET..."
                                                            />
                                                            <p className="text-[10px] text-muted-foreground">Soporta etiquetas básicas: <code>&lt;b&gt;negrita&lt;/b&gt;</code>, <code>&lt;i&gt;itálica&lt;/i&gt;</code>, <code>&lt;code&gt;código&lt;/code&gt;</code>.</p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>
                                        </Tabs>

                                        <Card className="bg-primary/5 border-primary/20">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center gap-2">
                                                <Info className="h-4 w-4 text-primary" />
                                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary">Variables Dinámicas Disponibles</CardTitle>
                                            </CardHeader>
                                            <CardContent className="py-2 px-4 flex flex-wrap gap-2">
                                                {eventVariables[editingTemplate.eventId]?.map(variable => (
                                                    <Tooltip key={variable}>
                                                        <TooltipTrigger asChild>
                                                            <code 
                                                                className="text-[10px] bg-white border px-1.5 py-0.5 rounded cursor-copy hover:bg-primary hover:text-white transition-colors"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(`{{${variable}}}`);
                                                                    toast({ title: "Copiado", description: `{{${variable}}} copiado al portapapeles.`, duration: 1000 });
                                                                }}
                                                            >
                                                                {`{{${variable}}}`}
                                                            </code>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p className="text-[10px]">Clic para copiar</p></TooltipContent>
                                                    </Tooltip>
                                                ))}
                                                {(!eventVariables[editingTemplate.eventId] || eventVariables[editingTemplate.eventId].length === 0) && (
                                                    <p className="text-[10px] italic text-muted-foreground">No se han definido variables específicas para este evento.</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                ) : (
                                    <div className="h-[70vh] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl opacity-30">
                                        <LayoutTemplate className="h-20 w-20 mb-4" />
                                        <p className="font-bold">Selecciona una plantilla para empezar a diseñar.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="scheduled" className="space-y-4 pt-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Sincronización y Tareas Cron</CardTitle>
                                    <CardDescription>Gestiona procesos que corren automáticamente (ej: Vigilante de Vencimientos).</CardDescription>
                                </div>
                                <Button variant="outline" onClick={() => { setCurrentTask({ name: '', schedule: '0 0 * * *', taskId: 'erp-sync', enabled: true }); setTaskDialogOpen(true); }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Tarea
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tarea</TableHead>
                                            <TableHead>Frecuencia (Cron)</TableHead>
                                            <TableHead>Función</TableHead>
                                            <TableHead>Habilitada</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tasks.map(task => (
                                            <TableRow key={task.id}>
                                                <TableCell className="font-bold">{task.name}</TableCell>
                                                <TableCell className="font-mono text-xs">{task.schedule}</TableCell>
                                                <TableCell><Badge variant="secondary">{task.taskId}</Badge></TableCell>
                                                <TableCell>
                                                    <Switch checked={task.enabled} onCheckedChange={() => toggleTaskStatus(task)} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => { setCurrentTask(task); setTaskDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteScheduledTask(task.id).then(fetchData)}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {tasks.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No hay tareas programadas.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="services" className="space-y-6 pt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <Mail className="h-8 w-8 text-primary" />
                                    <div>
                                        <CardTitle>Servidor de Correo (SMTP)</CardTitle>
                                        <CardDescription>Configura la salida de correos para notificaciones y recuperación de contraseñas.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label>Servidor SMTP</Label>
                                        <Input value={emailSettings.smtpHost} onChange={e => setEmailSettings({...emailSettings, smtpHost: e.target.value})} placeholder="smtp.gmail.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Puerto</Label>
                                        <Input type="number" value={emailSettings.smtpPort} onChange={e => setEmailSettings({...emailSettings, smtpPort: Number(e.target.value)})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Seguridad</Label>
                                        <Select value={String(emailSettings.smtpSecure)} onValueChange={v => setEmailSettings({...emailSettings, smtpSecure: v === 'true'})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">TLS/STARTTLS (Recomendado)</SelectItem>
                                                <SelectItem value="false">Ninguna (Inseguro)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Usuario / Correo</Label>
                                        <Input value={emailSettings.smtpUser} onChange={e => setEmailSettings({...emailSettings, smtpUser: e.target.value})} placeholder="notificaciones@empresa.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Contraseña SMTP</Label>
                                        <Input type="password" value={emailSettings.smtpPass} onChange={e => setEmailSettings({...emailSettings, smtpPass: e.target.value})} placeholder="••••••••" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="outline" onClick={handleTestEmail} disabled={isTestingEmail || !emailSettings.smtpHost}>
                                    {isTestingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                    Probar Conexión
                                </Button>
                                <Button onClick={handleSaveEmail} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Guardar Configuración de Correo
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <Send className="h-8 w-8 text-blue-500" />
                                    <div>
                                        <CardTitle>Telegram Bot</CardTitle>
                                        <CardDescription>Configura tu bot para enviar alertas instantáneas a grupos o canales.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bot API Token</Label>
                                        <Input 
                                            type="password" 
                                            value={telegramSettings?.botToken || ''} 
                                            onChange={e => setTelegramSettings({...telegramSettings!, botToken: e.target.value})} 
                                            placeholder="123456:ABC-DEF..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Chat ID Predeterminado (Staff)</Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                value={telegramSettings?.chatId || ''} 
                                                onChange={e => setTelegramSettings({...telegramSettings!, chatId: e.target.value})} 
                                                placeholder="-100123456789"
                                                className="flex-1"
                                            />
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={handleFetchChatId}
                                                disabled={isFetchingChatId}
                                                title="Detectar ID desde últimos mensajes recibidos"
                                            >
                                                {isFetchingChatId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                                <span className="ml-2 hidden sm:inline">Obtener Chat ID</span>
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">Envía un mensaje al bot antes de intentar obtener el ID automáticamente.</p>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6">
                                <Button variant="outline" onClick={handleTestTelegram} disabled={isTestingTelegram}>
                                    {isTestingTelegram ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Enviar Mensaje de Prueba
                                </Button>
                                <Button onClick={handleSaveTelegram} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Guardar Credenciales Telegram
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Dialogs */}
                <Dialog open={isRuleDialogOpen} onOpenChange={setRuleDialogOpen}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader><DialogTitle>Regla de Notificación</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre de la Regla</Label>
                                <Input value={currentRule.name} onChange={e => setCurrentRule({...currentRule, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Evento</Label>
                                    <Select value={currentRule.event} onValueChange={(v: string) => setCurrentRule({...currentRule, event: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(eventLabels).map(([id, label]) => (
                                                <SelectItem key={id} value={id}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Medio</Label>
                                    <Select value={currentRule.action} onValueChange={(v: string) => setCurrentRule({...currentRule, action: v as 'sendEmail' | 'sendTelegram'})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sendEmail">Correo Electrónico</SelectItem>
                                            <SelectItem value="sendTelegram">Telegram</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Destinatarios (uno por línea)</Label>
                                <p className="text-[10px] text-muted-foreground mb-1">
                                    Usa <b>[CORREO_CLIENTE]</b> para Email o <b>[TELEGRAM_CLIENTE]</b> para Telegram del cliente. Escribe varios IDs de chat para enviar a varios destinos.
                                </p>
                                <Textarea 
                                    className="w-full min-h-[100px]" 
                                    value={currentRule.recipients?.join('\n')}
                                    onChange={e => setCurrentRule({...currentRule, recipients: e.target.value.split('\n').filter(Boolean)})}
                                    placeholder="ejemplo@empresa.com o ID de chat"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSaveRule} disabled={isSaving}>Guardar Regla</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isTaskDialogOpen} onOpenChange={setTaskDialogOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Programar Tarea (Cron)</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nombre de la Automatización</Label>
                                <Input value={currentTask.name} onChange={e => setCurrentTask({...currentTask, name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Frecuencia Cron</Label>
                                <Input value={currentTask.schedule} onChange={e => setCurrentTask({...currentTask, schedule: e.target.value})} />
                                <p className="text-[10px] text-muted-foreground">Ej: &quot;0 8 * * *&quot; para revisión diaria a las 8am.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Acción del Sistema</Label>
                                <Select value={currentTask.taskId} onValueChange={(v: string) => setCurrentTask({...currentTask, taskId: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="check-expirations">Vigilante de Vencimientos (Contratos/Licencias)</SelectItem>
                                        <SelectItem value="auto-renew-contracts">Renovación Automática de Contratos</SelectItem>
                                        <SelectItem value="erp-sync">Sincronización Completa ERP</SelectItem>
                                        <SelectItem value="backup-system">Copia de Seguridad Automática</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSaveTask} disabled={isSaving}>Guardar Tarea</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </TooltipProvider>
    );
}
