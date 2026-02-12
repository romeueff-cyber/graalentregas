import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface EquipmentHistoryEntry {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  patrimony: string;
  client_name: string;
  client_id: string | null;
  action_type: string;
  order_number: string | null;
  notes: string | null;
}

interface UseEquipmentHistoryFilters {
  startDate: Date;
  endDate: Date;
  patrimony?: string;
  clientName?: string;
}

interface UseEquipmentHistoryReturn {
  history: EquipmentHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEquipmentHistory(filters: UseEquipmentHistoryFilters): UseEquipmentHistoryReturn {
  const [history, setHistory] = useState<EquipmentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('equipment_history')
        .select('*')
        .gte('created_at', startOfDay(filters.startDate).toISOString())
        .lte('created_at', endOfDay(filters.endDate).toISOString())
        .order('created_at', { ascending: false });

      if (filters.patrimony?.trim()) {
        query = query.ilike('patrimony', `%${filters.patrimony.trim()}%`);
      }

      if (filters.clientName?.trim()) {
        query = query.ilike('client_name', `%${filters.clientName.trim()}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('[useEquipmentHistory] Error:', fetchError);
        setError('Erro ao carregar histórico');
        return;
      }

      setHistory(data || []);
    } catch (err) {
      console.error('[useEquipmentHistory] Unexpected error:', err);
      setError('Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filters.startDate, filters.endDate, filters.patrimony, filters.clientName]);

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  };
}

// Helper function to record equipment history
export async function recordEquipmentHistory(entry: {
  userId: string;
  userName: string;
  patrimony: string;
  clientName: string;
  clientId?: string;
  actionType: string;
  orderNumber?: string;
  notes?: string;
}): Promise<boolean> {
  try {
    // Capture driver's real GPS position
    let driverLat: number | null = null;
    let driverLng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 5000, maximumAge: 30000,
        });
      });
      driverLat = pos.coords.latitude;
      driverLng = pos.coords.longitude;
    } catch {
      // GPS unavailable
    }

    const { error } = await supabase.from('equipment_history').insert({
      user_id: entry.userId,
      user_name: entry.userName,
      patrimony: entry.patrimony,
      client_name: entry.clientName,
      client_id: entry.clientId || null,
      action_type: entry.actionType,
      order_number: entry.orderNumber || null,
      notes: entry.notes || null,
      driver_latitude: driverLat,
      driver_longitude: driverLng,
    });

    if (error) {
      console.error('[recordEquipmentHistory] Error:', error);
      return false;
    }

    console.log(`[recordEquipmentHistory] Recorded: ${entry.actionType} - ${entry.patrimony}`);
    return true;
  } catch (err) {
    console.error('[recordEquipmentHistory] Unexpected error:', err);
    return false;
  }
}

// Action type constants
export const HISTORY_ACTIONS = {
  ENTREGA: 'ENTREGA',
  DEVOLUCAO: 'DEVOLUCAO',
  LIBERACAO: 'LIBERACAO',
  CONFERENCIA: 'CONFERENCIA',
} as const;
