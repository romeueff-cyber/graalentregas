import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';
import { useMemo } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';

export interface ERPOrderAnalytics {
  id: string;
  orderNumber: string;
  value: number;
  date: string;
  clientName: string;
  clientId: number;
  grupoCliente?: string | null;
  id_empresa?: number | null;
}

export interface ERPAnalyticsMetrics {
  totalValue: number;
  totalOrders: number;
  avgOrderValue: number;
  valueByDay: { date: string; value: number; count: number; label: string }[];
  topClientsByValue: { clientName: string; totalValue: number; orderCount: number }[];
}

export function useERPAnalytics(days: number = 7) {
  const startDate = useMemo(() => format(subDays(startOfDay(new Date()), days - 1), 'yyyy-MM-dd'), [days]);
  const endDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const empresasFilter = selectedEmpresa != null ? [selectedEmpresa] : allowedEmpresas;

  const { data: rawData, isLoading, error, refetch } = useQuery({
    queryKey: ['erp-analytics', startDate, endDate, empresasFilter.join(',')],
    enabled: empresasFilter.length > 0,
    queryFn: async (): Promise<ERPOrderAnalytics[]> => {
      console.log(`[useERPAnalytics] Fetching analytics from ${startDate} to ${endDate} empresas=${empresasFilter.join(',')}`);
      
      const { data, error } = await supabase.functions.invoke('get-erp-analytics', {
        body: {
          start_date: startDate,
          end_date: endDate,
          empresas: empresasFilter,
        },
      });

      if (error) {
        console.error('[useERPAnalytics] Error fetching analytics:', error);
        throw error;
      }

      console.log(`[useERPAnalytics] Retrieved ${data?.length || 0} orders`);
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const metrics: ERPAnalyticsMetrics = useMemo(() => {
    if (!rawData || rawData.length === 0) {
      return {
        totalValue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        valueByDay: [],
        topClientsByValue: [],
      };
    }

    // Calculate totals
    const totalValue = rawData.reduce((sum, order) => sum + (order.value || 0), 0);
    const totalOrders = rawData.length;
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

    // Group by day
    const dayMap = new Map<string, { value: number; count: number }>();
    
    rawData.forEach(order => {
      const dateKey = order.date ? format(new Date(order.date), 'yyyy-MM-dd') : 'unknown';
      const existing = dayMap.get(dateKey) || { value: 0, count: 0 };
      dayMap.set(dateKey, {
        value: existing.value + (order.value || 0),
        count: existing.count + 1,
      });
    });

    // Build valueByDay array for charts
    const valueByDay: ERPAnalyticsMetrics['valueByDay'] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = dayMap.get(dateStr) || { value: 0, count: 0 };
      valueByDay.push({
        date: dateStr,
        value: dayData.value,
        count: dayData.count,
        label: format(date, 'EEE', { locale: undefined }),
      });
    }

    // Group by client
    const clientMap = new Map<string, { totalValue: number; orderCount: number }>();
    
    rawData.forEach(order => {
      const clientName = order.clientName || 'Desconhecido';
      const existing = clientMap.get(clientName) || { totalValue: 0, orderCount: 0 };
      clientMap.set(clientName, {
        totalValue: existing.totalValue + (order.value || 0),
        orderCount: existing.orderCount + 1,
      });
    });

    // Sort clients by value and get top 10
    const topClientsByValue = Array.from(clientMap.entries())
      .map(([clientName, data]) => ({
        clientName,
        totalValue: data.totalValue,
        orderCount: data.orderCount,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return {
      totalValue,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      valueByDay,
      topClientsByValue,
    };
  }, [rawData, days]);

  return {
    data: rawData || [],
    metrics,
    isLoading,
    error,
    refetch,
  };
}
