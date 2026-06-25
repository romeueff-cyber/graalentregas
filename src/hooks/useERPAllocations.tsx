import { useQuery } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';

export interface ERPAllocation {
  client_id: number;
  client_name: string;
  client_full_name: string;
  patrimony: string | null;
  model: string | null;
  type: string;
  order_number: string | null;
  delivery_date: string | null;
  id_empresa?: number | null;
}

export interface AllocationEquipment extends ERPAllocation {
  days_allocated: number | null;
}

export interface ClientAllocations {
  client_id: number;
  client_name: string;
  client_full_name: string;
  equipments: AllocationEquipment[];
  max_days: number;
  total_equipments: number;
}

function computeDays(deliveryDate: string | null): number | null {
  if (!deliveryDate) return null;
  try {
    const d = typeof deliveryDate === 'string' ? parseISO(deliveryDate) : new Date(deliveryDate);
    if (isNaN(d.getTime())) return null;
    return differenceInDays(new Date(), d);
  } catch {
    return null;
  }
}

export function useERPAllocations() {
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();

  const query = useQuery({
    queryKey: ['erp-allocations', selectedEmpresa, allowedEmpresas.join(',')],
    enabled: !!selectedEmpresa,
    queryFn: async () => {
      const empresas = selectedEmpresa ? String(selectedEmpresa) : allowedEmpresas.join(',');
      const { data, error } = await supabase.functions.invoke(
        `list-erp-allocations${empresas ? `?empresas=${empresas}` : ''}`,
        { body: {} }
      );
      if (error) throw error;
      const list: ERPAllocation[] = Array.isArray(data?.allocations) ? data.allocations : [];
      // Safety net: filtrar no cliente também
      return list.filter(a => !a.id_empresa || allowedEmpresas.includes(a.id_empresa as any));
    },
    staleTime: 5 * 60 * 1000,
  });

  const allocations = query.data ?? [];

  const groupedByClient: ClientAllocations[] = (() => {
    const map = new Map<number, ClientAllocations>();
    for (const a of allocations) {
      const days = computeDays(a.delivery_date);
      const eq: AllocationEquipment = { ...a, days_allocated: days };
      let entry = map.get(a.client_id);
      if (!entry) {
        entry = {
          client_id: a.client_id,
          client_name: a.client_name || a.client_full_name || `Cliente ${a.client_id}`,
          client_full_name: a.client_full_name,
          equipments: [],
          max_days: -1,
          total_equipments: 0,
        };
        map.set(a.client_id, entry);
      }
      entry.equipments.push(eq);
      entry.total_equipments += 1;
      if (days !== null && days > entry.max_days) entry.max_days = days;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.max_days - a.max_days);
    for (const c of arr) {
      c.equipments.sort((x, y) => (y.days_allocated ?? -1) - (x.days_allocated ?? -1));
    }
    return arr;
  })();

  const summary = {
    totalClients: groupedByClient.length,
    totalEquipments: allocations.length,
    over60: allocations.filter(a => {
      const d = computeDays(a.delivery_date);
      return d !== null && d > 60;
    }).length,
    over180: allocations.filter(a => {
      const d = computeDays(a.delivery_date);
      return d !== null && d > 180;
    }).length,
  };

  return {
    allocations,
    groupedByClient,
    summary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
