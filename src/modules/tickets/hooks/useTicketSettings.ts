/**
 * @fileoverview Custom hook for managing the ticket settings page.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import type { HelpTopic, TicketPriority, Role, User, SupportPackage, Service, Province, Canton, District } from '@/modules/core/types';
import { 
    getHelpTopics, addHelpTopic, updateHelpTopic, deleteHelpTopic,
    getCRGeoData, addProvince, updateProvince, deleteProvince,
    addCanton, updateCanton, deleteCanton,
    addDistrict, updateDistrict, deleteDistrict,
    getTicketSettings, saveTicketSettings
} from '../lib/actions';
import { getAllUsers } from '@/modules/core/lib/auth-client';
import { getAllRoles } from '@/modules/core/lib/roles-db';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { saveCompanySettings } from '@/modules/core/lib/settings-db';


const emptyTopic: Omit<HelpTopic, 'id'> = {
    name: '',
    defaultPriority: 'medium',
    defaultAssigneeId: null,
    defaultServiceId: null,
};

const priorityConfig: { [key in TicketPriority]: { label: string } } = {
    low: { label: "Baja" },
    medium: { label: "Media" },
    high: { label: "Alta" },
    urgent: { label: "Urgente" }
};

export const useTicketSettings = () => {
    const { isAuthorized } = useAuthorization(['tickets:admin:settings']);
    const { toast } = useToast();
    const { companyData, setCompanyData } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTopic, setCurrentTopic] = useState<HelpTopic | Omit<HelpTopic, 'id'>>(emptyTopic);
    const [topicToDelete, setTopicToDelete] = useState<HelpTopic | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    
    // Ticket Consecutive Settings
    const [ticketPrefix, setTicketPrefix] = useState('CAS-');
    const [nextTicketNumber, setNextTicketNumber] = useState(1);

    // Geographic Data State
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [cantons, setCantons] = useState<Canton[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    
    // States for services and packages
    const [newService, setNewService] = useState<Service>({ id: "", name: "", price: 0 });
    const [newPackage, setNewPackage] = useState<Omit<SupportPackage, 'includedServices' | 'excludedServices'>>({ 
        id: "", 
        name: "", 
        defaultHours: 0,
        roundingMultiple: 15,
        graceMinutes: 5
    });

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [topics, users, roles, geo, settings] = await Promise.all([
                getHelpTopics(),
                getAllUsers(),
                getAllRoles(),
                getCRGeoData(),
                getTicketSettings()
            ]);
            setHelpTopics(topics);
            setAllUsers(users);
            setAllRoles(roles);
            setProvinces(geo.provinces);
            setCantons(geo.cantons);
            setDistricts(geo.districts);
            if (settings.ticketPrefix) setTicketPrefix(settings.ticketPrefix);
            if (settings.nextTicketNumber) setNextTicketNumber(settings.nextTicketNumber);
        } catch (error) {
            logError('Failed to fetch settings data', { error });
            toast({ title: "Error", description: "No se pudieron cargar los datos de configuración.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isAuthorized) {
            fetchInitialData();
        }
    }, [isAuthorized, fetchInitialData]);
    
    const handleSaveTopic = async () => {
        if (!currentTopic.name) {
            toast({ title: "Nombre requerido", variant: "destructive" });
            return;
        }

        try {
            if (isEditing && 'id' in currentTopic) {
                const updated = await updateHelpTopic(currentTopic);
                setHelpTopics(prev => prev.map(t => t.id === updated.id ? updated : t));
                toast({ title: "Tema Actualizado" });
                logInfo('Help topic updated', { topic: updated.name });
            } else {
                const newTopic = await addHelpTopic(currentTopic as Omit<HelpTopic, 'id'>);
                setHelpTopics(prev => [...prev, newTopic]);
                toast({ title: "Tema Creado" });
                logInfo('New help topic created', { topic: newTopic.name });
            }
            resetForm();
            setFormOpen(false);
        } catch (error: unknown) {
            logError('Failed to save help topic', { error: (error as Error).message });
            toast({ title: "Error al Guardar", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const handleEditClick = (topic: HelpTopic) => {
        setCurrentTopic(topic);
        setIsEditing(true);
        setFormOpen(true);
    };

    const handleDeleteTopic = async () => {
        if (!topicToDelete) return;
        try {
            await deleteHelpTopic(topicToDelete.id);
            setHelpTopics(prev => prev.filter(t => t.id !== topicToDelete.id));
            toast({ title: "Tema Eliminado" });
            logInfo('Help topic deleted', { topic: topicToDelete.name });
            setTopicToDelete(null);
        } catch (error: unknown) {
            logError('Failed to delete help topic', { error: (error as Error).message });
            toast({ title: "Error al Eliminar", description: (error as Error).message, variant: "destructive" });
        }
    };

    const resetForm = () => {
        setCurrentTopic(emptyTopic);
        setIsEditing(false);
    };

    const handleAddService = () => {
        if (!companyData || !newService.id || !newService.name) return;
        const updatedCatalog = [...(companyData.servicesCatalog || []), newService];
        setCompanyData({ ...companyData, servicesCatalog: updatedCatalog });
        setNewService({ id: "", name: "", price: 0 });
      };
    
      const handleDeleteService = (serviceId: string) => {
        if (!companyData) return;
        const updatedCatalog = (companyData.servicesCatalog || []).filter(s => s.id !== serviceId);
        const updatedPackages = (companyData.supportPackages || []).map(p => ({
            ...p,
            includedServices: p.includedServices.filter(sId => sId !== serviceId),
            excludedServices: p.excludedServices.filter(sId => sId !== serviceId),
        }));
        setCompanyData({ ...companyData, servicesCatalog: updatedCatalog, supportPackages: updatedPackages });
      };
      
      const handleAddPackage = () => {
        if (!companyData || !newPackage.id || !newPackage.name) return;
        const newPkg: SupportPackage = { 
            ...newPackage, 
            defaultHours: newPackage.defaultHours || 0, 
            includedServices: [], 
            excludedServices: [],
            roundingMultiple: newPackage.roundingMultiple || 15,
            graceMinutes: newPackage.graceMinutes || 0
        };
        const updatedPackages = [...(companyData.supportPackages || []), newPkg];
        setCompanyData({ ...companyData, supportPackages: updatedPackages });
        setNewPackage({ id: "", name: "", defaultHours: 0, roundingMultiple: 15, graceMinutes: 5 });
      };
    
      const handleDeletePackage = (packageId: string) => {
        if (!companyData) return;
        const updatedPackages = (companyData.supportPackages || []).filter(p => p.id !== packageId);
        setCompanyData({ ...companyData, supportPackages: updatedPackages });
      };
      
      const handlePackageServiceToggle = (packageId: string, serviceId: string, type: 'included' | 'excluded', checked: boolean) => {
        if (!companyData) return;
        const updatedPackages = (companyData.supportPackages || []).map(pkg => {
            if (pkg.id === packageId) {
                const listKey = type === 'included' ? 'includedServices' : 'excludedServices';
                const otherListKey = type === 'included' ? 'excludedServices' : 'includedServices';
                
                let newList = [...pkg[listKey]];
                let otherList = [...pkg[otherListKey]];
    
                if (checked) {
                    if (!newList.includes(serviceId)) newList.push(serviceId);
                    otherList = otherList.filter(sId => sId !== serviceId); // Ensure it's not in the other list
                } else {
                    newList = newList.filter(sId => sId !== serviceId);
                }
                return { ...pkg, [listKey]: newList, [otherListKey]: otherList };
            }
            return pkg;
        });
        setCompanyData({ ...companyData, supportPackages: updatedPackages });
    };

    const handlePackagePropChange = (packageId: string, prop: keyof SupportPackage, value: string | number | string[]) => {
        if (!companyData) return;
        const updatedPackages = (companyData.supportPackages || []).map(pkg => {
            if (pkg.id === packageId) {
                return { ...pkg, [prop]: value };
            }
            return pkg;
        });
        setCompanyData({ ...companyData, supportPackages: updatedPackages });
    }

    const handleSaveAll = async () => {
        if (!companyData) return;
        try {
            await Promise.all([
                saveCompanySettings(companyData),
                saveTicketSettings({ ticketPrefix, nextTicketNumber })
            ]);
            toast({
              title: "Configuración Guardada",
              description: "Los ajustes de soporte han sido actualizados.",
            });
            await logInfo("Configuración de soporte técnico guardada.");
        } catch (e) {
            logError("Failed to save ticket settings", { error: String(e) });
            toast({ title: "Error al guardar", variant: "destructive" });
        }
    };

    // --- Geographic Actions ---
    const handleGeoAction = async (type: 'province' | 'canton' | 'district', action: 'add' | 'update' | 'delete', data: any) => {
        try {
            switch (`${type}-${action}`) {
                case 'province-add':
                    const newProv = await addProvince(data.name);
                    setProvinces(prev => [...prev, newProv]);
                    break;
                case 'province-update':
                    await updateProvince(data.id, data.name);
                    setProvinces(prev => prev.map(p => p.id === data.id ? { ...p, name: data.name } : p));
                    break;
                case 'province-delete':
                    await deleteProvince(data.id);
                    setProvinces(prev => prev.filter(p => p.id !== data.id));
                    break;
                case 'canton-add':
                    const newCant = await addCanton(data.provinceId, data.name);
                    setCantons(prev => [...prev, newCant]);
                    break;
                case 'canton-update':
                    await updateCanton(data.id, data.name);
                    setCantons(prev => prev.map(c => c.id === data.id ? { ...c, name: data.name } : c));
                    break;
                case 'canton-delete':
                    await deleteCanton(data.id);
                    setCantons(prev => prev.filter(c => c.id !== data.id));
                    break;
                case 'district-add':
                    const newDist = await addDistrict(data.cantonId, data.name);
                    setDistricts(prev => [...prev, newDist]);
                    break;
                case 'district-update':
                    await updateDistrict(data.id, data.name);
                    setDistricts(prev => prev.map(d => d.id === data.id ? { ...d, name: data.name } : d));
                    break;
                case 'district-delete':
                    await deleteDistrict(data.id);
                    setDistricts(prev => prev.filter(d => d.id !== data.id));
                    break;
            }
            toast({ title: "Datos Geográficos Actualizados" });
        } catch (error: unknown) {
            toast({ title: "Error en Módulo Geográfico", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    return {
        state: {
            isLoading,
            helpTopics,
            isFormOpen,
            isEditing,
            currentTopic,
            topicToDelete,
            newService,
            newPackage,
            provinces,
            cantons,
            districts,
            ticketPrefix,
            nextTicketNumber
        },
        actions: {
            setFormOpen,
            setCurrentTopic,
            handleSaveTopic,
            handleEditClick,
            handleDeleteTopic,
            setTopicToDelete,
            resetForm,
            setNewService,
            setNewPackage,
            handleAddService,
            handleDeleteService,
            handleAddPackage,
            handleDeletePackage,
            handlePackageServiceToggle,
            handlePackagePropChange,
            handleSaveAll,
            handleGeoAction,
            setTicketPrefix,
            setNextTicketNumber
        },
        selectors: {
            priorityConfig,
            allUsers,
            allRoles,
        },
        isAuthorized,
        isLoading,
    };
};
