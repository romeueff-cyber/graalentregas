import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  product: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OrderEquipment {
  type: string;
  quantity: number;
}

export interface DailyOrderData {
  order_number: string;
  client_name: string;
  phone: string | null;
  expected_delivery: string | null;
  expected_return: string | null;
  observations: string | null;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: OrderItem[];
  equipments: OrderEquipment[];
}

export function useDailyOrders() {
  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const { data: orders, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['daily-orders-hook', today],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-erp-orders', {
        body: { date: today },
      });
      if (error) throw error;
      return data as DailyOrderData[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const hasGrowler = (order: DailyOrderData) => {
    return order.items.some(item => 
      item.product.toLowerCase().includes('growler')
    );
  };

  const hasBarrel = (order: DailyOrderData) => {
    return order.equipments.some(eq => 
      eq.type.toLowerCase().includes('barril')
    );
  };

  const hasChopeira = (order: DailyOrderData) => {
    return order.equipments.some(eq => 
      eq.type.toLowerCase().includes('chopeira')
    );
  };

  // Determine if the order requires collection date (only chopeira needs it)
  const needsCollectionDate = (order: DailyOrderData) => {
    return hasChopeira(order);
  };

  // Orders with only growler/barril should be marked as RECOLHIDO immediately
  const shouldAutoCollect = (order: DailyOrderData) => {
    return (hasGrowler(order) || hasBarrel(order)) && !hasChopeira(order);
  };

  return {
    orders: orders || [],
    isLoading,
    isFetching,
    refetch,
    error,
    hasGrowler,
    hasBarrel,
    hasChopeira,
    needsCollectionDate,
    shouldAutoCollect,
  };
}
