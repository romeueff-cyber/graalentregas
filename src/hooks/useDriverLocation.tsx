import { useState, useEffect, useCallback } from 'react';
import { locationStorage, DriverLocation } from '@/lib/offline-storage';

interface UseDriverLocationResult {
  location: DriverLocation | null;
  isTracking: boolean;
  error: string | null;
  startTracking: () => void;
  stopTracking: () => void;
}

export function useDriverLocation(): UseDriverLocationResult {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Load last known location on mount
  useEffect(() => {
    const loadLastLocation = async () => {
      const lastLocation = await locationStorage.get();
      if (lastLocation) {
        setLocation(lastLocation);
      }
    };
    loadLastLocation();
  }, []);

  const handlePosition = useCallback(async (position: GeolocationPosition) => {
    const newLocation: DriverLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: new Date().toISOString()
    };

    setLocation(newLocation);
    await locationStorage.save(newLocation);
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.error('Geolocation error:', err);
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError('Permissão de localização negada');
        break;
      case err.POSITION_UNAVAILABLE:
        setError('Localização indisponível');
        break;
      case err.TIMEOUT:
        setError('Tempo esgotado ao obter localização');
        break;
      default:
        setError('Erro ao obter localização');
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Get initial position
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    // Start watching position
    const id = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    });

    setWatchId(id);
  }, [handlePosition, handleError]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Auto-start tracking only once on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    location,
    isTracking,
    error,
    startTracking,
    stopTracking
  };
}
