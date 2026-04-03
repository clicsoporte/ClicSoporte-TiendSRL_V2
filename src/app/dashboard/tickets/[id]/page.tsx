/**
 * @fileoverview Ticket detail page with contract, provider and time tracking integration.
 */
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTickets } from '@/modules/tickets/hooks/useTickets';
import type { Ticket, TicketThread, TicketPriority, ThirdPartyProvider } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Loader2, MoreVertical, CreditCard, ShieldCheck, ShieldAlert, Truck, CheckCircle2, XCircle, PlayCircle, PauseCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { TimeTracker } from '@/components/tickets/time-tracker';

const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
};

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const ticketId = Number(params.id);
    const { isAuthorized, hasPermission } = useAuthorization(['tickets:read:all']);
    const { actions, selectors } = useTickets();
    const { user: currentUser, companyData } = useAuth();
    const { toast } = useToast();
    
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [thread, setThread] = useState<TicketThread[]>([]);
    const [replyContent, setReplyContent] = useState("");
    const [isReplying, setIsReplying] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Closure Dialog States
    const [isClosureDialogOpen, setClosureDialogOpen] = useState(false);
    const [closureType, setClosureType] = useState<'completed' | 'canceled'>('completed');
    const [closureContent, setClosureContent] = useState("");
    
    const supportUsers = useMemo(() => selectors.supportUsers, [selectors.supportUsers]);

    const { getTicketById, getTicketThread } = actions;

    const loadData = useCallback(async () => {
        if (ticketId && isAuthorized) {
            const ticketData = await getTicketById(ticketId);
            if (ticketData) {
                setTicket(ticketData);
                const threadData = await getTicketThread(ticketId);
                setThread(threadData);
            }
            setIsInitialLoading(false);
        }
    }, [ticketId, isAuthorized, getTicketById, getTicketThread]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleAddReply = async () => {
        if (!replyContent.trim() || !currentUser) return;
        setIsReplying(true);
        const newEntry = await actions.addThreadEntry({ 
            ticketId, 
            content: replyContent,
            userId: currentUser.id,
            userName: currentUser.name,
            type: 'message'
        });
        if (newEntry) {
            setThread(prev => [...prev, newEntry]);
            setReplyContent("");
        }
        setIsReplying(false);
    };

    const handleDetailUpdate = async (updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'isBillable' | 'providerId'>>) => {
        if (!currentUser || !hasPermission('tickets:manage')) {
             toast({ title: "Acción no permitida", description: "No tienes permiso para gestionar metadatos de tickets.", variant: "destructive" });
            return;
        };

        // Intercept Completed/Canceled to show dialog
        if (updates.status === 'completed' || updates.status === 'canceled') {
            setClosureType(updates.status);
            setClosureContent("");
            setClosureDialogOpen(true);
            return;
        }

        const updatedTicket = await actions.updateTicketDetails(ticketId, updates, currentUser);
        if (updatedTicket) {
            setTicket(updatedTicket);
            const threadData = await getTicketThread(ticketId);
            setThread(threadData);
            if (updates.status === 'in_progress') toast({ title: "Cronómetro Iniciado Automáticamente" });
            if (updates.status === 'on_hold') toast({ title: "Tiempo Pausado" });
        }
    };

    const handleConfirmClosure = async () => {
        if (!closureContent.trim() || !currentUser) return;
        setIsReplying(true);
        
        // 1. Add the final resolution/cancellation message to thread
        await actions.addThreadEntry({
            ticketId,
            content: closureContent,
            userId: currentUser.id,
            userName: currentUser.name,
            type: 'message'
        });

        // 2. Update status (this also stops timer server-side)
        const updatedTicket = await actions.updateTicketDetails(ticketId, { status: closureType }, currentUser);
        
        if (updatedTicket) {
            setTicket(updatedTicket);
            const threadData = await getTicketThread(ticketId);
            setThread(threadData);
            setClosureDialogOpen(false);
            toast({ title: closureType === 'completed' ? "Caso Finalizado con Éxito" : "Caso Cancelado" });
        }
        setIsReplying(false);
    };

    const handleDeleteTicket = async () => {
        if (!ticket || !hasPermission('tickets:delete')) return;
        setIsDeleting(true);
        try {
            await actions.deleteTicket(ticket.id);
            toast({ title: "Ticket Eliminado" });
            router.push('/dashboard/tickets');
        } catch {
            toast({ title: "Error", variant: "destructive" });
            setIsDeleting(false);
        }
    }
    
    if (!isAuthorized) return null;

    if (isInitialLoading) {
        return (
             <div className="flex h-[calc(100vh-4rem)]">
                <div className="w-full flex flex-col p-4"><Skeleton className="h-full w-full"/></div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Card className="p-10 text-center">
                    <CardTitle>Ticket no encontrado</CardTitle>
                    <Button className="mt-4" onClick={() => router.push('/dashboard/tickets')}>Volver a la lista</Button>
                </Card>
            </div>
        );
    }

    const selectedService = companyData?.servicesCatalog.find(s => s.id === ticket.serviceId);
    
    return (
        <div className="flex h-[calc(100vh-4rem)] bg-muted/40">
            <div className="flex-1 flex flex-col">
                <header className="p-4 border-b bg-background flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">{ticket.subject}</h1>
                        <p className="text-sm text-muted-foreground">Ticket #{ticket.consecutive}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {ticket.isBillable && <Badge variant="destructive" className="animate-pulse">FACTURABLE</Badge>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                {hasPermission('tickets:delete') && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Eliminar Ticket</DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                                <AlertDialogDescription>Esta acción es permanente.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteTicket} disabled={isDeleting}>
                                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                    Sí, eliminar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                 <ScrollArea className="flex-1 p-4">
                    <div className="space-y-6">
                        {thread.map(item => (
                            <div key={item.id} className={cn("flex items-start gap-4", item.userId ? "justify-end" : "")}>
                                {!item.userId && <Avatar><AvatarFallback>{getInitials(item.userName)}</AvatarFallback></Avatar>}
                                <div className={cn(
                                    "max-w-xl rounded-lg p-3 text-sm shadow-sm",
                                    item.userId ? "bg-primary text-primary-foreground" : "bg-card border",
                                    item.type === 'status_change' && "bg-amber-100 text-amber-900 w-full text-center italic border-amber-200"
                                )}>
                                    <p className="font-semibold">{item.userName}</p>
                                    <p className="whitespace-pre-wrap">{item.content}</p>
                                    <p className="text-[10px] mt-2 opacity-70 text-right">{format(parseISO(item.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                                </div>
                                {item.userId && <Avatar><AvatarFallback>{getInitials(item.userName)}</AvatarFallback></Avatar>}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t bg-background">
                    <div className="relative">
                        <Textarea
                            placeholder={hasPermission('tickets:reply') ? "Escribe una respuesta o nota..." : "No tienes permiso para responder tickets."}
                            className="pr-20"
                            rows={3}
                            value={replyContent}
                            onChange={e => setReplyContent(e.target.value)}
                            disabled={!hasPermission('tickets:reply') || ticket.status === 'completed' || ticket.status === 'canceled'}
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                             <Button type="button" size="icon" onClick={handleAddReply} disabled={isReplying || !hasPermission('tickets:reply') || ticket.status === 'completed' || ticket.status === 'canceled'}>
                                {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <aside className="hidden md:flex flex-col w-80 lg:w-96 border-l bg-background p-4 space-y-6 overflow-y-auto">
                {/* --- Time Tracking Integration --- */}
                {hasPermission('tickets:time-tracking') && (
                    <TimeTracker 
                        ticketId={ticket.id} 
                        defaultIsBillable={ticket.isBillable} 
                        ticketStatus={ticket.status} // Pass status to trigger internal refresh
                    />
                )}

                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Estado del Caso</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                         <div className="space-y-1.5">
                            <Label className="text-xs">Prioridad</Label>
                            <Select value={ticket.priority} onValueChange={(v: TicketPriority) => handleDetailUpdate({ priority: v })} disabled={!hasPermission('tickets:manage') || ticket.status === 'completed' || ticket.status === 'canceled'}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(selectors.priorityConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Flujo de Trabajo</Label>
                             <div className="grid grid-cols-1 gap-2 pt-1">
                                <Button 
                                    variant={ticket.status === 'open' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="justify-start h-8 text-xs"
                                    onClick={() => handleDetailUpdate({ status: 'open' })}
                                    disabled={ticket.status === 'completed' || ticket.status === 'canceled'}
                                >
                                    <Badge variant="outline" className="mr-2 h-2 w-2 p-0 rounded-full bg-slate-400" /> Abierto
                                </Button>
                                <Button 
                                    variant={ticket.status === 'in_progress' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="justify-start h-8 text-xs"
                                    onClick={() => handleDetailUpdate({ status: 'in_progress' })}
                                    disabled={ticket.status === 'completed' || ticket.status === 'canceled'}
                                >
                                    <PlayCircle className={cn("mr-2 h-4 w-4", ticket.status === 'in_progress' && "animate-pulse")} /> En Progreso
                                </Button>
                                <Button 
                                    variant={ticket.status === 'on_hold' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="justify-start h-8 text-xs"
                                    onClick={() => handleDetailUpdate({ status: 'on_hold' })}
                                    disabled={ticket.status === 'completed' || ticket.status === 'canceled'}
                                >
                                    <PauseCircle className="mr-2 h-4 w-4" /> En Espera
                                </Button>
                                <Button 
                                    variant={ticket.status === 'completed' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="justify-start h-8 text-xs border-green-600 text-green-700 hover:bg-green-50"
                                    onClick={() => handleDetailUpdate({ status: 'completed' })}
                                    disabled={ticket.status === 'completed' || ticket.status === 'canceled'}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar Caso
                                </Button>
                                <Button 
                                    variant={ticket.status === 'canceled' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="justify-start h-8 text-xs border-red-600 text-red-700 hover:bg-red-50"
                                    onClick={() => handleDetailUpdate({ status: 'canceled' })}
                                    disabled={ticket.status === 'completed' || ticket.status === 'canceled'}
                                >
                                    <XCircle className="mr-2 h-4 w-4" /> Anular / Cancelar
                                </Button>
                             </div>
                        </div>
                         <div className="space-y-1.5 pt-2">
                            <Label className="text-xs">Técnico Asignado</Label>
                            <Select value={String(ticket.assigneeId || 'null')} onValueChange={(v) => handleDetailUpdate({ assigneeId: v === 'null' ? null : Number(v) })} disabled={!hasPermission('tickets:manage') || ticket.status === 'completed' || ticket.status === 'canceled'}>
                                <SelectTrigger className="h-8"><SelectValue placeholder="Sin Asignar"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">Sin Asignar</SelectItem>
                                    {supportUsers.map(u => (<SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(ticket.isBillable ? "border-destructive bg-destructive/5" : "border-green-200 bg-green-50/30")}>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <CreditCard className="h-4 w-4" /> FACTURACIÓN Y COBERTURA
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="billable-switch" className="text-sm">Marcar como Facturable</Label>
                            <Switch 
                                id="billable-switch" 
                                checked={ticket.isBillable} 
                                onCheckedChange={(checked) => handleDetailUpdate({ isBillable: checked })}
                                disabled={!hasPermission('tickets:manage') || ticket.status === 'completed' || ticket.status === 'canceled'}
                            />
                        </div>
                        <div className="p-3 rounded-md border text-xs space-y-2">
                            <div className="flex items-center gap-2">
                                {ticket.isBillable ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-green-600" />}
                                <span className="font-bold">{ticket.isBillable ? 'Servicio Adicional (Con Costo)' : 'Cubierto por Contrato'}</span>
                            </div>
                            <p className="text-muted-foreground">Servicio: <strong>{selectedService?.name || 'General'}</strong></p>
                            {ticket.contractId && <p className="text-muted-foreground">Línea de Contrato: <strong>#{ticket.contractId}</strong></p>}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Truck className="h-4 w-4" /> PROVEEDOR EXTERNO
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                        <Select value={String(ticket.providerId || 'null')} onValueChange={(v) => handleDetailUpdate({ providerId: v === 'null' ? null : Number(v) })} disabled={!hasPermission('tickets:manage') || ticket.status === 'completed' || ticket.status === 'canceled'}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Sin proveedor externo"/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="null">Ninguno (Soporte Interno)</SelectItem>
                                {selectors.providers.map((p: ThirdPartyProvider) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Usa esta opción si el caso requiere derivarse a una marca o soporte de tercero.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-bold">CLIENTE</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 text-sm space-y-1">
                        <p className="font-bold">{ticket.customerName}</p>
                        {ticket.companyName && <p className="text-xs text-muted-foreground">{ticket.companyName}</p>}
                        <p className="text-xs text-muted-foreground mt-2">Creado: {format(parseISO(ticket.createdAt), 'dd/MM/yy HH:mm')}</p>
                    </CardContent>
                </Card>
            </aside>

            {/* --- Closure Dialog (Resolution/Cancellation) --- */}
            <Dialog open={isClosureDialogOpen} onOpenChange={setClosureDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {closureType === 'completed' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                            {closureType === 'completed' ? 'Finalizar Soporte Técnico' : 'Anulación de Caso'}
                        </DialogTitle>
                        <DialogDescription>
                            {closureType === 'completed' 
                                ? 'Por favor, detalla la solución aplicada para cerrar este caso satisfactoriamente.' 
                                : 'Indica el motivo por el cual este ticket debe ser cancelado.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="closure-content" className="text-xs font-bold mb-2 block uppercase">
                            {closureType === 'completed' ? 'Resolución de la Incidencia' : 'Motivo de Cancelación'}
                        </Label>
                        <Textarea 
                            id="closure-content" 
                            rows={5} 
                            placeholder="Escribe aquí los detalles..." 
                            value={closureContent}
                            onChange={e => setClosureContent(e.target.value)}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Atrás</Button></DialogClose>
                        <Button 
                            onClick={handleConfirmClosure} 
                            disabled={!closureContent.trim() || isReplying}
                            className={cn(closureType === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')}
                        >
                            {isReplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar y Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
