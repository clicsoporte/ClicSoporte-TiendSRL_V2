/**
 * @fileoverview Custom hook `useTickets` for managing the state and logic of the Tickets page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { NewTicketPayload, Ticket, TicketPriority, TicketStatus, TicketThread, User, HelpTopic, Contract, ThirdPartyProvider } from '@/modules/core/types';
import {
    saveTicket, getTickets, getTicketById as getTicketByIdServer,
    getTicketThread as getTicketThreadServer,
    addThreadEntry as addThreadEntryServer,
    updateTicketDetails as updateTicketDetailsServer,
    getHelpTopics,
    deleteTicket,
    getThirdPartyProviders,
} from '../lib/actions';
import { getActiveContractForCustomer } from '@/modules/contracts/lib/actions';
import { useDebounce } from 'use-debounce';

const emptyTicket: NewTicketPayload = {
    subject: '',
    content: '',
    status: 'open',
    priority: 'medium',
    companyId: null,
    serviceId: null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    companyName: '',
    isBillable: false,
    contractId: null,
    providerId: null,
};

const initialState = {
    isLoading: true,
    isSubmitting: false,
    isNewTicketDialogOpen: false,
    newTicket: emptyTicket,
    customerSearchTerm: '',
    isCustomerSearchOpen: false,
    tickets: [] as Ticket[],
    helpTopics: [] as HelpTopic[],
    searchTerm: '',
    statusFilter: 'all',
    priorityFilter: 'all',
    currentThread: [] as TicketThread[],
    activeContract: null as Contract | null,
    providers: [] as ThirdPartyProvider[],
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
    const { companyData, users, customers } = useAuth();

    const [state, setState] = useState(initialState);
    
    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const [debouncedCustomerSearch] = useDebounce(state.customerSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 500);

    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [fetchedTickets, fetchedHelpTopics, fetchedProviders] = await Promise.all([
                getTickets(),
                getHelpTopics(),
                getThirdPartyProviders()
            ]);
            updateState({ 
                tickets: fetchedTickets, 
                helpTopics: fetchedHelpTopics,
                providers: fetchedProviders
            });
        } catch (error) {
            logError("Failed to load tickets", { error: (error as Error).message });
            toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);

    useEffect(() => {
        setTitle("Soporte Técnico");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [setTitle, isAuthorized, loadInitialData]);

    const validateCoverage = useCallback((serviceId: string | null, contract: Contract | null) => {
        if (!serviceId) return { isBillable: false, message: 'Seleccione un servicio' };
        if (!contract) return { isBillable: true, message: 'El cliente NO TIENE un contrato activo. El servicio será FACTURABLE.' };

        if (contract.includedServices.includes(serviceId)) {
            return { isBillable: false, message: `Servicio cubierto por el contrato: ${contract.name}` };
        }
        if (contract.excludedServices.includes(serviceId)) {
            return { isBillable: true, message: `Servicio EXCLUIDO del contrato. Será FACTURABLE por separado.` };
        }
        return { isBillable: true, message: 'Servicio no especificado en el contrato. Por defecto será FACTURABLE.' };
    }, []);

    const actions = {
        setNewTicketDialogOpen: (isOpen: boolean) => updateState({ isNewTicketDialogOpen: isOpen }),
        setCustomerSearchTerm: (term: string) => updateState({ customerSearchTerm: term }),
        setCustomerSearchOpen: (isOpen: boolean) => updateState({ isCustomerSearchOpen: isOpen }),
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setStatusFilter: (status: string) => updateState({ statusFilter: status }),
        setPriorityFilter: (priority: string) => updateState({ priorityFilter: priority }),

        clearFilters: () => updateState({ searchTerm: '', statusFilter: 'all', priorityFilter: 'all' }),

        handleNewTicketChange: (field: keyof NewTicketPayload, value: string | number | boolean | null) => {
            let updatedTicket = { ...state.newTicket, [field]: value };

            if (field === 'helpTopicId' && value) {
                const topic = state.helpTopics.find(t => t.id === value);
                if (topic) {
                    updatedTicket = {
                        ...updatedTicket,
                        helpTopicId: topic.id,
                        priority: topic.defaultPriority || updatedTicket.priority,
                        assigneeId: topic.defaultAssigneeId !== undefined ? topic.defaultAssigneeId : updatedTicket.assigneeId,
                        serviceId: topic.defaultServiceId || updatedTicket.serviceId
                    };
                }
            }

            if (field === 'serviceId' || field === 'helpTopicId') {
                const { isBillable } = validateCoverage(updatedTicket.serviceId, state.activeContract);
                updatedTicket.isBillable = isBillable;
            }

            updateState({ newTicket: updatedTicket });
        },

        handleSelectCompany: async (customerId: string) => {
            const customer = customers.find(c => c.id === customerId);
            if (!customer) return;

            const contract = await getActiveContractForCustomer(customer.id);
            const { isBillable } = validateCoverage(state.newTicket.serviceId, contract);

            updateState({
                newTicket: { 
                    ...state.newTicket, 
                    companyId: null,
                    companyName: customer.name, 
                    customerName: customer.name, 
                    customerEmail: customer.email || customer.electronicDocEmail,
                    contractId: contract?.id || null,
                    isBillable
                },
                activeContract: contract,
                customerSearchTerm: customer.name,
                isCustomerSearchOpen: false,
            });
        },

        handleCreateTicket: async () => {
            const user = users[0]; 
            if (!user || !state.newTicket.subject || !state.newTicket.content || !state.newTicket.customerName || !state.newTicket.customerEmail || !state.newTicket.serviceId) {
                toast({ title: "Datos Incompletos", description: "Asunto, descripción, servicio y cliente son obligatorios.", variant: "destructive" });
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
                    tickets: [createdTicket, ...state.tickets],
                    activeContract: null
                });

            } catch (error: unknown) {
                logError("Failed to create ticket", { error: (error as Error).message });
                toast({ title: "Error", description: "No se pudo crear el ticket.", variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        getTicketById: async (id: number) => {
            updateState({ isLoading: true });
            try {
                return await getTicketByIdServer(id);
            } catch (error: unknown) {
                logError("Failed to get ticket", { error: (error as Error).message });
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
            } catch (error: unknown) {
                logError("Failed to get thread", { error: (error as Error).message });
                return [];
            } finally {
                updateState({ isLoading: false });
            }
        },

        addThreadEntry: async (payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' | 'status_change' }) => {
            updateState({ isSubmitting: true });
            try {
                const newEntry = await addThreadEntryServer(payload);
                updateState({ currentThread: [...state.currentThread, newEntry] });
                return newEntry;
            } catch (error: unknown) {
                toast({ title: "Error al Responder", description: (error as Error).message, variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        updateTicketDetails: async (ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'isBillable' | 'providerId'>>, user: User): Promise<Ticket | null> => {
            try {
                const updatedTicket = await updateTicketDetailsServer(ticketId, updates, user);
                const thread = await getTicketThreadServer(ticketId);
                updateState({
                    tickets: state.tickets.map(t => t.id === ticketId ? updatedTicket : t),
                    currentThread: thread
                });
                return updatedTicket;
            } catch (error: unknown) {
                logError("Failed to update ticket", { error: (error as Error).message });
                return null;
            }
        },

        deleteTicket: async (id: number): Promise<void> => {
            return deleteTicket(id);
        },

        resetNewTicketForm: () => {
            updateState({ newTicket: emptyTicket, customerSearchTerm: '', activeContract: null });
        }
    };

    const selectors = {
        priorityConfig,
        statusConfig,
        supportUsers: useMemo(() => users.filter(u => u.role === 'admin' || u.role === 'support-agent'), [users]),
        customerOptions: useMemo(() => {
            if (debouncedCustomerSearch.length < 2) return [];
            return customers.filter(c =>
                c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) ||
                c.id.toLowerCase().includes(debouncedCustomerSearch.toLowerCase())
            ).map(c => ({ value: c.id, label: `${c.name} (${c.id})` }));
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
        }, [state.tickets, debouncedSearchTerm, state.statusFilter, state.priorityFilter]),
        coverageMessage: useMemo(() => {
            const { message } = validateCoverage(state.newTicket.serviceId, state.activeContract);
            return message;
        }, [state.newTicket.serviceId, state.activeContract, validateCoverage])
    };

    return {
        state,
        actions,
        selectors
    };
};