
'use client';

import { useTickets } from "@/modules/tickets/hooks/useTickets";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { FilePlus, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";

export default function TicketsPage() {
    const { state, actions, selectors } = useTickets();

    const {
        isNewTicketDialogOpen,
        newTicket,
        isSubmitting,
        customerSearchTerm,
        isCustomerSearchOpen,
    } = state;

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
                <CardContent>
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <h2 className="text-xl font-semibold">Próximamente...</h2>
                        <p className="text-muted-foreground mt-2">
                            La lista de tickets y las funcionalidades de gestión se implementarán aquí.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
