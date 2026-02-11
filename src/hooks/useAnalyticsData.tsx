import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DeliveryMetrics {
  totalDeliveries: number;
  totalCollected: number;
  pendingCollection: number;
  avgCollectionDays: number;
  confirmationRate: number;
  deliveriesPerDay: { date: string; count: number; label: string }[];
  collectionsByPeriod: { period: string; count: number }[];
  statusDistribution: { status: string; count: number; color: string }[];
}

export interface HygieneMetrics {
  totalClients: number;
  totalEquipment: number;
  servicesCompleted: number;
  overdueCleanings: number;
  upcomingCleanings: number;
  cleaningsByDay: { date: string; count: number; label: string }[];
  equipmentByType: { type: string; count: number; color: string }[];
  servicesByType: { type: string; count: number }[];
}

export interface DriverMetrics {
  userId: string;
  userName: string;
  totalDeliveries: number;
  totalCollections: number;
  confirmationRate: number;
  avgCollectionDays: number;
  score: number;
}

export interface ClientMetrics {
  totalClients: number;
  totalOrders: number;
  avgOrdersPerClient: number;
  recurrentRate: number;
  newClients: number;
  recurrentClients: number;
  topClients: { clientName: string; orderCount: number }[];
  frequencyDistribution: { range: string; count: number }[];
}

