import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Beer, Mail, Lock, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { authStorage } from '@/lib/offline-storage';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, isLoading: authLoading, user, isOffline } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Redirect if already logged in (including cached offline session)
  useEffect(() => {
    if (!authLoading && user) {
      console.log('User found (possibly from cache), redirecting to home');
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  // Show cached session recovery message when offline with no user
  const showOfflineRecoveryMessage = isOffline && !user && !authLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    
    // If offline, try to validate against cached credentials
    if (isOffline) {
      try {
        const cachedAuth = await authStorage.get();
        const isValid = await authStorage.isValid();
        
        if (cachedAuth && isValid && cachedAuth.user.email?.toLowerCase() === email.toLowerCase()) {
          // Email matches cached user - restore session
          toast.success('Login offline realizado com sucesso!');
          navigate('/');
          return;
        } else if (cachedAuth && cachedAuth.user.email?.toLowerCase() !== email.toLowerCase()) {
          toast.error('Este email não corresponde à sessão salva neste dispositivo');
        } else {
          toast.error('Nenhuma sessão salva encontrada. Conecte-se à internet para o primeiro login.');
        }
      } catch (err) {
        toast.error('Erro ao verificar sessão offline');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Online login
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Login realizado com sucesso!');
        navigate('/');
      }
    } catch (err: any) {
      toast.error('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-hero">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-14 h-14 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
          <Beer className="w-8 h-8 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Graal Beer</h1>
          <p className="text-sm text-muted-foreground">Sistema de Entregas</p>
        </div>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md shadow-xl border-0 bg-card">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Entrar</CardTitle>
          <CardDescription className="text-center">
            Acesse sua conta para gerenciar entregas
          </CardDescription>
          {showOfflineRecoveryMessage && (
            <div className="flex flex-col items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3 mt-2">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4" />
                <span className="font-medium">Você está offline</span>
              </div>
              <span className="text-xs text-center text-warning/80">
                Se você já fez login antes neste dispositivo, sua sessão deveria ter sido recuperada automaticamente.
                Caso contrário, conecte-se à internet para fazer o primeiro login.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Password */}
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
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : isOffline ? (
                'Entrar Offline'
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Novo entregador? Fale com o administrador.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Graal Beer - Todos os direitos reservados
      </p>
    </div>
  );
}
