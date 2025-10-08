/**
 * @fileoverview Page for the Cost Assistant module.
 * Allows users to upload purchase invoice XMLs and calculate selling prices.
 */
'use client';

import { useState } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileScan } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CostAssistantPage() {
    useAuthorization(['dashboard:access']); // Basic access permission
    const { setTitle } = usePageTitle();
    const [isLoading, setIsLoading] = useState(false);

    useState(() => {
        setTitle("Asistente de Costos");
    });

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-6 w-full max-w-md mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card className="max-w-6xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-600 text-white">
                            <FileScan className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl">Asistente de Costos y Precios</CardTitle>
                            <CardDescription>Carga facturas de compra en formato XML para extraer artículos y calcular precios de venta.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Próximamente: Área para cargar archivos XML y tabla de resultados.</p>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}

    