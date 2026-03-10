'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getApiSettings, saveApiSettings } from '@/modules/core/lib/settings-db';
import type { ApiSettings } from '@/modules/core/types';
import { Loader2, Save, Network } from 'lucide-react';

export default function ApiSettingsClient() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<ApiSettings>({
        exchangeRateApi: '',
        haciendaExemptionApi: '',
        haciendaTributariaApi: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            const data = await getApiSettings();
            if (data) setSettings(data);
            setIsLoading(false);
        };
        load();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveApiSettings(settings);
            toast({ title: "Configuración Guardada" });
        } catch {
            toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" /> Configuración de APIs Externas</CardTitle>
                    <CardDescription>Define los puntos de enlace para los servicios de Hacienda y Tipo de Cambio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>API Tipo de Cambio (BCCR/Indicadores)</Label>
                        <Input value={settings.exchangeRateApi} onChange={e => setSettings({...settings, exchangeRateApi: e.target.value})} placeholder="https://api.ejemplo.com/tipo-cambio" />
                    </div>
                    <div className="space-y-2">
                        <Label>API Consulta Exoneraciones (Hacienda)</Label>
                        <Input value={settings.haciendaExemptionApi} onChange={e => setSettings({...settings, haciendaExemptionApi: e.target.value})} placeholder="https://api.hacienda.go.cr/exoneraciones/" />
                    </div>
                    <div className="space-y-2">
                        <Label>API Situación Tributaria (Hacienda)</Label>
                        <Input value={settings.haciendaTributariaApi} onChange={e => setSettings({...settings, haciendaTributariaApi: e.target.value})} placeholder="https://api.hacienda.go.cr/situacion-tributaria/" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar API Settings
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
