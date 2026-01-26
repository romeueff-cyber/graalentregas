import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch all delivered order numbers (pedido_dia) from the database.
 * Uses a security definer function that bypasses RLS to allow all authenticated
 * users to see which orders have been delivered (without exposing PII).
 */
export function useDeliveredOrders() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['delivered-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_delivered_order_numbers');
      
      if (error) {
        console.error('Error fetching delivered orders:', error);
        throw error;
      }
      
      // Normalize order numbers for consistent comparison
      const normalizedSet = new Set<string>();
      (data || []).forEach((row: { pedido_dia: string }) => {
        const normalized = normalizeOrderKey(row.pedido_dia);
        if (normalized) {
          normalizedSet.add(normalized);
        }
      });
      
      return normalizedSet;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });

  return {
    deliveredOrderNumbers: data || new Set<string>(),
    isLoading,
    error,
    refetch,
  };
}

/**
 * Normalize order number for comparison (trim, remove leading zeros, digits only)
 */
export function normalizeOrderKey(value: unknown): string {
  if (value === null || value === undefined) return '';

  const raw = String(value).trim();
  // ERP/DB can sometimes include spaces or formatting; compare using digits when possible.
  const digitsOnly = raw.replace(/\D+/g, '');
  if (!digitsOnly) return raw;
  const withoutLeadingZeros = digitsOnly.replace(/^0+/, '');
  return withoutLeadingZeros || '0';
}
