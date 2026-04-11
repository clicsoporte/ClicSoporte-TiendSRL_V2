
/**
 * @fileoverview Hook for managing the state and logic of the IT Notes page.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError } from '@/modules/core/lib/logger';
import { getNotes, saveNote, deleteNote } from '../lib/actions';
import type { ITNote } from '@/modules/core/types';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { useDebounce } from 'use-debounce';

export const useItNotes = () => {
    const { isAuthorized, hasPermission } = useAuthorization(['it-tools:notes:read']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { user, companyData, customers } = useAuth();
    
    const [state, setState] = useState({
        isLoading: true,
        isSubmitting: false,
        isFormOpen: false,
        notes: [] as ITNote[],
        searchTerm: '',
        customerFilter: 'all',
        noteToEdit: null as ITNote | null,
        noteToDelete: null as ITNote | null,
        currentTitle: '',
        currentContent: '',
        currentCustomerId: 'none',
        companySearchTerm: '',
        isCompanySearchOpen: false,
    });

    const [debouncedSearchTerm] = useDebounce(state.searchTerm, companyData?.searchDebounceTime ?? 300);
    const [debouncedCompanySearch] = useDebounce(state.companySearchTerm, companyData?.searchDebounceTime ?? 500);

    const updateState = useCallback((newState: Partial<typeof state>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    }, []);

    const loadInitialData = useCallback(async () => {
        try {
            const notesData = await getNotes();
            updateState({ notes: notesData, isLoading: false });
        } catch (error: unknown) {
            logError("Failed to load IT notes data", { error: (error as Error).message });
            toast({ title: "Error", description: "No se pudieron cargar las notas.", variant: "destructive" });
            updateState({ isLoading: false });
        }
    }, [toast, updateState]);
    
    useEffect(() => {
        setTitle("Notas de TI");
        if (isAuthorized) {
            loadInitialData();
        }
    }, [isAuthorized, setTitle, loadInitialData]);

    const openForm = (note: ITNote | null = null) => {
        if (note) {
            const customer = customers.find(c => c.id === note.customerId);
            updateState({ 
                noteToEdit: note, 
                currentTitle: note.title,
                currentContent: note.content || '',
                currentCustomerId: note.customerId || 'none',
                companySearchTerm: customer ? customer.name : '',
                isFormOpen: true 
            });
        } else {
            updateState({ 
                noteToEdit: null, 
                currentTitle: '',
                currentContent: '',
                currentCustomerId: 'none',
                companySearchTerm: '',
                isFormOpen: true 
            });
        }
    };

    const handleSave = async () => {
        if (!user || !state.currentTitle.trim()) {
            toast({ title: 'Título requerido', variant: 'destructive' });
            return;
        }

        updateState({ isSubmitting: true });
        try {
            const payload: Omit<ITNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: number } = {
                title: state.currentTitle,
                content: state.currentContent,
                customerId: state.currentCustomerId === 'none' ? null : state.currentCustomerId,
                createdBy: user.name,
                tags: null,
                ...(state.noteToEdit && { id: state.noteToEdit.id }),
            };
            const savedNote = await saveNote(payload);

            if (state.noteToEdit) {
                updateState({ notes: state.notes.map(n => n.id === savedNote.id ? savedNote : n) });
            } else {
                updateState({ notes: [savedNote, ...state.notes] });
            }
            
            toast({ title: 'Nota Guardada' });
            updateState({ isFormOpen: false });
        } catch (error: unknown) {
            toast({ title: 'Error al Guardar', description: (error as Error).message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const handleDelete = async () => {
        if (!state.noteToDelete) return;
        updateState({ isSubmitting: true });
        try {
            await deleteNote(state.noteToDelete.id);
            updateState({ notes: state.notes.filter(n => n.id !== state.noteToDelete!.id), noteToDelete: null });
            toast({ title: 'Nota Eliminada', variant: 'destructive' });
        } catch (error: unknown) {
            toast({ title: 'Error al Eliminar', description: (error as Error).message, variant: 'destructive' });
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    const customerOptions = useMemo(() => {
        if (debouncedCompanySearch.length < 2) return [];
        return customers.filter(c => 
            c.name.toLowerCase().includes(debouncedCompanySearch.toLowerCase()) || 
            (c.commercialName || "").toLowerCase().includes(debouncedCompanySearch.toLowerCase()) ||
            c.id.toLowerCase().includes(debouncedCompanySearch.toLowerCase())
        ).map(c => ({ value: c.id, label: `[${c.id}] ${c.name} (${c.commercialName || ''})` }));
    }, [customers, debouncedCompanySearch]);

    const filteredNotes = useMemo(() => {
        return state.notes.filter(note => {
            const matchesSearch = debouncedSearchTerm
                ? (note.title + ' ' + note.content).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
                : true;
            const matchesCustomer = state.customerFilter === 'all'
                ? true
                : note.customerId === state.customerFilter;
            return matchesSearch && matchesCustomer;
        });
    }, [state.notes, debouncedSearchTerm, state.customerFilter]);

    return {
        state,
        actions: {
            openForm,
            handleSave,
            handleDelete,
            setSearchTerm: (term: string) => updateState({ searchTerm: term }),
            setCustomerFilter: (filter: string) => updateState({ customerFilter: filter }),
            setIsFormOpen: (open: boolean) => updateState({ isFormOpen: open }),
            setNoteToDelete: (note: ITNote | null) => updateState({ noteToDelete: note }),
            setCurrentTitle: (title: string) => updateState({ currentTitle: title }),
            setCurrentContent: (content: string) => updateState({ currentContent: content }),
            setCompanySearchTerm: (term: string) => updateState({ companySearchTerm: term }),
            setIsCompanySearchOpen: (open: boolean) => updateState({ isCompanySearchOpen: open }),
            handleSelectCompany: (id: string) => {
                const customer = customers.find(c => c.id === id);
                updateState({ currentCustomerId: id, companySearchTerm: customer ? customer.name : '', isCompanySearchOpen: false });
            },
            clearFilters: () => updateState({ searchTerm: '', customerFilter: 'all' }),
        },
        selectors: {
            filteredNotes,
            customerOptions,
            getCustomerName: (id: string) => customers.find(c => c.id === id)?.name || id,
        },
        isAuthorized,
        hasPermission
    };
};
