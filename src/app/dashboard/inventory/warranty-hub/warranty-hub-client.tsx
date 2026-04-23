'use client';

/**
 * @fileoverview Client component for the Warranty Hub.
 * Lists and filters all hardware warranties with incremental loading.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Search, FilterX, Loader2, Calendar, FileText, UserCircle, Receipt, ChevronDown } from 'lucide-react';
import { getAllSaleRecords } from '@/modules/inventory/lib/actions';
import { getWarrantyStatus } from '@/modules/inventory/lib/inventory-utils';
import type { SaleRecord } from '@/modules/core/types';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useDebounce } from 'use-debounce';

export default function WarrantyHubClient() {
    const { setTitle } = usePageTitle();
    const { customers } = useAuth();
    
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch] = useDebounce(searchTerm, 500);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const fetchData = useCallback(async (currentPage: number, search: string, isLoadMore: boolean = false) => {
        if (isLoadMore) setIsLoadingMore(true);
        else setIsLoading(true);

        try {
            const result = await getAllSaleRecords(currentPage, 20, search);
            if (isLoadMore) {
                setSales(prev => [...prev, ...result.data]);
            } else {
                setSales(result.data);
            }
            setHasMore(result.hasMore);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    // Effect for search reset
    useEffect(() => {
        setPage(1);
        fetchData(1, debouncedSearch, false);
    }, [debouncedSearch, fetchData]);

    useEffect(() => {
        setTitle("Centro de Garantías (Hub)");
    }, [setTitle]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchData(nextPage, debouncedSearch, true);
    };

    const handleClear = () => {
        setSearchTerm("");
        setPage(1);
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Auditoría de Garantías</h1>
                    <p className="text-sm text-muted-foreground">Monitor de vencimientos proactivo para servicios técnicos.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Filtrar por S/N, Factura o Artículo..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleClear}>
                            <FilterX className="mr-2 h-4 w-4" /> Limpiar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border overflow-hidden bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Artículo</TableHead>
                                    <TableHead>Serial</TableHead>
                                    <TableHead>Factura / ERP</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-xs text-muted-foreground">Cargando registros...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : sales.length > 0 ? (
                                    sales.map(sale => {
                                        const status = getWarrantyStatus(sale.warrantyExpiry, sale.warrantyStatus);
                                        const client = customers.find(c => c.id === sale.clientId);
                                        
                                        return (
                                            <TableRow key={sale.id} className="text-xs group hover:bg-muted/30">
                                                <TableCell className="font-bold">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {sale.productName || 'Hardware Independiente'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] select-all">{sale.serialNumber}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 font-black uppercase text-primary">
                                                        <Receipt className="h-3 w-3" /> {sale.invoiceNumber}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <UserCircle className="h-3 w-3 text-muted-foreground" />
                                                        {client?.name || sale.clientId}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {format(parseISO(sale.warrantyExpiry), 'dd/MM/yyyy')}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        "uppercase text-[9px] font-black h-5",
                                                        status === 'active' ? 'bg-green-600' : 
                                                        status === 'expiring' ? 'bg-yellow-500' : 'bg-red-600'
                                                    )}>
                                                        {status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No se encontraron registros de garantía.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <Button 
                                variant="outline" 
                                onClick={handleLoadMore} 
                                disabled={isLoadingMore}
                                className="w-full sm:w-auto min-w-[200px]"
                            >
                                {isLoadingMore ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ChevronDown className="mr-2 h-4 w-4" />
                                )}
                                Cargar más registros
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
