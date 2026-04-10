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
import { getAllRoles, saveAllRoles, resetDefaultRoles } from '@/modules/core/lib/roles-actions';
import type { Role } from '@/modules/core/types';
import { PlusCircle, Save, Trash2, ShieldQuestion, Copy, Loader2, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';

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
        id: '', // New role, so no ID
        name: `Copia de ${role.name}`,
        permissions: [...role.permissions] // Copy permissions
    });
    setDialogOpen(true);
  }

  const handleSaveRole = async () => {
    if (!currentRole || !currentRole.name.trim()) {
      toast({
        title: 'Error de Validación',
        description: 'El nombre del rol no puede estar vacío.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    let updatedRoles;
    const isNew = !currentRole.id;
    if (isNew) {
      const newRoleId = currentRole.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      if (roles.some((r) => r.id === newRoleId)) {
        toast({
          title: 'Error',
          description: 'Ya existe un rol con un ID similar.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      updatedRoles = [...roles, { ...currentRole, id: newRoleId }];
    } else {
      updatedRoles = roles.map((r) =>
        r.id === currentRole.id ? currentRole : r
      );
    }

    try {
      await saveAllRoles(updatedRoles);
      setRoles(updatedRoles);
      toast({
        title: 'Roles Guardados',
        description: `El rol "${currentRole.name}" ha sido ${
          isNew ? 'creado' : 'actualizado'
        }.`,
      });
      await logInfo('Roles saved', { role: currentRole.name });
      setDialogOpen(false);
    } catch (err: unknown) {
      logError('Failed to save roles', { error: (err as Error).message });
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los roles.',
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    if (roleToDelete.id === 'admin') {
      toast({
        title: 'Acción no permitida',
        description: 'No se puede eliminar el rol de Administrador.',
        variant: 'destructive',
      });
      return;
    }
    const updatedRoles = roles.filter((r) => r.id !== roleToDelete.id);
    await saveAllRoles(updatedRoles);
    setRoles(updatedRoles);
    toast({
      title: 'Rol Eliminado',
      description: `El rol "${roleToDelete.name}" ha sido eliminado.`,
      variant: 'destructive',
    });
    await logInfo('Role deleted', { roleId: roleToDelete.id });
    setRoleToDelete(null);
  };

  const handleResetAdmin = async () => {
    await resetDefaultRoles();
    await fetchRoles(); // Re-fetch all roles to get the updated admin role
    toast({
      title: 'Roles Restablecidos',
      description: 'Los roles predeterminados han sido restaurados.',
    });
    await logInfo('Admin roles reset to default');
  };

  const handlePermissionChange = (permission: AppPermission, isChecked: boolean) => {
    if (!currentRole) return;

    const newPermissions = new Set(currentRole.permissions as AppPermission[]);

    // Helper: When checking an item, auto-check all its parent dependencies (Recursive Up)
    const addWithParents = (perm: AppPermission) => {
        newPermissions.add(perm);
        // Find who is the parent of this permission in the tree
        for (const parentId in permissionTree) {
            if (parentId === 'admin:all') continue; // Stop admin:all from being auto-selected
            const children = permissionTree[parentId] || [];
            if (children.includes(perm)) {
                addWithParents(parentId as AppPermission);
            }
        }
    };
    
    // Helper: When unchecking an item, auto-uncheck all its child dependencies (Recursive Down)
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
  
 const handleGroupPermissionChange = (groupPermissions: AppPermission[], check: boolean) => {
    if (!currentRole) return;
    
    const newPermissions = new Set(currentRole.permissions as AppPermission[]);

    const addWithParents = (perm: AppPermission) => {
        newPermissions.add(perm);
        for (const parentId in permissionTree) {
            if (parentId === 'admin:all') continue;
            const children = permissionTree[parentId] || [];
            if (children.includes(perm)) {
                addWithParents(parentId as AppPermission);
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

    groupPermissions.forEach(p => {
        if (check) {
            addWithParents(p);
        } else {
            removeWithChildren(p);
        }
    });

    setCurrentRole({ ...currentRole, permissions: Array.from(newPermissions) });
};


  const renderPermissionGroup = (
    groupName: string,
    permissions: AppPermission[],
    role: Role
  ) => {
    const allSelectedInGroup = permissions.every(p => role.permissions.includes(p));

    return (
      <details key={groupName} className="group space-y-2 border rounded-lg overflow-hidden bg-muted/10">
        <summary className="cursor-pointer font-bold flex justify-between items-center py-3 px-4 hover:bg-muted/50 transition-colors bg-muted/20">
          <div className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            <span className="uppercase text-xs tracking-widest">{groupName}</span>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Label htmlFor={`select-all-${groupName.replace(/\s+/g, '-')}`} className="text-[10px] font-black uppercase cursor-pointer text-muted-foreground">
              Todos
            </Label>
            <Checkbox
              id={`select-all-${groupName.replace(/\s+/g, '-')}`}
              checked={allSelectedInGroup}
              onCheckedChange={(checked) => handleGroupPermissionChange(permissions, !!checked)}
              disabled={role.id === 'admin'}
            />
          </div>
        </summary>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t bg-card">
          {permissions.map((permission) => (
            <div key={permission} className="flex items-start space-x-2">
              <Checkbox
                id={`${role.id}-${permission}`}
                checked={role.permissions.includes(permission)}
                onCheckedChange={(checked) =>
                  handlePermissionChange(permission as AppPermission, !!checked)
                }
                disabled={role.id === 'admin'}
                className="mt-0.5"
              />
              <Label
                htmlFor={`${role.id}-${permission}`}
                className="font-normal text-xs leading-tight cursor-pointer"
              >
                {permissionTranslations[permission] || permission}
              </Label>
            </div>
          ))}
        </div>
      </details>
    );
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Roles</h1>
            <p className="text-muted-foreground text-sm">
              Define roles de usuario y asigna permisos específicos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAdmin}
              disabled={!hasPermission('roles:update')}
            >
              <ShieldQuestion className="mr-2 h-4 w-4" />
              Restablecer Predeterminados
            </Button>
            <Button
              size="sm"
              onClick={() => handleOpenDialog()}
              disabled={!hasPermission('roles:create')}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Rol
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {roles.map((role) => (
            <Card key={role.id} className="overflow-hidden">
              <CardHeader className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    <CardDescription className="text-xs font-mono uppercase">ID: {role.id}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyRole(role)}
                      disabled={!hasPermission('roles:create')}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5"/>
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(role)}
                      disabled={
                        role.id === 'admin' || !hasPermission('roles:update')
                      }
                    >
                      Editar Permisos
                    </Button>
                     <AlertDialog onOpenChange={(open) => !open && setRoleToDelete(null)}>
                        <AlertDialogTrigger asChild>
                             <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={
                                    role.id === 'admin' || !hasPermission('roles:delete')
                                }
                                onClick={() => setRoleToDelete(role)}
                                >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar el rol &quot;{roleToDelete?.name}&quot;?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Los usuarios con este rol perderán sus permisos.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground">Sí, Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>
              {currentRole?.id ? 'Editar Permisos del Rol' : 'Crear Nuevo Rol'}
            </DialogTitle>
            <DialogDescription>
              {currentRole?.id
                ? `Personaliza las facultades para "${currentRole?.name}"`
                : 'Define el nombre y las capacidades del nuevo puesto.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {currentRole && (
                <div className="space-y-6 pr-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                        <div className="space-y-2">
                            <Label htmlFor="role-name" className="text-xs font-bold uppercase">Nombre del Rol</Label>
                            <Input
                                id="role-name"
                                value={currentRole.name}
                                onChange={(e) =>
                                    setCurrentRole({ ...currentRole, name: e.target.value })
                                }
                                disabled={currentRole.id === 'admin'}
                                placeholder="Ej: Técnico de Nivel 2"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase opacity-50">Identificador Único</Label>
                            <Input
                                value={currentRole.id || '(Se generará al guardar)'}
                                disabled
                                className="bg-muted font-mono text-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b pb-2">Configuración de Accesos</h3>
                        <div className="space-y-4">
                            {Object.entries(permissionGroups).map(([groupName, perms]) =>
                                renderPermissionGroup(groupName, perms as AppPermission[], currentRole)
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-muted/10">
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSaveRole}
              disabled={isSubmitting || currentRole?.id === 'admin'}
              className="min-w-[150px]"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
