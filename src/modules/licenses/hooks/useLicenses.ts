/**
 * @fileoverview Custom hook for managing the state and logic of the Licenses page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { License, SoftwareProduct } from '@/modules/core/types';
import { 
    getLicenses as getLicensesServer, 
    addLicense as addLicenseServer,
    updateLicense as updateLicenseServer,
    deleteLicense as deleteLicenseServer,
    getSoftwareProducts, 
    addSoftwareProduct, 
    updateSoftwareProduct,
    deleteSoftwareProduct,
    generateNewKeys
} from '../lib/actions';
import { useDebounce } from 'use-debounce';
import { add } from 'date-fns';

const emptyLicense: Partial<License> = {
    softwareId: 0,
    customerId: null,
    hardwareId: '',
    licenseKey: '',
    isPerpetual: false,
    expirationDate: '',
    status: 'active',
    m01_val: false, m02_val: false, m03_val: false, m04_val: false, m05_val: false,
    m06_val: false, m07_val: false, m08_val: false, m09_val: false, m10_val: false
};

const emptySoftwareProduct: Omit<SoftwareProduct, 'id'> = {
    name: '',
    isInternal: false,
    m01_name: '', m02_name: '', m03_name: '', m04_name: '', m05_name: '',
    m06_name: '', m07_name: '', m08_name: '', m09_name: '', m10_name: ''
};

export const useLicenses = () => {
    const { isAuthorized } = useAuthorization(['licenses:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { companyData, customers } = useAuth();

    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        licenses: [] as License[],
        softwareProducts: [] as SoftwareProduct[],
        isFormOpen: false,
        isEditing: false,
        currentLicense: emptyLicense,
        isSoftwareDialogOpen: false,
        isSoftwareEditing: false,
        newSoftwareProduct: emptySoftwareProduct as any,
        licenseToDelete: null as License | null,
        companySearchTerm: '',
        isCompanySearchOpen: false,
    });

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const [debouncedCompanySearch] = useDebounce(state.companySearchTerm, companyData?.searchDebounceTime ?? 500);

    const loadInitialData = useCallback(async () => {
        updateState({ isLoading: true });
        try {
            const [licensesData, softwareData] = await Promise.all([
                getLicensesServer(),
                getSoftwareProducts(),
            ]);
            updateState({ licenses: licensesData, softwareProducts: softwareData });
        } catch (error) {
            logError('Failed to load license data', { error: String(error) });
            toast({ title: "Error", description: "No se pudieron cargar los datos de licencias.", variant: "destructive" });
        } finally {
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);

    useEffect(() => {
        setTitle("Gestión de Licencias");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [isAuthorized, loadInitialData, setTitle]);

    const handleCurrentLicenseChange = (field: keyof License, value: any) => {
        updateState({ currentLicense: { ...state.currentLicense, [field]: value } });
    };
    
    const handleNewSoftwareChange = (field: keyof SoftwareProduct, value: any) => {
        updateState({ newSoftwareProduct: { ...state.newSoftwareProduct, [field]: value } });
    };

    const handleSelectCompany = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        updateState({ 
            currentLicense: { ...state.currentLicense, customerId: customerId },
            companySearchTerm: customer ? customer.name : '',
            isCompanySearchOpen: false,
        });
    };

    const handleSaveLicense = async () => {
        const { currentLicense, softwareProducts, isEditing } = state;

        const selectedSoftware = currentLicense.softwareId
            ? softwareProducts.find(p => p.id === currentLicense.softwareId)
            : null;

        if (!currentLicense.softwareId || !currentLicense.customerId) {
            toast({ title: "Datos incompletos", description: "Debe seleccionar un cliente y un producto de software.", variant: "destructive" });
            return;
        }

        if (selectedSoftware?.isInternal && !currentLicense.hardwareId) {
            toast({ title: "Datos incompletos", description: "El Hardware ID es obligatorio para el software propio.", variant: "destructive" });
            return;
        }

        if (!selectedSoftware?.isInternal && !currentLicense.licenseKey) {
            toast({ title: "Datos incompletos", description: "El número de licencia es obligatorio para el software de terceros.", variant: "destructive" });
            return;
        }

        updateState({ isSubmitting: true });

        const licensePayload = { ...currentLicense };
        if(selectedSoftware?.isInternal) {
            if (!isEditing) {
                delete licensePayload.licenseKey;
            }
        } else {
            licensePayload.hardwareId = null;
        }

        try {
            if (isEditing && 'id' in licensePayload) {
                const updated = await updateLicenseServer(licensePayload as License);
                updateState({ licenses: state.licenses.map(l => l.id === updated.id ? updated : l) });
                toast({ title: "Licencia Actualizada" });
            } else {
                const newLicense = await addLicenseServer(licensePayload as Omit<License, 'id' | 'createdAt'>);
                updateState({ licenses: [newLicense, ...state.licenses] });
                toast({ title: "Licencia Creada" });
            }
            updateState({ isFormOpen: false, currentLicense: emptyLicense, isEditing: false, companySearchTerm: '' });
        } catch (error: unknown) {
            const err = error as { message: string };
            logError('Failed to save license', { error: err.message, currentLicense: licensePayload });
            toast({ title: "Error al Guardar", description: err.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const handleEditLicense = (license: License) => {
        const customer = customers.find(c => c.id === license.customerId);
        updateState({
            currentLicense: license,
            isEditing: true,
            isFormOpen: true,
            companySearchTerm: customer ? customer.name : (license.customerId || ''),
        });
    };

    const handleDeleteLicense = async () => {
        if (!state.licenseToDelete) return;
        updateState({ isSubmitting: true });
        try {
            await deleteLicenseServer(state.licenseToDelete.id);
            updateState({ licenses: state.licenses.filter(l => l.id !== state.licenseToDelete!.id), licenseToDelete: null });
            toast({ title: "Licencia Eliminada" });
        } catch (error: unknown) {
            const err = error as { message: string };
            logError('Failed to delete license', { error: err.message });
            toast({ title: "Error al Eliminar", description: err.message, variant: "destructive" });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleOpenSoftwareEdit = (product: SoftwareProduct) => {
        updateState({ 
            newSoftwareProduct: { ...product }, 
            isSoftwareEditing: true 
        });
    };

    const handleSaveSoftware = async () => {
        if (!state.newSoftwareProduct.name) return;
        try {
            if (state.isSoftwareEditing) {
                const updated = await updateSoftwareProduct(state.newSoftwareProduct);
                updateState({ 
                    softwareProducts: state.softwareProducts.map(p => p.id === updated.id ? updated : p),
                    newSoftwareProduct: emptySoftwareProduct,
                    isSoftwareEditing: false
                });
                toast({ title: "Software Actualizado" });
            } else {
                const newProd = await addSoftwareProduct(state.newSoftwareProduct);
                updateState({ 
                    softwareProducts: [...state.softwareProducts, newProd], 
                    newSoftwareProduct: emptySoftwareProduct 
                });
                toast({ title: "Software Creado" });
            }
        } catch (error: unknown) {
            const err = error as { message: string };
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };
    
    const handleDeleteSoftware = async (id: number) => {
        try {
            await deleteSoftwareProduct(id);
            updateState({ softwareProducts: state.softwareProducts.filter(p => p.id !== id) });
            toast({ title: "Producto Eliminado" });
        } catch (error: unknown) {
            const err = error as { message: string };
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    const resetCurrentLicense = () => {
        updateState({ currentLicense: emptyLicense, isEditing: false, companySearchTerm: '' });
    };

    const setExpirationDatePreset = (days: number) => {
        const newDate = add(new Date(), { days });
        updateState({
            currentLicense: { ...state.currentLicense, isPerpetual: false, expirationDate: newDate.toISOString().split('T')[0] }
        });
    };
    
    const handleGenerateKeys = async () => {
        updateState({ isSubmitting: true });
        try {
            const result = await generateNewKeys();
            if (result.success) {
                toast({ title: "Éxito", description: result.message });
            } else {
                toast({ title: "Error", description: result.message, variant: 'destructive' });
            }
        } catch (error: unknown) {
            const err = error as { message: string };
            toast({ title: "Error Crítico", description: err.message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };
    
    const downloadLicenseFile = (license: License) => {
        const software = state.softwareProducts.find(p => p.id === license.softwareId);
        if (!software || !software.isInternal) {
            toast({ title: "Operación no permitida", description: "Solo se pueden descargar archivos de licencia para software propio.", variant: "destructive" });
            return;
        }
        const blob = new Blob([license.licenseKey], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const softwareName = software.name.replace(/\s+/g, '_') || 'software';
        const clientName = customers.find(c => c.id === license.customerId)?.name.replace(/\s+/g, '_') || 'cliente';
        a.download = `licencia_${softwareName}_${clientName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const clientCustomerOptions = useMemo(() => {
        if (debouncedCompanySearch.length < 2) return [];
        const searchTerms = debouncedCompanySearch.toLowerCase().split(' ').filter(Boolean);
        return customers.filter(c => {
            const targetText = `${c.id} ${c.name} ${c.taxId}`.toLowerCase();
            return searchTerms.every(term => targetText.includes(term));
        }).map(c => ({ value: c.id, label: `[${c.id}] ${c.name} (${c.taxId})` }));
    }, [customers, debouncedCompanySearch]);

    const getLicenseStatus = (license: License): { label: string, variant: "default" | "secondary" | "destructive" | "outline" } => {
        if (license.status === 'revoked') return { label: "Revocada", variant: "destructive" };
        if (license.isPerpetual) return { label: "Perpetua", variant: "default" };
        if (!license.expirationDate) return { label: "Válida", variant: "secondary" };
        const isExpired = new Date(license.expirationDate) < new Date();
        return isExpired ? { label: "Vencida", variant: "destructive" } : { label: "Activa", variant: "default" };
    };

    const actions = {
        setIsFormOpen: (isOpen: boolean) => updateState({ isNewTicketDialogOpen: false, isFormOpen: isOpen }), // isNewTicketDialogOpen was likely a copy-paste error
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
        handleSaveSoftware,
        handleDeleteSoftware,
        handleOpenSoftwareEdit,
        setSoftwareEditing: (val: boolean) => updateState({ isSoftwareEditing: val }),
        resetCurrentLicense,
        setExpirationDatePreset,
        handleGenerateKeys,
        downloadLicenseFile,
    };

    const selectors = {
        filteredLicenses: state.licenses,
        clientCustomerOptions,
        getSoftwareProduct: (id: number | null) => state.softwareProducts.find(p => p.id === id),
        getCustomer: (id: string | null) => customers.find(c => c.id === id),
        getLicenseStatus,
    };

    return {
        state: { ...state, companyData },
        actions,
        selectors
    };
};
