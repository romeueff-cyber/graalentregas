import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner, FullPageLoader } from '@/components/ui/loading-spinner';
import { ArrowLeft, Plus, User, Mail, Lock, Pencil, X, Check, UserX, UserCheck, Eye, EyeOff, Shield, ShieldOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'entregador', label: 'Entregador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'financeiro', label: 'Financeiro' },
] as const;
const roleLabel = (r: string | null) => ROLE_OPTIONS.find(o => o.value === r)?.label || '—';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email inválido').max(255, 'Email deve ter no máximo 255 caracteres'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
});

const editSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email inválido').max(255, 'Email deve ter no máximo 255 caracteres'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .optional()
    .or(z.literal('')),
});

interface UserData {
  id: string;
  name: string;
  email: string;
  created_at: string | null;
  role: string | null;
  banned_until: string | null;
}

export default function UsersManagementPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('entregador');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  
  // Edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editErrors, setEditErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Deactivate confirmation
  const [userToToggle, setUserToToggle] = useState<UserData | null>(null);
  // Role change confirmation
  const [userToChangeRole, setUserToChangeRole] = useState<UserData | null>(null);

  // Fetch all users with banned status
  const { data: users = [], isLoading, error: queryError } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      console.log('Fetching users...');
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        throw rolesError;
      }

      // Fetch user auth data to get banned status
      const response = await supabase.functions.invoke('list-users', {});
      const authUsers = response.data?.users || [];

      // Combine data
      const usersWithRoles: UserData[] = profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        const authUser = authUsers.find((u: any) => u.id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          created_at: profile.created_at,
          role: userRole?.role || null,
          banned_until: authUser?.banned_until || null
        };
      });

      console.log('Users fetched:', usersWithRoles);
      return usersWithRoles;
    },
    enabled: !!user
  });

  // Create user mutation using edge function
  const createUserMutation = useMutation({
    mutationFn: async ({ name, email, password, role }: { name: string; email: string; password: string; role: string }) => {
      const response = await supabase.functions.invoke('create-user', {
        body: { name, email, password, role }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowNewUserForm(false);
      setName('');
      setEmail('');
      setPassword('');
      setNewUserRole('entregador');
      toast.success('Usuário criado com sucesso!');
    },
    onError: (error: any) => {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('already') || msg.includes('exists') || msg.includes('email_exists') || msg.includes('registered')) {
        toast.error('Este email já está cadastrado. Use outro email.');
      } else {
        console.error('Erro ao criar usuário:', error);
        toast.error('Erro ao criar usuário: ' + error.message);
      }
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, name, email, password }: { userId: string; name: string; email: string; password?: string }) => {
      const response = await supabase.functions.invoke('manage-user', {
        body: { 
          action: 'update',
          userId,
          name,
          email,
          password: password || undefined
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao atualizar usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      setEditName('');
      setEditEmail('');
      setEditPassword('');
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: any) => {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('already') || msg.includes('exists') || msg.includes('email_exists') || msg.includes('registered')) {
        toast.error('Este email já está em uso por outro usuário.');
      } else {
        console.error('Erro ao atualizar usuário:', error);
        toast.error('Erro ao atualizar usuário: ' + error.message);
      }
    }
  });

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'activate' | 'deactivate' }) => {
      const response = await supabase.functions.invoke('manage-user', {
        body: { action, userId }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao alterar status do usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(variables.action === 'deactivate' ? 'Usuário inativado com sucesso!' : 'Usuário ativado com sucesso!');
      setUserToToggle(null);
    },
    onError: (error: any) => {
      console.error('Erro ao alterar status do usuário:', error);
      toast.error('Erro ao alterar status do usuário: ' + error.message);
      setUserToToggle(null);
    }
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await supabase.functions.invoke('manage-user', {
        body: { action: 'change_role', userId, role }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao alterar perfil');
      }
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Perfil alterado para ${roleLabel(variables.role)}!`);
      setUserToChangeRole(null);
    },
    onError: (error: any) => {
      console.error('Erro ao alterar perfil:', error);
      toast.error('Erro ao alterar perfil: ' + error.message);
      setUserToChangeRole(null);
    }
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = userSchema.safeParse({ name, email, password });
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'name') fieldErrors.name = err.message;
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsCreating(true);
    try {
      await createUserMutation.mutateAsync({ name, email, password, role: newUserRole });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (user: UserData) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword('');
    setEditErrors({});
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditEmail('');
    setEditPassword('');
    setEditErrors({});
  };

  const handleSaveEdit = async (userId: string) => {
    const validationData = {
      name: editName,
      email: editEmail,
      password: editPassword || undefined
    };

    const result = editSchema.safeParse(validationData);
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string; password?: string } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'name') fieldErrors.name = err.message;
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setEditErrors(fieldErrors);
      return;
    }

    setIsSaving(true);
    try {
      await updateUserMutation.mutateAsync({ 
        userId, 
        name: editName, 
        email: editEmail,
        password: editPassword || undefined
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = (user: UserData) => {
    setUserToToggle(user);
  };

  const confirmToggleStatus = () => {
    if (!userToToggle) return;
    const action = userToToggle.banned_until ? 'activate' : 'deactivate';
    toggleUserStatusMutation.mutate({ userId: userToToggle.id, action });
  };

  const isUserBanned = (user: UserData) => {
    if (!user.banned_until) return false;
    return new Date(user.banned_until) > new Date();
  };

  if (authLoading) {
    return <FullPageLoader />;
  }

  // Note: Admin check is now handled by AdminRoute wrapper in App.tsx

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Gerenciar Usuários</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Add New User Button */}
        {!showNewUserForm && (
          <Button
            className="w-full h-12 gap-2"
            onClick={() => setShowNewUserForm(true)}
          >
            <Plus className="w-5 h-5" />
            Novo Usuário
          </Button>
        )}

        {/* New User Form */}
        {showNewUserForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novo Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Nome do usuário"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Perfil</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger id="role" className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setShowNewUserForm(false)}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12"
                    disabled={isCreating}
                  >
                    {isCreating ? <LoadingSpinner size="sm" /> : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <div className="space-y-3">
          <h2 className="font-medium text-muted-foreground">
            Usuários ({users.length})
          </h2>

          {isLoading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          )}

          {queryError && (
            <Card className="border-destructive">
              <CardContent className="p-4 text-destructive">
                Erro ao carregar usuários. Tente novamente.
              </CardContent>
            </Card>
          )}
          
          {!isLoading && users.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                Nenhum usuário cadastrado.
              </CardContent>
            </Card>
          )}
          
          {users.map((userData: UserData) => {
            const isBanned = isUserBanned(userData);
            
            return (
              <Card key={userData.id} className={`overflow-hidden ${isBanned ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  {editingUserId === userData.id ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-name-${userData.id}`}>Nome</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id={`edit-name-${userData.id}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-10 pl-9"
                          />
                        </div>
                        {editErrors.name && <p className="text-sm text-destructive">{editErrors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`edit-email-${userData.id}`}>Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id={`edit-email-${userData.id}`}
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="h-10 pl-9"
                          />
                        </div>
                        {editErrors.email && <p className="text-sm text-destructive">{editErrors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`edit-password-${userData.id}`}>Nova Senha (deixe vazio para manter)</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id={`edit-password-${userData.id}`}
                            type={showEditPassword ? 'text' : 'password'}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-10 pl-9 pr-9"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                          >
                            {showEditPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                        </div>
                        {editErrors.password && <p className="text-sm text-destructive">{editErrors.password}</p>}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(userData.id)}
                          disabled={isSaving}
                          className="flex-1"
                        >
                          {isSaving ? <LoadingSpinner size="sm" /> : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBanned ? 'bg-destructive/10' : 'bg-secondary'}`}>
                          <User className={`w-5 h-5 ${isBanned ? 'text-destructive' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{userData.name}</p>
                            {isBanned && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                                Inativo
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{userData.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {userData.id === user?.id ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {roleLabel(userData.role)}
                          </span>
                        ) : (
                          <Select
                            value={userData.role || 'entregador'}
                            onValueChange={(newRole) => {
                              if (newRole === userData.role) return;
                              changeRoleMutation.mutate({ userId: userData.id, role: newRole });
                            }}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {userData.id !== user?.id && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartEdit(userData)}
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleToggleStatus(userData)}
                              title={isBanned ? 'Ativar' : 'Inativar'}
                              className={isBanned ? 'text-green-600 hover:text-green-700' : 'text-destructive hover:text-destructive'}
                            >
                              {isBanned ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!userToToggle} onOpenChange={() => setUserToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToToggle && isUserBanned(userToToggle) ? 'Ativar Usuário' : 'Inativar Usuário'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToToggle && isUserBanned(userToToggle) 
                ? `Tem certeza que deseja ativar o usuário "${userToToggle?.name}"? Ele poderá acessar o sistema novamente.`
                : `Tem certeza que deseja inativar o usuário "${userToToggle?.name}"? Ele não poderá mais acessar o sistema.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmToggleStatus}
              className={userToToggle && isUserBanned(userToToggle) ? '' : 'bg-destructive hover:bg-destructive/90'}
            >
              {toggleUserStatusMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                userToToggle && isUserBanned(userToToggle) ? 'Ativar' : 'Inativar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={!!userToChangeRole} onOpenChange={() => setUserToChangeRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToChangeRole?.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToChangeRole?.role === 'admin' 
                ? `Tem certeza que deseja remover o perfil de administrador de "${userToChangeRole?.name}"? Ele passará a ser um entregador comum.`
                : `Tem certeza que deseja tornar "${userToChangeRole?.name}" um administrador? Ele terá acesso total ao sistema.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (!userToChangeRole) return;
                const newRole = userToChangeRole.role === 'admin' ? 'entregador' : 'admin';
                changeRoleMutation.mutate({ userId: userToChangeRole.id, role: newRole });
              }}
              className={userToChangeRole?.role === 'admin' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {changeRoleMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : userToChangeRole?.role === 'admin' ? (
                <>
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Remover Admin
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Tornar Admin
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
