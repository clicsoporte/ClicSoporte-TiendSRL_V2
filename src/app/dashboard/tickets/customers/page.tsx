
/**
 * @fileoverview Page for managing client companies for the support ticket module.
 */
'use client';

import { useTickets } from '@/modules/tickets/hooks/useTickets';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useEffect } from 'react';

export default function TicketCustomersPage() {
    const { isAuthorized, hasPermission } = useAuthorization(['tickets:create']);
    const { setTitle } = usePageTitle();
    const { state: ticketState, actions: ticketActions } = useTickets();

    useEffect(() => {
        setTitle("Gestión de Clientes de Soporte");
    }, [setTitle]);

    if (!isAuthorized) {
        return null;
    }

    if (ticketState.isLoading) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-64"/>
                        <Skeleton className="h-4 w-96 mt-2"/>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                 </Card>
            </main>
        );
    }
    
    // This is a placeholder for a more complex UI that will be built in the next steps.
    // For now, it will just list the client companies.
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Empresas Clientes</CardTitle>
                    <CardDescription>
                       Gestiona las empresas clientes a las que se les brinda soporte. (Funcionalidad en desarrollo)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <p className="text-center text-muted-foreground py-8">
                        La gestión completa de empresas, sucursales y contactos se implementará en la siguiente etapa.
                     </p>
                </CardContent>
            </Card>
        </main>
    )
}
