import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import {
  APP_UPDATE_AVAILABLE_EVENT,
  APP_UPDATE_REFRESH_START_EVENT,
  canUseAppServiceWorker,
  checkForAppUpdate,
  getAppVersion,
  isAppRefreshInProgress,
  markAppRefreshComplete,
  refreshAppToLatestVersion,
} from '@/lib/pwaUpdate';

export { getAppVersion };

export function PWAUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      if (isAppRefreshInProgress()) return;
      const hasUpdate = await checkForAppUpdate();
      if (hasUpdate && !isAppRefreshInProgress()) {
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.log('[PWAUpdate] Check failed:', error);
    }
  }, []);

  useEffect(() => {
    markAppRefreshComplete();
    if (!canUseAppServiceWorker()) return;

    const showUpdate = () => {
      if (!isAppRefreshInProgress()) {
        setDismissed(false);
        setUpdateAvailable(true);
      }
    };

    const hideDuringManualRefresh = () => {
      setUpdateAvailable(false);
      setDismissed(true);
    };

    window.addEventListener(APP_UPDATE_AVAILABLE_EVENT, showUpdate);
    window.addEventListener(APP_UPDATE_REFRESH_START_EVENT, hideDuringManualRefresh);

    const interval = setInterval(checkForUpdate, 2 * 60 * 1000);
    const onFocus = () => checkForUpdate();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void checkForUpdate();

    return () => {
      clearInterval(interval);
      window.removeEventListener(APP_UPDATE_AVAILABLE_EVENT, showUpdate);
      window.removeEventListener(APP_UPDATE_REFRESH_START_EVENT, hideDuringManualRefresh);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checkForUpdate]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await refreshAppToLatestVersion();
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
