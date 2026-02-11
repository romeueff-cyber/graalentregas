import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

// App version - increment this on each meaningful release
const APP_VERSION = '1.0.0';
const BUILD_TIME = new Date().toISOString();

export function getAppVersion() {
  return APP_VERSION;
}

export function getBuildTime() {
  return BUILD_TIME;
}

export function PWAUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      // Check if service worker has a waiting update
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.waiting) {
        setUpdateAvailable(true);
        return;
      }

      // Trigger a manual update check
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
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Check for waiting worker on load
        if (registration.waiting) {
          setUpdateAvailable(true);
        }

        // Listen for new workers
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

      // Listen for controller change (update applied)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isUpdating) {
          window.location.reload();
        }
      });
    }

    // Periodic check every 2 minutes
    const interval = setInterval(checkForUpdate, 2 * 60 * 1000);
    
    // Also check on focus (user returns to app)
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
        // Force reload if no waiting worker
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
