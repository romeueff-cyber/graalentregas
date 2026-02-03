import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GeoSettings {
  filtro_geografico_ativo: boolean;
  centro_latitude: number;
  centro_longitude: number;
  raio_km: number;
}

const DEFAULT_GEO_SETTINGS: GeoSettings = {
  filtro_geografico_ativo: false,
  centro_latitude: -26.4841,
  centro_longitude: -49.0747,
  raio_km: 50,
};

export function useGeoSettings() {
  const queryClient = useQueryClient();

  const { data: geoSettings, isLoading } = useQuery({
    queryKey: ['geo-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('filtro_geografico_ativo, centro_latitude, centro_longitude, raio_km')
        .single();
      
      if (error) {
        console.error('Error fetching geo settings:', error);
        return DEFAULT_GEO_SETTINGS;
      }
      
      return {
        filtro_geografico_ativo: data.filtro_geografico_ativo ?? false,
        centro_latitude: data.centro_latitude ?? DEFAULT_GEO_SETTINGS.centro_latitude,
        centro_longitude: data.centro_longitude ?? DEFAULT_GEO_SETTINGS.centro_longitude,
        raio_km: data.raio_km ?? DEFAULT_GEO_SETTINGS.raio_km,
      } as GeoSettings;
    },
  });

  const updateGeoSettings = useMutation({
    mutationFn: async (newSettings: Partial<GeoSettings>) => {
      // First, get the current settings row ID
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
      queryClient.invalidateQueries({ queryKey: ['geo-settings'] });
      toast.success('Configurações geográficas salvas!');
    },
    onError: (error) => {
      console.error('Error updating geo settings:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  return {
    geoSettings: geoSettings ?? DEFAULT_GEO_SETTINGS,
    isLoading,
    updateGeoSettings: updateGeoSettings.mutate,
    isUpdating: updateGeoSettings.isPending,
  };
}
