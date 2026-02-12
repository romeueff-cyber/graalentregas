import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  enqueueLocation,
  getQueue,
  clearQueue,
  getCurrentPosition,
  type GPSPoint,
} from '@/lib/gps-location-queue';
import { syncVisits } from '@/lib/visit-queue';

const CAPTURE_INTERVAL_MS = 60_000; // 60 seconds
const SYNC_INTERVAL_MS = 120_000; // 2 minutes
const BATCH_SIZE = 50;

export function useGPSTracking() {
  const { user } = useAuth();
  const captureTimerRef = useRef<ReturnType<typeof setInterval>>();
  const syncTimerRef = useRef<ReturnType<typeof setInterval>>();
  const isSyncingRef = useRef(false);

  const captureLocation = useCallback(async () => {
    if (!user?.id) return;
    try {
      const position = await getCurrentPosition();
      const point: GPSPoint = {
        userId: user.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date().toISOString(),
      };
      await enqueueLocation(point);
    } catch (err) {
      // GPS failure is expected sometimes (indoors, permissions)
      console.debug('[GPS] Capture failed:', (err as Error).message);
    }
  }, [user?.id]);

  const syncLocations = useCallback(async () => {
    if (!user?.id || isSyncingRef.current || !navigator.onLine) return;
    isSyncingRef.current = true;

    try {
      const queue = await getQueue();
      if (queue.length === 0) {
        isSyncingRef.current = false;
        return;
      }

      // Send in batches
      for (let i = 0; i < queue.length; i += BATCH_SIZE) {
        const batch = queue.slice(i, i + BATCH_SIZE);
        const rows = batch.map((p) => ({
          user_id: p.userId,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracy: p.accuracy,
          captured_at: p.capturedAt,
        }));

        const { error } = await supabase
          .from('driver_locations')
          .insert(rows);

        if (error) {
          console.error('[GPS] Sync batch failed:', error.message);
          isSyncingRef.current = false;
          return; // Keep queue for retry
        }
      }

      await clearQueue();
      console.debug(`[GPS] Synced ${queue.length} locations`);

      // Also sync pending visit attempts
      await syncVisits();
    } catch (err) {
      console.error('[GPS] Sync error:', (err as Error).message);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Capture immediately on start
    captureLocation();

    // Set up intervals
    captureTimerRef.current = setInterval(captureLocation, CAPTURE_INTERVAL_MS);
    syncTimerRef.current = setInterval(syncLocations, SYNC_INTERVAL_MS);

    // Sync when coming back online
    const handleOnline = () => {
      console.debug('[GPS] Back online, syncing...');
      syncLocations();
    };
    window.addEventListener('online', handleOnline);

    // Sync before page unload
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        syncLocations();
      } else if (document.visibilityState === 'visible') {
        // Resume capturing when app comes back to foreground
        captureLocation();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Final sync attempt
      syncLocations();
    };
  }, [user?.id, captureLocation, syncLocations]);
}
