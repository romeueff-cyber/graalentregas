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

  const isLoading = loadingEquipments || loadingAllEquipments || 
    loadingHygieneClients || loadingHygieneEquipment || loadingHygieneServices;

  return {
    deliveryMetrics,
    hygieneMetrics,
    isLoading,
  };
}
