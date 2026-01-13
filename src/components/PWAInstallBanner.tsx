import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner recently
    const dismissedAt = localStorage.getItem('pwa-banner-dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const dayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < dayInMs) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    // Show banner after a delay if installable and not dismissed
    if (isInstallable && !dismissed && !isInstalled) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, dismissed, isInstalled]);

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-amber-500 text-white rounded-lg shadow-lg p-4 flex items-center gap-3">
        <Download className="h-6 w-6 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Instalar Graal Beer</p>
          <p className="text-xs text-white/80">Use offline e acesse mais rápido</p>
        </div>
        <Button 
          size="sm" 
          variant="secondary"
          className="flex-shrink-0"
          onClick={handleInstall}
        >
          Instalar
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-8 w-8 text-white hover:bg-white/20 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
