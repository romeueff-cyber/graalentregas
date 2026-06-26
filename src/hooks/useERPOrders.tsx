import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySaoPaulo } from '@/lib/date-utils';
import { erpOrdersCache, type ERPCacheStatus } from '@/lib/erp-cache';
import { isOnline as checkOnline } from '@/lib/offline-storage';
import { useEmpresa } from '@/contexts/EmpresaContext';
import type { DailyOrderData } from '@/hooks/useDailyOrders';

export { type DailyOrderData } from '@/hooks/useDailyOrders';


interface UseERPOrdersOptions {
  date?: string;
  enabled?: boolean;
}

export function useERPOrders({ date, enabled = true }: UseERPOrdersOptions = {}) {
  const queryClient = useQueryClient();
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const [isOnline, setIsOnline] = useState(checkOnline());
  const [cacheStatus, setCacheStatus] = useState<ERPCacheStatus | null>(null);
  const hasTriedAutoSync = useRef(false);

  const empresasFilter = useMemo(() => {
    if (selectedEmpresa) return [selectedEmpresa];
    return allowedEmpresas;
  }, [selectedEmpresa, allowedEmpresas]);


  const targetDate = useMemo(() => {
    return date || getTodaySaoPaulo();
  }, [date]);

  // Reset auto-sync flag when date changes
  useEffect(() => {
    hasTriedAutoSync.current = false;
  }, [targetDate]);

  // Update cache status
  const updateCacheStatus = useCallback(async () => {
    const status = await erpOrdersCache.getStatus(targetDate);
    setCacheStatus(status);
  }, [targetDate]);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cache status on mount and when date changes
  useEffect(() => {
    updateCacheStatus();
  }, [updateCacheStatus]);

  const { data: orders, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['erp-orders', targetDate, empresasFilter.join(',')],
    queryFn: async () => {
      const cacheKey = `${targetDate}|empresas:${empresasFilter.join(',') || 'none'}`;

      // Try to fetch from network first
      if (isOnline) {
        try {
          const { data, error } = await supabase.functions.invoke('list-erp-orders', {
            body: { date: targetDate, empresas: empresasFilter },
          });

          
          if (error) throw error;
          
          const ordersData = data as DailyOrderData[];
          
          // Save to cache for offline use
          await erpOrdersCache.save(cacheKey, ordersData);
          await updateCacheStatus();
          
          console.log(`[ERP Cache] Saved ${ordersData.length} orders for ${targetDate}`);
          
          return ordersData;
        } catch (networkError) {
          console.warn('[ERP Cache] Network fetch failed, trying cache:', networkError);
          // Fall through to cache
        }
      }

      // Try to get from cache
      const cachedOrders = await erpOrdersCache.get(cacheKey);
      if (cachedOrders) {
        console.log(`[ERP Cache] Using cached data for ${targetDate} (${cachedOrders.length} orders)`);
        return cachedOrders;
      }

      // No cache available
      if (!isOnline) {
        throw new Error('Sem conexão e sem dados em cache');
      }

      // Online but failed - rethrow original error
      throw new Error('Erro ao carregar pedidos do ERP');
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: enabled && empresasFilter.length > 0,
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!checkOnline()) return false;
      return failureCount < 2;
    },
  });

  // Auto-sync on app open when online
  useEffect(() => {
    if (enabled && isOnline && !hasTriedAutoSync.current && cacheStatus?.isStale) {
      hasTriedAutoSync.current = true;
      console.log(`[ERP Cache] Auto-syncing stale data for ${targetDate}...`);
      refetch();
    }
  }, [enabled, isOnline, cacheStatus?.isStale, refetch, targetDate]);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    if (!isOnline) {
      console.warn('[ERP Cache] Cannot refresh while offline');
      return;
    }
    
    // Invalidate query cache and refetch
    await queryClient.invalidateQueries({ queryKey: ['erp-orders', targetDate] });
    await refetch();
  }, [isOnline, queryClient, targetDate, refetch]);

  const filteredOrders = useMemo(() => {
    const all = orders || [];
    if (!empresasFilter.length) return all;
    // Server já filtra; aqui aceitamos id_empresa ausente para não esconder legado.
    return all.filter(o => o.id_empresa != null && empresasFilter.includes(Number(o.id_empresa) as any));
  }, [orders, empresasFilter]);

  return {
    orders: filteredOrders,

    isLoading,
    isFetching,
    refetch,
    forceRefresh,
    error,
    isOnline,
    cacheStatus,
    targetDate,
  };
}
