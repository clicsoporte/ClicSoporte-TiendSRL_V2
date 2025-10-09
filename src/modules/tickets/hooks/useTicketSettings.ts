
/**
 * @fileoverview Custom hook for managing the ticket settings page.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { logError, logInfo } from '@/modules/core/lib/logger';
import type { HelpTopic, TicketPriority } from '@/modules/core/types';
import { getHelpTopics, addHelpTopic, updateHelpTopic, deleteHelpTopic } from '../lib/actions';

const emptyTopic: HelpTopic = {
    id: 0,
    name: '',
    defaultPriority: 'medium',
    defaultAssigneeId: null,
};

const priorityConfig: { [key in TicketPriority]: { label: string } } = {
    low: { label: "Baja" },
    medium: { label: "Media" },
    high: { label: "Alta" },
    urgent: { label: "Urgente" }
};

export const useTicketSettings = () => {
    const { isAuthorized } = useAuthorization(['admin:settings:general']); // TODO: Change to a specific permission
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTopic, setCurrentTopic] = useState<HelpTopic>(emptyTopic);
    const [topicToDelete, setTopicToDelete] = useState<HelpTopic | null>(null);
    
    const fetchHelpTopics = useCallback(async () => {
        setIsLoading(true);
        try {
            const topics = await getHelpTopics();
            setHelpTopics(topics);
        } catch (error) {
            logError('Failed to fetch help topics', { error });
            toast({ title: "Error", description: "No se pudieron cargar los temas de ayuda.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isAuthorized) {
            fetchHelpTopics();
        }
    }, [isAuthorized, fetchHelpTopics]);
    
    const handleSaveTopic = async () => {
        if (!currentTopic.name) {
            toast({ title: "Nombre requerido", variant: "destructive" });
            return;
        }

        try {
            if (isEditing) {
                const updated = await updateHelpTopic(currentTopic);
                setHelpTopics(prev => prev.map(t => t.id === updated.id ? updated : t));
                toast({ title: "Tema Actualizado" });
                logInfo('Help topic updated', { topic: updated.name });
            } else {
                const newTopic = await addHelpTopic(currentTopic);
                setHelpTopics(prev => [...prev, newTopic]);
                toast({ title: "Tema Creado" });
                logInfo('New help topic created', { topic: newTopic.name });
            }
            resetForm();
            setFormOpen(false);
        } catch (error: any) {
            logError('Failed to save help topic', { error: error.message });
            toast({ title: "Error al Guardar", description: error.message, variant: "destructive" });
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
        } catch (error: any) {
            logError('Failed to delete help topic', { error: error.message });
            toast({ title: "Error al Eliminar", description: error.message, variant: "destructive" });
        }
    };

    const resetForm = () => {
        setCurrentTopic(emptyTopic);
        setIsEditing(false);
    };
    
    return {
        state: {
            isLoading,
            helpTopics,
            isFormOpen,
            isEditing,
            currentTopic,
            topicToDelete
        },
        actions: {
            setFormOpen,
            setCurrentTopic,
            handleSaveTopic,
            handleEditClick,
            handleDeleteTopic,
            setTopicToDelete,
            resetForm,
        },
        selectors: {
            priorityConfig,
        },
        isAuthorized,
        isLoading,
    };
};
