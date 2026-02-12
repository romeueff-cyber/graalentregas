import { useGPSTracking } from '@/hooks/useGPSTracking';

/**
 * Invisible component that activates GPS tracking when the user is authenticated.
 * Place inside AuthProvider.
 */
export function GPSTracker() {
  useGPSTracking();
  return null;
}
