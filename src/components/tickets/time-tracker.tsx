'use client';

/**
 * @fileoverview Reusable component for tracking time on a specific ticket.
 * Features a real-time stopwatch and manual entry options.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTimeTracker } from '@/modules/timesheet/hooks/useTimeTracker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Play, Square, Plus, History, Clock, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

interface TimeTrackerProps {
    ticketId: number;
    defaultIsBillable: boolean;
    ticketStatus?: string; // Added to trigger refresh on status change
}

export function TimeTracker({ ticketId, defaultIsBillable, ticketStatus }: TimeTrackerProps) {
    const { state, actions, formatDuration } = useTimeTracker(ticketId);
    const { hasPermission } = useAuthorization();
    const [note, setNote] = useState("");
    const [isBillable, setIsBillable] = useState(defaultIsBillable);
    
    // Manual entry state
    const [manualMinutes, setManualMinutes] = useState(0);
    const [manualNote, setManualNote] = useState("");
    const [manualDate, setManualDate] = useState(new Date().toISOString().substring(0, 10));

    // Refresh when status changes externally (sync with sidebar)
    // Stable refresh call to avoid infinite loops
    const stableRefresh = actions.refresh;
    useEffect(() => {
        if (ticketStatus) {
            stableRefresh();
        }
    }, [ticketStatus, stableRefresh]);

    const handleStart = () => {
        actions.handleStartTimer(isBillable, note);
        setNote("");
    };

    const handleStop = () => {
        actions.handleStopTimer(note, isBillable);
        setNote("");
    };

    const handleAddManual = () => {
        actions.handleAddManualEntry(manualMinutes, manualNote, isBillable, new Date(manualDate));
        setManualMinutes(0);
        setManualNote("");
    };

    if (state.isLoading) {
        return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    const canTrackTime = hasPermission('tickets:time-tracking');

    return (
        <div className="space-y-4">
            {/* Active Stopwatch Card */}
            <Card className={cn("border-2 transition-colors", state.activeEntry ? "border-primary shadow-lg" : "border-border")}>
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>{state.activeEntry ? 'CRONÓMETRO ACTIVO' : 'SEGUIMIENTO DE TIEMPO'}</span>
                        <Clock className={cn("h-4 w-4", state.activeEntry && "animate-pulse text-primary")} />
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                    <div className="text-4xl font-mono font-bold text-center py-2 tabular-nums">
                        {formatDuration(state.elapsedTime)}
                    </div>

                    <div className="space-y-3">
                        <Input 
                            placeholder="¿En qué estás trabajando?" 
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="h-8 text-xs"
                            disabled={!canTrackTime}
                        />
                        
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Switch 
                                    id="billable-timer" 
                                    checked={isBillable}
                                    onCheckedChange={setIsBillable}
                                    disabled={!canTrackTime}
                                />
                                <Label htmlFor="billable-timer" className="text-xs">Facturable</Label>
                            </div>
                            
                            {!state.activeEntry ? (
                                <Button onClick={handleStart} size="sm" className="bg-green-600 hover:bg-green-700" disabled={!canTrackTime}>
                                    <Play className="mr-2 h-4 w-4" /> Iniciar
                                </Button>
                            ) : (
                                <Button onClick={handleStop} size="sm" variant="destructive" disabled={!canTrackTime}>
                                    <Square className="mr-2 h-4 w-4" /> Detener
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 border-t bg-muted/30">
                    <div className="flex justify-between items-center w-full pt-2">
                        <span className="text-[10px] text-muted-foreground">Total Acumulado:</span>
                        <span className="text-sm font-bold">{formatDuration(state.totalRegisteredTime)}</span>
                    </div>
                </CardFooter>
            </Card>

            {/* Manual Entry and History */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <History className="h-3 w-3" /> Entradas de Tiempo
                    </h4>
                    
                    <Dialog open={state.showManualForm} onOpenChange={actions.setShowManualForm}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canTrackTime}><Plus className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Registrar Tiempo Manual</DialogTitle>
                                <DialogDescription>Añade tiempo trabajado fuera del cronómetro.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Fecha</Label>
                                        <Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Duración (Minutos)</Label>
                                        <Input type="number" value={manualMinutes || ''} onChange={e => setManualMinutes(Number(e.target.value))} placeholder="Ej: 45" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Nota / Descripción</Label>
                                    <Input value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="¿Qué hiciste?" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={isBillable} onCheckedChange={setIsBillable} />
                                    <Label>Es Facturable</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                                <Button onClick={handleAddManual}>Guardar Entrada</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <ScrollArea className="h-48 rounded-md border bg-card">
                    <div className="p-2 space-y-2">
                        {state.entries.map((entry) => (
                            <div key={entry.id} className="text-[11px] p-2 rounded border bg-muted/30 group">
                                <div className="flex justify-between font-bold">
                                    <span className="flex items-center gap-1">
                                        {format(parseISO(entry.startTime), 'dd/MM')} 
                                        {entry.isBillable ? <Badge variant="outline" className="text-[8px] h-3 px-1 border-primary text-primary">Contrato</Badge> : <Badge variant="outline" className="text-[8px] h-3 px-1 border-destructive text-destructive">Extra</Badge>}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span>{formatDuration(entry.duration)}</span>
                                        {hasPermission('billing:manage') && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-4 w-4 opacity-0 group-hover:opacity-100 text-destructive"
                                                onClick={() => actions.handleDeleteEntry(entry.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-muted-foreground truncate italic mt-1">{entry.notes || 'Sin nota'}</p>
                                {entry.billableDuration !== null && entry.billableDuration !== entry.duration && (
                                    <p className="text-[9px] text-primary font-semibold mt-0.5">
                                        Facturable: {formatDuration(entry.billableDuration)} (Redondeo)
                                    </p>
                                )}
                            </div>
                        ))}
                        {state.entries.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground italic text-xs">
                                No hay registros de tiempo.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}