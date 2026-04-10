/**
 * @fileoverview Client-side component for Support Tickets.
 */
'use client';

import { useTickets } from "@/modules/tickets/hooks/useTickets";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { FilePlus, Loader2, FilterX, ShieldCheck, ShieldAlert, Clock, Info, EyeOff, MapPin, Zap, UserCircle, Mail, MessageCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import Link from "next/link";
import { useAuth } from "@/modules/core/hooks/useAuth";
import type { Ticket, CustomerContact } from '@/modules/core/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useMemo } from "react";

export default function TicketsClient() {
    const { state, actions, selectors } = useTickets();
    const { hasPermission } = useAuthorization(['tickets:admin:settings', 'view:provider:costs']);
    const canViewCosts = hasPermission('view:provider:costs');
    const router = useRouter();
    const { companyData, customers, users } = useAuth();
    
    const {
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
        providers,
        selectedCustomerId,
        showOnlyMine
    } = state;

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const customerContacts = selectedCustomer?.contacts || [];
    const isCustomerBlocked = selectedCustomer?.isBlocked || false;

    // Intelligence: Provider rate matching with Margin, VAT and Travel Logic
    const providerRateInfo = useMemo(() => {
        if (!newTicket.providerId || !newTicket.serviceId) return null;
        const provider = providers.find(p => p.id === Number(newTicket.providerId));
        if (!provider) return null;

        const serviceDefinition = companyData?.servicesCatalog.find(s => s.id === newTicket.serviceId);
        const serviceRate = provider.services?.find(s => s.serviceId === newTicket.serviceId);
        const billingType = serviceDefinition?.billingType || 'hour';
        const unitSuffix = billingType === 'task' ? 'Tarea' : 'Hora';
        
        // Find travel rate matching customer location
        let travelRate = null;
        if (selectedCustomerId) {
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer && provider.geoRates) {
                // Priority: District match -> Canton match -> Province match
                travelRate = provider.geoRates.find(g => 
                    g.provinceId === customer.provinceId && 
                    g.cantonId === customer.cantonId && 
                    g.districtId === customer.districtId
                ) || provider.geoRates.find(g => 
                    g.provinceId === customer.provinceId && 
                    g.cantonId === customer.cantonId && 
                    !g.districtId
                ) || provider.geoRates.find(g => 
                    g.provinceId === customer.provinceId && 
                    !g.cantonId
                );
            }
        }

        if (!serviceRate && !travelRate) return null;

        return {
            providerName: provider.name,
            billingType,
            unitSuffix,
            service: serviceRate ? {
                remote: { buy: serviceRate.buyPriceRemote, margin: serviceRate.marginRemote, sell: serviceRate.sellPriceRemote },
                onSite: { buy: serviceRate.buyPriceOnSite, margin: serviceRate.marginOnSite, sell: serviceRate.sellPriceOnSite }
            } : null,
            travel: travelRate ? {
                buy: travelRate.buyTravelPrice,
                margin: travelRate.marginTravel,
                sell: travelRate.sellTravelPrice,
                location: travelRate.locationName
            } : null
        };
    }, [newTicket.providerId, newTicket.serviceId, providers, selectedCustomerId, customers, companyData]);

    const formatDuration = (ms: number | undefined) => {
        if (!ms) return "00:00";
        const totalMinutes = Math.floor(ms / 60000);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const renderTicketRow = (ticket: Ticket) => {
        const { priorityConfig, statusConfig } = selectors;
        const assignee = users.find(u => u.id === ticket.assigneeId);

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
                    <Badge variant={priorityConfig[ticket.priority]?.variant}>
                        {priorityConfig[ticket.priority]?.label || ticket.priority}
                    </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={cn("h-2 w-2 rounded-full", statusConfig[ticket.status]?.color)}></span>
                        <span className="font-medium">{statusConfig[ticket.status]?.label || ticket.status}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2 text-xs font-mono">
                        {ticket.hasActiveTimer && <Clock className="h-3 w-3 text-green-600 animate-pulse" />}
                        <span className={cn(ticket.hasActiveTimer ? "text-green-600 font-bold" : "text-muted-foreground")}>
                            {formatDuration(ticket.totalDuration)}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(parseISO(ticket.createdAt), 'dd/MM/yy HH:mm')}</TableCell>
                <TableCell>
                    {assignee ? (
                        <div className="flex items-center gap-2">
                            <UserCircle className="h-3.5 w-3.5 text-primary/70" />
                            <span className="text-xs font-medium">{assignee.name}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-muted-foreground italic">Sin asignar</span>
                    )}
                </TableCell>
            </TableRow>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold">Mesa de Ayuda</h1>
                <div className="flex gap-2">
                     {hasPermission('tickets:admin:settings') && (
                        <Button variant="outline" asChild size="sm">
                            <Link href="/dashboard/admin/tickets">
                                <FilePlus className="mr-2 h-4 w-4" /> Configuración
                            </Link>
                        </Button>
                    )}
                    <Dialog open={isNewTicketDialogOpen} onOpenChange={(open) => { actions.setNewTicketDialogOpen(open); if(!open) actions.resetNewTicketForm(); }}>
                        <DialogTrigger asChild>
                            <Button size="sm"><FilePlus className="mr-2 h-4 w-4" /> Nuevo Ticket</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
                            <form onSubmit={(e) => { e.preventDefault(); actions.handleCreateTicket(); }} className="flex flex-col flex-1 h-full">
                                <DialogHeader className="p-6 pb-4 border-b">
                                    <DialogTitle>Abrir Nuevo Caso de Soporte</DialogTitle>
                                    <DialogDescription>Valida la cobertura del contrato antes de proceder.</DialogDescription>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                                    {isCustomerBlocked && (
                                        <Alert variant="destructive" className="mb-6 border-2 shadow-md">
                                            <ShieldAlert className="h-5 w-5" />
                                            <AlertTitle className="font-black uppercase tracking-wider">¡CLIENTE BLOQUEADO!</AlertTitle>
                                            <AlertDescription className="text-sm font-bold">
                                                Este cliente tiene un bloqueo administrativo. Motivo: {selectedCustomer?.blockedReason || 'Sin razón especificada.'}
                                                <br />
                                                <span className="uppercase text-[10px] mt-2 block">No se permite la apertura de nuevos tickets para este cliente.</span>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 pr-2">
                                        <div className="md:col-span-2 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Tema de Ayuda</Label>
                                                    <Select value={String(newTicket.helpTopicId || '')} onValueChange={(v) => actions.handleNewTicketChange('helpTopicId', Number(v))} required disabled={isCustomerBlocked}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Seleccione un tema..."/></SelectTrigger>
                                                        <SelectContent>{helpTopics.map(topic => (<SelectItem key={topic.id} value={String(topic.id)}>{topic.name}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                    <div className="space-y-2">
                                                    <Label className="text-xs">Servicio Requerido</Label>
                                                    <Select value={newTicket.serviceId || "none"} onValueChange={(v) => actions.handleNewTicketChange('serviceId', v === 'none' ? null : v)} required disabled={isCustomerBlocked}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Seleccione un servicio..."/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Ninguno</SelectItem>
                                                            {companyData?.servicesCatalog.map(service => (<SelectItem key={service.id} value={service.id}>{service.name} ({service.billingType === 'task' ? 'Tarea' : 'Hora'})</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {selectors.coverageMessage && !isCustomerBlocked && (
                                                <Alert variant={newTicket.isBillable ? 'destructive' : 'default'} className="py-2">
                                                    {newTicket.isBillable ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                                    <AlertTitle className="text-xs font-bold">{newTicket.isBillable ? 'FUERA DE CONTRATO' : 'INCLUIDO EN CONTRATO'}</AlertTitle>
                                                    <AlertDescription className="text-[10px]">{selectors.coverageMessage}</AlertDescription>
                                                </Alert>
                                            )}

                                            <div className="space-y-2">
                                                <Label className="text-xs">Asunto</Label>
                                                <Input id="new-ticket-subject" value={newTicket.subject} onChange={(e) => actions.handleNewTicketChange('subject', e.target.value)} required className="h-8" disabled={isCustomerBlocked} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Descripción Detallada</Label>
                                                <Textarea id="new-ticket-content" rows={6} value={newTicket.content} onChange={(e) => actions.handleNewTicketChange('content', e.target.value)} required disabled={isCustomerBlocked} />
                                            </div>
                                        </div>
                                        <div className="md:col-span-1 space-y-4 md:border-l md:pl-6">
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
                                            
                                            {activeContract && !isCustomerBlocked && (
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
                                                        disabled={isCustomerBlocked}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Proveedor Externo (Opcional)</Label>
                                                    <Select value={String(newTicket.providerId || 'null')} onValueChange={(v) => actions.handleNewTicketChange('providerId', v === 'null' ? null : Number(v))} disabled={isCustomerBlocked}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Servicio Interno"/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="null">Ninguno</SelectItem>
                                                            {providers.map(p => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {providerRateInfo && !isCustomerBlocked && (
                                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1"><Info className="h-3 w-3"/> Tarifas Sugeridas</p>
                                                        <Badge variant="outline" className="text-[8px] h-4 uppercase">
                                                            {providerRateInfo.billingType === 'task' ? <Zap className="h-2 w-2 mr-1"/> : <Clock className="h-2 w-2 mr-1"/>}
                                                            {providerRateInfo.billingType === 'task' ? 'Tarea' : 'Hora'}
                                                        </Badge>
                                                    </div>
                                                    
                                                    {providerRateInfo.service && (
                                                        <div className="space-y-2">
                                                            <div className="flex flex-col border-b border-blue-100 pb-2">
                                                                <span className="text-[9px] text-muted-foreground uppercase font-bold">Labor Remota (Por {providerRateInfo.unitSuffix})</span>
                                                                <div className="flex justify-between items-end">
                                                                    <span className="text-xs font-black text-blue-900">¢{providerRateInfo.service.remote.sell.toLocaleString()}</span>
                                                                    {canViewCosts && (
                                                                        <div className="text-[9px] text-blue-600/70 italic flex items-center gap-1">
                                                                            <EyeOff className="h-2 w-2" />
                                                                            ¢{providerRateInfo.service.remote.buy.toLocaleString()} (+{providerRateInfo.service.remote.margin}%)
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] text-muted-foreground uppercase font-bold">Labor en Sitio (Por {providerRateInfo.unitSuffix})</span>
                                                                <div className="flex justify-between items-end">
                                                                    <span className="text-xs font-black text-blue-900">¢{providerRateInfo.service.onSite.sell.toLocaleString()}</span>
                                                                    {canViewCosts && (
                                                                        <div className="text-[9px] text-blue-600/70 italic flex items-center gap-1">
                                                                            <EyeOff className="h-2 w-2" />
                                                                            ¢{providerRateInfo.service.onSite.buy.toLocaleString()} (+{providerRateInfo.service.onSite.margin}%)
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {providerRateInfo.travel && (
                                                        <div className="pt-2 border-t border-blue-200">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] text-orange-600 uppercase font-bold flex items-center gap-1">
                                                                    <MapPin className="h-2 w-2"/> Viático: {providerRateInfo.travel.location}
                                                                </span>
                                                                <div className="flex justify-between items-end">
                                                                    <span className="text-xs font-black text-orange-900">¢{providerRateInfo.travel.sell.toLocaleString()}</span>
                                                                    {canViewCosts && (
                                                                        <div className="text-[9px] text-orange-600/70 italic flex items-center gap-1">
                                                                            <EyeOff className="h-2 w-2" />
                                                                            ¢{providerRateInfo.travel.buy.toLocaleString()} (+{providerRateInfo.travel.margin}%)
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="pt-4 space-y-2 border-t mt-4">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Label className="text-xs">Contacto del Cliente</Label>
                                                    {customerContacts.length > 0 && (
                                                        <Badge variant="outline" className="text-[9px] h-4">
                                                            <UserCircle className="h-2 w-2 mr-1"/> {customerContacts.length} registrados
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                {customerContacts.length > 0 && (
                                                    <Select 
                                                        disabled={isCustomerBlocked}
                                                        onValueChange={(val) => {
                                                            const contact = customerContacts.find(c => c.id === val);
                                                            if (contact) actions.handleSelectContact(contact);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs bg-muted/30">
                                                            <SelectValue placeholder="Seleccionar contacto..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {customerContacts.map((contact: CustomerContact) => (
                                                                <SelectItem key={contact.id} value={contact.id} className="text-xs">
                                                                    {contact.name} ({contact.department || 'Gral'})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}

                                                <Input id="new-ticket-customer-name" value={newTicket.customerName} onChange={(e) => actions.handleNewTicketChange('customerName', e.target.value)} required placeholder="Nombre" className="h-8 text-xs" disabled={isCustomerBlocked} />
                                                <Input id="new-ticket-customer-email" type="email" value={newTicket.customerEmail} onChange={(e) => actions.handleNewTicketChange('customerEmail', e.target.value)} required placeholder="Email" className="h-8 text-xs" disabled={isCustomerBlocked} />
                                                
                                                <div className="flex flex-wrap gap-3 pt-1">
                                                    {newTicket.customerEmail && (
                                                        <a 
                                                            href={`mailto:${newTicket.customerEmail}`} 
                                                            className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                                                        >
                                                            <Mail className="h-3 w-3" /> Enviar Correo
                                                        </a>
                                                    )}
                                                    {newTicket.customerPhone && (
                                                        <a 
                                                            href={`https://wa.me/${newTicket.customerPhone.replace(/\D/g, '')}?text=Hola%20quiero%20hacer%20una%20consulta`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] text-green-600 hover:underline flex items-center gap-1 font-bold"
                                                        >
                                                            <MessageCircle className="h-3 w-3" /> WhatsApp
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="p-6 border-t bg-muted/10">
                                    <DialogClose asChild><Button type="button" variant="ghost" size="sm">Cancelar</Button></DialogClose>
                                    <Button type="submit" disabled={isSubmitting || isCustomerBlocked} size="sm" className={cn(isCustomerBlocked && "bg-muted text-muted-foreground cursor-not-allowed")}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                        {isCustomerBlocked ? 'CLIENTE BLOQUEADO' : 'Abrir Ticket'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-primary/5 border-primary/20"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Casos Abiertos</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold">{state.tickets.filter(t=>t.status !== 'completed' && t.status !== 'canceled').length}</CardContent></Card>
                <Card className="bg-destructive/5 border-destructive/20"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Facturables (Extras)</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-destructive">{state.tickets.filter(t=>t.isBillable && t.status !== 'completed' && t.status !== 'canceled').length}</CardContent></Card>
                <Card className="bg-amber-50 border-amber-200"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">En Progreso</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold text-amber-600">{state.tickets.filter(t=>t.status === 'in_progress').length}</CardContent></Card>
                <Card><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Total Tickets</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-bold">{state.tickets.length}</CardContent></Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <Input placeholder="Buscar por Nº ticket, asunto o cliente..." value={searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="max-w-sm h-9" />
                        <Select value={statusFilter} onValueChange={actions.setStatusFilter}><SelectTrigger className="w-full md:w-[180px] h-9"><SelectValue placeholder="Estado"/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Estados</SelectItem>{Object.entries(selectors.statusConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}</SelectContent></Select>
                        <Select value={priorityFilter} onValueChange={actions.setPriorityFilter}><SelectTrigger className="w-full md:w-[180px] h-9"><SelectValue placeholder="Prioridad"/></SelectTrigger><SelectContent><SelectItem value="all">Todas las Prioridades</SelectItem>{Object.entries(selectors.priorityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}</SelectContent></Select>
                        
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-md border border-dashed border-primary/20">
                            <Checkbox 
                                id="show-only-mine" 
                                checked={showOnlyMine} 
                                onCheckedChange={(checked) => actions.setShowOnlyMine(!!checked)} 
                            />
                            <Label htmlFor="show-only-mine" className="text-xs whitespace-nowrap cursor-pointer font-bold text-primary/80">Solo mis tickets</Label>
                        </div>

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
                                    <TableHead className="w-[100px]">Tiempo</TableHead>
                                    <TableHead className="hidden md:table-cell w-[150px]">Fecha</TableHead>
                                    <TableHead>Técnico Asignado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectors.filteredTickets.length > 0 ? (
                                    selectors.filteredTickets.map(renderTicketRow)
                                ) : (
                                    <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">No se encontraron casos con los filtros actuales.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
