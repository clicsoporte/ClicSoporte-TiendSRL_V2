
'use client';

import { useTickets } from "@/modules/tickets/hooks/useTickets";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { FilePlus, Loader2, FilterX } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function TicketsPage() {
    const { state, actions, selectors } = useTickets();
    const router = useRouter();

    const {
        isLoading,
        isNewTicketDialogOpen,
        newTicket,
        isSubmitting,
        customerSearchTerm,
        isCustomerSearchOpen,
        tickets,
        searchTerm,
        statusFilter,
        priorityFilter,
    } = state;

    const renderTicketRow = (ticket: typeof tickets[0]) => {
        const { priorityConfig, statusConfig } = selectors;
        return (
            <TableRow key={ticket.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                <TableCell className="font-medium">{ticket.consecutive}</TableCell>
                <TableCell>{ticket.subject}</TableCell>
                <TableCell>{ticket.customerName}</TableCell>
                <TableCell>
                    <Badge variant={priorityConfig[ticket.priority]?.variant as any}>
                        {priorityConfig[ticket.priority]?.label || ticket.priority}
                    </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", statusConfig[ticket.status]?.color)}></span>
                        <span>{statusConfig[ticket.status]?.label || ticket.status}</span>
                    </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{format(parseISO(ticket.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
            </TableRow>
        );
    }
    
    if (isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                    <Skeleton className="h-8 w-64"/>
                    <Skeleton className="h-10 w-32"/>
                </div>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-48"/>
                        <Skeleton className="h-4 w-80 mt-2"/>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex gap-4">
                            <Skeleton className="h-10 flex-grow max-w-sm"/>
                            <Skeleton className="h-10 w-40"/>
                            <Skeleton className="h-10 w-40"/>
                        </div>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                 </Card>
             </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Gestión de Tickets de Soporte</h1>
                 <Dialog open={isNewTicketDialogOpen} onOpenChange={actions.setNewTicketDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <FilePlus className="mr-2 h-4 w-4" />
                            Nuevo Ticket
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl">
                        <form onSubmit={(e) => { e.preventDefault(); actions.handleCreateTicket(); }}>
                            <DialogHeader>
                                <DialogTitle>Crear Nuevo Ticket de Soporte</DialogTitle>
                                <DialogDescription>
                                    Describe el problema. Busca un cliente del ERP o ingresa los datos de un nuevo contacto.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customer-search">Buscar Cliente (ERP)</Label>
                                    <SearchInput
                                        options={selectors.customerOptions}
                                        onSelect={actions.handleSelectCustomer}
                                        value={customerSearchTerm}
                                        onValueChange={actions.setCustomerSearchTerm}
                                        placeholder="Buscar por código, nombre o cédula..."
                                        open={isCustomerSearchOpen}
                                        onOpenChange={actions.setCustomerSearchOpen}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-ticket-name">Nombre del Contacto</Label>
                                    <Input
                                        id="new-ticket-name"
                                        value={newTicket.customerName}
                                        onChange={(e) => actions.handleNewTicketChange('customerName', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-ticket-email">Correo Electrónico</Label>
                                    <Input
                                        id="new-ticket-email"
                                        type="email"
                                        value={newTicket.customerEmail}
                                        onChange={(e) => actions.handleNewTicketChange('customerEmail', e.target.value)}
                                        required
                                    />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="new-ticket-phone">Teléfono</Label>
                                    <Input
                                        id="new-ticket-phone"
                                        value={newTicket.customerPhone || ''}
                                        onChange={(e) => actions.handleNewTicketChange('customerPhone', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 col-span-1 md:col-span-2">
                                    <Label htmlFor="new-ticket-subject">Asunto</Label>
                                    <Input
                                        id="new-ticket-subject"
                                        value={newTicket.subject}
                                        onChange={(e) => actions.handleNewTicketChange('subject', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 col-span-1 md:col-span-2">
                                    <Label htmlFor="new-ticket-content">Descripción del Problema</Label>
                                    <Textarea
                                        id="new-ticket-content"
                                        rows={6}
                                        value={newTicket.content}
                                        onChange={(e) => actions.handleNewTicketChange('content', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                    Crear Ticket
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Bandeja de Entrada</CardTitle>
                    <CardDescription>
                       Aquí se mostrarán todos los tickets de soporte.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <Input 
                            placeholder="Buscar por Nº ticket, asunto o cliente..."
                            value={searchTerm}
                            onChange={(e) => actions.setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={statusFilter} onValueChange={actions.setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Estados</SelectItem>
                                {Object.entries(selectors.statusConfig).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={priorityFilter} onValueChange={actions.setPriorityFilter}>
                            <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Prioridades</SelectItem>
                                {Object.entries(selectors.priorityConfig).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" onClick={actions.clearFilters}><FilterX className="mr-2 h-4 w-4"/>Limpiar</Button>
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ticket</TableHead>
                                    <TableHead>Asunto</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Prioridad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden md:table-cell">Creado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectors.filteredTickets.length > 0 ? (
                                    selectors.filteredTickets.map(renderTicketRow)
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No se encontraron tickets con los filtros actuales.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
