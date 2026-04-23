'use client';

/**
 * @fileoverview Form for creating or editing IT equipment.
 * Enhanced with Consumable management.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { saveEquipment, getEquipmentDetails } from '@/modules/inventory/lib/actions';
import { useToast } from '@/modules/core/hooks/use-toast';
import { Loader2, ShieldCheck, Laptop, Printer, Monitor, Radio, Phone, HardDrive, Cpu, type LucideIcon, Package, PlusCircle, Trash2, Zap } from 'lucide-react';
import type { Equipment, EquipmentCategory, Consumable, ConsumableType } from '@/modules/core/types';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface EquipmentFormProps {
    equipment?: Partial<Equipment>;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const categories: { value: EquipmentCategory; label: string; icon: LucideIcon }[] = [
    { value: 'laptop', label: 'Laptop', icon: Laptop },
    { value: 'desktop', label: 'Computadora Mesa', icon: Cpu },
    { value: 'printer', label: 'Impresora', icon: Printer },
    { value: 'monitor', label: 'Monitor', icon: Monitor },
    { value: 'network', label: 'Red (Router/Switch)', icon: Radio },
    { value: 'phone', label: 'Telefonía IP', icon: Phone },
    { value: 'other', label: 'Otros Insumos', icon: HardDrive },
];

const consumableTypes: { value: ConsumableType; label: string }[] = [
    { value: 'ink', label: 'Tinta' },
    { value: 'toner', label: 'Tóner' },
    { value: 'drum', label: 'Tambor / Drum' },
    { value: 'ram', label: 'Memoria RAM' },
    { value: 'storage', label: 'Disco / Almacenamiento' },
    { value: 'battery', label: 'Batería' },
    { value: 'charger', label: 'Cargador' },
    { value: 'cable', label: 'Cable' },
    { value: 'other', label: 'Otro' },
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

    const [consumables, setConsumables] = useState<Partial<Consumable>[]>([]);
    const [newConsumable, setNewConsumable] = useState<Partial<Consumable>>({
        type: 'ink',
        description: '',
        partNumber: '',
        isRecurring: false
    });

    useEffect(() => {
        if (isOpen && equipment?.id) {
            getEquipmentDetails(equipment.id).then(data => {
                if (data) {
                    setFormData(data);
                    setConsumables(data.consumables || []);
                }
            });
        } else if (isOpen) {
            setFormData(equipment || {
                nickname: '',
                category: 'laptop',
                brand: '',
                model: '',
                status: 'active',
                clientId: ''
            });
            setConsumables([]);
        }
    }, [isOpen, equipment]);

    const handleAddConsumable = () => {
        if (!newConsumable.description || !newConsumable.partNumber) {
            toast({ title: "Datos incompletos", description: "Descripción y P/N son obligatorios.", variant: "destructive" });
            return;
        }
        setConsumables(prev => [...prev, { ...newConsumable, id: crypto.randomUUID() }]);
        setNewConsumable({ type: 'ink', description: '', partNumber: '', isRecurring: false });
    };

    const handleRemoveConsumable = (id: string | undefined) => {
        setConsumables(prev => prev.filter(c => c.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.clientId || !formData.nickname) return;
        
        setIsLoading(true);
        try {
            const id = formData.id || crypto.randomUUID();
            await saveEquipment(
                {
                    ...formData as Equipment,
                    id,
                    status: formData.status || 'active'
                },
                consumables as Omit<Consumable, 'createdAt'>[]
            );
            toast({ title: "Equipo Guardado", description: "La ficha técnica y consumibles han sido actualizados." });
            onSuccess();
            onClose();
        } catch (error: unknown) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle className="flex items-center gap-2">
                            {formData.id ? <ShieldCheck className="text-primary" /> : <PlusCircle className="text-primary" />}
                            {formData.id ? 'Editar' : 'Registrar'} Ficha de Hardware
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* --- General Data Section --- */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" /> Información General
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Cliente Propietario</Label>
                                        <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})} required>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                            <SelectContent>
                                                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Categoría</Label>
                                        <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v as EquipmentCategory})}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
                                    <Label>Nombre Descriptivo (Alias del Equipo)</Label>
                                    <Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="Ej: Laptop Diseño Luis, Impresora Recepción..." required className="h-9 font-bold" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Marca</Label>
                                        <Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} required className="h-9" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Modelo</Label>
                                        <Input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} required className="h-9" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Número de Serie (S/N)</Label>
                                    <Input value={formData.serialNumber || ''} onChange={e => setFormData({...formData, serialNumber: e.target.value})} placeholder="S/N único del fabricante" className="h-9 font-mono" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Ubicación Física</Label>
                                        <Input value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Ej: Oficina 3, Recepción..." className="h-9" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Usuario Asignado</Label>
                                        <Input value={formData.assignedUser || ''} onChange={e => setFormData({...formData, assignedUser: e.target.value})} placeholder="Nombre del usuario" className="h-9" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Notas Técnicas</Label>
                                    <Textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="text-xs" />
                                </div>
                            </div>

                            {/* --- Consumables Section --- */}
                            <div className="space-y-6 lg:border-l lg:pl-8">
                                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-orange-500" /> Gestión de Consumibles
                                </h3>

                                <div className="bg-muted/30 p-4 rounded-xl border border-dashed space-y-4">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Agregar Consumible (Tinta, Tóner, etc)</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px]">Tipo</Label>
                                            <Select value={newConsumable.type} onValueChange={v => setNewConsumable({...newConsumable, type: v as ConsumableType})}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {consumableTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px]">P/N (Modelo Pieza)</Label>
                                            <Input value={newConsumable.partNumber} onChange={e => setNewConsumable({...newConsumable, partNumber: e.target.value})} className="h-8 text-xs font-mono" placeholder="Ej: GI-11 BK" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-[10px]">Descripción Comercial</Label>
                                            <Input value={newConsumable.description} onChange={e => setNewConsumable({...newConsumable, description: e.target.value})} className="h-8 text-xs" placeholder="Ej: Tinta Negra 170ml" />
                                        </div>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" className="w-full h-8" onClick={handleAddConsumable}>
                                        <PlusCircle className="h-3 w-3 mr-1" /> Añadir a la Lista
                                    </Button>
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                                    {consumables.map((c, idx) => (
                                        <div key={c.id || idx} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary transition-colors group shadow-sm">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[8px] h-4 uppercase">{consumableTypes.find(t => t.value === c.type)?.label || c.type}</Badge>
                                                    <span className="text-[10px] font-mono text-muted-foreground font-bold">P/N: {c.partNumber}</span>
                                                </div>
                                                <p className="text-xs font-bold truncate mt-0.5">{c.description}</p>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveConsumable(c.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {consumables.length === 0 && (
                                        <div className="text-center py-10 border-2 border-dashed rounded-xl opacity-30">
                                            <Package className="h-8 w-8 mx-auto mb-2" />
                                            <p className="text-[10px] uppercase font-bold">Sin consumibles registrados</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/10">
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isLoading} className="min-w-[140px]">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            {formData.id ? 'Guardar Cambios' : 'Registrar Equipo'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
