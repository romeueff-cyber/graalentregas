import { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Wifi, WifiOff, CheckCircle, Share, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function InstallPage() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleInstall = async () => {
    setInstalling(true);
    const success = await promptInstall();
    setInstalling(false);
    if (success) {
      // Redirect after successful install
      setTimeout(() => navigate('/'), 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-900 to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden shadow-2xl">
            <img 
              src="/icons/icon-192x192.png" 
              alt="Graal Beer" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-white">Graal Beer</h1>
          <p className="text-amber-200">Gestão de Entregas</p>
        </div>

        {/* Status Card */}
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white">
              {isInstalled ? 'App Instalado!' : 'Instalar Aplicativo'}
            </CardTitle>
            <CardDescription className="text-amber-200">
              {isInstalled 
                ? 'O aplicativo está instalado e pronto para uso offline'
                : 'Instale para usar mesmo sem internet'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle className="h-8 w-8" />
                  <span className="text-lg font-medium">Instalado com sucesso!</span>
                </div>
                <Button 
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  onClick={() => navigate('/')}
                >
                  Abrir Aplicativo
                </Button>
              </div>
            ) : isIOS ? (
              <div className="space-y-4">
                <p className="text-white text-center text-sm">
                  Para instalar no iPhone/iPad:
                </p>
                <div className="space-y-3 text-white/90 text-sm">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <Share className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <span>1. Toque no botão <strong>Compartilhar</strong></span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <Plus className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <span>2. Selecione <strong>"Adicionar à Tela de Início"</strong></span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <Download className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <span>3. Toque em <strong>"Adicionar"</strong></span>
                  </div>
                </div>
              </div>
            ) : isInstallable ? (
              <Button 
                className="w-full bg-amber-500 hover:bg-amber-600 h-12 text-lg"
                onClick={handleInstall}
                disabled={installing}
              >
                <Download className="h-5 w-5 mr-2" />
                {installing ? 'Instalando...' : 'Instalar Agora'}
              </Button>
            ) : (
              <div className="text-center text-white/70 text-sm">
                <p>O prompt de instalação aparecerá automaticamente.</p>
                <p className="mt-2">Se não aparecer, use o menu do navegador.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-lg">Funcionalidades Offline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-white/90">
              <WifiOff className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <span>Funciona sem internet</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <Smartphone className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <span>Abre como app nativo</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <Wifi className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <span>Sincroniza quando online</span>
            </div>
          </CardContent>
        </Card>

        {/* Continue without install */}
        {!isInstalled && (
          <div className="text-center">
            <Button 
              variant="ghost" 
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate(user ? '/' : '/auth')}
            >
              Continuar no navegador
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
