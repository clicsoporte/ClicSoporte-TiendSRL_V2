'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getCompanySettings, saveCompanySettings } from '@/modules/core/lib/settings-db';
import type { Company } from '@/modules/core/types';
import { Loader2, Save, Building2, Settings2 } from 'lucide-react';
import { useAuth } from '@/modules/core/hooks/useAuth';

/**
 * Converts decimal hours to HH:MM format.
 */
const toHHMM = (decimalHours: number | null | undefined): string => {
    if (decimalHours === null || decimalHours === undefined) return '';
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Converts a string (either decimal or HH:MM) to decimal hours.
 */
const toDecimalHours = (input: string): number | null => {
    if (!input) return null;
    if (input.includes(':')) {
        const [hours, minutes] = input.split(':').map(Number);
        return (hours || 0) + ((minutes || 0) / 60);
    } else {
        const normalized = input.replace(',', '.');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? null : parsed;
    }
};

export default function GeneralSettingsClient() {
    const { toast } = useToast();
    const { setCompanyData: setAuthCompanyData } = useAuth();
    const [company, setCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [syncWarningDisplay, setSyncWarningDisplay] = useState('');

    useEffect(() => {
        const load = async () => {
            const data = await getCompanySettings();
            setCompany(data);
            setSyncWarningDisplay(toHHMM(data.syncWarningHours));
            setIsLoading(false);
        };
        load();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!company) return;
        setCompany({ ...company, [e.target.id]: e.target.value });
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!company) return;
        setCompany({ ...company, [e.target.id]: Number(e.target.value) });
    };

    const handleSyncWarningChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSyncWarningDisplay(value);
        if (company) {
            const decimal = toDecimalHours(value);
            setCompany({ ...company, syncWarningHours: decimal || 0 });
        }
    };

    const handleSave = async () => {
        if (!company) return;
        setIsSaving(true);
        try {
            await saveCompanySettings(company);
            setAuthCompanyData(company);
            toast({ title: "Configuración General Guardada" });
        } catch {
            toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !company) return <div className="p-8"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Datos de la Empresa</CardTitle>
                    <CardDescription>Información legal y de contacto que aparecerá en los documentos generados.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nombre de Fantasía / Sistema</Label>
                            <Input id="systemName" value={company.systemName} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Razón Social</Label>
                            <Input id="name" value={company.name} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Cédula Jurídica</Label>
                            <Input id="taxId" value={company.taxId} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Correo Electrónico</Label>
                            <Input id="email" type="email" value={company.email} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Teléfono</Label>
                            <Input id="phone" value={company.phone} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Dirección Física</Label>
                        <Input id="address" value={company.address} onChange={handleChange} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Ajustes de Interfaz y Rendimiento</CardTitle>
                    <CardDescription>Configuración global para la experiencia de usuario y el acceso a la aplicación.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="systemVersion">Versión del Sistema</Label>
                        <Input 
                            id="systemVersion"
                            value={company.systemVersion || ''}
                            onChange={handleChange}
                        />
                        <p className="text-xs text-muted-foreground pt-1">
                            El número de versión que se muestra en la aplicación.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="searchDebounceTime">Retraso de Búsqueda (ms)</Label>
                        <Input 
                            id="searchDebounceTime"
                            type="number"
                            value={company.searchDebounceTime ?? ''}
                            onChange={handleNumberChange}
                        />
                        <p className="text-xs text-muted-foreground pt-1">
                            Tiempo en milisegundos que el sistema espera antes de buscar (ej: 500 = 0.5s).
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="syncWarningHours">Tiempo para Alerta de Sinc.</Label>
                        <Input 
                            id="syncWarningHours"
                            type="text"
                            placeholder="HH:MM"
                            value={syncWarningDisplay}
                            onChange={handleSyncWarningChange}
                        />
                        <p className="text-xs text-muted-foreground pt-1">
                            Después de cuánto tiempo sin sincronizar se mostrará la alerta. Formato HH:MM o decimal (ej: 0.5 para 30 min).
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="publicUrl">URL Pública de la Aplicación</Label>
                        <Input 
                            id="publicUrl"
                            type="url"
                            value={company.publicUrl || ''}
                            onChange={handleChange}
                            placeholder="Ej: https://intranet.miempresa.com"
                        />
                        <p className="text-xs text-muted-foreground pt-1">
                            Importante para generar códigos QR correctos si la aplicación está detrás de un proxy.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="border-t pt-6">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Toda la Configuración
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
