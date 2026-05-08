/**
 * @fileoverview Management UI for Dynamic Marketing Campaigns (v3.1).
 * Features campaign expiration and improved preview.
 */
'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, Megaphone, Trash2, Edit, Loader2, Link as LinkIcon, Image as ImageIcon, Users, Calendar, AlertCircle } from 'lucide-react';
import { getAllAds, saveAd, deleteAd } from '@/modules/marketing/lib/actions';
import type { MarketingAd, SoftwareProduct } from '@/modules/core/types';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';

const emptyAd: Partial<MarketingAd> = {
    softwareId: 0,
    imageUrl: '',
    description: '',
    price: '',
    targetUrl: '',
    isEnabled: true,
    targetType: 'all',
    expiresAt: null
};

export default function MarketingClient() {
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const { softwareProducts, isAuthReady } = useAuth();
    const { hasPermission } = useAuthorization();

    const [ads, setAds] = useState<MarketingAd[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFormOpen, setFormOpen] = useState(false);
    const [currentAd, setCurrentAd] = useState<Partial<MarketingAd>>(emptyAd);
    const [adToDelete, setAdToDelete] = useState<MarketingAd | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getAllAds();
            setAds(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setTitle("Centro de Marketing");
        if (isAuthReady) loadData();
    }, [isAuthReady, setTitle]);

    const handleSave = async () => {
        if (!currentAd.softwareId || !currentAd.imageUrl || !currentAd.description) {
            toast({ title: "Datos incompletos", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            await saveAd(currentAd as Omit<MarketingAd, 'id' | 'createdAt'>);
            toast({ title: "Campaña Guardada" });
            loadData();
            setFormOpen(false);
        } catch {
            toast({ title: "Error al guardar", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (ad: MarketingAd) => {
        setCurrentAd(ad);
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!adToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteAd(adToDelete.id);
            toast({ title: "Anuncio Eliminado" });
            loadData();
            setAdToDelete(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (ad: MarketingAd) => {
        if (!ad.isEnabled) return <Badge variant="secondary" className="uppercase text-[9px]">Pausado</Badge>;
        if (ad.expiresAt && isPast(parseISO(ad.expiresAt))) return <Badge variant="destructive" className="uppercase text-[9px]">Expirado</Badge>;
        return <Badge variant="default" className="uppercase text-[9px] bg-green-600">Activo</Badge>;
    };

    if (isLoading) return <div className="p-8"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Megaphone className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Publicidad Dinámica</h1>
                        <p className="text-xs text-muted-foreground">Versión 3.1: Gestión de avisos globales y segmentados con auto-terminación.</p>
                    </div>
                </div>
                <Button onClick={() => { setCurrentAd(emptyAd); setFormOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nueva Campaña
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Preview</TableHead>
                                <TableHead>Software / Segmento</TableHead>
                                <TableHead>Descripción / Precio</TableHead>
                                <TableHead>Vencimiento</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ads.map(ad => {
                                const software = softwareProducts.find((p: SoftwareProduct) => p.id === ad.softwareId);
                                const isExpired = ad.expiresAt && isPast(parseISO(ad.expiresAt));
                                
                                return (
                                    <TableRow key={ad.id} className={cn(isExpired && "opacity-60")}>
                                        <TableCell>
                                            <div className="relative h-16 w-28 rounded-lg border overflow-hidden bg-muted shadow-sm group">
                                                <Image src={ad.imageUrl} alt="Ad" fill className="object-cover transition-transform group-hover:scale-110" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-sm">{software?.name || 'N/A'}</span>
                                                <Badge variant="outline" className="w-fit text-[9px] uppercase">
                                                    <Users className="h-2 w-2 mr-1" /> {ad.targetType === 'all' ? 'Público General' : ad.targetType}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs line-clamp-1 max-w-[200px]">{ad.description}</span>
                                                <span className="text-sm font-black text-primary">{ad.price}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {ad.expiresAt ? format(parseISO(ad.expiresAt), 'dd MMM, yy', { locale: es }) : 'Sin límite'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                {getStatusBadge(ad)}
                                                <Switch checked={ad.isEnabled} onCheckedChange={async (val) => {
                                                    await saveAd({ ...ad, isEnabled: val });
                                                    loadData();
                                                }} />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(ad)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setAdToDelete(ad)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {ads.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic border-2 border-dashed rounded-lg">No hay campañas configuradas. Presiona "Nueva Campaña" para empezar.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detalle de Campaña Publicitaria</DialogTitle>
                        <DialogDescription>Los cambios se sincronizan con los software hijos automáticamente.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Software Destino</Label>
                                <Select value={String(currentAd.softwareId)} onValueChange={v => setCurrentAd({...currentAd, softwareId: Number(v)})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                    <SelectContent>
                                        {softwareProducts.map((p: SoftwareProduct) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Segmento de Usuarios</Label>
                                <Select value={currentAd.targetType} onValueChange={v => setCurrentAd({...currentAd, targetType: v as any})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Usuarios</SelectItem>
                                        <SelectItem value="free">Solo Versiones Gratis</SelectItem>
                                        <SelectItem value="premium">Solo Versiones Premium</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>URL de Imagen (Publicidad)</Label>
                                <div className="relative">
                                    <ImageIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={currentAd.imageUrl} onChange={e => setCurrentAd({...currentAd, imageUrl: e.target.value})} className="pl-8" placeholder="https://..." />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">Se recomienda formato 16:9 o cuadrado.</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3" /> Fecha de Expiración
                                </Label>
                                <Input 
                                    type="date" 
                                    value={currentAd.expiresAt || ''} 
                                    onChange={e => setCurrentAd({...currentAd, expiresAt: e.target.value || null})} 
                                />
                                <p className="text-[10px] text-muted-foreground">La campaña se desactivará automáticamente al finalizar este día.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Descripción Destacada (Máx 30 palabras)</Label>
                                <Textarea value={currentAd.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentAd({...currentAd, description: e.target.value})} placeholder="Ej: ¡Nuevo tóner compatible disponible!..." rows={3} />
                            </div>
                            <div className="space-y-2">
                                <Label>Texto de Precio / Oferta</Label>
                                <Input value={currentAd.price} onChange={e => setCurrentAd({...currentAd, price: e.target.value})} placeholder="Ej: ¢12,500 o ¡GRATIS!" className="font-bold text-primary" />
                            </div>
                            <div className="space-y-2">
                                <Label>Link de Destino (Tienda o Web)</Label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={currentAd.targetUrl} onChange={e => setCurrentAd({...currentAd, targetUrl: e.target.value})} className="pl-8" placeholder="https://mi-tienda.com/producto" />
                                </div>
                            </div>
                            
                            {currentAd.imageUrl && (
                                <div className="p-3 border rounded-lg bg-muted/30">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Previsualización de Banner</Label>
                                    <div className="relative aspect-video rounded border overflow-hidden shadow-inner">
                                        <Image src={currentAd.imageUrl} alt="Preview" fill className="object-cover" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="bg-muted/10 -mx-6 -mb-6 p-6 mt-4 border-t">
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={handleSave} disabled={isSubmitting} className="min-w-[150px]">
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Megaphone className="h-4 w-4 mr-2" />}
                            Lanzar Campaña
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!adToDelete} onOpenChange={open => !open && setAdToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es inmediata y dejará de mostrarse en los software hijos. El registro será borrado permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="p-4 bg-muted/20 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <p className="text-sm font-bold">{adToDelete?.description}</p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar Definitivamente</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
