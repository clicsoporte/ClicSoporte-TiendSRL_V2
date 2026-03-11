/**
 * @fileoverview The main header component for the application's authenticated layout.
 */
"use client";

import { useState } from "react";
import { SidebarTrigger } from "../ui/sidebar";
import { UserNav } from "./user-nav";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import { importAllDataFromFiles } from "@/modules/core/lib/import-service";
import { addSuggestion } from "@/modules/core/lib/suggestions-actions";
import { format, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Loader2, RefreshCw, Clock, DollarSign, Send, MessageSquare, Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import Link from "next/link";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user, companyData, setCompanyData, exchangeRateData, refreshExchangeRate, updateUnreadSuggestionsCount, notifications, markAsRead } = useAuth();
  const { hasPermission } = useAuthorization(['admin:import:run']);
  const { toast } = useToast();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isRateRefreshing, setIsRateRefreshing] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [isSuggestionDialogOpen, setSuggestionDialogOpen] = useState(false);

  const unreadNotifications = notifications.filter(n => !n.isRead);

  const isSyncOld = companyData?.lastSyncTimestamp && companyData?.syncWarningHours 
    ? (new Date().getTime() - parseISO(companyData.lastSyncTimestamp).getTime()) > (companyData.syncWarningHours * 60 * 60 * 1000) 
    : false;

  const handleFullSync = async () => {
    if (!hasPermission('admin:import:run')) {
      toast({ title: "Acceso Denegado", description: "No tienes permiso para sincronizar.", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    try {
        const results = await importAllDataFromFiles();
        toast({ title: "Sincronización Exitosa", description: `Se han procesado ${results.length} tipos de datos.` });
        if (companyData) setCompanyData({ ...companyData, lastSyncTimestamp: new Date().toISOString() });
    } catch (error: unknown) {
         toast({ title: "Error en Sincronización", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleSuggestionSubmit = async () => {
      if (!suggestion.trim() || !user) return;
      setIsSubmittingSuggestion(true);
      try {
          await addSuggestion(suggestion, user.id, user.name);
          toast({ title: "¡Gracias!", description: "Sugerencia enviada." });
          setSuggestion("");
          setSuggestionDialogOpen(false);
      } catch (error: unknown) {
          toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
      } finally {
          setIsSubmittingSuggestion(false);
      }
  };

  return (
    <header className="sticky top-0 z-10 flex h-auto min-h-16 items-center gap-4 border-b bg-background/80 px-4 py-2 backdrop-blur-sm md:px-6 md:h-16">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-2xl font-semibold hidden sm:block">{title}</h1>
      </div>
      <div className="ml-auto flex items-center justify-end gap-2 flex-wrap">
        {exchangeRateData.rate && (
            <div className="hidden items-center gap-2 text-sm text-muted-foreground p-2 border rounded-lg md:flex">
                <DollarSign className="h-4 w-4"/>
                <span>TC Venta: <strong>{exchangeRateData.rate.toLocaleString('es-CR')}</strong></span>
            </div>
        )}
        
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadNotifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            {unreadNotifications.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-sm">Notificaciones</h3>
                    {unreadNotifications.length > 0 && (
                        <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => markAsRead(unreadNotifications.map(n => n.id))}>
                            Marcar todas leídas
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length > 0 ? (
                        <div className="divide-y">
                            {notifications.map((n) => (
                                <Link 
                                    key={n.id} 
                                    href={n.href} 
                                    onClick={() => markAsRead([n.id])}
                                    className={cn("block p-4 hover:bg-muted transition-colors", !n.isRead && "bg-primary/5")}
                                >
                                    <p className={cn("text-xs leading-relaxed", !n.isRead && "font-semibold")}>{n.message}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{format(parseISO(n.timestamp), 'dd/MM HH:mm')}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center text-xs text-muted-foreground italic">No hay notificaciones.</div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>

        {companyData?.lastSyncTimestamp && (
            <Button onClick={handleFullSync} disabled={isSyncing || !hasPermission('admin:import:run')} size="sm" variant="outline" className={cn("hidden md:inline-flex", isSyncOld && "border-red-500/50 bg-red-50 text-red-500")}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                <span>Sincronizar ERP</span>
            </Button>
        )}

        <Dialog open={isSuggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span className="hidden md:inline">Sugerencias</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Buzón de Sugerencias</DialogTitle>
                    <DialogDescription>¿Cómo podemos mejorar la plataforma?</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <Textarea placeholder="Describe tu idea..." rows={4} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button onClick={handleSuggestionSubmit} disabled={isSubmittingSuggestion || !suggestion.trim()}>
                        {isSubmittingSuggestion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Enviar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <UserNav />
      </div>
    </header>
  );
}
