'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useEffect } from "react";

export default function RemovedPage() {
    const { setTitle } = usePageTitle();
    
    useEffect(() => {
        setTitle("Módulo Eliminado");
    }, [setTitle]);

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Módulo Eliminado</CardTitle>
                    <CardDescription>Esta funcionalidad ya no forma parte del sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">El módulo de solicitudes de compra ha sido removido completamente de la aplicación.</p>
                </CardContent>
            </Card>
        </main>
    );
}
