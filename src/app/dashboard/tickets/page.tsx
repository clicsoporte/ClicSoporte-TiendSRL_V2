/**
 * @fileoverview Support tickets management page with contract validation.
 */
'use client';

import { useTickets } from "@/modules/tickets/hooks/useTickets";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { FilePlus, Loader2, FilterX, Users, AlertCircle, ShieldCheck, ShieldAlert, BadgeAlert } from "lucide-react";
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
import type { TicketPriority, Ticket } from '@/modules/core/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

export default function TicketsPage() {
    const { state, actions, selectors } = useTickets();
    const { hasPermission } = useAuthorization(['tickets:read:all', 'tickets:admin:settings']);
    const router = useRouter();
    const { companyData } = useAuth();
    
    const {
        isLoading,
        isNewTicketDialogOpen,
        newTicket,
        isSubmitting,
        customerSearchTerm,
        isCustomerSearchOpen,
        helpTopics,
        searchTerm,
        statusFilter,
        priorityFilter,
        activeContract,
        providers
    } = state;

    const renderTicketRow = (ticket: Ticket) => {
        const { priorityConfig, statusConfig } = selectors;
        return (
            <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                <TableCell className="font-mono font-bold text-xs">{ticket.consecutive}</TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <span>{ticket.subject}</span>
                        {ticket.isBillable && <Badge variant="destructive" className="text-[10px] h-4 px-1">FACTURABLE</Badge>}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{ticket.customerName}</span>
                        {ticket.companyName && <span className="text-[10px] text-muted-foreground">{ticket.companyName}</span>}
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant={priorityConfig[ticket.priority]?.variant as "default" | "secondary" | "destructive" | "outline"}>
                        {priorityConfig[ticket.priority]?.label || ticket.priority}
                    </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={cn("h-2 w-2 rounded-full", statusConfig[ticket.status]?.color)}></span>
                        <span className="font-medium">{statusConfig[ticket.status]?.label || ticket.status}</span>
                    </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(parseISO(ticket.createdAt), 'dd/MM/yy HH:mm')}</TableCell>
            </TableRow>
        );
    }
    
    if (isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6"><Skeleton className="h-8 w-64"/><Skeleton className="h-10 w-32"/></div>
                 <Card><CardHeader><Skeleton className="h-8 w-48"/><Skeleton className="h-4 w-80 mt-2"/></CardHeader><CardContent className="space-y-4 pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
             </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold">Mesa de Ayuda</h1>
                <div className="flex gap-2">
                     {hasPermission('tickets:admin:settings') && (
                        <Button variant="outline" asChild size="sm">
                            <Link href="/dashboard/admin/tickets">
                                <Users className="mr-2 h-4 w-4" /> Configuración
                            </Link>
                        </Button>
                    )}
                    {hasPermission('tickets:create') && (
                         <Dialog open={isNewTicketDialogOpen} onOpenChange={(open) => { actions.setNewTicketDialogOpen(open); if(!open) actions.resetNewTicketForm(); }}>
                            <DialogTrigger asChild>
                                <Button size="sm"><FilePlus className="mr-2 h-4 w-4" /> Nuevo Ticket</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-5xl" onPointerDownOutside={(e) => e.preventDefault()}>
                                <form onSubmit={(e) => { e.preventDefault(); actions.handleCreateTicket(); }}>
                                    <DialogHeader>
                                        <DialogTitle>Abrir Nuevo Caso de Soporte</DialogTitle>
                                        <DialogDescription>Valida la cobertura del contrato antes de proceder.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                                        <div className="md:col-span-2 space-y-4">
                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Tema de Ayuda</Label>
                                                    <Select value={String(newTicket.helpTopicId || '')} onValueChange={(v) => actions.handleNewTicketChange('helpTopicId', Number(v))} required>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Seleccione un tema..."/></SelectTrigger>
                                                        <SelectContent>{helpTopics.map(topic => (<SelectItem key={topic.id} value={String(topic.id)}>{topic.name}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                 <div className="space-y-2">
                                                    <Label className="text-xs">Servicio Requerido</Label>
                                                    <Select value={newTicket.serviceId || "none"} onValueChange={(v) => actions.handleNewTicketChange('serviceId', v === 'none' ? null : v)} required>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Seleccione un servicio..."/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Ninguno</SelectItem>
                                                            {companyData?.servicesCatalog.map(service => (<SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {selectors.coverageMessage && (
                                                <Alert variant={newTicket.isBillable ? 'destructive' : 'default'} className="py-2">
                                                    {newTicket.isBillable ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                                    <AlertTitle className="text-xs font-bold">{newTicket.isBillable ? 'FUERA DE CONTRATO' : 'INCLUIDO EN CONTRATO'}</AlertTitle>
                                                    <AlertDescription className="text-[10px]">{selectors.coverageMessage}</AlertDescription>
                                                </Alert>
                                            )}

                                            <div className="space-y-2">
                                                <Label className="text-xs">Asunto</Label>
                                                <Input id="new-ticket-subject" value={newTicket.subject} onChange={(e) => actions.handleNewTicketChange('subject', e.target.value)} required className="h-8" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Descripción Detallada</Label>
                                                <Textarea id="new-ticket-content" rows={6} value={newTicket.content} onChange={(e) => actions.handleNewTicketChange('content', e.target.value)} required />
                                            </div>
                                        </div>
                                        <div className="md:col-span-1 space-y-4 border-l pl-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Empresa Cliente</Label>
                                                <SearchInput
                                                    options={selectors.customerOptions}
                                                    onSelect={actions.handleSelectCompany}
                                                    value={customerSearchTerm}
                                                    onValueChange={actions.setCustomerSearchTerm}
                                                    placeholder="Buscar cliente..."
                                                    open={isCustomerSearchOpen}
                                                    onOpenChange={actions.setCustomerSearchOpen}
                                                />
                                            </div>
                                            
                                            {activeContract && (
                                                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-1">
                                                    <p className="text-[10px] font-bold text-primary uppercase">Contrato Activo</p>
                                                    <p className="text-xs font-bold">{activeContract.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">Vence: {format(parseISO(activeContract.endDate), 'dd/MM/yyyy')}</p>
                                                </div>
                                            )}

                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs">¿Facturable aparte?</Label>
                                                    <Switch 
                                                        checked={newTicket.isBillable} 
                                                        onCheckedChange={(checked) => actions.handleNewTicketChange('isBillable', checked)} 
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Proveedor Externo (Opcional)</Label>
                                                    <Select value={String(newTicket.providerId || 'null')} onValueChange={(v) => actions.handleNewTicketChange('providerId', v === 'null' ? null : Number(v))}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Servicio Interno"/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="null">Ninguno</SelectItem>
                                                            {providers.map(p => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="pt-4 space-y-2 border-t mt-4">
                                                <Label className="text-xs">Contacto del Cliente</Label>
                                                <Input id="new-ticket-customer-name" value={newTicket.customerName} onChange={(e) => actions.handleNewTicketChange('customerName', e.target.value)} required placeholder="Nombre" className="h-8 text-xs" />
                                                <Input id="new-ticket-customer-email" type="email" value={newTicket.customerEmail} onChange={(e) => actions.handleNewTicketChange('customerEmail', e.target.value)} required placeholder="Email" className="h-8 text-xs" />
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter className="border-t pt-4">
                                        <DialogClose asChild><Button type="button" variant="ghost" size="sm">Cancelar</Button></DialogClose>
                                        <Button type="submit" disabled={isSubmitting} size="sm">
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                            Abrir Ticket
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-primary/5 border-primary/20"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Casos Abiertos</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold">{state.tickets.filter(t=>t.status !== 'closed').length}</CardContent></Card>
                <Card className="bg-destructive/5 border-destructive/20"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Facturables (Extras)</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-destructive">{state.tickets.filter(t=>t.isBillable && t.status !== 'closed').length}</CardContent></Card>
                <Card className="bg-amber-50 border-amber-200"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">En Progreso</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-amber-600">{state.tickets.filter(t=>t.status === 'in_progress').length}</CardContent></Card>
                <Card><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Total Tickets</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold">{state.tickets.length}</CardContent></Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4">
                        <Input placeholder="Buscar por Nº ticket, asunto o cliente..." value={searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="max-w-sm h-9" />
                        <Select value={statusFilter} onValueChange={actions.setStatusFilter}><SelectTrigger className="w-full md:w-[180px] h-9"><SelectValue placeholder="Estado"/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Estados</SelectItem>{Object.entries(selectors.statusConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}</SelectContent></Select>
                        <Select value={priorityFilter} onValueChange={actions.setPriorityFilter}><SelectTrigger className="w-full md:w-[180px] h-9"><SelectValue placeholder="Prioridad"/></SelectTrigger><SelectContent><SelectItem value="all">Todas las Prioridades</SelectItem>{Object.entries(selectors.priorityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}</SelectContent></Select>
                        <Button variant="ghost" size="sm" onClick={actions.clearFilters} className="h-9"><FilterX className="mr-2 h-4 w-4"/>Limpiar</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[100px]">ID</TableHead>
                                    <TableHead>Descripción del Caso</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="w-[120px]">Prioridad</TableHead>
                                    <TableHead className="w-[120px]">Estado</TableHead>
                                    <TableHead className="hidden md:table-cell w-[150px]">Fecha</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectors.filteredTickets.length > 0 ? (
                                    selectors.filteredTickets.map(renderTicketRow)
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">No se encontraron casos con los filtros actuales.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
