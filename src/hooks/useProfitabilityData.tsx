import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCostSettings } from './useCostSettings';
import { format } from 'date-fns';

// Fixed base coordinates: Rua Pedro Francisco Freiberger, 56 - Jaraguá do Sul
const BASE_LAT = -26.4841;
const BASE_LNG = -49.0747;

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Road correction factor (straight line → real road distance)
const ROAD_FACTOR = 1.4;

// Thresholds for detecting batch/impossible registrations
const MAX_REALISTIC_SPEED_KMH = 120;
const MIN_INTERVAL_MINUTES = 2;
const ESTIMATED_URBAN_SPEED_KMH = 40;

interface Movement {
  clientName: string;
  timestamp: Date;
  lat: number;
  lng: number;
  type: 'ENTREGA' | 'DEVOLUCAO';
  driverId: string;
  driverName: string;
}

export interface ClientProfitability {
  clientName: string;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  margin: number;
  deliveryCount: number;
  collectionCount: number;
  avgCostPerMovement: number;
}

export interface DriverDayCost {
  driverId: string;
  driverName: string;
  date: string;
  movements: number;
  totalDistanceKm: number;
  totalTimeHours: number;
  totalCost: number;
}

export function useProfitabilityData() {
  const { costSettings } = useCostSettings();

  // Fetch all deliveries (entregas) with coordinates
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ['profitability-deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipments')
        .select('nome_cliente, data_entrega, latitude, longitude, created_by_user_id')
        .not('data_entrega', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all collections (devoluções) from equipment_history
  const { data: collections = [], isLoading: loadingCollections } = useQuery({
    queryKey: ['profitability-collections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_history')
        .select('client_name, created_at, user_id, user_name')
        .eq('action_type', 'DEVOLUCAO');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles for driver names
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profitability-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch boletos for revenue
  const { data: boletos = [], isLoading: loadingBoletos } = useQuery({
    queryKey: ['profitability-boletos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boletos')
        .select('customer_name, total_amount, status');
      if (error) throw error;
      return data || [];
    },
  });

  // Build a client → coordinates lookup from equipments
  const clientCoords = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    deliveries.forEach(d => {
      const key = d.nome_cliente.trim().toUpperCase();
      if (!map.has(key) && d.latitude && d.longitude) {
        map.set(key, { lat: d.latitude, lng: d.longitude });
      }
    });
    return map;
  }, [deliveries]);

  // Build all movements
  const allMovements: Movement[] = useMemo(() => {
    const movements: Movement[] = [];

    // Deliveries
    deliveries.forEach(d => {
      if (!d.data_entrega || !d.latitude || !d.longitude) return;
      const profile = profiles.find(p => p.id === d.created_by_user_id);
      movements.push({
        clientName: d.nome_cliente.trim().toUpperCase(),
        timestamp: new Date(d.data_entrega),
        lat: d.latitude,
        lng: d.longitude,
        type: 'ENTREGA',
        driverId: d.created_by_user_id,
        driverName: profile?.name || 'Desconhecido',
      });
    });

    // Collections - get coordinates from client lookup
    collections.forEach(c => {
      const clientKey = c.client_name.trim().toUpperCase();
      const coords = clientCoords.get(clientKey);
      if (!coords) return; // Skip if no coordinates found
      
      movements.push({
        clientName: clientKey,
        timestamp: new Date(c.created_at),
        lat: coords.lat,
        lng: coords.lng,
        type: 'DEVOLUCAO',
        driverId: c.user_id,
        driverName: c.user_name || 'Desconhecido',
      });
    });

    return movements;
  }, [deliveries, collections, clientCoords, profiles]);

  // Calculate costs per client using real movement sequences
  const { profitabilityData, driverDayCosts } = useMemo(() => {
    if (!allMovements.length) return { profitabilityData: [], driverDayCosts: [] };

    // Group movements by driver + day
    const driverDayMap = new Map<string, Movement[]>();
    allMovements.forEach(m => {
      const dayKey = `${m.driverId}|${format(m.timestamp, 'yyyy-MM-dd')}`;
      if (!driverDayMap.has(dayKey)) driverDayMap.set(dayKey, []);
      driverDayMap.get(dayKey)!.push(m);
    });

    // Accumulate costs per client
    const clientCosts = new Map<string, { cost: number; deliveries: number; collections: number }>();
    const dayCosts: DriverDayCost[] = [];

    driverDayMap.forEach((movements, key) => {
      // Sort by timestamp
      movements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const [driverId, date] = key.split('|');
      const driverName = movements[0]?.driverName || 'Desconhecido';

      let totalDistanceKm = 0;
      let totalTimeHours = 0;
      let prevLat = BASE_LAT;
      let prevLng = BASE_LNG;
      let prevTime = movements[0].timestamp;

      // Calculate each leg
      movements.forEach((m, i) => {
        const distKm = haversineKm(prevLat, prevLng, m.lat, m.lng) * ROAD_FACTOR;
        
        // Calculate raw time from timestamps
        const rawTimeHours = i === 0
          ? 0
          : Math.max(0, (m.timestamp.getTime() - prevTime.getTime()) / 3600000);
        
        // Detect batch registration or impossible speed
        const rawSpeedKmh = rawTimeHours > 0 ? distKm / rawTimeHours : Infinity;
        const intervalMinutes = rawTimeHours * 60;
        const isSuspicious = i > 0 && (
          rawSpeedKmh > MAX_REALISTIC_SPEED_KMH || 
          intervalMinutes < MIN_INTERVAL_MINUTES
        );
        
        // For suspicious legs: use estimated time based on realistic urban speed
        const timeHours = i === 0
          ? 0
          : isSuspicious
            ? distKm / ESTIMATED_URBAN_SPEED_KMH
            : rawTimeHours;

        const legCost = (distKm * costSettings.custo_por_km) +
                        (timeHours * costSettings.custo_por_hora) +
                        costSettings.custo_fixo_parada;

        // Attribute leg cost to this client
        const clientKey = m.clientName;
        const existing = clientCosts.get(clientKey) || { cost: 0, deliveries: 0, collections: 0 };
        existing.cost += legCost;
        if (m.type === 'ENTREGA') existing.deliveries++;
        else existing.collections++;
        clientCosts.set(clientKey, existing);

        totalDistanceKm += distKm;
        totalTimeHours += timeHours;
        prevLat = m.lat;
        prevLng = m.lng;
        prevTime = m.timestamp;
      });

      // Return trip to base - split among all clients of the day
      const returnDistKm = haversineKm(prevLat, prevLng, BASE_LAT, BASE_LNG) * ROAD_FACTOR;
      const returnCost = returnDistKm * costSettings.custo_por_km;
      const returnCostPerClient = returnCost / movements.length;
      totalDistanceKm += returnDistKm;

      // Distribute return cost
      const dayClients = new Set(movements.map(m => m.clientName));
      const returnPerClient = returnCost / dayClients.size;
      dayClients.forEach(clientKey => {
        const existing = clientCosts.get(clientKey)!;
        existing.cost += returnPerClient;
      });

      dayCosts.push({
        driverId,
        driverName,
        date,
        movements: movements.length,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        totalTimeHours: Math.round(totalTimeHours * 10) / 10,
        totalCost: Math.round(
          (totalDistanceKm * costSettings.custo_por_km) +
          (totalTimeHours * costSettings.custo_por_hora) +
          (movements.length * costSettings.custo_fixo_parada) +
          returnCost
        ),
      });
    });

    // Build revenue map
    const clientRevenue = new Map<string, number>();
    boletos
      .filter(b => b.status !== 'CANCELLED')
      .forEach(b => {
        const name = b.customer_name.trim().toUpperCase();
        clientRevenue.set(name, (clientRevenue.get(name) || 0) + b.total_amount / 100);
      });

    // Merge into final data
    const allClients = new Set([...clientCosts.keys(), ...clientRevenue.keys()]);
    const results: ClientProfitability[] = [];

    allClients.forEach(name => {
      const revenue = clientRevenue.get(name) || 0;
      const costData = clientCosts.get(name) || { cost: 0, deliveries: 0, collections: 0 };
      const cost = Math.round(costData.cost * 100) / 100;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const totalMovements = costData.deliveries + costData.collections;

      if (revenue > 0 || cost > 0) {
        results.push({
          clientName: name,
          totalRevenue: revenue,
          totalCost: cost,
          profit: Math.round(profit * 100) / 100,
          margin: Math.round(margin),
          deliveryCount: costData.deliveries,
          collectionCount: costData.collections,
          avgCostPerMovement: totalMovements > 0
            ? Math.round((cost / totalMovements) * 100) / 100
            : 0,
        });
      }
    });

    return {
      profitabilityData: results.sort((a, b) => b.profit - a.profit),
      driverDayCosts: dayCosts.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [allMovements, boletos, costSettings]);

  const summary = useMemo(() => {
    const totalRevenue = profitabilityData.reduce((s, c) => s + c.totalRevenue, 0);
    const totalCost = profitabilityData.reduce((s, c) => s + c.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const unprofitableCount = profitabilityData.filter(c => c.profit < 0).length;
    const totalMovements = profitabilityData.reduce((s, c) => s + c.deliveryCount + c.collectionCount, 0);

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin: Math.round(avgMargin),
      totalClients: profitabilityData.length,
      unprofitableCount,
      totalMovements,
    };
  }, [profitabilityData]);

  return {
    profitabilityData,
    driverDayCosts,
    summary,
    isLoading: loadingDeliveries || loadingCollections || loadingProfiles || loadingBoletos,
  };
}
