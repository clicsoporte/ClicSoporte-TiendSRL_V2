'use client';

/**
 * @fileoverview Administration page for managing the Notifications and Automations Engine.
 */

import { useState, useEffect, useCallback } from 'react';
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
import { PlusCircle, Trash2, Save, BellRing, Clock, Send, Loader2 } from 'lucide-react';
import type { NotificationRule, ScheduledTask, NotificationServiceConfig } from '@/modules/core/types';
import { 
    getAllNotificationRules, saveNotificationRule, deleteNotificationRule,
    getAllScheduledTasks, saveScheduledTask, deleteScheduledTask,
    getNotificationServiceSettings, saveNotificationServiceSettings 
} from '@/modules/notifications/lib/actions';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AutomationManagerPage() {
    const { isAuthorized } = useAuthorization(['admin:settings:general']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [telegramSettings, setTelegramSettings] = useState<NotificationServiceConfig['telegram']>({ botToken: '', chatId: '' });
    
    const [isRuleDialogOpen, setRuleDialogOpen] = useState(false);
    const [isTaskDialogOpen, setTaskDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [currentRule, setCurrentRule] = useState<Partial<NotificationRule>>({
        name: '', event: 'onTicketCreated', action: 'sendEmail', recipients: [], enabled: true
    });
    const [currentTask, setCurrentTask] = useState<Partial<ScheduledTask>>({
        name: '', schedule: '0 0 * * *', taskId: 'erp-sync', enabled: true
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rulesData, tasksData, settings] = await Promise.all([
                getAllNotificationRules(),
                getAllScheduledTasks(),
                getNotificationServiceSettings('telegram')
            ]);
            setRules(rulesData);
            setTasks(tasksData);
            if (settings.telegram) setTelegramSettings(settings.telegram);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las automatizaciones.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

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
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Automatizaciones y Alertas</h1>
                    <p className="text-muted-foreground text-sm">Gestiona el motor de eventos y tareas programadas de Clic-Soporte.</p>
                </div>
            </div>

            <Tabs defaultValue="scheduled">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="scheduled" className="flex gap-2"><Clock className="h-4 w-4" /> Tareas Cron</TabsTrigger>
                    <TabsTrigger value="rules" className="flex gap-2"><BellRing className="h-4 w-4" /> Reglas de Envío</TabsTrigger>
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
                                            <TableCell><Badge variant="outline">{rule.event}</Badge></TableCell>
                                            <TableCell className="capitalize">{rule.action === 'sendEmail' ? 'Email' : 'Telegram'}</TableCell>
                                            <TableCell>
                                                <Switch checked={rule.enabled} onCheckedChange={() => toggleRuleStatus(rule)} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => { setCurrentRule(rule); setRuleDialogOpen(true); }}><Save className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteNotificationRule(rule.id).then(fetchData)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {rules.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No hay reglas configuradas.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="scheduled" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Sincronización y Tareas Cron</CardTitle>
                                <CardDescription>Gestiona procesos que corren automáticamente (ej: Auto-Sincronización ERP).</CardDescription>
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
                                                <Button variant="ghost" size="icon" onClick={() => { setCurrentTask(task); setTaskDialogOpen(true); }}><Save className="h-4 w-4" /></Button>
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

                <TabsContent value="services" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuración de Telegram Bot</CardTitle>
                            <CardDescription>Establece el token de tu bot oficial para enviar alertas instantáneas.</CardDescription>
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
                                    <Label>Chat ID de Grupo/Canal</Label>
                                    <Input 
                                        value={telegramSettings?.chatId || ''} 
                                        onChange={e => setTelegramSettings({...telegramSettings!, chatId: e.target.value})} 
                                        placeholder="-100123456789"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveTelegram} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Guardar Credenciales
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
                                        <SelectItem value="onTicketCreated">Nuevo Ticket</SelectItem>
                                        <SelectItem value="onTicketPriorityUrgent">Prioridad Urgente</SelectItem>
                                        <SelectItem value="onProjectCompleted">Proyecto Terminado</SelectItem>
                                        <SelectItem value="onNewSuggestion">Nueva Sugerencia</SelectItem>
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
                            <textarea 
                                className="w-full min-h-[100px] border rounded-md p-2 text-sm" 
                                value={currentRule.recipients?.join('\n')}
                                onChange={e => setCurrentRule({...currentRule, recipients: e.target.value.split('\n').filter(Boolean)})}
                                placeholder="ejemplo@clic.com"
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
                            <p className="text-[10px] text-muted-foreground">Ej: &quot;0 0 * * *&quot; para medianoche diaria.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Acción del Sistema</Label>
                            <Select value={currentTask.taskId} onValueChange={(v: string) => setCurrentTask({...currentTask, taskId: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="erp-sync">Sincronización Completa ERP</SelectItem>
                                    <SelectItem value="backup-system">Copia de Seguridad Automática</SelectItem>
                                    <SelectItem value="sla-check">Vigilancia de Tickets (SLA)</SelectItem>
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
    );
}
