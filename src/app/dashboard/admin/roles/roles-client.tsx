'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/modules/core/hooks/use-toast';
import { logInfo, logError } from '@/modules/core/lib/logger';
import {
  permissionGroups,
  permissionTranslations,
  permissionTree,
  AppPermission,
} from '@/modules/core/lib/permissions';
import { getAllRoles, saveAllRoles, resetDefaultRoles } from '@/modules/core/lib/roles-db';
import type { Role } from '@/modules/core/types';
import { PlusCircle, Save, Trash2, ShieldQuestion, Copy, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function RolesClient() {
  const { hasPermission } = useAuthorization(['roles:create', 'roles:read', 'roles:update', 'roles:delete']);
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const rolesData = await getAllRoles();
      setRoles(rolesData);
    } catch (error) {
      logError('Error fetching roles', { error });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los roles.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    setTitle('Gestión de Roles');
    fetchRoles();
  }, [setTitle, fetchRoles]);

  const handleOpenDialog = (role?: Role) => {
    setCurrentRole(role ? { ...role } : { id: '', name: '', permissions: [] });
    setDialogOpen(true);
  };
  
  const handleCopyRole = (role: Role) => {
    setCurrentRole({
        id: '', 
        name: `Copia de ${role.name}`,
        permissions: [...role.permissions] 
    });
    setDialogOpen(true);
  }

  const handleSaveRole = async () => {
    if (!currentRole || !currentRole.name.trim()) {
      toast({ title: 'Error de Validación', description: 'El nombre del rol es requerido.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    let updatedRoles;
    const isNew = !currentRole.id;
    if (isNew) {
      const newRoleId = currentRole.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (roles.some((r) => r.id === newRoleId)) {
        toast({ title: 'Error', description: 'Ya existe un rol con un ID similar.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      updatedRoles = [...roles, { ...currentRole, id: newRoleId }];
    } else {
      updatedRoles = roles.map((r) => r.id === currentRole.id ? currentRole : r);
    }

    try {
      await saveAllRoles(updatedRoles);
      setRoles(updatedRoles);
      toast({ title: 'Roles Guardados', description: `El rol "${currentRole.name}" ha sido actualizado.` });
      await logInfo('Roles saved', { role: currentRole.name });
      setDialogOpen(false);
    } catch (err: unknown) {
      logError('Failed to save roles', { error: (err as Error).message });
      toast({ title: 'Error', description: 'No se pudieron guardar los roles.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    const updatedRoles = roles.filter((r) => r.id !== roleToDelete.id);
    try {
        await saveAllRoles(updatedRoles);
        setRoles(updatedRoles);
        toast({ title: 'Rol Eliminado', variant: 'destructive' });
        await logInfo('Role deleted', { roleId: roleToDelete.id });
    } catch {
        toast({ title: 'Error', description: 'No se pudo eliminar el rol.', variant: 'destructive' });
    }
    setRoleToDelete(null);
  };

  const handlePermissionChange = (permission: AppPermission, isChecked: boolean) => {
    if (!currentRole) return;

    const newPermissions = new Set(currentRole.permissions as AppPermission[]);

    const addWithParents = (perm: AppPermission) => {
        newPermissions.add(perm);
        for (const parent in permissionTree) {
            if (permissionTree[parent]?.includes(perm)) {
                addWithParents(parent as AppPermission);
            }
        }
    };
    
    const removeWithChildren = (perm: AppPermission) => {
        newPermissions.delete(perm);
        const children = permissionTree[perm] || [];
        for (const child of children) {
            removeWithChildren(child as AppPermission);
        }
    };
    
    if (isChecked) {
        addWithParents(permission);
    } else {
        removeWithChildren(permission);
    }
    
    setCurrentRole({ ...currentRole, permissions: Array.from(newPermissions) });
  };

  if (isLoading) {
    return <main className="flex-1 p-8"><Skeleton className="h-64 w-full" /></main>;
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Roles y Permisos</h1>
          <p className="text-muted-foreground">Define las capacidades de cada puesto en la empresa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => { await resetDefaultRoles(); fetchRoles(); }} disabled={!hasPermission('roles:update')}>
            <ShieldQuestion className="mr-2 h-4 w-4" /> Restablecer
          </Button>
          <Button onClick={() => handleOpenDialog()} disabled={!hasPermission('roles:create')}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Rol
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{role.name}</CardTitle>
                <CardDescription>ID: {role.id}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleCopyRole(role)} disabled={!hasPermission('roles:create')} title="Copiar"><Copy className="h-4 w-4"/></Button>
                <Button variant="ghost" onClick={() => handleOpenDialog(role)} disabled={role.id === 'admin' || !hasPermission('roles:update')}>Editar</Button>
                {role.id !== 'admin' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive" disabled={!hasPermission('roles:delete')}><Trash2 className="h-4 w-4"/></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar el rol &quot;{role.name}&quot;?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción es irreversible y afectará a los usuarios con este rol.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { setRoleToDelete(role); handleDeleteRole(); }}>Eliminar</AlertDialogAction>
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{currentRole?.id ? 'Editar Permisos' : 'Nuevo Rol'}</DialogTitle>
            <DialogDescription>Asigna permisos por módulo utilizando el árbol jerárquico.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {currentRole && (
              <div className="space-y-4 pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del Rol</Label>
                    <Input value={currentRole.name} onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })} disabled={currentRole.id === 'admin'} />
                  </div>
                  <div className="space-y-2">
                    <Label>ID Identificador</Label>
                    <Input value={currentRole.id} readOnly className="bg-muted" />
                  </div>
                </div>
                <div className="border rounded-md p-4 bg-muted/30">
                  <Accordion type="multiple" className="space-y-4">
                    {Object.entries(permissionGroups).map(([groupName, perms]) => (
                      <AccordionItem key={groupName} value={groupName}>
                        <AccordionTrigger className="text-sm font-bold uppercase">{groupName}</AccordionTrigger>
                        <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                          {perms.map((p) => (
                            <div key={p} className="flex items-center space-x-2">
                              <Checkbox 
                                  id={`perm-${p}`} 
                                  checked={currentRole.permissions.includes(p)} 
                                  onCheckedChange={(checked) => handlePermissionChange(p, !!checked)}
                                  disabled={currentRole.id === 'admin'}
                              />
                              <Label htmlFor={`perm-${p}`} className="text-xs font-normal cursor-pointer leading-none">
                                  {permissionTranslations[p] || p}
                              </Label>
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 border-t bg-muted/10">
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveRole} disabled={isSubmitting || currentRole?.id === 'admin'}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
