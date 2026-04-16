'use client';

/**
 * @fileoverview Form for registering sale records and warranties.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { saveSaleRecord, getEquipmentByClient } from '@/modules/inventory/lib/actions';
import { useToast } from '@/modules/core/hooks/use-toast';
import { Loader2, Receipt } from 'lucide-react';
import type { SaleRecord, Equipment } from '@/modules/core/types';
import { addMonths } from 'date-fns';

interface SaleRecordFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function SaleRecordForm({ isOpen, onClose, onSuccess }: SaleRecordFormProps) {
    const { customers } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [customerEquipment, setCustomerEquipment] = useState<Equipment[]>([]);
    
    const [formData, setFormData] = useState<Partial<SaleRecord>>({
        clientId: '',
        equipmentId: null,
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        warrantyMonths: 12,
        serialNumber: '',
        warrantyStatus: 'active'
    });

    useEffect(() => {
        if (formData.clientId) {
            getEquipmentByClient(formData.clientId).then(setCustomerEquipment);
        } else {
            setCustomerEquipment([]);
        }
    }, [formData.clientId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.clientId || !formData.invoiceNumber || !formData.serialNumber) return;

        setIsLoading(true);
        try {
            const expiry = addMonths(new Date(formData.invoiceDate!), formData.warrantyMonths!);
            await saveSaleRecord({
                ...formData as SaleRecord,
                id: crypto.randomUUID(),
                warrantyExpiry: expiry.toISOString()
            });
            toast({ title: "Garantía Registrada" });
            onSuccess();
            onClose();
        } catch {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <DialogHeader>
                        <DialogTitle>Registrar Venta / Garantía</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Cliente</Label>
                            <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})} required>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Vincular a Hardware (Opcional)</Label>
                            <Select value={formData.equipmentId || 'none'} onValueChange={v => setFormData({...formData, equipmentId: v === 'none' ? null : v})}>
                                <SelectTrigger><SelectValue placeholder="Independiente" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Producto Independiente / Periférico</SelectItem>
                                    {customerEquipment.map(e => <SelectItem key={e.id} value={e.id}>{e.nickname}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {!formData.equipmentId && (
                            <div className="space-y-2">
                                <Label>Nombre del Producto</Label>
                                <Input value={formData.productName || ''} onChange={e => setFormData({...formData, productName: e.target.value})} required />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Número de Factura</Label>
                                <Input value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha de Venta</Label>
                                <Input type="date" value={formData.invoiceDate} onChange={e => setFormData({...formData, invoiceDate: e.target.value})} required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Número de Serie (S/N)</Label>
                            <Input value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} required />
                        </div>

                        <div className="space-y-3">
                            <Label>Meses de Garantía</Label>
                            <RadioGroup value={String(formData.warrantyMonths)} onValueChange={v => setFormData({...formData, warrantyMonths: Number(v)})} className="flex flex-wrap gap-4">
                                {[3, 6, 12, 24, 36].map(m => (
                                    <div key={m} className="flex items-center space-x-2">
                                        <RadioGroupItem value={String(m)} id={`m-${m}`} />
                                        <Label htmlFor={`m-${m}`}>{m}m</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={isLoading} className="w-full">
                            {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                            Registrar Garantía
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
