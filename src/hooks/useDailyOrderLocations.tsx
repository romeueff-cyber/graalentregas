import { useMemo } from 'react';
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
    // Use the Google Maps Geocoding service if available
    if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      
      return new Promise((resolve) => {
        geocoder.geocode({ address: addressString }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({ lat: location.lat(), lng: location.lng() });
          } else {
            resolve(null);
          }
        });
      });
    }
    return null;
  } catch {
    return null;
  }
}

export function useDailyOrderLocations() {
  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['daily-orders-for-map', today],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-erp-orders', {
        body: { date: today },
      });
      if (error) throw error;
      return data as Order[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Geocode addresses (only when Google Maps is loaded)
  const { data: locations } = useQuery({
    queryKey: ['daily-orders-geocoded', orders?.map(o => o.order_number).join(',')],
    queryFn: async () => {
      if (!orders || typeof google === 'undefined') return [];

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

      return results;
    },
    enabled: !!orders && orders.length > 0,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

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
    locations: locations || [],
    ordersWithoutLocation,
    isLoading,
    error,
  };
}
