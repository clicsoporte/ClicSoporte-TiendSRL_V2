
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTickets } from '@/modules/tickets/hooks/useTickets';
import type { Ticket, TicketThread, TicketCustomer, TicketStatus, TicketPriority, User } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

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
    const { users: allUsers, user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [thread, setThread] = useState<TicketThread[]>([]);
    const [customerInfo, setCustomerInfo] = useState<TicketCustomer | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [isReplying, setIsReplying] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const supportUsers = useMemo(() => allUsers.filter(u => u.role === 'admin' || u.role === 'support-agent' || (u.role && selectors.isSupportRole(u.role))), [allUsers, selectors]);

    const loadData = useCallback(async () => {
        if (ticketId && isAuthorized) {
            const ticketData = await actions.getTicketById(ticketId);
            setTicket(ticketData);
            if (ticketData) {
                const threadData = await actions.getTicketThread(ticketId);
                setThread(threadData);
                if (ticketData.contactId) {
                    const contactData = await actions.getTicketCustomerById(ticketData.contactId);
                    setCustomerInfo(contactData);
                }
            }
        }
    }, [ticketId, isAuthorized, actions]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleAddReply = async () => {
        if (!replyContent.trim()) {
            toast({ title: "Error", description: "La respuesta no puede estar vacía.", variant: "destructive" });
            return;
        }
        setIsReplying(true);
        const newEntry = await actions.addThreadEntry({ ticketId, content: replyContent });
        if (newEntry) {
            setThread(prev => [...prev, newEntry]);
            setReplyContent("");
        }
        setIsReplying(false);
    };

    const handleDetailUpdate = async (updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId'>>) => {
        if (!currentUser || !hasPermission('tickets:update')) {
             toast({ title: "Acción no permitida", description: "No tienes permiso para actualizar este ticket.", variant: "destructive" });
            return;
        };
        const updatedTicket = await actions.updateTicketDetails(ticketId, updates, currentUser);
        if (updatedTicket) {
            setTicket(updatedTicket);
            await loadData();
        }
    };

    const handleDeleteTicket = async () => {
        if (!ticket) return;
        setIsDeleting(true);
        try {
            await actions.deleteTicket(ticket.id);
            toast({ title: "Ticket Eliminado", description: "El ticket ha sido eliminado exitosamente." });
            router.push('/dashboard/tickets');
        } catch (error) {
            toast({ title: "Error", description: "No se pudo eliminar el ticket.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    }
    
    if (!isAuthorized) return null;

    if (!ticket) {
        return (
             <div className="flex h-[calc(100vh-4rem)]">
                <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col p-4">
                    <Skeleton className="h-full w-full"/>
                </div>
                <div className="hidden md:block w-1/3 lg:w-1/4 p-4 border-l">
                    <Skeleton className="h-full w-full"/>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex h-[calc(100vh-4rem)] bg-muted/40">
            <div className="flex-1 flex flex-col">
                <header className="p-4 border-b bg-background flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">{ticket.subject}</h1>
                        <p className="text-sm text-muted-foreground">Ticket #{ticket.consecutive}</p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem disabled>Editar Ticket</DropdownMenuItem>
                            {hasPermission('tickets:update') && (
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
                </header>
                 <ScrollArea className="flex-1 p-4">
                    <div className="space-y-6">
                        {thread.map(item => (
                            <div key={item.id} className={cn(
                                "flex items-start gap-4",
                                item.userId ? "justify-end" : ""
                            )}>
                                {!item.userId && (
                                    <Avatar>
                                        <AvatarFallback>{getInitials(item.userName)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn(
                                    "max-w-xl rounded-lg p-3 text-sm",
                                    item.userId ? "bg-primary text-primary-foreground" : "bg-card",
                                    item.type === 'status_change' && "bg-yellow-100 text-yellow-800 w-full text-center italic"
                                )}>
                                    <p className="font-semibold">{item.userName}</p>
                                    <p className="whitespace-pre-wrap">{item.content}</p>
                                    <p className="text-xs mt-2 opacity-70 text-right">{format(parseISO(item.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                                </div>
                                {item.userId && (
                                     <Avatar>
                                        <AvatarFallback>{getInitials(item.userName)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t bg-background">
                    <div className="relative">
                        <Textarea
                            placeholder="Escribe tu respuesta..."
                            className="pr-20"
                            rows={3}
                            value={replyContent}
                            onChange={e => setReplyContent(e.target.value)}
                            disabled={!hasPermission('tickets:update')}
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                             <Button type="button" size="icon" onClick={handleAddReply} disabled={isReplying || !hasPermission('tickets:update')}>
                                {isReplying ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                                <span className="sr-only">Enviar</span>
                            </Button>
                             <Button type="button" size="icon" variant="ghost" disabled={!hasPermission('tickets:update')}>
                                <Paperclip className="h-4 w-4" />
                                <span className="sr-only">Adjuntar</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <aside className="hidden md:flex flex-col w-1/3 lg:w-1/4 border-l bg-background p-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Detalles del Ticket</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-4">
                         <div className="space-y-1.5">
                            <Label>Prioridad</Label>
                            <Select value={ticket.priority} onValueChange={(v) => handleDetailUpdate({ priority: v as TicketPriority })} disabled={!hasPermission('tickets:update')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(selectors.priorityConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Estado</Label>
                             <Select value={ticket.status} onValueChange={(v) => handleDetailUpdate({ status: v as TicketStatus })} disabled={!hasPermission('tickets:update')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                     {Object.entries(selectors.statusConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                             <div className="flex items-center gap-2">
                                                <span className={cn("h-2 w-2 rounded-full", config.color)}></span>
                                                <span>{config.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Creado</span>
                            <span>{format(parseISO(ticket.createdAt), 'dd/MM/yyyy')}</span>
                        </div>
                         <div className="space-y-1.5">
                            <Label>Asignado a</Label>
                            <Select value={String(ticket.assigneeId || 'null')} onValueChange={(v) => handleDetailUpdate({ assigneeId: v === 'null' ? null : Number(v) })} disabled={!hasPermission('tickets:update')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin Asignar"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">Sin Asignar</SelectItem>
                                    {supportUsers.map(u => (
                                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Información del Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                       <div className="flex justify-between">
                            <span className="text-muted-foreground">Nombre Contacto</span>
                            <span className="font-medium text-right">{ticket.customerName}</span>
                        </div>
                        {ticket.companyName && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Empresa</span>
                                <span className="font-medium text-right">{ticket.companyName}</span>
                            </div>
                        )}
                        {customerInfo && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Teléfono</span>
                                    <span>{customerInfo.phone}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Correo</span>
                                    <span className="truncate">{customerInfo.email}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </aside>
        </div>
    );
}
