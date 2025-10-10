/**
 * @fileoverview Custom hook for managing the state and logic of the Licenses page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { License, SoftwareProduct, ClientCompany } from '@/modules/core/types';
import { 
    getLicenses as getLicensesServer, 
    addLicense as addLicenseServer,
    updateLicense as updateLicenseServer,
    deleteLicense as deleteLicenseServer,
    getSoftwareProducts, 
    addSoftwareProduct, 
    deleteSoftwareProduct
} from '../lib/actions';
import { getClientCompanies } from '@/modules/tickets/lib/actions';
import { useDebounce } from 'use-debounce';
import { add } from 'date-fns';

const emptyLicense: Omit<License, 'id' | 'createdAt' | 'licenseKey'> = {
    softwareId: 0,
    clientCompanyId: null,
    hardwareId: '',
    isPerpetual: false,
    expirationDate: '',
    status: 'active',
};

const emptySoftwareProduct: Omit<SoftwareProduct, 'id'> = {
    name: '',
    isInternal: false,
};

export const useLicenses = () => {
    const { isAuthorized } = useAuthorization(['licenses:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, companyData } = useAuth();

    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        licenses: [] as License[],
        softwareProducts: [] as SoftwareProduct[],
        clientCompanies: [] as ClientCompany[],
        isFormOpen: false,
        isEditing: false,
        currentLicense: emptyLicense as License | Omit<License, 'id' | 'createdAt' | 'licenseKey'>,
        isSoftwareDialogOpen: false,
        newSoftwareProduct: emptySoftwareProduct,
        licenseToDelete: null as License | null,
        companySearchTerm: '',
        isCompanySearchOpen: false,
    });

    const [debouncedCompanySearch] = useDebounce(state.companySearchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = (newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    };

    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [licensesData, softwareData, companiesData] = await Promise.all([
                getLicensesServer(),
                getSoftwareProducts(),
                getClientCompanies(),
            ]);
            updateState({ licenses: licensesData, softwareProducts: softwareData, clientCompanies: companiesData });
        } catch (error) {
            logError('Failed to load license data', { error });
            toast({ title: "Error", description: "No se pudieron cargar los datos de licencias.", variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast]);

    useEffect(() => {
        setTitle("Gestión de Licencias");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [isAuthorized, loadInitialData, setTitle]);

    const handleCurrentLicenseChange = (field: keyof typeof emptyLicense, value: any) => {
        updateState({ currentLicense: { ...state.currentLicense, [field]: value } });
    };
    
    const handleNewSoftwareChange = (field: keyof typeof emptySoftwareProduct, value: any) => {
        updateState({ newSoftwareProduct: { ...state.newSoftwareProduct, [field]: value } });
    };

    const handleSelectCompany = (companyId: string) => {
        const id = parseInt(companyId, 10);
        const company = state.clientCompanies.find(c => c.id === id);
        updateState({ 
            currentLicense: { ...state.currentLicense, clientCompanyId: id },
            companySearchTerm: company ? company.name : '',
            isCompanySearchOpen: false,
        });
    };

    const handleSaveLicense = async () => {
        if (!state.currentLicense.softwareId || !state.currentLicense.clientCompanyId) {
            toast({ title: "Datos incompletos", description: "Debe seleccionar un cliente y un producto de software.", variant: "destructive" });
            return;
        }
        updateState({ isSubmitting: true });
        try {
            if (state.isEditing && 'id' in state.currentLicense) {
                const updated = await updateLicenseServer(state.currentLicense);
                updateState({ licenses: state.licenses.map(l => l.id === updated.id ? updated : l) });
                toast({ title: "Licencia Actualizada" });
            } else {
                const newLicense = await addLicenseServer(state.currentLicense as Omit<License, 'id' | 'createdAt' | 'licenseKey'>);
                updateState({ licenses: [newLicense, ...state.licenses] });
                toast({ title: "Licencia Creada" });
            }
            updateState({ isFormOpen: false, currentLicense: emptyLicense, isEditing: false, companySearchTerm: '' });
        } catch (error: any) {
            logError('Failed to save license', { error: error.message });
            toast({ title: "Error al Guardar", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleEditLicense = (license: License) => {
        const company = state.clientCompanies.find(c => c.id === license.clientCompanyId);
        updateState({
            currentLicense: license,
            isEditing: true,
            isFormOpen: true,
            companySearchTerm: company ? company.name : '',
        });
    };

    const handleDeleteLicense = async () => {
        if (!state.licenseToDelete) return;
        updateState({ isSubmitting: true });
        try {
            await deleteLicenseServer(state.licenseToDelete.id);
            updateState({ licenses: state.licenses.filter(l => l.id !== state.licenseToDelete!.id), licenseToDelete: null });
            toast({ title: "Licencia Eliminada" });
        } catch (error: any) {
            logError('Failed to delete license', { error: error.message });
            toast({ title: "Error al Eliminar", description: error.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleCreateSoftware = async () => {
        if (!state.newSoftwareProduct.name) return;
        try {
            const newProd = await addSoftwareProduct(state.newSoftwareProduct);
            updateState({ softwareProducts: [...state.softwareProducts, newProd], newSoftwareProduct: emptySoftwareProduct });
            toast({ title: "Producto de Software Creado" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };
    
    const handleDeleteSoftware = async (id: number) => {
        try {
            await deleteSoftwareProduct(id);
            updateState({ softwareProducts: state.softwareProducts.filter(p => p.id !== id) });
            toast({ title: "Producto de Software Eliminado" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const resetCurrentLicense = () => {
        updateState({ currentLicense: emptyLicense, isEditing: false, companySearchTerm: '' });
    };

    const setExpirationDatePreset = (preset: 'perpetual' | number) => {
        if (preset === 'perpetual') {
            updateState({
                currentLicense: { ...state.currentLicense, isPerpetual: true, expirationDate: '' }
            });
        } else {
            const newDate = add(new Date(), { days: preset });
            updateState({
                currentLicense: { ...state.currentLicense, isPerpetual: false, expirationDate: newDate.toISOString().split('T')[0] }
            });
        }
    };

    const clientCompanyOptions = useMemo(() => {
        if (debouncedCompanySearch.length < 2) return [];
        const searchTerms = debouncedCompanySearch.toLowerCase().split(' ').filter(Boolean);
        return state.clientCompanies.filter(c => {
            const targetText = `${c.id} ${c.name} ${c.taxId}`.toLowerCase();
            return searchTerms.every(term => targetText.includes(term));
        }).map(c => ({ value: String(c.id), label: `${c.name} (${c.taxId})` }));
    }, [state.clientCompanies, debouncedCompanySearch]);

    const getLicenseStatus = (license: License): { label: string, variant: "default" | "secondary" | "destructive" | "outline" } => {
        if (license.status === 'revoked') return { label: "Revocada", variant: "destructive" };
        if (license.isPerpetual) return { label: "Perpetua", variant: "default" };
        if (!license.expirationDate) return { label: "Válida", variant: "secondary" };
        const isExpired = new Date(license.expirationDate) < new Date();
        return isExpired ? { label: "Vencida", variant: "destructive" } : { label: "Activa", variant: "default" };
    };

    const actions = {
        setIsFormOpen: (isOpen: boolean) => updateState({ isFormOpen: isOpen }),
        setIsSoftwareDialogOpen: (isOpen: boolean) => updateState({ isSoftwareDialogOpen: isOpen }),
        setLicenseToDelete: (license: License | null) => updateState({ licenseToDelete: license }),
        handleCurrentLicenseChange,
        handleNewSoftwareChange,
        handleSelectCompany,
        setCompanySearchTerm: (term: string) => updateState({ companySearchTerm: term }),
        setIsCompanySearchOpen: (isOpen: boolean) => updateState({ isCompanySearchOpen: isOpen }),
        handleSaveLicense,
        handleEditLicense,
        handleDeleteLicense,
        handleCreateSoftware,
        handleDeleteSoftware,
        resetCurrentLicense,
        setExpirationDatePreset,
    };

    const selectors = {
        filteredLicenses: state.licenses, // Placeholder for future filtering
        clientCompanyOptions,
        getSoftwareProduct: (id: number | null) => state.softwareProducts.find(p => p.id === id),
        getClientCompany: (id: number | null) => state.clientCompanies.find(c => c.id === id),
        getLicenseStatus,
    };

    return {
        state,
        actions,
        selectors
    };
};
