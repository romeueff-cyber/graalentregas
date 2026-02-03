import { useMemo } from 'react';
import { useGeoSettings } from './useGeoSettings';
import { isWithinRadius } from '@/lib/geo-utils';

interface ItemWithCoords {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

/**
 * Hook that provides geo-filtering functionality.
 * Returns a function to filter items by the configured radius.
 */
export function useGeoFilter() {
  const { geoSettings, isLoading } = useGeoSettings();

  const filterByGeo = useMemo(() => {
    return <T extends ItemWithCoords>(items: T[]): T[] => {
      // If geo filter is not active, return all items
      if (!geoSettings.filtro_geografico_ativo) {
        return items;
      }

      return items.filter(item => {
        // Support both naming conventions (latitude/longitude and lat/lng)
        const lat = item.latitude ?? item.lat;
        const lng = item.longitude ?? item.lng;
        
        if (lat === undefined || lng === undefined) {
          return true; // Keep items without coordinates
        }

        return isWithinRadius(
          lat,
          lng,
          geoSettings.centro_latitude,
          geoSettings.centro_longitude,
          geoSettings.raio_km
        );
      });
    };
  }, [geoSettings]);

  return {
    filterByGeo,
    isGeoFilterActive: geoSettings.filtro_geografico_ativo,
    geoSettings,
    isLoading,
  };
}
