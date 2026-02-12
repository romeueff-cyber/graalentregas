import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineReturnQueue, type PendingReturn } from '@/lib/offline-return-queue';
import { isOnline as checkOnline } from '@/lib/offline-storage';
import { toast } from 'sonner';

/**
 * Hook that automatically syncs pending offline equipment returns
 * when the device comes back online.
 */
export function useOfflineReturnSync() {
  const isSyncing = useRef(false);

  const syncPendingReturns = useCallback(async () => {
    if (isSyncing.current || !checkOnline()) return;

    const pending = await offlineReturnQueue.getAll();
    if (pending.length === 0) return;

    isSyncing.current = true;
    console.log(`[OfflineReturnSync] Syncing ${pending.length} pending returns...`);

    let successCount = 0;
    let errorCount = 0;

    for (const item of pending) {
      try {
        const { data, error } = await supabase.functions.invoke('update-erp-equipment-status', {
          body: { patrimonio: item.patrimony, orderNumber: item.orderNumber }
        });

        if (error) {
          console.error(`[OfflineReturnSync] Error syncing ${item.patrimony}:`, error);
          errorCount++;
        } else if (data?.success === false) {
          console.warn(`[OfflineReturnSync] ${item.patrimony}: ${data.warning}`);
          // Remove from queue even if ERP says it failed (already processed or invalid)
          await offlineReturnQueue.remove(item.id);
          errorCount++;
        } else {
          await offlineReturnQueue.remove(item.id);
          successCount++;
          console.log(`[OfflineReturnSync] ✓ ${item.patrimony} synced`);
        }
      } catch (err) {
        console.error(`[OfflineReturnSync] Exception syncing ${item.patrimony}:`, err);
        errorCount++;
      }
    }

    if (successCount > 0 || errorCount > 0) {
      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} devolução(ões) offline sincronizada(s) com o ERP`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} sincronizada(s), ${errorCount} com erro`);
      } else {
        toast.error(`${errorCount} devolução(ões) offline falharam ao sincronizar`);
      }
    }

    isSyncing.current = false;
  }, []);

  // Listen for online event to trigger sync
  useEffect(() => {
    const handleOnline = () => {
      console.log('[OfflineReturnSync] Device came online, checking for pending returns...');
      // Small delay to ensure connection is stable
      setTimeout(syncPendingReturns, 2000);
    };

    window.addEventListener('online', handleOnline);

    // Also try to sync on mount if online
    if (checkOnline()) {
      syncPendingReturns();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncPendingReturns]);

  return { syncPendingReturns };
}
