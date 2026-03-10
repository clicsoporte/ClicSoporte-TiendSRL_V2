'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/modules/core/hooks/use-toast';
import { logError } from '@/modules/core/lib/logger';
import { getAllUsers, addUser, updateUser, deleteUser } from '@/modules/core/lib/auth-client';
import { getAllRoles } from '@/modules/core/lib/roles-db';
import type { User, Role } from '@/modules/core/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Edit, Trash2, Loader2, UserCog } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

const emptyUser: Partial<User> & { password?: string } = {
  name: '',
  email: '',
  role: 'viewer',
  phone: '',
  whatsapp: '',
  forcePasswordChange: true,
};

export default function UsersClient() {
  const { hasPermission } = useAuthorization(['users:read', 'users:create', 'users:update', 'users:delete']);
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User> & { password?: string }>(emptyUser);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uData, rData] = await Promise.all([getAllUsers(), getAllRoles()]);
      setUsers(uData);
      setRoles(rData);
    } catch (error) {
      logError('Error fetching users/roles', { error });
      toast({ title: 'Error', description: 'No se pudieron cargar los datos.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    setTitle('Gestión de Usuarios');
    fetchData();
  }, [setTitle, fetchData]);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setCurrentUser(user);
      setIsEditing(true);
    } else {
      setCurrentUser(emptyUser);
      setIsEditing(false);
    }
    setDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!currentUser.name || !currentUser.email || (!isEditing && !currentUser.password)) {
      toast({ title: 'Datos Incompletos', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateUser(currentUser as User);
        toast({ title: 'Usuario Actualizado' });
      } else {
        await addUser({
          name: currentUser.name,
          email: currentUser.email,
          password: currentUser.password!,
          role: currentUser.role!,
          phone: currentUser.phone || '',
          whatsapp: currentUser.whatsapp || '',
          forcePasswordChange: !!currentUser.forcePasswordChange,
        });
        toast({ title: 'Usuario Creado' });
      }
      await fetchData();
      setDialogOpen(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <main className="flex-1 p-8"><Skeleton className="h-64 w-full" /></main>;

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="h-6 w-6 text-primary"/> Usuarios</h1>
        {hasPermission('users:create') && (
          <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Nuevo Usuario</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-4 text-left font-medium">Perfil</th>
                  <th className="p-4 text-left font-medium">Contacto</th>
                  <th className="p-4 text-left font-medium">Rol</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar><AvatarImage src={user.avatar}/><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      <div>{user.phone}</div>
                      <div>{user.whatsapp}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {roles.find(r => r.id === user.role)?.name || user.role}
                      </Badge>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {hasPermission('users:update') && <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}><Edit className="h-4 w-4"/></Button>}
                      {hasPermission('users:delete') && user.id !== 1 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar Usuario?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => { await deleteUser(user.id); fetchData(); }}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nombre Completo</Label><Input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})}/></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={currentUser.email} onChange={e => setCurrentUser({...currentUser, email: e.target.value})}/></div>
            </div>
            <div className="space-y-2">
              <Label>{isEditing ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}</Label>
              <Input type="password" value={currentUser.password || ''} onChange={e => setCurrentUser({...currentUser, password: e.target.value})}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Rol</Label>
                <Select value={currentUser.role} onValueChange={v => setCurrentUser({...currentUser, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox id="force-pass" checked={!!currentUser.forcePasswordChange} onCheckedChange={checked => setCurrentUser({...currentUser, forcePasswordChange: !!checked})}/>
                <Label htmlFor="force-pass" className="text-xs">Obligar cambio de clave</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveUser} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{isEditing ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
