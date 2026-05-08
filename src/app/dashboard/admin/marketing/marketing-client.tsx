'use client';

/**
 * @fileoverview Management UI for Dynamic Marketing Campaigns.
 */

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAuth } from '@/modules/core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PlusCircle, Megaphone, Trash2, Edit, Loader2, Link as LinkIcon, Image as ImageIcon, Users, ExternalLink } from 'lucide-react';
import { getAllAds, saveAd, deleteAd } from '@/modules/marketing/lib/actions';
import type { MarketingAd, SoftwareProduct } from '@/modules/core/types';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const emptyAd: Partial<MarketingAd> = {
    softwareId: 0,
    imageUrl: '',
    description: '',
    price: '',
    targetUrl: '',
    isEnabled: true,
    targetType: 'all'
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

    if (isLoading) return <div className="p-8"><Loader2 className="animate-spin mx-auto" /></div>;

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Megaphone className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Publicidad Dinámica</h1>
                        <p className="text-xs text-muted-foreground">Gestiona los anuncios que rotan en las versiones gratuitas de tus programas.</p>
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
                                <TableHead>Vista Previa</TableHead>
                                <TableHead>Software Destino</TableHead>
                                <TableHead>Descripción / Precio</TableHead>
                                <TableHead>Segmento</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ads.map(ad => {
                                const software = softwareProducts.find(p => p.id === ad.softwareId);
                                return (
                                    <TableRow key={ad.id}>
                                        <TableCell>
                                            <div className="relative h-12 w-20 rounded border overflow-hidden bg-muted">
                                                <Image src={ad.imageUrl} alt="Ad" fill className="object-cover" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold">{software?.name || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm line-clamp-1">{ad.description}</span>
                                                <span className="text-xs font-black text-primary">{ad.price}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                <Users className="h-3 w-3 mr-1" /> {ad.targetType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Switch checked={ad.isEnabled} onCheckedChange={async (val) => {
                                                await saveAd({ ...ad, isEnabled: val });
                                                loadData();
                                            }} />
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(ad)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setAdToDelete(ad)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {ads.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">No hay campañas configuradas.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalle de Campaña Publicitaria</DialogTitle>
                        <DialogDescription>Define el contenido que verán los usuarios en el carrusel de su aplicación.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Software Destino</Label>
                                <Select value={String(currentAd.softwareId)} onValueChange={v => setCurrentAd({...currentAd, softwareId: Number(v)})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger>
                                    <SelectContent>
                                        {softwareProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
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
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Descripción Destacada</Label>
                                <Input value={currentAd.description} onChange={e => setCurrentAd({...currentAd, description: e.target.value})} placeholder="Máximo 30 palabras..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Texto de Precio / Oferta</Label>
                                <Input value={currentAd.price} onChange={e => setCurrentAd({...currentAd, price: e.target.value})} placeholder="Ej: ₡10,000 o ¡Oferta!" />
                            </div>
                            <div className="space-y-2">
                                <Label>Link de Destino (Tienda)</Label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={currentAd.targetUrl} onChange={e => setCurrentAd({...currentAd, targetUrl: e.target.value})} className="pl-8" placeholder="https://clictienda.com/..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Megaphone className="h-4 w-4 mr-2" />}
                            Guardar Campaña
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!adToDelete} onOpenChange={open => !open && setAdToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es inmediata y dejará de mostrarse en los software hijos.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
