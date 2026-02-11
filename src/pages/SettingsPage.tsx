import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getAppVersion } from '@/components/PWAUpdateBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner, FullPageLoader } from '@/components/ui/loading-spinner';
import { ArrowLeft, Settings as SettingsIcon, Calendar, MapPin, Locate } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGeoSettings } from '@/hooks/useGeoSettings';
import type { Settings } from '@/types/database';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { geoSettings, updateGeoSettings, isUpdating } = useGeoSettings();

  const [diasExibir, setDiasExibir] = useState<number>(7);
  const [isSaving, setIsSaving] = useState(false);
  
  // Geo settings local state
  const [geoAtivo, setGeoAtivo] = useState(false);
  const [centroLat, setCentroLat] = useState(-26.4841);
  const [centroLng, setCentroLng] = useState(-49.0747);
  const [raioKm, setRaioKm] = useState(50);
  const [isLocating, setIsLocating] = useState(false);

  // Sync geo settings from hook
  useEffect(() => {
    if (geoSettings) {
      setGeoAtivo(geoSettings.filtro_geografico_ativo);
      setCentroLat(geoSettings.centro_latitude);
      setCentroLng(geoSettings.centro_longitude);
      setRaioKm(geoSettings.raio_km);
    }
  }, [geoSettings]);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error) throw error;
      setDiasExibir(data.dias_exibir_recolhido);
      return data as Settings;
    },
    enabled: isAdmin
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (dias: number) => {
      const { error } = await supabase
        .from('settings')
        .update({ dias_exibir_recolhido: dias })
        .eq('id', settings!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Configurações salvas!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  const handleSave = async () => {
    if (diasExibir < 1 || diasExibir > 365) {
      toast.error('O valor deve estar entre 1 e 365 dias');
      return;
    }

    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(diasExibir);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeoSettings = () => {
    if (raioKm < 1 || raioKm > 500) {
      toast.error('O raio deve estar entre 1 e 500 km');
      return;
    }
    updateGeoSettings({
      filtro_geografico_ativo: geoAtivo,
      centro_latitude: centroLat,
      centro_longitude: centroLng,
      raio_km: raioKm,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCentroLat(Math.round(position.coords.latitude * 10000) / 10000);
        setCentroLng(Math.round(position.coords.longitude * 10000) / 10000);
        setIsLocating(false);
        toast.success('Localização obtida!');
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Erro ao obter localização');
        setIsLocating(false);
      }
    );
  };

  if (authLoading || isLoading) {
    return <FullPageLoader />;
  }

  // Note: Admin check is now handled by AdminRoute wrapper in App.tsx

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Configurações</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Exibição de Equipamentos Recolhidos
            </CardTitle>
            <CardDescription>
              Configure por quantos dias os equipamentos recolhidos permanecerão visíveis no mapa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="diasExibir">Dias para exibir após recolha</Label>
              <Input
                id="diasExibir"
                type="number"
                min={1}
                max={365}
                value={diasExibir}
                onChange={(e) => setDiasExibir(parseInt(e.target.value) || 0)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Após este período, os equipamentos recolhidos serão ocultados automaticamente do mapa (mas não excluídos do sistema).
              </p>
            </div>

            <Button
              className="w-full h-12"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <LoadingSpinner size="sm" /> : 'Salvar Configurações'}
            </Button>
          </CardContent>
        </Card>

        {/* Geo Filter Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Filtro Geográfico
            </CardTitle>
            <CardDescription>
              Limite a área de atuação para otimizar performance e focar nos pedidos relevantes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar filtro por raio</Label>
                <p className="text-xs text-muted-foreground">
                  Mostra apenas pedidos e equipamentos dentro do raio definido
                </p>
              </div>
              <Switch
                checked={geoAtivo}
                onCheckedChange={setGeoAtivo}
              />
            </div>

            {geoAtivo && (
              <>
                <div className="space-y-2">
                  <Label>Raio de atuação (km)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={raioKm}
                    onChange={(e) => setRaioKm(parseInt(e.target.value) || 50)}
                    className="h-12"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Latitude central</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={centroLat}
                      onChange={(e) => setCentroLat(parseFloat(e.target.value) || 0)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude central</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={centroLng}
                      onChange={(e) => setCentroLng(parseFloat(e.target.value) || 0)}
                      className="h-12"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-10"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                >
                  {isLocating ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Locate className="w-4 h-4 mr-2" />
                      Usar minha localização atual
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  O filtro será aplicado no Mapa de Pedidos do Dia, Mapa Principal e Otimização de Rotas.
                </p>
              </>
            )}

            <Button
              className="w-full h-12"
              onClick={handleSaveGeoSettings}
              disabled={isUpdating}
            >
              {isUpdating ? <LoadingSpinner size="sm" /> : 'Salvar Configurações Geográficas'}
            </Button>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Informações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versão</span>
              <span>{getAppVersion()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sistema</span>
              <span>Graal Beer Delivery</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
