'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/modules/core/hooks/use-toast';
import { getCompanySettings, saveCompanySettings } from '@/modules/core/lib/settings-db';
import type { Company } from '@/modules/core/types';
import { Loader2, Save, Building2 } from 'lucide-react';
import { useAuth } from '@/modules/core/hooks/useAuth';

export default function GeneralSettingsClient() {
    const { toast } = useToast();
    const { setCompanyData: setAuthCompanyData } = useAuth();
    const [company, setCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            const data = await getCompanySettings();
            setCompany(data);
            setIsLoading(false);
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!company) return;
        setIsSaving(true);
        try {
            await saveCompanySettings(company);
            setAuthCompanyData(company);
            toast({ title: "Configuración General Guardada" });
        } catch (e) {
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
                            <Input value={company.systemName} onChange={e => setCompany({...company, systemName: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Razón Social</Label>
                            <Input value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Cédula Jurídica</Label>
                            <Input value={company.taxId} onChange={e => setCompany({...company, taxId: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Correo Electrónico</Label>
                            <Input type="email" value={company.email} onChange={e => setCompany({...company, email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Teléfono</Label>
                            <Input value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Dirección Física</Label>
                        <Input value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Cambios
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
