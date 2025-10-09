
/**
 * @fileoverview Custom hook `useTickets` for managing the state and logic of the Tickets page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { NewTicketPayload, Ticket, TicketPriority, TicketStatus, TicketThread, User, HelpTopic, TicketCustomer } from '@/modules/core/types';
import { saveTicket, getTickets, getTicketById as getTicketByIdServer, getTicketThread as getTicketThreadServer, addThreadEntry as addThreadEntryServer, updateTicketDetails as updateTicketDetailsServer, getHelpTopics, addTicketCustomer } from '../lib/actions';
import { useDebounce } from 'use-debounce';


const emptyTicket: NewTicketPayload = {
    subject: '',
    content: '',
    status: 'open',
    priority: 'medium',
    erpCustomerId: null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
};

const emptyCustomer: Omit<TicketCustomer, 'id' | 'createdAt' | 'notes'> = {
    name: '',
    email: '',
    phone: '',
};

const initialState = {
    isLoading: true,
    isSubmitting: false,
    isNewTicketDialogOpen: false,
    isNewCustomerDialogOpen: false,
    newTicket: emptyTicket,
    newCustomer: emptyCustomer,
    customerSearchTerm: '',
    isCustomerSearchOpen: false,
    tickets: [] as Ticket[],
    helpTopics: [] as HelpTopic[],
    searchTerm: '',
    statusFilter: 'all',
    priorityFilter: 'all',
    currentThread: [] as TicketThread[],
};

const priorityConfig: { [key in TicketPriority]: { label: string, variant: 'default' | 'secondary' | 'destructive' | 'outline' } } = {
    low: { label: "Baja", variant: "secondary" },
    medium: { label: "Media", variant: "default" },
    high: { label: "Alta", variant: "outline" },
    urgent: { label: "Urgente", variant: "destructive" }
};

const statusConfig: { [key in TicketStatus]: { label: string, color: string } } = {
    open: { label: "Abierto", color: "bg-green-500" },
    in_progress: { label: "En Progreso", color: "bg-blue-500" },
    on_hold: { label: "En Espera", color: "bg-yellow-500" },
    closed: { label: "Cerrado", color: "bg-gray-500" },
};

export const useTickets = () => {
    const { isAuthorized } = useAuthorization(['tickets:read:all']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, customers, companyData } = useAuth();

    const [state, setState] = useState(initialState);
    const [debouncedCustomerSearch] = useDebounce(state.customerSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 500);


    const updateState = (newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    };
    
    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [fetchedTickets, fetchedHelpTopics] = await Promise.all([
                getTickets(),
                getHelpTopics()
            ]);
            updateState({ tickets: fetchedTickets, helpTopics: fetchedHelpTopics });
        } catch (error) {
            logError("Failed to load tickets", { error: (error as Error).message });
            toast({ title: "Error", description: "No se pudieron cargar los tickets.", variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast]);
    
    useEffect(() => {
        setTitle("Soporte Técnico");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [setTitle, isAuthorized, loadInitialData]);
    
    const actions = {
        setNewTicketDialogOpen: (isOpen: boolean) => updateState({ isNewTicketDialogOpen: isOpen }),
        setNewCustomerDialogOpen: (isOpen: boolean) => updateState({ isNewCustomerDialogOpen: isOpen }),
        setCustomerSearchTerm: (term: string) => updateState({ customerSearchTerm: term }),
        setCustomerSearchOpen: (isOpen: boolean) => updateState({ isCustomerSearchOpen: isOpen }),
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setStatusFilter: (status: string) => updateState({ statusFilter: status }),
        setPriorityFilter: (priority: string) => updateState({ priorityFilter: priority }),
        
        clearFilters: () => updateState({ searchTerm: '', statusFilter: 'all', priorityFilter: 'all' }),

        handleNewTicketChange: (field: keyof NewTicketPayload, value: string | number | null) => {
            updateState({ newTicket: { ...state.newTicket, [field]: value } });
        },

        handleNewCustomerChange: (field: keyof typeof emptyCustomer, value: string) => {
            updateState({ newCustomer: { ...state.newCustomer, [field]: value } });
        },

        handleSelectCustomer: (customerId: string) => {
            updateState({ isCustomerSearchOpen: false });
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                updateState({
                    newTicket: {
                        ...state.newTicket,
                        erpCustomerId: customer.id,
                        customerName: customer.name,
                        customerEmail: customer.email || customer.electronicDocEmail,
                        customerPhone: customer.phone,
                    },
                    customerSearchTerm: `[${customer.id}] ${customer.name}`
                });
            } else {
                updateState({
                    newTicket: {
                        ...state.newTicket,
                        erpCustomerId: null,
                    },
                    customerSearchTerm: ''
                });
            }
        },
        
        handleCreateCustomer: async () => {
            if (!state.newCustomer.name || !state.newCustomer.email) {
                toast({ title: "Datos Incompletos", description: "El nombre y el correo electrónico son requeridos.", variant: "destructive" });
                return;
            }
            updateState({ isSubmitting: true });
            try {
                await addTicketCustomer(state.newCustomer);
                toast({ title: "Cliente Creado", description: "El nuevo cliente de soporte ha sido añadido." });
                updateState({ isNewCustomerDialogOpen: false, newCustomer: emptyCustomer });
            } catch (error: any) {
                logError("Failed to create ticket customer", { error: error.message });
                toast({ title: "Error", description: `No se pudo crear el cliente: ${error.message}`, variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        handleCreateTicket: async () => {
            if (!user || !state.newTicket.subject || !state.newTicket.content || !state.newTicket.customerName || !state.newTicket.customerEmail) {
                toast({ title: "Datos Incompletos", description: "El asunto, descripción y datos del cliente son requeridos.", variant: "destructive"});
                return;
            }

            updateState({ isSubmitting: true });
            try {
                const createdTicket = await saveTicket(state.newTicket, user);
                toast({ title: "Ticket Creado", description: `El ticket #${createdTicket.consecutive} ha sido creado.` });
                
                updateState({
                    isNewTicketDialogOpen: false,
                    newTicket: emptyTicket,
                    customerSearchTerm: '',
                    tickets: [createdTicket, ...state.tickets]
                });

            } catch (error: any) {
                logError("Failed to create ticket", { error: error.message });
                toast({ title: "Error", description: `No se pudo crear el ticket: ${error.message}`, variant: "destructive"});
            } finally {
                updateState({ isSubmitting: false });
            }
        },
        
        getTicketById: async (id: number) => {
            updateState({ isLoading: true });
            try {
                return await getTicketByIdServer(id);
            } catch (error) {
                 logError("Failed to get ticket by id", { error: (error as Error).message });
                 toast({ title: "Error", description: "No se pudo cargar el ticket.", variant: "destructive" });
                 return null;
            } finally {
                 updateState({ isLoading: false });
            }
        },

        getTicketThread: async (ticketId: number) => {
            updateState({ isLoading: true });
            try {
                const thread = await getTicketThreadServer(ticketId);
                updateState({ currentThread: thread });
                return thread;
            } catch (error) {
                logError("Failed to get ticket thread", { error: (error as Error).message });
                toast({ title: "Error", description: "No se pudo cargar la conversación.", variant: "destructive" });
                return [];
            } finally {
                updateState({ isLoading: false });
            }
        },
        
        addThreadEntry: async (payload: { ticketId: number; content: string; type?: 'message' | 'note' }) => {
            if (!user) return;
            updateState({ isSubmitting: true });
            try {
                const newEntry = await addThreadEntryServer({ ...payload, userId: user.id, userName: user.name, type: payload.type || 'message' });
                updateState({ currentThread: [...state.currentThread, newEntry] });
                return newEntry;
            } catch (error: any) {
                logError("Failed to add thread entry", { error: error.message });
                toast({ title: "Error al Responder", description: error.message, variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },
        
        updateTicketDetails: async (ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId'>>, user: User): Promise<Ticket | null> => {
            if (!user) return null;
            try {
                const updatedTicket = await updateTicketDetailsServer(ticketId, updates, user);
                // Also update thread immediately
                const thread = await getTicketThreadServer(ticketId);
                updateState({ 
                    tickets: state.tickets.map(t => t.id === ticketId ? updatedTicket : t),
                    currentThread: thread 
                });
                return updatedTicket;
            } catch (error: any) {
                logError("Failed to update ticket details", { error: error.message });
                toast({ title: "Error al Actualizar", description: error.message, variant: "destructive" });
                return null;
            }
        },
    };

    const selectors = {
        priorityConfig,
        statusConfig,
        customerOptions: useMemo(() => {
            if (debouncedCustomerSearch.length < 2) return [];
            const searchTerms = debouncedCustomerSearch.toLowerCase().split(' ').filter(Boolean);
            return customers.filter(c => {
                const targetText = `${c.id} ${c.name} ${c.taxId}`.toLowerCase();
                return searchTerms.every(term => targetText.includes(term));
            }).map(c => ({ value: c.id, label: `[${c.id}] ${c.name} (${c.taxId})` }));
        }, [customers, debouncedCustomerSearch]),
        filteredTickets: useMemo(() => {
            return state.tickets.filter(ticket => {
                const searchMatch = debouncedSearchTerm 
                    ? `${ticket.consecutive} ${ticket.subject} ${ticket.customerName}`.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                    : true;
                const statusMatch = state.statusFilter === 'all' || ticket.status === state.statusFilter;
                const priorityMatch = state.priorityFilter === 'all' || ticket.priority === state.priorityFilter;
                return searchMatch && statusMatch && priorityMatch;
            });
        }, [state.tickets, debouncedSearchTerm, state.statusFilter, state.priorityFilter])
    };
    
    return {
        state,
        actions,
        selectors
    };
};
