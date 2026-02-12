import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CostSettings {
  custo_por_km: number;
  custo_por_hora: number;
  custo_fixo_parada: number;
}

const DEFAULT_COST_SETTINGS: CostSettings = {
  custo_por_km: 1.50,
  custo_por_hora: 25.00,
  custo_fixo_parada: 10.00,
};

export function useCostSettings() {
  const queryClient = useQueryClient();

  const { data: costSettings, isLoading } = useQuery({
    queryKey: ['cost-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('custo_por_km, custo_por_hora, custo_fixo_parada')
        .single();
      
      if (error) {
        console.error('Error fetching cost settings:', error);
        return DEFAULT_COST_SETTINGS;
      }
      
      return {
        custo_por_km: Number(data.custo_por_km) ?? DEFAULT_COST_SETTINGS.custo_por_km,
        custo_por_hora: Number(data.custo_por_hora) ?? DEFAULT_COST_SETTINGS.custo_por_hora,
        custo_fixo_parada: Number(data.custo_fixo_parada) ?? DEFAULT_COST_SETTINGS.custo_fixo_parada,
      } as CostSettings;
    },
  });

  const updateCostSettings = useMutation({
    mutationFn: async (newSettings: Partial<CostSettings>) => {
      const { data: existingSettings, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabase
        .from('settings')
        .update(newSettings)
        .eq('id', existingSettings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-settings'] });
      toast.success('Configurações de custo salvas!');
    },
    onError: (error) => {
      console.error('Error updating cost settings:', error);
      toast.error('Erro ao salvar configurações de custo');
    },
  });

  return {
    costSettings: costSettings ?? DEFAULT_COST_SETTINGS,
    isLoading,
    updateCostSettings: updateCostSettings.mutate,
    isUpdating: updateCostSettings.isPending,
  };
}
