import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCostSettings } from './useCostSettings';

export interface ClientProfitability {
  clientName: string;
  totalRevenue: number; // in R$ (converted from centavos)
  totalCost: number;
  profit: number;
  margin: number; // percentage
  deliveryCount: number;
  avgCostPerDelivery: number;
}

export function useProfitabilityData() {
  const { costSettings } = useCostSettings();

  // Fetch all boletos (revenue data)
  const { data: boletos = [], isLoading: loadingBoletos } = useQuery({
    queryKey: ['profitability-boletos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boletos')
        .select('customer_name, order_number, total_amount, status');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch route stops with route info (cost data)
  const { data: routeStops = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['profitability-route-stops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stops')
        .select(`
          client_name, order_number, distance_from_previous,
          route_id,
          optimized_routes!inner (
            id, total_distance, total_duration
          )
        `);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch equipments to know which orders have chopeira (need return trip)
  const { data: equipments = [], isLoading: loadingEquipments } = useQuery({
    queryKey: ['profitability-equipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipments')
        .select('pedido_dia, observacoes');
      if (error) throw error;
      return data || [];
    },
  });

  const profitabilityData: ClientProfitability[] = useMemo(() => {
    if (!boletos.length && !routeStops.length) return [];

    // Group revenue by client (normalized name)
    const clientRevenue = new Map<string, number>();
    boletos
      .filter(b => b.status !== 'CANCELLED')
      .forEach(b => {
        const name = b.customer_name.trim().toUpperCase();
        clientRevenue.set(name, (clientRevenue.get(name) || 0) + b.total_amount / 100);
      });

    // Count stops per route for cost splitting
    const routeStopCounts = new Map<string, number>();
    routeStops.forEach(rs => {
      const routeId = rs.route_id;
      routeStopCounts.set(routeId, (routeStopCounts.get(routeId) || 0) + 1);
    });

    // Calculate cost per client from routes
    const clientCost = new Map<string, { cost: number; deliveries: number }>();

    routeStops.forEach(rs => {
      const name = rs.client_name.trim().toUpperCase();
      const routeId = rs.route_id;
      const route = rs.optimized_routes as any;
      const stopsInRoute = routeStopCounts.get(routeId) || 1;

      // Total route distance in km
      const totalDistanceKm = (route?.total_distance || 0) / 1000;
      // Total route duration in hours
      const totalDurationHours = (route?.total_duration || 0) / 3600;

      // Cost per stop = total route cost / number of stops
      const routeCost = (totalDistanceKm * costSettings.custo_por_km) +
                        (totalDurationHours * costSettings.custo_por_hora) +
                        (stopsInRoute * costSettings.custo_fixo_parada);
      const costPerStop = routeCost / stopsInRoute;

      const existing = clientCost.get(name) || { cost: 0, deliveries: 0 };
      existing.cost += costPerStop;
      existing.deliveries += 1;
      clientCost.set(name, existing);
    });

    // Merge revenue and cost data
    const allClients = new Set([...clientRevenue.keys(), ...clientCost.keys()]);
    const results: ClientProfitability[] = [];

    allClients.forEach(name => {
      const revenue = clientRevenue.get(name) || 0;
      const costData = clientCost.get(name) || { cost: 0, deliveries: 0 };
      const cost = Math.round(costData.cost * 100) / 100;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      // Only include clients that have either revenue or cost data
      if (revenue > 0 || cost > 0) {
        results.push({
          clientName: name,
          totalRevenue: revenue,
          totalCost: cost,
          profit: Math.round(profit * 100) / 100,
          margin: Math.round(margin),
          deliveryCount: costData.deliveries,
          avgCostPerDelivery: costData.deliveries > 0 
            ? Math.round((cost / costData.deliveries) * 100) / 100 
            : 0,
        });
      }
    });

    return results.sort((a, b) => b.profit - a.profit);
  }, [boletos, routeStops, equipments, costSettings]);

  const summary = useMemo(() => {
    const totalRevenue = profitabilityData.reduce((s, c) => s + c.totalRevenue, 0);
    const totalCost = profitabilityData.reduce((s, c) => s + c.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const unprofitableCount = profitabilityData.filter(c => c.profit < 0).length;

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin: Math.round(avgMargin),
      totalClients: profitabilityData.length,
      unprofitableCount,
    };
  }, [profitabilityData]);

  return {
    profitabilityData,
    summary,
    isLoading: loadingBoletos || loadingRoutes || loadingEquipments,
  };
}
