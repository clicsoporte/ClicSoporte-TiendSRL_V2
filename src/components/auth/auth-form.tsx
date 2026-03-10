/**
 * @fileoverview Client component for handling the authentication form,
 * including login and forced password change.
 */
"use client";

import { Button } from "../ui/button";
import { CardFooter } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import React, { useState } from "react";
import type { User } from "@/modules/core/types";
import { useToast } from "@/modules/core/hooks/use-toast";
import { login, updateUser } from "@/modules/core/lib/auth-client";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

interface AuthFormProps {
  clientInfo: {
    ip: string;
    host: string;
  };
}

export function AuthForm({ }: AuthFormProps) {
  const { toast } = useToast();
  const { refreshAuth } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // State for forced password change
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [userToUpdate, setUserToUpdate] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  if (mustChangePassword) {
      return (
        <form onSubmit={handlePasswordChange} className="space-y-4">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Seguridad</AlertTitle>
                <AlertDescription>Debes establecer una nueva contraseña.</AlertDescription>
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
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Actualizar e Ingresar"}
            </Button>
        </form>
      );
  }

  return (
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
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <CardFooter className="p-0 pt-4">
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Sesión"}
            </Button>
        </CardFooter>
    </form>
  );
}
