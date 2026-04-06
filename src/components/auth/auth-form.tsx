
/**
 * @fileoverview Client component for handling the authentication form,
 * including login, forced password change, and password recovery.
 * Integrated with SetupWizard for first-time configuration.
 */
"use client";

import { Button } from "../ui/button";
import { CardFooter } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, AlertCircle, Mail, Key } from "lucide-react";
import React, { useState } from "react";
import type { User } from "@/modules/core/types";
import { useToast } from "@/modules/core/hooks/use-toast";
import { login, updateUser, sendRecoveryEmail } from "@/modules/core/lib/auth-client";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { SetupWizard } from "./setup-wizard";

interface AuthFormProps {
  clientInfo: {
    ip: string;
    host: string;
  };
  initialHasUsers: boolean;
}

export function AuthForm({ initialHasUsers }: AuthFormProps) {
  const { toast } = useToast();
  const { refreshAuth } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [userToUpdate, setUserToUpdate] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  // If no users exist, we are in setup mode
  if (!initialHasUsers) {
      return <SetupWizard />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    try {
        const { user, forcePasswordChange } = await login(email, password);

        if (user) {
            if (forcePasswordChange) {
                setUserToUpdate(user);
                setMustChangePassword(true);
                setIsLoggingIn(false);
                toast({
                    title: "Actualización Requerida",
                    description: "Por seguridad, debes cambiar tu contraseña antes de ingresar."
                });
            } else {
                await refreshAuth();
                window.location.href = '/dashboard';
            }
        } else {
            toast({
                title: "Credenciales Incorrectas",
                description: "El correo o la contraseña no son correctos.",
                variant: "destructive",
            });
            setIsLoggingIn(false);
        }
    } catch {
        toast({ title: "Error", description: "Hubo un problema al conectar con el servidor.", variant: "destructive" });
        setIsLoggingIn(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToUpdate) return;

    if (newPassword.length < 6) {
        toast({ title: "Contraseña Débil", description: "Mínimo 6 caracteres.", variant: "destructive" });
        return;
    }

    if (newPassword !== confirmPassword) {
        toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
        return;
    }

    setIsLoggingIn(true);
    try {
        await updateUser({
            ...userToUpdate,
            password: newPassword,
            forcePasswordChange: false
        });
        
        toast({ title: "Contraseña Actualizada", description: "Ya puedes ingresar al sistema." });
        await refreshAuth();
        window.location.href = '/dashboard';
    } catch {
        toast({ title: "Error", description: "No se pudo actualizar la contraseña.", variant: "destructive" });
        setIsLoggingIn(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;

    setIsSendingRecovery(true);
    try {
        await sendRecoveryEmail(recoveryEmail);
        toast({
            title: "Correo Enviado",
            description: "Si el correo está registrado, recibirás una clave temporal en unos minutos."
        });
        setIsRecoveryOpen(false);
        setRecoveryEmail("");
    } catch (error: unknown) {
        const err = error as Error;
        toast({
            title: "Error de Recuperación",
            description: err.message || "No se pudo procesar la solicitud.",
            variant: "destructive"
        });
    } finally {
        setIsSendingRecovery(false);
    }
  };

  if (mustChangePassword) {
      return (
        <form onSubmit={handlePasswordChange} className="space-y-4">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Seguridad</AlertTitle>
                <AlertDescription>Debes establecer una nueva contraseña personal.</AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                Actualizar e Ingresar
            </Button>
        </form>
      );
  }

  return (
    <div className="space-y-4">
        <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <Dialog open={isRecoveryOpen} onOpenChange={setIsRecoveryOpen}>
                        <DialogTrigger asChild>
                            <button type="button" className="text-xs font-medium text-primary hover:underline underline-offset-4">
                                ¿Olvidaste tu contraseña?
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <form onSubmit={handleRecoverySubmit}>
                                <DialogHeader>
                                    <DialogTitle>Recuperación de Acceso</DialogTitle>
                                    <DialogDescription>
                                        Ingresa tu correo institucional para recibir una contraseña temporal.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="recovery-email">Correo Electrónico</Label>
                                        <Input 
                                            id="recovery-email" 
                                            type="email" 
                                            placeholder="tu@correo.com" 
                                            value={recoveryEmail}
                                            onChange={e => setRecoveryEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="sm:justify-between">
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Cancelar</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isSendingRecovery}>
                                        {isSendingRecovery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                        Enviar Clave Temporal
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <CardFooter className="p-0 pt-4">
                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                    {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Sesión"}
                </Button>
            </CardFooter>
        </form>
    </div>
  );
}
