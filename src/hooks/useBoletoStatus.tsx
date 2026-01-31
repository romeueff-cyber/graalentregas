import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useERPBoletoData, type ERPBoletoData } from '@/hooks/useERPBoletoData';

interface BoletoStatusMap {
  [orderNumber: string]: {
    hasGenerated: boolean;
    isBoletoPayment: boolean | null; // null = not checked yet
  };
}

interface PaymentInfoCache {
  [orderNumber: string]: {
    isBoleto: boolean;
    fetchedAt: number;
  };
}

// Cache payment info for 5 minutes
const PAYMENT_CACHE_TTL = 5 * 60 * 1000;

export function useBoletoStatus(orderNumbers: string[]) {
  const [statusMap, setStatusMap] = useState<BoletoStatusMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [paymentCache, setPaymentCache] = useState<PaymentInfoCache>({});

  // Fetch generated boletos from database
  const fetchGeneratedBoletos = useCallback(async () => {
    if (orderNumbers.length === 0) return;

    try {
      // Build query to check all order numbers (including potential installments)
      const orConditions = orderNumbers.map(num => 
        `order_number.eq.${num},order_number.like.${num}-%`
      ).join(',');

      const { data, error } = await supabase
        .from('boletos')
        .select('order_number')
        .or(orConditions);

      if (error) {
        console.error('[BoletoStatus] Error fetching boletos:', error);
        return;
      }

      // Extract base order numbers from results
      const generatedOrders = new Set<string>();
      (data || []).forEach(row => {
        // Handle installment format (7163-1 -> 7163)
        const baseOrderNumber = row.order_number.split('-')[0];
        generatedOrders.add(baseOrderNumber);
      });

      // Update status map with generated info
      setStatusMap(prev => {
        const newMap = { ...prev };
        orderNumbers.forEach(orderNum => {
          newMap[orderNum] = {
            hasGenerated: generatedOrders.has(orderNum),
            isBoletoPayment: prev[orderNum]?.isBoletoPayment ?? null,
          };
        });
        return newMap;
      });
    } catch (err) {
      console.error('[BoletoStatus] Error:', err);
    }
  }, [orderNumbers]);

  // Fetch payment method from ERP for a specific order
  const fetchPaymentMethod = useCallback(async (orderNumber: string): Promise<boolean | null> => {
    // Check cache first
    const cached = paymentCache[orderNumber];
    if (cached && Date.now() - cached.fetchedAt < PAYMENT_CACHE_TTL) {
      return cached.isBoleto;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-erp-boleto-data', {
        body: { orderNumber },
      });

      if (error || data?.error) {
        console.warn(`[BoletoStatus] Could not fetch payment method for ${orderNumber}`);
        return null;
      }

      const isBoleto = data?.payment?.method_type === 'BOL';

      // Cache the result
      setPaymentCache(prev => ({
        ...prev,
        [orderNumber]: { isBoleto, fetchedAt: Date.now() },
      }));

      return isBoleto;
    } catch {
      return null;
    }
  }, [paymentCache]);

  // Batch check payment methods (limit concurrent calls)
  const batchCheckPaymentMethods = useCallback(async () => {
    if (orderNumbers.length === 0) return;

    setIsLoading(true);

    // Process in batches of 5 to avoid overwhelming the edge function
    const batchSize = 5;
    for (let i = 0; i < orderNumbers.length; i += batchSize) {
      const batch = orderNumbers.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async orderNum => {
          const isBoleto = await fetchPaymentMethod(orderNum);
          return { orderNum, isBoleto };
        })
      );

      // Update status map with payment info
      setStatusMap(prev => {
        const newMap = { ...prev };
        results.forEach(({ orderNum, isBoleto }) => {
          newMap[orderNum] = {
            hasGenerated: prev[orderNum]?.hasGenerated ?? false,
            isBoletoPayment: isBoleto,
          };
        });
        return newMap;
      });
    }

    setIsLoading(false);
  }, [orderNumbers, fetchPaymentMethod]);

  // Initial fetch of generated boletos
  useEffect(() => {
    fetchGeneratedBoletos();
  }, [fetchGeneratedBoletos]);

  // Fetch payment methods (only for orders not in cache)
  useEffect(() => {
    const uncachedOrders = orderNumbers.filter(num => {
      const cached = paymentCache[num];
      return !cached || Date.now() - cached.fetchedAt >= PAYMENT_CACHE_TTL;
    });

    if (uncachedOrders.length > 0) {
      batchCheckPaymentMethods();
    }
  }, [orderNumbers.join(',')]); // Only re-run when order list changes

  // Get status for a specific order
  const getStatus = useCallback((orderNumber: string) => {
    return statusMap[orderNumber] || { hasGenerated: false, isBoletoPayment: null };
  }, [statusMap]);

  // Refresh status after boleto generation
  const refreshStatus = useCallback(() => {
    fetchGeneratedBoletos();
  }, [fetchGeneratedBoletos]);

  return {
    getStatus,
    refreshStatus,
    isLoading,
  };
}
