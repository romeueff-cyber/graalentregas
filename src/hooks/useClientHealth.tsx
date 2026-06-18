import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';
import { useMemo } from 'react';
import type { ERPOrderAnalytics } from './useERPAnalytics';

export type ClientHealthStatus = 'ativo' | 'risco' | 'parado' | 'novo';

export interface ClientHealthRow {
  clientId: number | string;
  clientName: string;
  grupoCliente: string;
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
  firstOrder: string;
  lastOrder: string;
  daysSinceLast: number;
  avgIntervalDays: number;
  status: ClientHealthStatus;
  // Trend: orders in recent half-window vs previous half-window
  recentOrders: number;
  previousOrders: number;
  trendPct: number; // % change (recent vs previous)
}

export interface ClientHealthMetrics {
  totalClients: number;
  ativos: number;
  emRisco: number;
  parados: number;
  novos: number;
  rows: ClientHealthRow[];
  grupos: string[];
  byGrupo: { grupo: string; ativos: number; risco: number; parado: number; novos: number }[];
}

const NO_GROUP = 'Sem grupo';

/**
 * Hook para análise de saúde de clientes.
 *
 * Estratégia de classificação:
 * - Calcula intervalo médio entre pedidos por cliente (window completo).
 * - daysSinceLast > 3× avgInterval (ou > 120 dias)  → parado
 * - daysSinceLast > 2× avgInterval                  → risco
 * - 1 único pedido no período                        → novo
 * - caso contrário                                   → ativo
 *
 * Tendência: pedidos na metade recente vs metade anterior do período.
 */
export function useClientHealth(days: number = 90) {
  const startDate = useMemo(
    () => format(subDays(startOfDay(new Date()), days - 1), 'yyyy-MM-dd'),
    [days]
  );
  const endDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const { data: rawData, isLoading, error, refetch } = useQuery({
    queryKey: ['client-health', startDate, endDate],
    queryFn: async (): Promise<ERPOrderAnalytics[]> => {
      const { data, error } = await supabase.functions.invoke('get-erp-analytics', {
        body: { start_date: startDate, end_date: endDate },
      });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const metrics: ClientHealthMetrics = useMemo(() => {
    const empty: ClientHealthMetrics = {
      totalClients: 0,
      ativos: 0,
      emRisco: 0,
      parados: 0,
      novos: 0,
      rows: [],
      grupos: [],
      byGrupo: [],
    };
    if (!rawData || rawData.length === 0) return empty;

    const today = startOfDay(new Date());
    // Tendência: janela fixa de 60 dias vs 60 dias anteriores (independente de "days"),
    // assim "Todo o período" não distorce comparando 5 anos vs 5 anos.
    const TREND_WINDOW = 60;
    const recentCutoff = subDays(today, TREND_WINDOW);
    const previousCutoff = subDays(today, TREND_WINDOW * 2);

    // Group orders by clientId|clientName
    type Bucket = {
      clientId: number | string;
      clientName: string;
      grupoCliente: string;
      orders: ERPOrderAnalytics[];
    };
    const map = new Map<string, Bucket>();
    rawData.forEach(o => {
      const key = String(o.clientId ?? o.clientName ?? 'unknown');
      const grupo = (o.grupoCliente && String(o.grupoCliente).trim()) || NO_GROUP;
      const existing = map.get(key);
      if (existing) {
        existing.orders.push(o);
        // prefer non-empty group
        if (existing.grupoCliente === NO_GROUP && grupo !== NO_GROUP) {
          existing.grupoCliente = grupo;
        }
      } else {
        map.set(key, {
          clientId: o.clientId ?? key,
          clientName: o.clientName || 'Desconhecido',
          grupoCliente: grupo,
          orders: [o],
        });
      }
    });

    const rows: ClientHealthRow[] = [];
    map.forEach(bucket => {
      const orders = bucket.orders
        .filter(o => o.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (orders.length === 0) return;

      const totalOrders = orders.length;
      const totalValue = orders.reduce((s, o) => s + (o.value || 0), 0);
      const avgTicket = totalValue / totalOrders;

      const firstDate = new Date(orders[0].date);
      const lastDate = new Date(orders[orders.length - 1].date);
      const daysSinceLast = Math.max(0, differenceInDays(today, lastDate));

      // Average interval
      let avgIntervalDays = 0;
      if (orders.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < orders.length; i++) {
          intervals.push(
            Math.max(
              1,
              differenceInDays(new Date(orders[i].date), new Date(orders[i - 1].date))
            )
          );
        }
        avgIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      // Trend
      const recentOrders = orders.filter(o => new Date(o.date) >= midPoint).length;
      const previousOrders = totalOrders - recentOrders;
      const trendPct = previousOrders > 0
        ? ((recentOrders - previousOrders) / previousOrders) * 100
        : recentOrders > 0 ? 100 : 0;

      // Status
      let status: ClientHealthStatus;
      if (totalOrders === 1 && daysSinceLast <= 60) {
        status = 'novo';
      } else if (avgIntervalDays > 0 && daysSinceLast > avgIntervalDays * 3) {
        status = 'parado';
      } else if (daysSinceLast > 120) {
        status = 'parado';
      } else if (avgIntervalDays > 0 && daysSinceLast > avgIntervalDays * 2) {
        status = 'risco';
      } else {
        status = 'ativo';
      }

      rows.push({
        clientId: bucket.clientId,
        clientName: bucket.clientName,
        grupoCliente: bucket.grupoCliente,
        totalOrders,
        totalValue,
        avgTicket: Math.round(avgTicket * 100) / 100,
        firstOrder: format(firstDate, 'yyyy-MM-dd'),
        lastOrder: format(lastDate, 'yyyy-MM-dd'),
        daysSinceLast,
        avgIntervalDays: Math.round(avgIntervalDays * 10) / 10,
        status,
        recentOrders,
        previousOrders,
        trendPct: Math.round(trendPct),
      });
    });

    rows.sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    const grupos = Array.from(new Set(rows.map(r => r.grupoCliente))).sort();
    const grupoMap = new Map<string, { ativos: number; risco: number; parado: number; novos: number }>();
    rows.forEach(r => {
      const g = grupoMap.get(r.grupoCliente) || { ativos: 0, risco: 0, parado: 0, novos: 0 };
      if (r.status === 'ativo') g.ativos++;
      else if (r.status === 'risco') g.risco++;
      else if (r.status === 'parado') g.parado++;
      else if (r.status === 'novo') g.novos++;
      grupoMap.set(r.grupoCliente, g);
    });
    const byGrupo = Array.from(grupoMap.entries()).map(([grupo, v]) => ({ grupo, ...v }));

    return {
      totalClients: rows.length,
      ativos: rows.filter(r => r.status === 'ativo').length,
      emRisco: rows.filter(r => r.status === 'risco').length,
      parados: rows.filter(r => r.status === 'parado').length,
      novos: rows.filter(r => r.status === 'novo').length,
      rows,
      grupos,
      byGrupo,
    };
  }, [rawData, days]);

  return { data: rawData || [], metrics, isLoading, error, refetch };
}
