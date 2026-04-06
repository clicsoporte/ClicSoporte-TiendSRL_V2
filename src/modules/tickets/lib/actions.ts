/**
 * @fileoverview Client-side functions for interacting with the ticket module's server-side DB functions.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, SupportPackage, Service, ThirdPartyProvider, ProviderService, ProviderGeoRate, Province, Canton, District } from '@/modules/core/types';
import { 
    addTicket as addTicketServer, 
    getTickets as getTicketsServer, 
    getTicketById as getTicketByIdServer, 
    getTicketThread as getTicketThreadServer, 
    addThreadEntry as addThreadEntryServer, 
    updateTicketDetails as updateTicketDetailsServer, 
    getHelpTopics as getHelpTopicsServer,
    addHelpTopic as addHelpTopicServer,
    updateHelpTopic as updateHelpTopicServer,
    deleteHelpTopic as deleteHelpTopicServer,
    addClientCompany as addClientCompanyServer,
    updateClientCompany as updateClientCompanyServer,
    deleteClientCompany as deleteClientCompanyServer,
    getClientCompanies as getClientCompaniesServer,
    deleteTicket as deleteTicketServer,
    getCustomerSupportInfo as getCustomerSupportInfoServer,
    getThirdPartyProviders as getThirdPartyProvidersServer,
    addThirdPartyProvider as addThirdPartyProviderServer,
    updateThirdPartyProvider as updateThirdPartyProviderServer,
    deleteThirdPartyProvider as deleteThirdPartyProviderServer,
    saveProviderService as saveProviderServiceServer,
    deleteProviderService as deleteProviderServiceServer,
    saveProviderGeoRate as saveProviderGeoRateServer,
    deleteProviderGeoRate as deleteProviderGeoRateServer,
    getCRGeoData as getCRGeoDataServer,
    addProvince as addProvinceServer,
    updateProvince as updateProvinceServer,
    deleteProvince as deleteProvinceServer,
    addCanton as addCantonServer,
    updateCanton as updateCantonServer,
    deleteCanton as deleteCantonServer,
    addDistrict as addDistrictServer,
    updateDistrict as updateDistrictServer,
    deleteDistrict as deleteDistrictServer,
    getTicketSettings as getTicketSettingsServer,
    saveTicketSettings as saveTicketSettingsServer
} from './db';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';

/**
 * Saves a new ticket to the database.
 */
export async function saveTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    try {
        const createdTicket = await addTicketServer(payload, user);
        
        // --- Integration with Notification Engine ---
        await triggerNotificationEvent('onTicketCreated', {
            ...createdTicket,
            customerEmail: payload.customerEmail
        });
        
        if (createdTicket.priority === 'urgent') {
            await triggerNotificationEvent('onTicketPriorityUrgent', createdTicket);
        }

        await logInfo(`New ticket #${createdTicket.consecutive} created by ${user.name}`, { 
            ticketId: createdTicket.id, 
            customer: payload.customerName 
        });
        
        return JSON.parse(JSON.stringify(createdTicket));
    } catch (error: unknown) {
        logError("Error saving ticket", { error: (error as Error).message });
        throw error;
    }
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    const newCompany = await addClientCompanyServer(payload);
    return JSON.parse(JSON.stringify(newCompany));
}

export async function updateClientCompany(payload: ClientCompany): Promise<ClientCompany> {
    const updatedCompany = await updateClientCompanyServer(payload);
    return JSON.parse(JSON.stringify(updatedCompany));
}

export async function deleteClientCompany(id: number): Promise<void> {
    return deleteClientCompanyServer(id);
}

export async function getClientCompanies(): Promise<ClientCompany[]> {
    const companies = await getClientCompaniesServer();
    return JSON.parse(JSON.stringify(companies));
}

export async function getTickets(): Promise<Ticket[]> {
    const tickets = await getTicketsServer();
    return JSON.parse(JSON.stringify(tickets));
}

export async function getTicketById(id: number): Promise<Ticket | null> {
    const ticket = await getTicketByIdServer(id);
    return ticket ? JSON.parse(JSON.stringify(ticket)) : null;
}

export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const thread = await getTicketThreadServer(ticketId);
    return JSON.parse(JSON.stringify(thread));
}

export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' | 'status_change' }): Promise<TicketThread> {
    const newEntry = await addThreadEntryServer(payload);
    
    // Trigger notification for new message
    if (payload.type === 'message') {
        const ticket = await getTicketByIdServer(payload.ticketId);
        if (ticket) {
            await triggerNotificationEvent('onTicketReplyAdded', {
                ...newEntry,
                consecutive: ticket.consecutive,
                customerEmail: ticket.customerEmail
            });
        }
    }
    
    return JSON.parse(JSON.stringify(newEntry));
}

