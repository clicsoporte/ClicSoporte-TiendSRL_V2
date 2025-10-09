
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
import type { NewTicketPayload } from '@/modules/core/types';
import { saveTicket } from '../lib/actions';
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

const initialState = {
    isLoading: true,
    isSubmitting: false,
    isNewTicketDialogOpen: false,
    newTicket: emptyTicket,
    customerSearchTerm: '',
    isCustomerSearchOpen: false,
};

export const useTickets = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['dashboard:access']); // Basic permission for now
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, customers, companyData } = useAuth();

    const [state, setState] = useState(initialState);
    const [debouncedCustomerSearch] = useDebounce(state.customerSearchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = (newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    };
    
    useEffect(() => {
        setTitle("Soporte Técnico");
        if (isAuthorized) {
            // Placeholder to load initial data in the future
            // loadInitialData();
            updateState({ isLoading: false });
        }
    }, [setTitle, isAuthorized]);
    
    const actions = {
        setNewTicketDialogOpen: (isOpen: boolean) => updateState({ isNewTicketDialogOpen: isOpen }),
        setCustomerSearchTerm: (term: string) => updateState({ customerSearchTerm: term }),
        setCustomerSearchOpen: (isOpen: boolean) => updateState({ isCustomerSearchOpen: isOpen }),
        
        handleNewTicketChange: (field: keyof NewTicketPayload, value: string | number | null) => {
            updateState({ newTicket: { ...state.newTicket, [field]: value } });
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
                // Clear fields if the search is cleared
                 updateState({
                    newTicket: {
                        ...state.newTicket,
                        erpCustomerId: null,
                        customerName: '',
                        customerEmail: '',
                        customerPhone: '',
                    },
                    customerSearchTerm: ''
                });
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
                
                // Reset form and close dialog
                updateState({
                    isNewTicketDialogOpen: false,
                    newTicket: emptyTicket,
                    customerSearchTerm: '',
                });

                // In the future, we'll add the new ticket to the local state
                // updateState({ tickets: [createdTicket, ...state.tickets] });

            } catch (error: any) {
                logError("Failed to create ticket", { error: error.message });
                toast({ title: "Error", description: `No se pudo crear el ticket: ${error.message}`, variant: "destructive"});
            } finally {
                updateState({ isSubmitting: false });
            }
        }
    };

    const selectors = {
        customerOptions: useMemo(() => {
            if (debouncedCustomerSearch.length < 2) return [];
            const searchTerms = debouncedCustomerSearch.toLowerCase().split(' ').filter(Boolean);
            return customers.filter(c => {
                const targetText = `${c.id} ${c.name} ${c.taxId}`.toLowerCase();
                return searchTerms.every(term => targetText.includes(term));
            }).map(c => ({ value: c.id, label: `[${c.id}] ${c.name} (${c.taxId})` }));
        }, [customers, debouncedCustomerSearch]),
    };
    
    return {
        state,
        actions,
        selectors,
        isAuthorized
    };
};
