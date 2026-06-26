import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';

function isAbortErrorLike(err: unknown): boolean {
  const anyErr = err as any;
  const message = String(anyErr?.message ?? '');
  return (
    anyErr?.name === 'AbortError' ||
    /signal is aborted/i.test(message) ||
    /abort/i.test(message) ||
    anyErr?.cause?.name === 'AbortError'
  );
}

interface OrderAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface Order {
  order_number: string;
  client_name: string;
  expected_delivery: string | null;
  address: OrderAddress;
}

interface OrderLocation {
  orderNumber: string;
  clientName: string;
  expectedDelivery?: string | null;
  lat: number;
  lng: number;
  hasValidAddress: boolean;
}

// Simple geocoding using Google Maps Geocoding API
async function geocodeAddress(address: OrderAddress): Promise<{ lat: number; lng: number } | null> {
  const parts = [
    address.street,
    address.number,
    address.neighborhood,
    address.city,
    address.state,
    'Brasil',
  ].filter(Boolean);

  if (parts.length < 3) return null;

  const addressString = parts.join(', ');

  try {
    if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      
      return new Promise((resolve) => {
        geocoder.geocode({ address: addressString }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({ lat: location.lat(), lng: location.lng() });
          } else {
            console.log(`Geocoding failed for "${addressString}": ${status}`);
            resolve(null);
          }
        });
      });
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}

// Cache for geocoded locations - keyed by date
const geocodeCache = new Map<string, OrderLocation[]>();

/**
 * Hook to fetch and geocode orders for a specific date
 * Used for route optimization where date selection is required
 */
export function useRouteOrderLocations(date: string) {
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [locations, setLocations] = useState<OrderLocation[]>([]);
  const [failedOrders, setFailedOrders] = useState<string[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  
  // Track if geocoding has run for current date
  const geocodedDateRef = useRef<string | null>(null);

  const empresasFilter = useMemo(() => {
    if (selectedEmpresa) return [selectedEmpresa];
    return allowedEmpresas;
  }, [selectedEmpresa, allowedEmpresas]);

  const cacheKey = useMemo(() => `${date}|empresas:${empresasFilter.join(',') || 'none'}`, [date, empresasFilter]);

  // Check if Google Maps is ready
  useEffect(() => {
    const checkGoogle = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
        setIsGoogleReady(true);
        return true;
      }
      return false;
    };

    if (checkGoogle()) return;

    const interval = setInterval(() => {
      if (checkGoogle()) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['route-orders', date, empresasFilter.join(',')],
    queryFn: async ({ signal }) => {
      try {
        const { data, error } = await supabase.functions.invoke('list-erp-orders', {
          body: { date, empresas: empresasFilter },
          signal,
        });
        
        if (error) {
          // Handle abort errors gracefully
          if (signal?.aborted || isAbortErrorLike(error)) {
            console.log('Request aborted:', date);
            return [];
          }
          throw error;
        }
        
        console.log(`Orders loaded for ${date}:`, data?.length || 0);
        const list = (data as Array<Order & { id_empresa?: number | null }>) || [];
        return list.filter((order) => order.id_empresa != null && empresasFilter.includes(Number(order.id_empresa) as any)) as Order[];
      } catch (err: any) {
        // Handle abort errors gracefully
        if (signal?.aborted || isAbortErrorLike(err)) {
          console.log('Request aborted during fetch:', date);
          return [];
        }
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!date && empresasFilter.length > 0,
    retry: (failureCount, error: any) => {
      // Don't retry on abort errors
      if (isAbortErrorLike(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Restore locations from cache when date changes
  useEffect(() => {
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.length > 0) {
      console.log(`Restoring ${cached.length} cached locations for ${date}`);
      setLocations(cached);
      geocodedDateRef.current = cacheKey;
    } else {
      // Clear locations when switching to a new date without cache
      if (geocodedDateRef.current !== cacheKey) {
        setLocations([]);
        setFailedOrders([]);
      }
    }
  }, [date, cacheKey]);

  // Geocode addresses when Google Maps is ready and orders are loaded
  const geocodeOrders = useCallback(async () => {
    if (!orders || orders.length === 0 || !isGoogleReady || isGeocoding) return;
    
    setIsGeocoding(true);
    console.log(`Starting geocoding for ${orders.length} orders on ${date}`);
    
    const results: OrderLocation[] = [];
    const failed: string[] = [];

    for (const order of orders) {
      const coords = await geocodeAddress(order.address);
      
      if (coords) {
        results.push({
          orderNumber: order.order_number,
          clientName: order.client_name,
          expectedDelivery: order.expected_delivery,
          lat: coords.lat,
          lng: coords.lng,
          hasValidAddress: true,
        });
      } else {
        failed.push(order.order_number);
      }
    }

    // Spread overlapping locations
    const spreadOverlappingLocations = (locs: OrderLocation[]) => {
      const groups = new Map<string, OrderLocation[]>();

      for (const l of locs) {
        const key = `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
        const arr = groups.get(key) ?? [];
        arr.push(l);
        groups.set(key, arr);
      }

      const out: OrderLocation[] = [];
      for (const [, group] of groups.entries()) {
        if (group.length === 1) {
          out.push(group[0]);
          continue;
        }

        const radius = 0.00012;
        const sorted = [...group].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
        sorted.forEach((l, idx) => {
          const angle = (2 * Math.PI * idx) / sorted.length;
          out.push({
            ...l,
            lat: l.lat + radius * Math.cos(angle),
            lng: l.lng + radius * Math.sin(angle),
          });
        });
      }

      return out;
    };

    const spreadResults = spreadOverlappingLocations(results);

    console.log(`Geocoding complete for ${date}: ${results.length} found, ${failed.length} failed`);
    setLocations(spreadResults);
    setFailedOrders(failed);
    setIsGeocoding(false);
    geocodedDateRef.current = cacheKey;
    
    // Cache results
    if (spreadResults.length > 0) {
      geocodeCache.set(cacheKey, spreadResults);
    }
  }, [orders, isGoogleReady, isGeocoding, date, cacheKey]);

  // Trigger geocoding when ready and date hasn't been geocoded
  useEffect(() => {
    if (orders && orders.length > 0 && isGoogleReady && geocodedDateRef.current !== cacheKey && !isGeocoding) {
      geocodeOrders();
    }
  }, [orders, isGoogleReady, cacheKey, isGeocoding, geocodeOrders]);

  // Orders without valid coordinates
  const ordersWithoutLocation = useMemo(() => {
    if (!orders) return failedOrders;
    
    const locatedNumbers = new Set(locations.map(l => l.orderNumber));
    const missing = orders
      .filter(o => !locatedNumbers.has(o.order_number))
      .map(o => o.order_number);
    
    return [...new Set([...missing, ...failedOrders])];
  }, [orders, locations, failedOrders]);

  // Get location for a specific order number
  const getOrderLocation = useCallback((orderNumber: string): { lat: number; lng: number } | null => {
    const loc = locations.find(l => l.orderNumber === orderNumber);
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  }, [locations]);

  return {
    orders,
    locations,
    ordersWithoutLocation,
    isLoading: isLoading || isGeocoding,
    error,
    isGoogleReady,
    getOrderLocation,
  };
}
