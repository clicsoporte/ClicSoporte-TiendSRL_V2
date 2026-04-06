
'use client';

/**
 * @fileoverview Setup Wizard component for the first administrator creation.
 */

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { createFirstUser } from "@/modules/core/lib/user-actions";
import { useToast } from "@/modules/core/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

export function SetupWizard() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirm: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirm) {
            toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
            return;
        }
        if (formData.password.length < 8) {
            toast({ title: "Contraseña muy corta", description: "Mínimo 8 caracteres.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            await createFirstUser({
                name: formData.name,
                email: formData.email,
                password: formData.password
            });
            toast({ title: "Configuración Exitosa", description: "Primer administrador creado correctamente." });
            // Reload page to show login
            window.location.reload();
        } catch (error: unknown) {
            toast({ title: "Error en configuración", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Primer Inicio Detectado</AlertTitle>
                <AlertDescription className="text-blue-700 text-xs">
                    Bienvenido a Clic-Tools. Define los datos del administrador principal para comenzar.
                </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="setup-name">Nombre Completo</Label>
                    <Input 
                        id="setup-name" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="Ej: Administrador TI"
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="setup-email">Correo Electrónico</Label>
                    <Input 
                        id="setup-email" 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        placeholder="tu@correo.com"
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="setup-pass">Contraseña Maestra</Label>
                    <Input 
                        id="setup-pass" 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="setup-confirm">Confirmar Contraseña</Label>
                    <Input 
                        id="setup-confirm" 
                        type="password" 
                        value={formData.confirm} 
                        onChange={e => setFormData({...formData, confirm: e.target.value})} 
                        required 
                    />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Finalizar Configuración
                </Button>
            </form>
        </div>
    );
}