export function useAnalyticsData(days: number = 7) {
  const startDate = useMemo(() => subDays(startOfDay(new Date()), days), [days]);

  // Fetch equipments for delivery analytics
  const { data: equipments = [], isLoading: loadingEquipments } = useQuery({
    queryKey: ['analytics-equipments', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipments')
        .select('*')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all equipments for overall stats
  const { data: allEquipments = [], isLoading: loadingAllEquipments } = useQuery({
    queryKey: ['analytics-all-equipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipments')
        .select('*');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles for driver names
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['analytics-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch hygiene data
  const { data: hygieneClients = [], isLoading: loadingHygieneClients } = useQuery({
    queryKey: ['analytics-hygiene-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hygiene_clients')
        .select('*');
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: hygieneEquipment = [], isLoading: loadingHygieneEquipment } = useQuery({
    queryKey: ['analytics-hygiene-equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hygiene_equipment')
        .select('*');
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: hygieneServices = [], isLoading: loadingHygieneServices } = useQuery({
    queryKey: ['analytics-hygiene-services', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hygiene_services')
        .select('*')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch equipment history for collections tracking
  const { data: equipmentHistory = [], isLoading: loadingEquipmentHistory } = useQuery({
    queryKey: ['analytics-equipment-history', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_history')
        .select('*')
        .eq('action_type', 'DEVOLUCAO')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate delivery metrics
  const deliveryMetrics: DeliveryMetrics = useMemo(() => {
    const now = new Date();
    
    // Basic counts
    const totalDeliveries = equipments.length;
    const totalCollected = equipments.filter(e => e.status === 'RECOLHIDO').length;
    const pendingCollection = allEquipments.filter(e => e.status !== 'RECOLHIDO').length;
    
    // Average collection time (days between delivery and collection)
    const collectedWithDates = allEquipments.filter(
      e => e.status === 'RECOLHIDO' && e.data_entrega && e.data_real_recolha
    );
    const avgCollectionDays = collectedWithDates.length > 0
      ? collectedWithDates.reduce((sum, e) => {
          const days = differenceInDays(
            new Date(e.data_real_recolha!),
            new Date(e.data_entrega!)
          );
          return sum + Math.max(0, days);
        }, 0) / collectedWithDates.length
      : 0;
    
    // Confirmation rate (token used / total with tokens)
    const withTokens = allEquipments.filter(e => e.confirmation_token);
    const usedTokens = allEquipments.filter(e => e.token_used_at);
    const confirmationRate = withTokens.length > 0 
      ? (usedTokens.length / withTokens.length) * 100 
      : 0;
    
    // Deliveries per day
    const deliveriesPerDay: { date: string; count: number; label: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = equipments.filter(e => 
        e.data_entrega && format(new Date(e.data_entrega), 'yyyy-MM-dd') === dateStr
      ).length;
      deliveriesPerDay.push({
        date: dateStr,
        count,
        label: format(date, 'EEE', { locale: ptBR }),
      });
    }
    
    // Collections by period
    const periodCounts: Record<string, number> = {
      'Manhã': 0,
      'Tarde': 0,
      'Noite': 0,
      'Dia Todo': 0,
      'Cliente Avisará': 0,
    };
    equipments.forEach(e => {
      switch (e.periodo_recolha) {
        case 'MANHA': periodCounts['Manhã']++; break;
        case 'TARDE': periodCounts['Tarde']++; break;
        case 'NOITE': periodCounts['Noite']++; break;
        case 'DIA_TODO': periodCounts['Dia Todo']++; break;
        case 'CLIENTE_IRA_AVISAR': periodCounts['Cliente Avisará']++; break;
      }
    });
    const collectionsByPeriod = Object.entries(periodCounts)
      .filter(([, count]) => count > 0)
      .map(([period, count]) => ({ period, count }));
    
    // Status distribution
    const statusDistribution = [
      { status: 'Entregue', count: allEquipments.filter(e => e.status === 'ENTREGUE').length, color: 'hsl(var(--destructive))' },
      { status: 'Liberado', count: allEquipments.filter(e => e.status === 'LIBERADO_PARA_RECOLHA').length, color: 'hsl(var(--status-ready))' },
      { status: 'Recolhido', count: allEquipments.filter(e => e.status === 'RECOLHIDO').length, color: 'hsl(var(--status-collected))' },
    ].filter(s => s.count > 0);
    
    return {
      totalDeliveries,
      totalCollected,
      pendingCollection,
      avgCollectionDays: Math.round(avgCollectionDays * 10) / 10,
      confirmationRate: Math.round(confirmationRate),
      deliveriesPerDay,
      collectionsByPeriod,
      statusDistribution,
    };
  }, [equipments, allEquipments, days]);

  // Calculate hygiene metrics
  const hygieneMetrics: HygieneMetrics = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const in7Days = subDays(today, -7);
    
    // Basic counts
    const totalClients = hygieneClients.length;
    const totalEquipment = hygieneEquipment.filter(e => e.ativo).length;
    const servicesCompleted = hygieneServices.length;
    
    // Overdue and upcoming cleanings
    const overdueCleanings = hygieneEquipment.filter(e => 
      e.ativo && e.proxima_limpeza && new Date(e.proxima_limpeza) < today
    ).length;
    
    const upcomingCleanings = hygieneEquipment.filter(e => 
      e.ativo && e.proxima_limpeza && 
      new Date(e.proxima_limpeza) >= today && 
      new Date(e.proxima_limpeza) <= in7Days
    ).length;
    
    // Services by day
    const cleaningsByDay: { date: string; count: number; label: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = hygieneServices.filter(s => 
        format(new Date(s.data_servico), 'yyyy-MM-dd') === dateStr
      ).length;
      cleaningsByDay.push({
        date: dateStr,
        count,
        label: format(date, 'EEE', { locale: ptBR }),
      });
    }
    
    // Equipment by type
    const typeCounts: Record<string, number> = { chopeira: 0, geladeira: 0, balcao: 0 };
    hygieneEquipment.filter(e => e.ativo).forEach(e => {
      if (typeCounts[e.tipo_equipamento] !== undefined) {
        typeCounts[e.tipo_equipamento]++;
      }
    });
    const equipmentByType = [
      { type: 'Chopeira', count: typeCounts.chopeira, color: 'hsl(var(--primary))' },
      { type: 'Geladeira', count: typeCounts.geladeira, color: 'hsl(var(--status-ready))' },
      { type: 'Balcão', count: typeCounts.balcao, color: 'hsl(var(--chart-3))' },
    ].filter(t => t.count > 0);
    
    // Services by type
    const serviceTypeCounts: Record<string, number> = { limpeza: 0, troca: 0 };
    hygieneServices.forEach(s => {
      if (serviceTypeCounts[s.tipo_servico] !== undefined) {
        serviceTypeCounts[s.tipo_servico]++;
      }
    });
    const servicesByType = [
      { type: 'Limpeza', count: serviceTypeCounts.limpeza },
      { type: 'Troca', count: serviceTypeCounts.troca },
    ].filter(t => t.count > 0);
    
    return {
      totalClients,
      totalEquipment,
      servicesCompleted,
      overdueCleanings,
      upcomingCleanings,
      cleaningsByDay,
      equipmentByType,
      servicesByType,
    };
  }, [hygieneClients, hygieneEquipment, hygieneServices, days]);

  // Calculate driver metrics
  const driverMetrics: DriverMetrics[] = useMemo(() => {
    // Group equipments by driver (created_by_user_id)
    const driverMap = new Map<string, {
      deliveries: typeof equipments;
      collections: number;
      name: string;
    }>();

    // Process deliveries
    equipments.forEach(e => {
      const userId = e.created_by_user_id;
      if (!driverMap.has(userId)) {
        const profile = profiles.find(p => p.id === userId);
        driverMap.set(userId, {
          deliveries: [],
          collections: 0,
          name: profile?.name || profile?.email || 'Desconhecido',
        });
      }
      driverMap.get(userId)!.deliveries.push(e);
    });

    // Process collections from equipment_history
    equipmentHistory.forEach(h => {
      const userId = h.user_id;
      if (!driverMap.has(userId)) {
        const profile = profiles.find(p => p.id === userId);
        driverMap.set(userId, {
          deliveries: [],
          collections: 0,
          name: profile?.name || h.user_name || 'Desconhecido',
        });
      }
      driverMap.get(userId)!.collections++;
    });

    // Calculate metrics for each driver
    const metrics: DriverMetrics[] = [];
    const maxDeliveries = Math.max(...Array.from(driverMap.values()).map(d => d.deliveries.length), 1);
    const maxCollections = Math.max(...Array.from(driverMap.values()).map(d => d.collections), 1);

    driverMap.forEach((data, userId) => {
      const deliveries = data.deliveries;
      const totalDeliveries = deliveries.length;
      const totalCollections = data.collections;

      // Confirmation rate
      const withTokens = deliveries.filter(e => e.confirmation_token);
      const usedTokens = deliveries.filter(e => e.token_used_at);
      const confirmationRate = withTokens.length > 0 
        ? Math.round((usedTokens.length / withTokens.length) * 100) 
        : 0;

      // Average collection days
      const collectedWithDates = deliveries.filter(
        e => e.status === 'RECOLHIDO' && e.data_entrega && e.data_real_recolha
      );
      const avgCollectionDays = collectedWithDates.length > 0
        ? Math.round(collectedWithDates.reduce((sum, e) => {
            const days = differenceInDays(
              new Date(e.data_real_recolha!),
              new Date(e.data_entrega!)
            );
            return sum + Math.max(0, days);
          }, 0) / collectedWithDates.length * 10) / 10
        : 0;

      // Calculate score (0-100)
      // 30% entregas, 25% recolhas, 25% confirmação, 20% tempo recolha (invertido)
      const deliveryScore = (totalDeliveries / maxDeliveries) * 30;
      const collectionScore = maxCollections > 0 ? (totalCollections / maxCollections) * 25 : 0;
      const confirmationScore = (confirmationRate / 100) * 25;
      // For collection time, lower is better. Assume 14 days is baseline
      const timeScore = avgCollectionDays > 0 
        ? Math.max(0, (1 - avgCollectionDays / 14)) * 20 
        : 10; // Default if no data

      const score = Math.round(deliveryScore + collectionScore + confirmationScore + timeScore);

      metrics.push({
        userId,
        userName: data.name,
        totalDeliveries,
        totalCollections,
        confirmationRate,
        avgCollectionDays,
        score,
      });
    });

    return metrics.sort((a, b) => b.score - a.score);
  }, [equipments, equipmentHistory, profiles]);

  // Calculate client metrics
  const clientMetrics: ClientMetrics = useMemo(() => {
    // Group by client name (normalized)
    const clientMap = new Map<string, number>();
    
    allEquipments.forEach(e => {
      const clientName = e.nome_cliente.trim().toLowerCase();
      clientMap.set(clientName, (clientMap.get(clientName) || 0) + 1);
    });

    // In-period client map (for new vs recurrent analysis)
    const periodClientMap = new Map<string, number>();
    equipments.forEach(e => {
      const clientName = e.nome_cliente.trim().toLowerCase();
      periodClientMap.set(clientName, (periodClientMap.get(clientName) || 0) + 1);
    });

    const totalClients = periodClientMap.size;
    const totalOrders = equipments.length;
    const avgOrdersPerClient = totalClients > 0 ? totalOrders / totalClients : 0;

    // Recurrent = clients with more than 1 order in history
    let recurrentClients = 0;
    let newClients = 0;
    
    periodClientMap.forEach((_, clientName) => {
      const totalHistoryOrders = clientMap.get(clientName) || 0;
      if (totalHistoryOrders > 1) {
        recurrentClients++;
      } else {
        newClients++;
      }
    });

    const recurrentRate = totalClients > 0 
      ? Math.round((recurrentClients / totalClients) * 100) 
      : 0;

    // Top 10 clients (from period data)
    const topClients = Array.from(periodClientMap.entries())
      .map(([name, count]) => ({
        clientName: allEquipments.find(
          e => e.nome_cliente.trim().toLowerCase() === name
        )?.nome_cliente || name,
        orderCount: count,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    // Frequency distribution
    const frequencyCounts: Record<string, number> = {
      '1 pedido': 0,
      '2 pedidos': 0,
      '3-5 pedidos': 0,
      '6-10 pedidos': 0,
      '10+ pedidos': 0,
    };

    periodClientMap.forEach((count) => {
      if (count === 1) frequencyCounts['1 pedido']++;
      else if (count === 2) frequencyCounts['2 pedidos']++;
      else if (count >= 3 && count <= 5) frequencyCounts['3-5 pedidos']++;
      else if (count >= 6 && count <= 10) frequencyCounts['6-10 pedidos']++;
      else frequencyCounts['10+ pedidos']++;
    });

    const frequencyDistribution = Object.entries(frequencyCounts)
      .filter(([, count]) => count > 0)
      .map(([range, count]) => ({ range, count }));

    return {
      totalClients,
      totalOrders,
      avgOrdersPerClient: Math.round(avgOrdersPerClient * 10) / 10,
      recurrentRate,
      newClients,
      recurrentClients,
      topClients,
      frequencyDistribution,
    };
  }, [equipments, allEquipments]);

  const isLoading = loadingEquipments || loadingAllEquipments || 
    loadingHygieneClients || loadingHygieneEquipment || loadingHygieneServices || loadingProfiles || loadingEquipmentHistory;

  return {
    deliveryMetrics,
    hygieneMetrics,
    driverMetrics,
    clientMetrics,
    allEquipments,
    equipmentHistory,
    isLoading,
  };
}
