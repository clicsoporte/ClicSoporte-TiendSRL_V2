/**
 * @fileoverview Custom hook for managing the time tracking component.
 */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuth } from '@/modules/core/hooks/useAuth';
import type { TimeEntry } from '@/modules/core/types';
import { addTimeEntry, getEntriesForTicket, stopTimeEntry, deleteTimeEntry } from '../lib/actions';
import { logError } from '@/modules/core/lib/logger';

export const useTimeTracker = (ticketId: number) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showManualForm, setShowManualForm] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    const loadEntries = useCallback(async () => {
        setIsLoading(true);
        try {
            const ticketEntries = await getEntriesForTicket(ticketId);
            setEntries(ticketEntries);
            const runningEntry = ticketEntries.find(e => !e.endTime);
            setActiveEntry(runningEntry || null);
        } catch (error) {
            logError("Failed to load time entries", { error, ticketId });
            toast({ title: "Error", description: "No se pudieron cargar las entradas de tiempo.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [ticketId, toast]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    useEffect(() => {
        if (activeEntry) {
            const start = new Date(activeEntry.startTime).getTime();
            const updateElapsedTime = () => {
                setElapsedTime(Date.now() - start);
            };
            updateElapsedTime();
            timerRef.current = setInterval(updateElapsedTime, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setElapsedTime(0);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [activeEntry]);

    const handleStartTimer = async (isBillable: boolean, notes: string) => {
        if (!user || activeEntry) return;
        try {
            const newEntry = await addTimeEntry({
                ticketId,
                userId: user.id,
                startTime: new Date().toISOString(),
                isBillable,
                notes: notes || 'Cronómetro iniciado'
            });
            setActiveEntry(newEntry);
            setEntries(prev => [...prev, newEntry]);
            toast({ title: "Cronómetro Iniciado" });
        } catch (error) {
            logError("Failed to start timer", { error, ticketId });
            toast({ title: "Error", description: "No se pudo iniciar el cronómetro.", variant: "destructive" });
        }
    };
    
    const handleStopTimer = async (notes: string, isBillable: boolean) => {
        if (!user || !activeEntry) return;
        try {
            const updatedEntry = await stopTimeEntry(activeEntry.id, notes, isBillable);
            setActiveEntry(null);
            setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
            toast({ title: "Cronómetro Detenido", description: `Tiempo registrado: ${formatDuration(updatedEntry.duration)}` });
        } catch (error) {
            logError("Failed to stop timer", { error, activeEntryId: activeEntry.id });
            toast({ title: "Error", description: "No se pudo detener el cronómetro.", variant: "destructive" });
        }
    };
    
    const handleAddManualEntry = async (durationMinutes: number, notes: string, isBillable: boolean, entryDate: Date) => {
        if (!user || durationMinutes <= 0) {
            toast({ title: "Datos inválidos", description: "La duración debe ser mayor a 0.", variant: "destructive" });
            return;
        }

        const endTime = entryDate;
        const startTime = new Date(endTime.getTime() - durationMinutes * 60000);
        
        try {
            const newEntry = await addTimeEntry({
                ticketId,
                userId: user.id,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration: durationMinutes * 60000,
                notes,
                isBillable
            });
            setEntries(prev => [...prev, newEntry].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            toast({ title: "Entrada Manual Guardada" });
            setShowManualForm(false);
        } catch (error) {
             logError("Failed to add manual time entry", { error, ticketId });
            toast({ title: "Error", description: "No se pudo guardar la entrada manual.", variant: "destructive" });
        }
    };

    const handleDeleteEntry = async (entryId: number) => {
        try {
            await deleteTimeEntry(entryId);
            setEntries(prev => prev.filter(e => e.id !== entryId));
            if (activeEntry?.id === entryId) {
                setActiveEntry(null);
            }
            toast({ title: "Entrada Eliminada", variant: "destructive" });
        } catch (error) {
            logError("Failed to delete time entry", { error, entryId });
            toast({ title: "Error", description: "No se pudo eliminar la entrada.", variant: "destructive" });
        }
    };

    const formatDuration = (ms: number | null | undefined) => {
        if (ms === null || ms === undefined) return "00:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const totalRegisteredTime = useMemo(() => {
        return entries.reduce((acc, entry) => acc + (entry.duration || 0), 0);
    }, [entries]);
    
    return {
        state: {
            entries,
            activeEntry,
            elapsedTime,
            isLoading,
            showManualForm,
            totalRegisteredTime,
        },
        actions: {
            handleStartTimer,
            handleStopTimer,
            handleAddManualEntry,
            handleDeleteEntry,
            setShowManualForm,
            refresh: loadEntries
        },
        formatDuration,
    };
};
