/**
 * @fileoverview Page for managing offline license security settings.
 */
'use client';

import { useState } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Download, AlertTriangle, Loader2, Server } from 'lucide-react';
import { generateNewKeys, getPublicKeyData } from '@/modules/licenses/lib/actions';

export default function LicenseSettingsPage() {
    const { isAuthorized } = useAuthorization(['licenses:admin:keys']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    setTitle('Configuración de Licencias');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerateConfirmOpen, setGenerateConfirmOpen] = useState(false);
    const [generateStep, setGenerateStep] = useState(0);
    const [generateConfirmationText, setGenerateConfirmationText] = useState('');

    const handleGenerateKeys = async () => {
        if (generateStep !== 2 || generateConfirmationText !== 'GENERAR NUEVAS CLAVES') {
            toast({ title: "Confirmación Estricta Requerida", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await generateNewKeys();
            if (result.success) {
                toast({ title: "Éxito", description: result.message });
            } else {
                toast({ title: "Error", description: result.message, variant: 'destructive' });
            }
            setGenerateConfirmOpen(false);
        } catch (error: unknown) {
            toast({ title: "Error Crítico", description: (error as Error).message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadPublicKey = async () => {
        const publicKey = await getPublicKeyData();
        if (!publicKey) {
            toast({ title: "Clave no encontrada", description: "Primero debe generar un par de claves.", variant: "destructive" });
            return;
        }
        const blob = new Blob([publicKey], { type: 'application/x-pem-file' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'public_key.pem';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!isAuthorized) {
        return null; // Authorization hook handles redirection
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <KeyRound className="h-8 w-8 text-destructive" />
                            <div>
                                <CardTitle>Seguridad de Licenciamiento (Zona de Peligro)</CardTitle>
                                <CardDescription>
                                    Gestiona las claves criptográficas para la firma de licencias offline. Estas acciones son críticas y deben usarse con precaución.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <AlertDialog open={isGenerateConfirmOpen} onOpenChange={(open) => { setGenerateConfirmOpen(open); if (!open) { setGenerateStep(0); setGenerateConfirmationText(''); }}}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full">
                                        <Server className="mr-2 h-4 w-4"/>
                                        Generar Nuevo Par de Claves
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle/>¡ACCIÓN IRREVERSIBLE!</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Generar un nuevo par de claves **invalidará todas las licencias offline que hayas emitido previamente**. Solo procede si estás seguro de que quieres empezar de cero o si las claves actuales se han visto comprometidas.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="py-4 space-y-4">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="generate-keys-confirm-checkbox" onCheckedChange={(checked) => setGenerateStep(checked ? 1 : 0)} />
                                            <Label htmlFor="generate-keys-confirm-checkbox" className="font-medium text-destructive">Entiendo que esto invalidará todas las licencias existentes.</Label>
                                        </div>
                                        {generateStep > 0 && (
                                            <div className="space-y-2">
                                                <Label htmlFor="generate-keys-confirmation-text">Para confirmar, escribe &quot;GENERAR NUEVAS CLAVES&quot; en el campo:</Label>
                                                <Input id="generate-keys-confirmation-text" value={generateConfirmationText} onChange={(e) => { setGenerateConfirmationText(e.target.value.toUpperCase()); if (e.target.value.toUpperCase() === 'GENERAR NUEVAS CLAVES') {setGenerateStep(2);} else {setGenerateStep(1);}}} className="border-destructive focus-visible:ring-destructive" />
                                            </div>
                                        )}
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleGenerateKeys} disabled={isSubmitting || generateStep !== 2 || generateConfirmationText !== 'GENERAR NUEVAS CLAVES'}>
                                            {isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : <KeyRound className="mr-2"/>}
                                            Sí, Generar Claves
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button variant="secondary" onClick={handleDownloadPublicKey} className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Descargar Clave Pública
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
