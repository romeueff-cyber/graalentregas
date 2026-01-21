import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export function useDailyOrderLocations() {
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [locations, setLocations] = useState<OrderLocation[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
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

  // Geocode addresses when Google Maps is ready and orders are loaded
  const geocodeOrders = useCallback(async () => {
    if (!orders || orders.length === 0 || !isGoogleReady || isGeocoding) return;
    
    setIsGeocoding(true);
    console.log('Starting geocoding for', orders.length, 'orders');
    
    const results: OrderLocation[] = [];

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
      }
    }

    console.log('Geocoding complete:', results.length, 'locations found');
    setLocations(results);
    setIsGeocoding(false);
  }, [orders, isGoogleReady, isGeocoding]);

  useEffect(() => {
    if (orders && orders.length > 0 && isGoogleReady && locations.length === 0 && !isGeocoding) {
      geocodeOrders();
    }
  }, [orders, isGoogleReady, locations.length, isGeocoding, geocodeOrders]);

  // Orders without valid coordinates
  const ordersWithoutLocation = useMemo(() => {
    if (!orders || !locations) return [];
    
    const locatedNumbers = new Set(locations.map(l => l.orderNumber));
    return orders
      .filter(o => !locatedNumbers.has(o.order_number))
      .map(o => o.order_number);
  }, [orders, locations]);

  return {
    orders,
    locations,
    ordersWithoutLocation,
    isLoading: isLoading || isGeocoding,
    error,
    isGoogleReady,
  };
}
