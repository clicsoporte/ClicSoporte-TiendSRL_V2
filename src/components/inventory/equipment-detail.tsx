'use client';

/**
 * @fileoverview Slide-over component for equipment details.
 */

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ShieldCheck, QrCode, UserCircle, MapPin, ExternalLink, Calendar, Receipt, MessageSquare } from 'lucide-react';
import { getEquipmentDetails } from '@/modules/inventory/lib/actions';
import { getWarrantyStatus } from '@/modules/inventory/lib/inventory-utils';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Equipment, Consumable, SaleRecord } from '@/modules/core/types';

interface EquipmentDetailProps {
    equipmentId: string | null;
    onClose: () => void;
}

interface EquipmentFullData extends Equipment {
    consumables: Consumable[];
    saleRecords: SaleRecord[];
}

export function EquipmentDetail({ equipmentId, onClose }: EquipmentDetailProps) {
    const [data, setData] = useState<EquipmentFullData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { customers } = useAuth();

    useEffect(() => {
        if (equipmentId) {
            setIsLoading(true);
            getEquipmentDetails(equipmentId)
                .then((res) => setData(res as EquipmentFullData))
                .finally(() => setIsLoading(false));
        } else {
            setData(null);
        }
    }, [equipmentId]);

    const client = data ? customers.find(c => c.id === data.clientId) : null;

    return (
        <Sheet open={!!equipmentId} onOpenChange={open => !open && onClose()}>
            <SheetContent className="sm:max-w-xl h-full flex flex-col p-0 overflow-hidden">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : data ? (
                    <>
                        <SheetHeader className="p-6 pb-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Badge variant="outline" className="mb-2 uppercase font-mono text-[10px]">{data.id.substring(0, 8)}</Badge>
                                    <SheetTitle className="text-2xl font-black">{data.nickname}</SheetTitle>
                                    <SheetDescription className="text-lg font-bold text-primary">{client?.name}</SheetDescription>
                                </div>
                                <Button size="icon" variant="outline" title="Ver Ficha QR" onClick={() => window.open(`/api/qr/${data.id}`, '_blank')}>
                                    <QrCode className="h-5 w-5" />
                                </Button>
                            </div>
                        </SheetHeader>

                        <div className="px-6 py-4 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground border-b bg-muted/20">
                            <div className="flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5 text-primary" /> {data.assignedUser || 'Sin asignar'}</div>
                            <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> {data.location || 'N/A'}</div>
                            <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> {data.status}</div>
                        </div>

                        <Tabs defaultValue="specs" className="flex-1 overflow-hidden flex flex-col">
                            <TabsList className="px-6 border-b rounded-none h-14 bg-background justify-start gap-4">
                                <TabsTrigger value="specs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 font-bold">Especificaciones</TabsTrigger>
                                <TabsTrigger value="consumables" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 font-bold">
                                    Insumos ({data.consumables?.length || 0})
                                </TabsTrigger>
                                <TabsTrigger value="warranty" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 font-bold">Ventas/Garantías</TabsTrigger>
                            </TabsList>

                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                                <TabsContent value="specs" className="m-0 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Marca</p>
                                            <p className="font-bold">{data.brand}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Modelo</p>
                                            <p className="font-bold">{data.model}</p>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Número de Serie (S/N)</p>
                                            <p className="font-mono bg-muted p-2 rounded text-sm select-all">{data.serialNumber || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3"/> Notas Técnicas
                                        </p>
                                        <p className="text-sm text-muted-foreground leading-relaxed italic">{data.notes || 'Sin observaciones adicionales.'}</p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="consumables" className="m-0 space-y-4">
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-center gap-3">
                                        <Package className="h-5 w-5 text-primary" />
                                        <p className="text-xs text-primary font-medium">Lista de repuestos e insumos específicos para este modelo.</p>
                                    </div>
                                    <div className="space-y-3">
                                        {data.consumables?.map((c) => (
                                            <div key={c.id} className="p-4 border rounded-xl bg-card hover:border-primary transition-colors group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <Badge variant="secondary" className="text-[9px] uppercase font-bold mb-1">{c.type}</Badge>
                                                        <p className="font-bold text-sm">{c.description}</p>
                                                    </div>
                                                    {c.isRecurring && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none text-[8px] h-4">RECURRENTE</Badge>}
                                                </div>
                                                <div className="flex justify-between items-center text-xs mt-3">
                                                    <span className="text-muted-foreground">P/N: <strong className="font-mono text-foreground select-all">{c.partNumber}</strong></span>
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(c.partNumber)}>COPIAR</Button>
                                                </div>
                                            </div>
                                        ))}
                                        {(!data.consumables || data.consumables.length === 0) && (
                                            <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-40">
                                                <p className="text-sm">No hay insumos registrados.</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="warranty" className="m-0 space-y-4">
                                    {data.saleRecords?.map((s) => {
                                        const status = getWarrantyStatus(s.warrantyExpiry, s.warrantyStatus);
                                        return (
                                            <div key={s.id} className="p-4 border rounded-xl bg-card space-y-4 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><Receipt className="h-5 w-5 text-muted-foreground" /></div>
                                                        <div>
                                                            <p className="text-xs font-black uppercase text-muted-foreground">Factura #{s.invoiceNumber}</p>
                                                            <p className="text-[10px] font-bold">{format(parseISO(s.invoiceDate), 'dd/MM/yyyy')}</p>
                                                        </div>
                                                    </div>
                                                    <Badge className={cn(
                                                        "uppercase text-[9px] font-black tracking-widest",
                                                        status === 'active' ? 'bg-green-600' : 
                                                        status === 'expiring' ? 'bg-yellow-500' : 'bg-red-600'
                                                    )}>
                                                        {status}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span>Vence: <strong>{format(parseISO(s.warrantyExpiry), 'dd/MM/yyyy')}</strong></span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span><strong>{s.warrantyMonths}</strong> meses</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!data.saleRecords || data.saleRecords.length === 0) && (
                                        <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-40">
                                            <p className="text-sm">Sin registros de venta en el sistema.</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>

                        <div className="p-6 border-t bg-muted/10 flex justify-end gap-2">
                            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                            <Button variant="outline" className="gap-2">Editar Ficha</Button>
                        </div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
