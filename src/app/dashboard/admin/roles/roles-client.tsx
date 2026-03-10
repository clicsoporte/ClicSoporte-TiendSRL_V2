'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/modules/core/hooks/use-toast';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { permissionGroups, permissionTranslations, AppPermission } from '@/modules/core/lib/permissions';
import { getAllRoles, saveAllRoles, resetDefaultRoles } from '@/modules/core/lib/roles-db';
import type { Role } from '@/modules/core/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Save, Trash2, ShieldQuestion } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function RolesClient() {
  const { hasPermission } = useAuthorization(['roles:read']);
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const rolesData = await getAllRoles();
      setRoles(rolesData);
    } catch (error) {
      logError('Error fetching roles', { error });
      toast({ title: 'Error', description: 'No se pudieron cargar los roles.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    setTitle('Gestión de Roles');
    fetchRoles();
  }, [setTitle, fetchRoles]);

  const handleSaveRole = async () => {
    if (!currentRole || !currentRole.name.trim()) return;

    let updatedRoles;
    const isNew = !roles.find(r => r.id === currentRole.id);
    if (isNew) {
      updatedRoles = [...roles, currentRole];
    } else {
      updatedRoles = roles.map(r => r.id === currentRole.id ? currentRole : r);
    }

    try {
      await saveAllRoles(updatedRoles);
      setRoles(updatedRoles);
      toast({ title: 'Roles Guardados' });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handlePermissionChange = (perm: AppPermission, checked: boolean) => {
    if (!currentRole) return;
    const newPerms = checked 
      ? [...currentRole.permissions, perm]
      : currentRole.permissions.filter(p => p !== perm);
    setCurrentRole({ ...currentRole, permissions: newPerms });
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Roles y Permisos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => { await resetDefaultRoles(); fetchRoles(); }}><ShieldQuestion className="mr-2 h-4 w-4"/>Restablecer</Button>
          <Button onClick={() => { setCurrentRole({ id: '', name: '', permissions: [] }); setDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/>Nuevo Rol</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map(role => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{role.name}</CardTitle>
                <CardDescription>ID: {role.id}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setCurrentRole(role); setDialogOpen(true); }}>Editar</Button>
                {role.id !== 'admin' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { await saveAllRoles(roles.filter(r => r.id !== role.id)); fetchRoles(); }}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{currentRole?.id ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
          </DialogHeader>
          {currentRole && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID del Rol</Label>
                  <Input value={currentRole.id} onChange={e => setCurrentRole({...currentRole, id: e.target.value.toLowerCase()})} disabled={!!currentRole.id && roles.some(r => r.id === currentRole.id)} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={currentRole.name} onChange={e => setCurrentRole({...currentRole, name: e.target.value})} />
                </div>
              </div>
              <ScrollArea className="flex-1 border rounded-md p-4">
                <Accordion type="multiple" className="space-y-4">
                  {Object.entries(permissionGroups).map(([group, perms]) => (
                    <AccordionItem key={group} value={group}>
                      <AccordionTrigger className="text-sm font-bold">{group}</AccordionTrigger>
                      <AccordionContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {perms.map(p => (
                          <div key={p} className="flex items-center space-x-2">
                            <Checkbox id={p} checked={currentRole.permissions.includes(p)} onCheckedChange={checked => handlePermissionChange(p, !!checked)} />
                            <Label htmlFor={p} className="text-xs font-normal">{permissionTranslations[p] || p}</Label>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            </div>
          )}
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveRole}><Save className="mr-2 h-4 w-4"/>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
