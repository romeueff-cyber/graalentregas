import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner, FullPageLoader } from '@/components/ui/loading-spinner';
import { ArrowLeft, Plus, User, Mail, Lock, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

const editSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
});

interface UserData {
  id: string;
  name: string;
  email: string;
  created_at: string | null;
  role: string | null;
}

export default function UsersManagementPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  
  // Edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editErrors, setEditErrors] = useState<{ name?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all users
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

      // Combine data
      const usersWithRoles: UserData[] = profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          created_at: profile.created_at,
          role: userRole?.role || null
        };
      });

      console.log('Users fetched:', usersWithRoles);
      return usersWithRoles;
    },
    enabled: !!user
  });

  // Create user mutation using edge function
  const createUserMutation = useMutation({
    mutationFn: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const response = await supabase.functions.invoke('create-user', {
        body: { name, email, password }
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
      toast.success('Entregador criado com sucesso!');
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
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      setEditName('');
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar usuário:', error);
      toast.error('Erro ao atualizar usuário: ' + error.message);
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
      await createUserMutation.mutateAsync({ name, email, password });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (user: UserData) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditErrors({});
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditErrors({});
  };

  const handleSaveEdit = async (userId: string) => {
    const result = editSchema.safeParse({ name: editName });
    if (!result.success) {
      const fieldErrors: { name?: string } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'name') fieldErrors.name = err.message;
      });
      setEditErrors(fieldErrors);
      return;
    }

    setIsSaving(true);
    try {
      await updateUserMutation.mutateAsync({ userId, name: editName });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return <FullPageLoader />;
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

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
            Novo Entregador
          </Button>
        )}

        {/* New User Form */}
        {showNewUserForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novo Entregador</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Nome do entregador"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
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
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12"
                    />
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
          
          {users.map((userData: UserData) => (
            <Card key={userData.id} className="overflow-hidden">
              <CardContent className="p-4">
                {editingUserId === userData.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-name-${userData.id}`}>Nome</Label>
                      <Input
                        id={`edit-name-${userData.id}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-10"
                      />
                      {editErrors.name && <p className="text-sm text-destructive">{editErrors.name}</p>}
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
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{userData.name}</p>
                        <p className="text-sm text-muted-foreground">{userData.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        userData.role === 'admin' 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {userData.role === 'admin' ? 'Admin' : 'Entregador'}
                      </span>
                      {userData.role !== 'admin' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStartEdit(userData)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}