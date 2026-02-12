import { useState, useEffect, useCallback } from 'react';
import { offlineReturnQueue, type PendingReturn } from '@/lib/offline-return-queue';

/**
 * Hook to track pending offline returns count and list.
 * Polls localforage periodically and on online/offline events.
 */
export function usePendingReturns() {
  const [pending, setPending] = useState<PendingReturn[]>([]);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const items = await offlineReturnQueue.getAll();
    setPending(items);
    setCount(items.length);
  }, []);

  useEffect(() => {
    refresh();

    // Refresh on connectivity changes (sync may have cleared items)
    const handleChange = () => setTimeout(refresh, 3000);
    window.addEventListener('online', handleChange);
    window.addEventListener('offline', handleChange);

    // Poll every 30s in case sync happens in background
    const interval = setInterval(refresh, 30000);

    return () => {
      window.removeEventListener('online', handleChange);
      window.removeEventListener('offline', handleChange);
      clearInterval(interval);
    };
  }, [refresh]);

  return { pending, count, refresh };
}
