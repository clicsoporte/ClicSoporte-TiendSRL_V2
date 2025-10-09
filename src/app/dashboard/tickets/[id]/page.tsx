
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTickets } from '@/modules/tickets/hooks/useTickets';
import type { Ticket, TicketThread, Customer } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, UserCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
};

export default function TicketDetailPage() {
    const params = useParams();
    const ticketId = Number(params.id);
    const { actions, selectors } = useTickets();
    const { customers, users } = useAuth();
    
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [thread, setThread] = useState<TicketThread[]>([]);
    const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);

    useEffect(() => {
        if (ticketId) {
            const loadData = async () => {
                const ticketData = await actions.getTicketById(ticketId);
                setTicket(ticketData);
                if (ticketData) {
                    const threadData = await actions.getTicketThread(ticketId);
                    setThread(threadData);
                    if (ticketData.erpCustomerId) {
                        const erpCustomer = customers.find(c => c.id === ticketData.erpCustomerId);
                        if (erpCustomer) setCustomerInfo(erpCustomer);
                    }
                }
            };
            loadData();
        }
    }, [ticketId, actions, customers]);
    
    if (!ticket) {
        return (
             <div className="flex h-full">
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
                <header className="p-4 border-b bg-background">
                    <h1 className="text-xl font-bold">{ticket.subject}</h1>
                    <p className="text-sm text-muted-foreground">Ticket #{ticket.consecutive}</p>
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
                                    item.userId ? "bg-primary text-primary-foreground" : "bg-card"
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
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                             <Button type="submit" size="icon">
                                <Send className="h-4 w-4" />
                                <span className="sr-only">Enviar</span>
                            </Button>
                             <Button type="button" size="icon" variant="ghost">
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
                    <CardContent className="text-sm space-y-3">
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Prioridad</span>
                            <Badge variant={selectors.priorityConfig[ticket.priority]?.variant as any}>
                                {selectors.priorityConfig[ticket.priority]?.label || ticket.priority}
                            </Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Estado</span>
                             <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", selectors.statusConfig[ticket.status]?.color)}></span>
                                <span>{selectors.statusConfig[ticket.status]?.label || ticket.status}</span>
                            </div>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Creado</span>
                            <span>{format(parseISO(ticket.createdAt), 'dd/MM/yyyy')}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Asignado a</span>
                            <span>{users.find(u => u.id === ticket.assigneeId)?.name || 'Sin Asignar'}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Información del Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                       <div className="flex justify-between">
                            <span className="text-muted-foreground">Nombre</span>
                            <span className="font-medium text-right">{ticket.customerName}</span>
                        </div>
                        {customerInfo && (
                            <>
                                 <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cédula</span>
                                    <span>{customerInfo.taxId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Teléfono</span>
                                    <span>{customerInfo.phone}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Correo</span>
                                    <span className="truncate">{customerInfo.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Vendedor</span>
                                    <span>{customerInfo.salesperson}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </aside>
        </div>
    );
}
