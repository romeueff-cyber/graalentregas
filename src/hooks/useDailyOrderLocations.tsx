import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySaoPaulo } from '@/lib/date-utils';

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
  address: OrderAddress;
}

interface OrderLocation {
  orderNumber: string;
  clientName: string;
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

// Cache for geocoded locations to persist across navigation
const geocodeCache = new Map<string, OrderLocation[]>();

export function useDailyOrderLocations() {
  // All useState hooks at the top, in consistent order
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [locations, setLocations] = useState<OrderLocation[]>([]);
  const [failedOrders, setFailedOrders] = useState<string[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Use ref instead of state to track if geocoding has run (doesn't cause re-render issues)
  const hasGeocodedRef = useRef(false);

  const today = useMemo(() => {
    return getTodaySaoPaulo();
  }, []);

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

    // Poll for Google Maps availability
    const interval = setInterval(() => {
      if (checkGoogle()) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['daily-orders-for-map', today],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-erp-orders', {
        body: { date: today },
      });
      if (error) throw error;
      console.log('Daily orders loaded:', data?.length || 0);
      return data as Order[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Restore locations from cache on mount if available for today
  useEffect(() => {
    const cached = geocodeCache.get(today);
    if (cached && cached.length > 0) {
      console.log('Restoring', cached.length, 'geocoded locations from cache');
      setLocations(cached);
      hasGeocodedRef.current = true;
    }
  }, [today]);

  // Geocode addresses when Google Maps is ready and orders are loaded
  const geocodeOrders = useCallback(async () => {
    if (!orders || orders.length === 0 || !isGoogleReady || isGeocoding) return;
    
    setIsGeocoding(true);
    console.log('Starting geocoding for', orders.length, 'orders');
    
    const results: OrderLocation[] = [];
    const failed: string[] = [];

    for (const order of orders) {
      const coords = await geocodeAddress(order.address);
      
      if (coords) {
        results.push({
          orderNumber: order.order_number,
          clientName: order.client_name,
          lat: coords.lat,
          lng: coords.lng,
          hasValidAddress: true,
        });
        console.log(`✓ Order ${order.order_number} geocoded to (${coords.lat}, ${coords.lng})`);
      } else {
        failed.push(order.order_number);
        console.warn(`✗ Order ${order.order_number} geocoding failed. Address: ${JSON.stringify(order.address)}`);
      }
    }

    // If multiple orders resolve to the same coordinates (common when same address),
    // markers overlap and look like they are “missing”. Spread them slightly.
    const spreadOverlappingLocations = (locs: OrderLocation[]) => {
      const groups = new Map<string, OrderLocation[]>();

      for (const l of locs) {
        const key = `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
        const arr = groups.get(key) ?? [];
        arr.push(l);
        groups.set(key, arr);
      }

      const out: OrderLocation[] = [];
      for (const [key, group] of groups.entries()) {
        if (group.length === 1) {
          out.push(group[0]);
          continue;
        }

        console.info(`Spreading ${group.length} overlapping daily-order markers at ${key}`);

        const radius = 0.00012; // ~10–15m
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

    console.log('Geocoding complete:', results.length, 'locations found,', failed.length, 'failed:', failed.join(', '));
    setLocations(spreadResults);
    setFailedOrders(failed);
    setIsGeocoding(false);
    
    // Cache the results for today to persist across navigation
    if (spreadResults.length > 0) {
      geocodeCache.set(today, spreadResults);
    }
  }, [orders, isGoogleReady, isGeocoding, today]);

  // Trigger geocoding when ready
  useEffect(() => {
    if (orders && orders.length > 0 && isGoogleReady && !hasGeocodedRef.current && !isGeocoding) {
      hasGeocodedRef.current = true;
      geocodeOrders();
    }
  }, [orders, isGoogleReady, isGeocoding, geocodeOrders]);

  // Orders without valid coordinates (includes failed geocoding)
  const ordersWithoutLocation = useMemo(() => {
    if (!orders) return failedOrders;
    
    const locatedNumbers = new Set(locations.map(l => l.orderNumber));
    const missing = orders
      .filter(o => !locatedNumbers.has(o.order_number))
      .map(o => o.order_number);
    
    // Combine with explicitly failed orders to ensure all are tracked
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
