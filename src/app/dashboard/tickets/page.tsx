
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useEffect } from "react";

export default function TicketsPage() {
    usePageTitle("Soporte Técnico");

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Soporte Técnico</CardTitle>
                    <CardDescription>
                        Próximamente: gestiona tus tickets de soporte desde aquí.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-semibold">Módulo en Construcción</h2>
                        <p className="text-muted-foreground mt-2">
                            La gestión de tickets de soporte estará disponible en una futura actualización.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
