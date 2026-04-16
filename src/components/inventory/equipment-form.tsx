'use client';

/**
 * @fileoverview Form for creating or editing IT equipment.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { saveEquipment } from '@/modules/inventory/lib/actions';
import { useToast } from '@/modules/core/hooks/use-toast';
import { Loader2, ShieldCheck, Laptop, Printer, Monitor, Radio, Phone, HardDrive, Cpu } from 'lucide-react';
import type { Equipment, EquipmentCategory } from '@/modules/core/types';

interface EquipmentFormProps {
    equipment?: Partial<Equipment>;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const categories: { value: EquipmentCategory; label: string; icon: any }[] = [
    { value: 'laptop', label: 'Laptop', icon: Laptop },
    { value: 'desktop', label: 'Computadora Mesa', icon: Cpu },
    { value: 'printer', label: 'Impresora', icon: Printer },
    { value: 'monitor', label: 'Monitor', icon: Monitor },
    { value: 'network', label: 'Red (Router/Switch)', icon: Radio },
    { value: 'phone', label: 'Telefonía IP', icon: Phone },
    { value: 'other', label: 'Otros Insumos', icon: HardDrive },
];

export function EquipmentForm({ equipment, isOpen, onClose, onSuccess }: EquipmentFormProps) {
    const { customers } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Equipment>>(equipment || {
        nickname: '',
        category: 'laptop',
        brand: '',
        model: '',
        status: 'active',
        clientId: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.clientId || !formData.nickname) return;
        
        setIsLoading(true);
        try {
            const id = formData.id || crypto.randomUUID();
            await saveEquipment({
                ...formData as Equipment,
                id,
                status: formData.status || 'active'
            });
            toast({ title: "Equipo Guardado", description: "La ficha técnica ha sido actualizada correctamente." });
            onSuccess();
            onClose();
        } catch {
            toast({ title: "Error", description: "No se pudo guardar el equipo.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>{formData.id ? 'Editar' : 'Registrar'} Hardware</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cliente Propietario</Label>
                                <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})} required>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v as EquipmentCategory})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.value} value={c.value}>
                                                <div className="flex items-center gap-2">
                                                    <c.icon className="h-4 w-4" /> {c.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Nombre Descriptivo (Alias)</Label>
                            <Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="Ej: Laptop Diseño Luis, Servidor SQL..." required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Marca</Label>
                                <Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Modelo</Label>
                                <Input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Número de Serie (S/N)</Label>
                            <Input value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})} placeholder="S/N único del fabricante" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ubicación Física</Label>
                                <Input value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Ej: Oficina 3, Recepción..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Usuario Asignado</Label>
                                <Input value={formData.assignedUser || ''} onChange={e => setFormData({...formData, assignedUser: e.target.value})} placeholder="Nombre de la persona que lo usa" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notas Técnicas</Label>
                            <Textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} />
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/10">
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            Guardar Ficha
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
