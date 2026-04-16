'use client';

/**
 * @fileoverview Custom hook `useTickets` for managing the state and logic of the Tickets page.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { NewTicketPayload, Ticket, TicketPriority, TicketStatus, TicketThread, User, HelpTopic, Contract, ThirdPartyProvider, CustomerContact, License, SoftwareProduct, Role, Equipment } from '@/modules/core/types';
import {
    saveTicket, getTickets, getTicketById as getTicketByIdServer,
    getTicketThread as getTicketThreadServer,
    addThreadEntry as addThreadEntryServer,
    updateTicketDetails as updateTicketDetailsServer,
    getHelpTopics,
    deleteTicket,
    getThirdPartyProviders,
    getTicketPreference,
    saveTicketPreference,
    getLicensesByCustomer,
} from '../lib/actions';
import { getActiveContractForCustomer } from '@/modules/contracts/lib/actions';
import { getSoftwareProducts } from '@/modules/licenses/lib/actions';
import { getEquipmentByClient } from '@/modules/inventory/lib/actions';
import { useDebounce } from 'use-debounce';
import { checkPermissionInTree } from '@/modules/core/lib/permissions';

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
    licenseId: null,
    equipmentId: null,
    providerId: null,
};

const initialState = {
    isLoading: true,
    isSubmitting: false,
    isNewTicketDialogOpen: false,
    newTicket: emptyTicket,
    selectedCustomerId: null as string | null,
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
    customerLicenses: [] as License[],
    customerEquipment: [] as Equipment[],
    softwareProducts: [] as SoftwareProduct[],
    showOnlyMine: false,
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
    completed: { label: "Completado", color: "bg-green-600" },
    canceled: { label: "Cancelado", color: "bg-red-600" },
};

export const useTickets = () => {
    const { isAuthorized } = useAuthorization(['tickets:read:all']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData, users, customers, user, allRoles } = useAuth();

    const [state, setState] = useState(initialState);
    
    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const [debouncedCustomerSearch] = useDebounce(state.customerSearchTerm, companyData?.searchDebounceTime ?? 500);
    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 500);

    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [fetchedTickets, fetchedHelpTopics, fetchedProviders, fetchedSoftware] = await Promise.all([
                getTickets(),
                getHelpTopics(),
                getThirdPartyProviders(),
                getSoftwareProducts()
            ]);
            
            if (user) {
                const showOnlyMinePref = await getTicketPreference(user.id, 'showOnlyMine');
                updateState({ 
                    tickets: fetchedTickets, 
                    helpTopics: fetchedHelpTopics,
                    providers: fetchedProviders,
                    softwareProducts: fetchedSoftware,
                    showOnlyMine: !!showOnlyMinePref
                });
            } else {
                updateState({ 
                    tickets: fetchedTickets, 
                    helpTopics: fetchedHelpTopics,
                    providers: fetchedProviders,
                    softwareProducts: fetchedSoftware
                });
            }
        } catch (error) {
            logError("Failed to load tickets", { error: (error as Error).message });
            toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast, updateState, user]);

    useEffect(() => {
        setTitle("Soporte Técnico");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [setTitle, isAuthorized, loadInitialData]);

    const validateCoverage = useCallback((serviceId: string | null, contract: Contract | null, customerId: string | null) => {
        if (!serviceId) return { isBillable: false, message: 'Seleccione un servicio para validar cobertura.' };
        
        const service = companyData?.servicesCatalog.find(s => s.id === serviceId);
        const priceLabel = service ? ` (Tarifa: ¢${(service.price || 0).toLocaleString()} ${service.billingType === 'task' ? '/tarea' : '/hora'})` : '';

        if (contract) {
            if (contract.includedServices.includes(serviceId)) {
                return { isBillable: false, message: `Servicio cubierto por CONTRATO VIGENTE: ${contract.name}` };
            }
            if (contract.excludedServices.includes(serviceId)) {
                return { isBillable: true, message: `Servicio EXCLUIDO del contrato. Se generará cobro adicional${priceLabel}.` };
            }
        } else if (customerId) {
            return { isBillable: true, message: `¡ATENCIÓN! El cliente NO tiene contrato vigente. El servicio es de ALTO RIESGO FINANCIERO${priceLabel}.` };
        }

        if (customerId) {
            const customer = customers.find(c => c.id === customerId);
            if (customer?.supportPackageId) {
                const pkg = companyData?.supportPackages.find(p => p.id === customer.supportPackageId);
                if (pkg) {
                    if (pkg.includedServices.includes(serviceId)) {
                        return { isBillable: false, message: `Servicio cubierto por PLAN MENSUAL: ${pkg.name}` };
                    }
                    if (pkg.excludedServices.includes(serviceId)) {
                        return { isBillable: true, message: `Servicio NO INCLUIDO en el plan ${pkg.name}. Se generará cobro${priceLabel}.` };
                    }
                }
            }
        }

        return { isBillable: true, message: `Sin cobertura detectada. FACTURABLE${priceLabel}.` };
    }, [customers, companyData]);

    const handleNewTicketChange = useCallback((field: keyof NewTicketPayload, value: string | number | boolean | null) => {
        setState(prevState => {
            let updatedTicket = { ...prevState.newTicket, [field]: value };

            if (field === 'helpTopicId' && value) {
                const topic = prevState.helpTopics.find(t => t.id === value);
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
                const { isBillable } = validateCoverage(updatedTicket.serviceId, prevState.activeContract, prevState.selectedCustomerId);
                updatedTicket.isBillable = isBillable;
            }

            return { ...prevState, newTicket: updatedTicket };
        });
    }, [validateCoverage]);

    const handleSelectCompany = useCallback(async (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const [contract, licenses, equipment] = await Promise.all([
            getActiveContractForCustomer(customer.id),
            getLicensesByCustomer(customer.id),
            getEquipmentByClient(customer.id)
        ]);
        
        setState(prevState => {
            const { isBillable } = validateCoverage(prevState.newTicket.serviceId, contract, customer.id);
            return {
                ...prevState,
                selectedCustomerId: customer.id,
                newTicket: { 
                    ...prevState.newTicket, 
                    companyId: null,
                    companyName: customer.name, 
                    customerName: customer.name, 
                    customerEmail: customer.email || customer.electronicDocEmail,
                    contractId: contract?.id || null,
                    licenseId: null,
                    equipmentId: null,
                    isBillable
                },
                activeContract: contract,
                customerLicenses: licenses,
                customerEquipment: equipment,
                customerSearchTerm: customer.name,
                isCustomerSearchOpen: false,
            };
        });
    }, [customers, validateCoverage]);

    const actions = useMemo(() => ({
        setNewTicketDialogOpen: (isOpen: boolean) => updateState({ isNewTicketDialogOpen: isOpen }),
        setCustomerSearchTerm: (term: string) => updateState({ customerSearchTerm: term }),
        setCustomerSearchOpen: (isOpen: boolean) => updateState({ isCustomerSearchOpen: isOpen }),
        setSearchTerm: (term: string) => updateState({ searchTerm: term }),
        setStatusFilter: (status: string) => updateState({ statusFilter: status }),
        setPriorityFilter: (priority: string) => updateState({ priorityFilter: priority }),
        setShowOnlyMine: async (val: boolean) => {
            updateState({ showOnlyMine: val });
            if (user) {
                await saveTicketPreference(user.id, 'showOnlyMine', val);
            }
        },

        clearFilters: () => updateState({ searchTerm: '', statusFilter: 'all', priorityFilter: 'all' }),

        handleNewTicketChange,
        handleSelectCompany,

        handleSelectContact: (contact: CustomerContact) => {
            setState(prevState => ({
                ...prevState,
                newTicket: {
                    ...prevState.newTicket,
                    customerName: contact.name,
                    customerEmail: contact.email,
                    customerPhone: contact.whatsapp || contact.officePhone || prevState.newTicket.customerPhone
                }
            }));
        },

        handleCreateTicket: async () => {
            const usr = user; 
            if (!usr) return;
            
            let currentNewTicket: NewTicketPayload | null = null;
            setState(s => { currentNewTicket = s.newTicket; return s; });
            
            if (!currentNewTicket || !(currentNewTicket as NewTicketPayload).subject) {
                toast({ title: "Datos Incompletos", variant: "destructive" });
                return;
            }

            updateState({ isSubmitting: true });
            try {
                const createdTicket = await saveTicket(currentNewTicket as NewTicketPayload, usr);
                toast({ title: "Ticket Creado", description: `El ticket #${createdTicket.consecutive} ha sido creado.` });

                setState(prevState => ({
                    ...prevState,
                    isNewTicketDialogOpen: false,
                    newTicket: emptyTicket,
                    selectedCustomerId: null,
                    customerSearchTerm: '',
                    tickets: [createdTicket, ...prevState.tickets],
                    activeContract: null,
                    customerLicenses: [],
                    customerEquipment: [],
                    isSubmitting: false
                }));

            } catch (error: unknown) {
                logError("Failed to create ticket", { error: (error as Error).message });
                toast({ title: "Error", description: "No se pudo crear el ticket.", variant: "destructive" });
                updateState({ isSubmitting: false });
            }
        },

        getTicketById: async (id: number) => {
            try {
                return await getTicketByIdServer(id);
            } catch (error: unknown) {
                logError("Failed to get ticket", { error: (error as Error).message });
                return null;
            }
        },

        getTicketThread: async (ticketId: number) => {
            try {
                const thread = await getTicketThreadServer(ticketId);
                updateState({ currentThread: thread });
                return thread;
            } catch (error: unknown) {
                logError("Failed to get thread", { error: (error as Error).message });
                return [];
            }
        },

        addThreadEntry: async (payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' | 'status_change' }) => {
            updateState({ isSubmitting: true });
            try {
                const newEntry = await addThreadEntryServer(payload);
                setState(prev => ({ ...prev, currentThread: [...prev.currentThread, newEntry], isSubmitting: false }));
                return newEntry;
            } catch (error: unknown) {
                toast({ title: "Error al Responder", description: (error as Error).message, variant: "destructive" });
                updateState({ isSubmitting: false });
            }
        },

        updateTicketDetails: async (ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'isBillable' | 'providerId' | 'licenseId' | 'equipmentId'>>, u: User): Promise<Ticket | null> => {
            try {
                const updatedTicket = await updateTicketDetailsServer(ticketId, updates, u);
                const thread = await getTicketThreadServer(ticketId);
                setState(prev => ({
                    ...prev,
                    tickets: prev.tickets.map(t => t.id === ticketId ? updatedTicket : t),
                    currentThread: thread
                }));
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
            updateState({ newTicket: emptyTicket, selectedCustomerId: null, customerSearchTerm: '', activeContract: null, customerLicenses: [], customerEquipment: [] });
        }
    }), [updateState, toast, user, handleNewTicketChange, handleSelectCompany]);

    const selectors = useMemo(() => ({
        priorityConfig,
        statusConfig,
        supportUsers: users.filter(u => {
            const role = (allRoles || []).find((r: Role) => r.id === u.role);
            if (!role) return false;
            return checkPermissionInTree(role.permissions, 'tickets:read:all');
        }),
        customerOptions: debouncedCustomerSearch.length < 2 ? [] : customers.filter(c =>
            c.name.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) ||
            (c.commercialName || "").toLowerCase().includes(debouncedCustomerSearch.toLowerCase()) ||
            c.id.toLowerCase().includes(debouncedCustomerSearch.toLowerCase())
        ).map(c => ({ value: c.id, label: `${c.name} (${c.id})` })),
        filteredTickets: state.tickets.filter(ticket => {
            const searchMatch = debouncedSearchTerm
                ? `${ticket.consecutive} ${ticket.subject} ${ticket.customerName}`.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                : true;
            const statusMatch = state.statusFilter === 'all' || ticket.status === state.statusFilter;
            const priorityMatch = state.priorityFilter === 'all' || ticket.priority === state.priorityFilter;
            const assigneeMatch = !state.showOnlyMine || ticket.assigneeId === user?.id;
            return searchMatch && statusMatch && priorityMatch && assigneeMatch;
        }),
        coverageMessage: validateCoverage(state.newTicket.serviceId, state.activeContract, state.selectedCustomerId).message,
        providers: state.providers,
        softwareProducts: state.softwareProducts
    }), [users, customers, debouncedCustomerSearch, debouncedSearchTerm, state.tickets, state.statusFilter, state.priorityFilter, state.showOnlyMine, state.newTicket.serviceId, state.activeContract, state.selectedCustomerId, state.providers, state.softwareProducts, validateCoverage, user, allRoles]);

    return {
        state,
        actions,
        selectors
    };
};
