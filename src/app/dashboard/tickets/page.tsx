'use client';

import { useTickets } from "@/modules/tickets/hooks/useTickets";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { FilePlus, Loader2, FilterX, UserPlus, Paperclip, Users, AlertCircle } from "lucide-react";
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
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import Link from "next/link";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { useDropzone } from 'react-dropzone';
import { useMemo } from 'react';
import type { TicketPriority, Customer, ClientCompany } from '@/modules/core/types';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TicketsPage() {
    const { state, actions, selectors } = useTickets();
    const { hasPermission } = useAuthorization(['tickets:read:all', 'tickets:admin:settings']);
    const router = useRouter();
    const { companyData } = useAuth();
    
    const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
        // Placeholder for future file handling logic
    });

    const {
        isLoading,
        isNewTicketDialogOpen,
        isNewCustomerDialogOpen,
        newTicket,
        newCustomer,
        isSubmitting,
        customerSearchTerm,
        isCustomerSearchOpen,
        tickets,
        helpTopics,
        searchTerm,
        statusFilter,
        priorityFilter,
        customerSupportInfo
    } = state;
    
    const serviceCoverage = useMemo(() => {
        if (!customerSupportInfo || !newTicket.serviceId) {
            return { covered: true, message: '' }; // Default to covered if no info
        }
        
        const { supportPackage, services } = customerSupportInfo;
        const selectedService = services.find(s => s.id === newTicket.serviceId);

        if (!supportPackage || !selectedService) {
            return { covered: false, message: 'Servicio no definido en un paquete. Se cobrará por separado.' };
        }

        if (supportPackage.includedServices.includes(selectedService.id)) {
            return { covered: true, message: `Servicio "${selectedService.name}" INCLUIDO en el paquete ${supportPackage.name}.` };
        }
        if (supportPackage.excludedServices.includes(selectedService.id)) {
            return { covered: false, message: `Servicio "${selectedService.name}" EXCLUIDO del paquete ${supportPackage.name}. Se cobrará por separado.` };
        }
        
        return { covered: false, message: 'Servicio no especificado en el paquete. Se cobrará por separado.' };
    }, [customerSupportInfo, newTicket.serviceId]);

    const renderTicketRow = (ticket: typeof tickets[0]) => {
        const { priorityConfig, statusConfig } = selectors;
        return (
            <TableRow key={ticket.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                <TableCell className="font-medium">{ticket.consecutive}</TableCell>
                <TableCell>{ticket.subject}</TableCell>
                <TableCell>
                    <div className="flex flex-col">
                        <span className="font-medium">{ticket.customerName}</span>
                        {ticket.companyName && <span className="text-xs text-muted-foreground">{ticket.companyName}</span>}
                    </div>
                </TableCell>
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
            <div className="flex items-center justify-between mb-6 gap-2">
                <h1 className="text-2xl font-bold">Gestión de Tickets de Soporte</h1>
                <div className="flex gap-2">
                     {hasPermission('tickets:admin:settings') && (
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/admin/tickets">
                                <Users className="mr-2 h-4 w-4" />
                                Configuración
                            </Link>
                        </Button>
                    )}
                    {hasPermission('tickets:create') && (
                         <Dialog open={isNewTicketDialogOpen} onOpenChange={(open) => { actions.setNewTicketDialogOpen(open); if(!open) actions.resetNewTicketForm(); }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <FilePlus className="mr-2 h-4 w-4" />
                                    Nuevo Ticket
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-4xl" onPointerDownOutside={(e) => e.preventDefault()}>
                                <form onSubmit={(e) => { e.preventDefault(); actions.handleCreateTicket(); }}>
                                    <DialogHeader>
                                        <DialogTitle>Crear Nuevo Ticket de Soporte</DialogTitle>
                                        <DialogDescription>
                                            Describe el problema. Busca un contacto o cliente del ERP para asociar el ticket.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                                        <div className="md:col-span-2 space-y-4">
                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="new-ticket-topic">Tema de Ayuda</Label>
                                                    <Select value={String(newTicket.helpTopicId || '')} onValueChange={(v) => actions.handleNewTicketChange('helpTopicId', Number(v))} required>
                                                        <SelectTrigger id="new-ticket-topic"><SelectValue placeholder="Seleccione un tema..."/></SelectTrigger>
                                                        <SelectContent>
                                                            {helpTopics.map(topic => (
                                                                <SelectItem key={topic.id} value={String(topic.id)}>{topic.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                 <div className="space-y-2">
                                                    <Label htmlFor="new-ticket-priority">Prioridad</Label>
                                                    <Select value={newTicket.priority} onValueChange={(v) => actions.handleNewTicketChange('priority', v as TicketPriority)}>
                                                        <SelectTrigger id="new-ticket-priority"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(selectors.priorityConfig).map(([key, config]) => (
                                                                <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="new-ticket-service">Servicio Requerido</Label>
                                                <Select value={newTicket.serviceId || "none"} onValueChange={(v) => actions.handleNewTicketChange('serviceId', v === 'none' ? null : v)} required>
                                                    <SelectTrigger id="new-ticket-service"><SelectValue placeholder="Seleccione un servicio..."/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Ninguno</SelectItem>
                                                        {companyData?.servicesCatalog.map(service => (
                                                            <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {serviceCoverage.message && (
                                                <Alert variant={serviceCoverage.covered ? 'default' : 'destructive'} className="text-xs">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertDescription>{serviceCoverage.message}</AlertDescription>
                                                </Alert>
                                            )}

                                            <div className="space-y-2">
                                                <Label htmlFor="new-ticket-subject">Asunto</Label>
                                                <Input
                                                    id="new-ticket-subject"
                                                    value={newTicket.subject}
                                                    onChange={(e) => actions.handleNewTicketChange('subject', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-ticket-content">Descripción del Problema</Label>
                                                <Textarea
                                                    id="new-ticket-content"
                                                    rows={8}
                                                    value={newTicket.content}
                                                    onChange={(e) => actions.handleNewTicketChange('content', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary">
                                                <input {...getInputProps()} />
                                                <p>Arrastra archivos aquí o haz clic para seleccionarlos</p>
                                                {acceptedFiles.length > 0 && <p className="text-sm mt-2">{acceptedFiles.map(f => f.name).join(', ')}</p>}
                                            </div>
                                        </div>
                                        <div className="md:col-span-1 space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="customer-search">Empresa Cliente</Label>
                                                <SearchInput
                                                    options={selectors.clientCompanyOptions}
                                                    onSelect={actions.handleSelectCompany}
                                                    value={customerSearchTerm}
                                                    onValueChange={actions.setCustomerSearchTerm}
                                                    placeholder="Buscar por nombre o cédula..."
                                                    open={isCustomerSearchOpen}
                                                    onOpenChange={actions.setCustomerSearchOpen}
                                                />
                                            </div>
                                            {customerSupportInfo && customerSupportInfo.customer && (
                                                <Card className="bg-muted/50">
                                                    <CardHeader className="p-3"><CardTitle className="text-base">Plan de Soporte</CardTitle></CardHeader>
                                                    <CardContent className="p-3 pt-0 text-sm space-y-1">
                                                        <p><strong>Paquete:</strong> {customerSupportInfo.supportPackage?.name || 'No Asignado'}</p>
                                                        <p><strong>Horas Restantes:</strong> {(customerSupportInfo.customer as Customer)?.monthlyHoursBalance?.toFixed(2) || 'N/A'}</p>
                                                    </CardContent>
                                                </Card>
                                            )}
                                            <div className="space-y-2">
                                                <Label htmlFor="new-ticket-customer-name">Nombre del Contacto</Label>
                                                <Input id="new-ticket-customer-name" value={newTicket.customerName} onChange={(e) => actions.handleNewTicketChange('customerName', e.target.value)} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-ticket-customer-email">Email del Contacto</Label>
                                                <Input id="new-ticket-customer-email" type="email" value={newTicket.customerEmail} onChange={(e) => actions.handleNewTicketChange('customerEmail', e.target.value)} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-ticket-assignee">Asignar a</Label>
                                                <Select value={String(newTicket.assigneeId || 'null')} onValueChange={(v) => actions.handleNewTicketChange('assigneeId', v === 'null' ? null : Number(v))}>
                                                    <SelectTrigger id="new-ticket-assignee"><SelectValue placeholder="Automático (por tema)"/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="null">Automático (por tema)</SelectItem>
                                                        {selectors.supportUsers.map(u => (
                                                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-ticket-due-date">Fecha de Vencimiento (Opcional)</Label>
                                                <Input id="new-ticket-due-date" type="date" value={newTicket.dueDate || ''} onChange={(e) => actions.handleNewTicketChange('dueDate', e.target.value)} />
                                            </div>
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
                    )}
                </div>
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