export async function updateTicketDetails(ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'isBillable' | 'providerId'>>, user: User): Promise<Ticket> {
    const updatedTicket = await updateTicketDetailsServer(ticketId, updates, user);
    
    // Trigger notification for status change
    if (updates.status) {
        if (updates.status === 'completed' || updates.status === 'canceled') {
            const event = updates.status === 'completed' ? 'onTicketCompleted' : 'onTicketCanceled';
            // Fetch last message content to serve as "solution"
            const thread = await getTicketThreadServer(ticketId);
            const lastMessage = thread.filter(t => t.type === 'message').pop();
            
            await triggerNotificationEvent(event, {
                ...updatedTicket,
                content: lastMessage?.content || 'El caso fue resuelto satisfactoriamente.',
                userName: user.name
            });
        } else {
            await triggerNotificationEvent('onTicketStatusChanged', updatedTicket);
        }
    }

    if (updates.priority === 'urgent') {
        await triggerNotificationEvent('onTicketPriorityUrgent', updatedTicket);
    }
    
    return JSON.parse(JSON.stringify(updatedTicket));
}

export async function getHelpTopics(): Promise<HelpTopic[]> {
    const topics = await getHelpTopicsServer();
    return JSON.parse(JSON.stringify(topics));
}

export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    const newTopic = await addHelpTopicServer(topic);
    return JSON.parse(JSON.stringify(newTopic));
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const updatedTopic = await updateHelpTopicServer(topic);
    return JSON.parse(JSON.stringify(updatedTopic));
}

export async function deleteHelpTopic(id: number): Promise<void> {
    return deleteHelpTopicServer(id);
}

export async function deleteTicket(id: number): Promise<void> {
    return deleteTicketServer(id);
}

export async function getCustomerSupportInfo(companyId: number | string): Promise<{ customer: Record<string, unknown> | null; supportPackage: SupportPackage | null, services: Service[] }> {
    const info = await getCustomerSupportInfoServer(companyId);
    return JSON.parse(JSON.stringify(info));
}

// --- Third Party Providers Actions ---
export async function getThirdPartyProviders(): Promise<ThirdPartyProvider[]> {
    const providers = await getThirdPartyProvidersServer();
    return JSON.parse(JSON.stringify(providers));
}

export async function addThirdPartyProvider(payload: Omit<ThirdPartyProvider, 'id' | 'createdAt'>): Promise<ThirdPartyProvider> {
    const newProvider = await addThirdPartyProviderServer(payload);
    await logInfo(`New third-party provider added: ${payload.name}`);
    return JSON.parse(JSON.stringify(newProvider));
}

export async function updateThirdPartyProvider(payload: ThirdPartyProvider): Promise<ThirdPartyProvider> {
    const updated = await updateThirdPartyProviderServer(payload);
    return JSON.parse(JSON.stringify(updated));
}

export async function deleteThirdPartyProvider(id: number): Promise<void> {
    return deleteThirdPartyProviderServer(id);
}

export async function saveProviderService(payload: Omit<ProviderService, 'id'>): Promise<ProviderService> {
    return JSON.parse(JSON.stringify(await saveProviderServiceServer(payload)));
}

export async function deleteProviderService(id: number): Promise<void> {
    return deleteProviderServiceServer(id);
}

export async function saveProviderGeoRate(payload: Omit<ProviderGeoRate, 'id'>): Promise<ProviderGeoRate> {
    return JSON.parse(JSON.stringify(await saveProviderGeoRateServer(payload)));
}

export async function deleteProviderGeoRate(id: number): Promise<void> {
    return deleteProviderGeoRateServer(id);
}

export async function getCRGeoData(): Promise<{ provinces: Province[], cantons: Canton[], districts: District[] }> {
    return JSON.parse(JSON.stringify(await getCRGeoDataServer()));
}

// --- Geographic Management Actions ---

export async function addProvince(name: string): Promise<Province> {
    return JSON.parse(JSON.stringify(await addProvinceServer(name)));
}

export async function updateProvince(id: number, name: string): Promise<void> {
    return await updateProvinceServer(id, name);
}

export async function deleteProvince(id: number): Promise<void> {
    return await deleteProvinceServer(id);
}

export async function addCanton(provinceId: number, name: string): Promise<Canton> {
    return JSON.parse(JSON.stringify(await addCantonServer(provinceId, name)));
}

export async function updateCanton(id: number, name: string): Promise<void> {
    return await updateCantonServer(id, name);
}

export async function deleteCanton(id: number): Promise<void> {
    return await deleteCantonServer(id);
}

export async function addDistrict(cantonId: number, name: string): Promise<District> {
    return JSON.parse(JSON.stringify(await addDistrictServer(cantonId, name)));
}

export async function updateDistrict(id: number, name: string): Promise<void> {
    return await updateDistrictServer(id, name);
}

export async function deleteDistrict(id: number): Promise<void> {
    return await deleteDistrictServer(id);
}

export async function getTicketSettings(): Promise<{ ticketPrefix: string; nextTicketNumber: number }> {
    return await getTicketSettingsServer();
}

export async function saveTicketSettings(settings: { ticketPrefix: string; nextTicketNumber: number }): Promise<void> {
    return await saveTicketSettingsServer(settings);
}
