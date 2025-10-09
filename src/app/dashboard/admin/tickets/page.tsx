
'use client';

import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect } from 'react';

export default function TicketSettingsPage() {
    const { setTitle } = usePageTitle();
    useEffect(() => {
        setTitle("Configuración de Tickets");
    }, [setTitle]);

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-bold">Configuración del Módulo de Tickets</h1>
            <p className="text-muted-foreground">
                Próximamente: Aquí podrás configurar los Temas de Ayuda, SLAs, y más.
            </p>
        </main>
    )
}
