import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ERPProduct {
  id: number | string;
  description: string;
}
export interface ERPEquipmentType {
  id: number | string;
  description: string;
}

export function useERPProducts() {
  return useQuery({
    queryKey: ['erp-products'],
    staleTime: 1000 * 60 * 60, // 1h
    queryFn: async (): Promise<ERPProduct[]> => {
      const { data, error } = await supabase.functions.invoke('list-erp-products', {
        body: { limit: 2000 },
      });
      if (error) throw error;
      return (data as ERPProduct[]) || [];
    },
  });
}

export function useERPEquipmentTypes() {
  return useQuery({
    queryKey: ['erp-equipment-types'],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<ERPEquipmentType[]> => {
      const { data, error } = await supabase.functions.invoke('list-erp-equipment-types', {});
      if (error) throw error;
      return (data as ERPEquipmentType[]) || [];
    },
  });
}

export interface ERPLastOrderItem { product: string; quantity: number }
export interface ERPLastOrderEquipment { type: string; quantity: number }
export interface ERPLastOrder {
  order_number: string;
  delivery_date: string | null;
  items: ERPLastOrderItem[];
  equipments: ERPLastOrderEquipment[];
}

export async function fetchERPClientLastOrder(clientId: string): Promise<ERPLastOrder | null> {
  const { data, error } = await supabase.functions.invoke('get-erp-client-last-order', {
    body: { clientId },
  });
  if (error) throw error;
  return (data as ERPLastOrder) || null;
}
