import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySaoPaulo } from '@/lib/date-utils';
import { erpOrdersCache, type ERPCacheStatus } from '@/lib/erp-cache';
import { isOnline as checkOnline } from '@/lib/offline-storage';
import { useEmpresa } from '@/contexts/EmpresaContext';


interface OrderItem {
  product: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OrderEquipment {
  type: string;
  description: string | null;
  patrimony: string | null;
  model: string | null;
  quantity: number;
}

export interface DailyOrderData {
  order_number: string;
  client_id?: string | number;
  id_empresa?: number | null;
  client_name: string;

  phone: string | null;
  expected_delivery: string | null;
  expected_return: string | null;
  observations: string | null;
  erp_status: string | null;
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
  const queryClient = useQueryClient();
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const [isOnline, setIsOnline] = useState(checkOnline());
  const [cacheStatus, setCacheStatus] = useState<ERPCacheStatus | null>(null);
  const hasTriedAutoSync = useRef(false);

  const today = useMemo(() => {
    return getTodaySaoPaulo();
  }, []);

  const empresasFilter = useMemo(() => {
    if (selectedEmpresa) return [selectedEmpresa];
    return allowedEmpresas;
  }, [selectedEmpresa, allowedEmpresas]);


  // Update cache status
  const updateCacheStatus = useCallback(async () => {
    const status = await erpOrdersCache.getStatus();
    setCacheStatus(status);
  }, []);

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

  // Load cache status on mount
  useEffect(() => {
    updateCacheStatus();
    // Cleanup old cache entries
    erpOrdersCache.cleanup();
  }, [updateCacheStatus]);

  const { data: orders, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['daily-orders-hook', today, empresasFilter.join(',')],
    queryFn: async () => {
      // Try to fetch from network first
      if (isOnline) {
        try {
          const { data, error } = await supabase.functions.invoke('list-erp-orders', {
            body: { date: today, empresas: empresasFilter },
          });

          
          if (error) throw error;
          
          const ordersData = data as DailyOrderData[];
          
          // Save to cache for offline use
          await erpOrdersCache.save(today, ordersData);
          await updateCacheStatus();
          
          console.log(`[ERP Cache] Saved ${ordersData.length} orders for ${today}`);
          
          return ordersData;
        } catch (networkError) {
          console.warn('[ERP Cache] Network fetch failed, trying cache:', networkError);
          // Fall through to cache
        }
      }

      // Try to get from cache
      const cachedOrders = await erpOrdersCache.get(today);
      if (cachedOrders) {
        console.log(`[ERP Cache] Using cached data for ${today} (${cachedOrders.length} orders)`);
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
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!checkOnline()) return false;
      return failureCount < 2;
    },
  });

  // Auto-sync on app open when online
  useEffect(() => {
    if (isOnline && !hasTriedAutoSync.current && cacheStatus?.isStale) {
      hasTriedAutoSync.current = true;
      console.log('[ERP Cache] Auto-syncing stale data...');
      refetch();
    }
  }, [isOnline, cacheStatus?.isStale, refetch]);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    if (!isOnline) {
      console.warn('[ERP Cache] Cannot refresh while offline');
      return;
    }
    
    // Invalidate query cache and refetch
    await queryClient.invalidateQueries({ queryKey: ['daily-orders-hook', today] });
    await refetch();
  }, [isOnline, queryClient, today, refetch]);

  const hasGrowler = (order: DailyOrderData) => {
    return order.items.some(item => {
      const p = item.product.toLowerCase();
      return p.includes('growler') || p.includes('pet') || p.includes('garrafa');
    });
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

  // Only orders WITH chopeira need collection. Everything else is RECOLHIDO immediately.
  const shouldAutoCollect = (order: DailyOrderData) => {
    return !hasChopeira(order);
  };

  const filteredOrders = useMemo(() => {
    const all = orders || [];
    if (!empresasFilter.length) return all;
    return all.filter(o => o.id_empresa != null && empresasFilter.includes(o.id_empresa as any));
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
    hasGrowler,
    hasBarrel,
    hasChopeira,
    needsCollectionDate,
    shouldAutoCollect,
  };
}
