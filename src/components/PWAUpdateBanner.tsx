import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - injected by Vite define
const APP_BUILD_ID: string = __APP_BUILD_ID__;

export function getAppVersion() {
  return APP_BUILD_ID;
}

export function PWAUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.waiting) {
        setUpdateAvailable(true);
        return;
      }
      if (registration) {
        await registration.update();
        if (registration.waiting) {
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      console.log('[PWAUpdate] Check failed:', error);
    }
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setUpdateAvailable(true);
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isUpdating) {
          window.location.reload();
        }
      });
    }

    const interval = setInterval(checkForUpdate, 2 * 60 * 1000);
    const onFocus = () => checkForUpdate();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkForUpdate, isUpdating]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-in slide-in-from-top duration-300">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-3">
        <RefreshCw className={`h-5 w-5 flex-shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Nova versão disponível!</p>
          <p className="text-xs opacity-80">Atualize para a versão mais recente</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="flex-shrink-0"
          onClick={handleUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? 'Atualizando...' : 'Atualizar'}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 hover:bg-primary-foreground/20 flex-shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
