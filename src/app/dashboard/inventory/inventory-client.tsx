'use client';

/**
 * @fileoverview Client component for the Inventory module.
 * Features an omnibox search and result list.
 */

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Laptop, ShieldCheck, PlusCircle, Loader2, ArrowRight, ArrowLeft, History, Package, Receipt } from 'lucide-react';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { omniSearch } from '@/modules/inventory/lib/actions';
import { getWarrantyStatus } from '@/modules/inventory/lib/inventory-utils';
import type { InventorySearchResult } from '@/modules/core/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EquipmentDetail } from '@/components/inventory/equipment-detail';
import { EquipmentForm } from '@/components/inventory/equipment-form';
import { SaleRecordForm } from '@/components/inventory/sale-record-form';
import Link from 'next/link';

export default function InventoryClient() {
    const { setTitle } = usePageTitle();
    const { hasPermission } = useAuthorization();
    
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<InventorySearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
    const [isEqFormOpen, setEqFormOpen] = useState(false);
    const [isSaleFormOpen, setSaleFormOpen] = useState(false);

    useEffect(() => {
        setTitle("Control de Hardware e Inventario");
    }, [setTitle]);

    const handleSearch = async (p = 1) => {
        if (!query.trim()) return;
        setIsSearching(true);
        try {
            const res = await omniSearch(query, p);
            setResults(res.results);
            setHasMore(res.hasMore);
            setPage(p);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Gestión de Equipos</h1>
                    <p className="text-sm text-muted-foreground">Localiza hardware, verifica garantías y consulta insumos.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/inventory/warranty-hub">
                            <ShieldCheck className="mr-2 h-4 w-4" /> Hub de Garantías
                        </Link>
                    </Button>
                    {hasPermission('inventory:manage') && (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setSaleFormOpen(true)}>
                                <Receipt className="mr-2 h-4 w-4" /> Venta/Garantía
                            </Button>
                            <Button onClick={() => setEqFormOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Registrar Equipo
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Card className="shadow-lg border-primary/20">
                <CardHeader className="pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                        <Input 
                            className="pl-10 h-14 text-lg border-2 focus-visible:ring-primary shadow-inner"
                            placeholder="Buscar por Serial, Factura, Dueño o Nombre del equipo..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
                            autoFocus
                        />
                        <Button 
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-10"
                            onClick={() => handleSearch(1)}
                            disabled={isSearching}
                        >
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {results.length > 0 ? (
                            <div className="divide-y border rounded-lg overflow-hidden bg-card">
                                {results.map((result, idx) => (
                                    <div 
                                        key={`${result.type}-${idx}`}
                                        className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between group transition-colors"
                                        onClick={() => {
                                            if (result.type === 'equipment') setSelectedEquipmentId(result.data.id);
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "p-3 rounded-xl",
                                                result.type === 'equipment' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                                            )}>
                                                {result.type === 'equipment' ? <Laptop className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-lg">
                                                        {result.type === 'equipment' ? result.data.nickname : (result.data as any).productName}
                                                    </p>
                                                    <Badge variant="outline" className="text-[10px] uppercase">{result.type}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground font-mono">
                                                    {result.type === 'equipment' 
                                                        ? `${result.data.brand} ${result.data.model} | S/N: ${result.data.serialNumber}`
                                                        : `Factura: ${(result.data as any).invoiceNumber} | S/N: ${result.data.serialNumber}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {result.type === 'warranty' && (
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground">Estado Garantía</p>
                                                    <Badge className="capitalize">
                                                        {getWarrantyStatus((result.data as any).warrantyExpiry, (result.data as any).warrantyStatus)}
                                                    </Badge>
                                                </div>
                                            )}
                                            <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : query && !isSearching ? (
                            <div className="text-center py-20 border-2 border-dashed rounded-xl">
                                <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p className="text-muted-foreground">No se encontraron resultados para &quot;{query}&quot;</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-muted/20 border-dashed">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs uppercase font-black text-primary tracking-widest flex items-center gap-2">
                                            <Package className="h-3 w-3"/> Insumos Rápidos
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-muted-foreground">Registra equipos para tener un historial de qué tóners o cargadores usan tus clientes.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {(hasMore || page > 1) && (
                            <div className="flex justify-center gap-2 pt-4">
                                <Button variant="outline" size="sm" onClick={() => handleSearch(page - 1)} disabled={page === 1}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleSearch(page + 1)} disabled={!hasMore}>
                                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <EquipmentDetail 
                equipmentId={selectedEquipmentId} 
                onClose={() => setSelectedEquipmentId(null)} 
            />

            <EquipmentForm 
                isOpen={isEqFormOpen} 
                onClose={() => setEqFormOpen(false)} 
                onSuccess={() => handleSearch(page)} 
            />

            <SaleRecordForm 
                isOpen={isSaleFormOpen} 
                onClose={() => setSaleFormOpen(false)} 
                onSuccess={() => handleSearch(page)} 
            />
        </main>
    );
}
