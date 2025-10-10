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
import type { NewTicketPayload, Ticket, TicketPriority, TicketStatus, TicketThread, User, HelpTopic, ClientCompany, Service, SupportPackage, Customer } from '@/modules/core/types';
import {
    saveTicket, getTickets, getTicketById as getTicketByIdServer,
    getTicketThread as getTicketThreadServer,
    addThreadEntry as addThreadEntryServer,
    updateTicketDetails as updateTicketDetailsServer,
    getHelpTopics, addClientCompany,
    deleteTicket,
    getCustomerSupportInfo,
} from '../lib/actions';
import { getClientCompanies } from '../lib/db';
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
};

const emptyCustomer: Omit<ClientCompany, 'id' | 'createdAt'> = {
    name: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
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
    clientCompanies: [] as ClientCompany[],
    customerSupportInfo: null as { customer: Customer | ClientCompany | null, supportPackage: SupportPackage | null, services: Service[] } | null,
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
    const { user, companyData, users, customers } = useAuth();

    const [state, setState] = useState(initialState);
    const [debouncedCustomerSearch] = useDebounce(state.customerSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 500);


    const updateState = (newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    };

    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [fetchedTickets, fetchedHelpTopics, fetchedClientCompanies] = await Promise.all([
                getTickets(),
                getHelpTopics(),
                getClientCompanies()
            ]);
            updateState({ tickets: fetchedTickets, helpTopics: fetchedHelpTopics, clientCompanies: fetchedClientCompanies });
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
            if (field === 'helpTopicId' && value) {
                const topic = state.helpTopics.find(t => t.id === value);
                if (topic) {
                    updateState({
                        newTicket: {
                            ...state.newTicket,
                            helpTopicId: topic.id,
                            priority: topic.defaultPriority || state.newTicket.priority,
                            assigneeId: topic.defaultAssigneeId !== undefined ? topic.defaultAssigneeId : state.newTicket.assigneeId,
                            serviceId: topic.defaultServiceId || state.newTicket.serviceId
                        }
                    });
                    return;
                }
            }
            updateState({ newTicket: { ...state.newTicket, [field]: value } });
        },

        handleNewCustomerChange: (field: keyof typeof emptyCustomer, value: string) => {
            updateState({ newCustomer: { ...state.newCustomer, [field]: value } });
        },

        handleSelectCompany: async (entityIdentifier: string) => {
            const [type, id] = entityIdentifier.split('-');
            const entityId = type === 'manual' ? parseInt(id, 10) : id;

            let companyName = '';
            let customerName = '';
            let customerEmail = '';
            let companyId: number | null = null;
            let supportInfoCustomer: Customer | ClientCompany | null = null;

            if (type === 'manual') {
                const clientCompany = state.clientCompanies.find(c => c.id === entityId);
                if (clientCompany) {
                    companyName = clientCompany.name;
                    customerName = clientCompany.name;
                    customerEmail = clientCompany.email;
                    companyId = clientCompany.id;
                    supportInfoCustomer = clientCompany;
                }
            } else if (type === 'erp') {
                const erpCustomer = customers.find(c => c.id === entityId);
                if (erpCustomer) {
                    companyName = erpCustomer.name;
                    customerName = erpCustomer.name;
                    customerEmail = erpCustomer.email || erpCustomer.electronicDocEmail;
                    supportInfoCustomer = erpCustomer;
                }
            }

            updateState({
                newTicket: { ...state.newTicket, companyId, companyName, customerName, customerEmail },
                customerSearchTerm: companyName,
                isCustomerSearchOpen: false,
            });
            
            if (supportInfoCustomer) {
                const supportInfo = await getCustomerSupportInfo(supportInfoCustomer.id);
                updateState({ customerSupportInfo: supportInfo });
            } else {
                updateState({ customerSupportInfo: null });
            }
        },

        handleCreateCustomer: async () => {
            if (!state.newCustomer.name || !state.newCustomer.taxId) {
                toast({ title: "Datos Incompletos", description: "El nombre y la cédula jurídica son requeridos.", variant: "destructive" });
                return;
            }
            updateState({ isSubmitting: true });
            try {
                const newCompany = await addClientCompany(state.newCustomer);
                toast({ title: "Empresa Creada", description: "La nueva empresa cliente ha sido añadida." });
                updateState({ isNewCustomerDialogOpen: false, newCustomer: emptyCustomer, clientCompanies: [...state.clientCompanies, newCompany] });
            } catch (error: any) {
                logError("Failed to create ticket customer", { error: (error as Error).message });
                toast({ title: "Error", description: `No se pudo crear el cliente: ${error.message}`, variant: "destructive" });
            } finally {
                updateState({ isSubmitting: false });
            }
        },

        handleCreateTicket: async () => {
            if (!user || !state.newTicket.subject || !state.newTicket.content || !state.newTicket.customerName || !state.newTicket.customerEmail || !state.newTicket.serviceId) {
                toast({ title: "Datos Incompletos", description: "Asunto, descripción, servicio y datos del cliente son requeridos.", variant: "destructive" });
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
                logError("Failed to create ticket", { error: (error as Error).message });
                toast({ title: "Error", description: `No se pudo crear el ticket: ${error.message}`, variant: "destructive" });
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
                logError("Failed to add thread entry", { error: (error as Error).message });
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
                logError("Failed to update ticket details", { error: (error as Error).message });
                toast({ title: "Error al Actualizar", description: error.message, variant: "destructive" });
                return null;
            }
        },

        deleteTicket: async (id: number): Promise<void> => {
            return deleteTicket(id);
        },

        resetNewTicketForm: () => {
            updateState({ newTicket: emptyTicket, customerSearchTerm: '', customerSupportInfo: null });
        },

        loadCustomerSupportInfo: async (id: number | string) => {
            try {
                const info = await getCustomerSupportInfo(id);
                updateState({ customerSupportInfo: info });
            } catch (error: any) {
                logError("Failed to load customer support info", { error: error.message });
                updateState({ customerSupportInfo: null });
            }
        }
    };

    const selectors = {
        priorityConfig,
        statusConfig,
        supportUsers: useMemo(() => {
            if (!users) return [];
            return users.filter(u => u.role === 'admin' || u.role === 'support-agent');
        }, [users]),
        clientCompanyOptions: useMemo(() => {
            if (debouncedCustomerSearch.length < 2) return [];

            const clientCompanyResults = state.clientCompanies.filter(c =>
                c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) ||
                c.taxId.includes(debouncedCustomerSearch)
            ).map(c => ({ value: `manual-${c.id}`, label: `${c.name} (${c.taxId})` }));

            const erpCustomerResults = customers.filter(c =>
                c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) ||
                c.taxId.includes(debouncedCustomerSearch)
            ).map(c => ({ value: `erp-${c.id}`, label: `[ERP] ${c.name} (${c.taxId})` }));

            return [...clientCompanyResults, ...erpCustomerResults];
        }, [state.clientCompanies, customers, debouncedCustomerSearch]),
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
