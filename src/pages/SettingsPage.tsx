import { useState, useEffect, useCallback } from 'react';
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
import { ArrowLeft, Settings as SettingsIcon, Calendar, MapPin, Locate, DollarSign, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGeoSettings } from '@/hooks/useGeoSettings';
import { useCostSettings } from '@/hooks/useCostSettings';
import { useBoletoSettings } from '@/hooks/useBoletoSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Settings } from '@/types/database';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { geoSettings, updateGeoSettings, isUpdating } = useGeoSettings();
  const { costSettings, updateCostSettings, isUpdating: isUpdatingCost } = useCostSettings();
  const { boletoSettings, updateBoletoSettings, isUpdating: isUpdatingBoleto } = useBoletoSettings();

  const [diasExibir, setDiasExibir] = useState<number>(7);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);

    const reload = () => {
      // Avoid double reload via controllerchange
      window.removeEventListener('beforeunload', () => {});
      window.location.reload();
    };

    try {
      if (!('serviceWorker' in navigator)) {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        reload();
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        reload();
        return;
      }

      // Reload once the new SW takes control
      let reloaded = false;
      const onControllerChange = () => {
        if (reloaded) return;
        reloaded = true;
        reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      const activateWaiting = (sw: ServiceWorker) => {
        sw.postMessage({ type: 'SKIP_WAITING' });
      };

      // Already waiting -> activate immediately
      if (registration.waiting) {
        toast.success('Atualizando para a nova versão...');
        activateWaiting(registration.waiting);
        // Fallback in case controllerchange doesn't fire
        setTimeout(reload, 4000);
        return;
      }

      // Wait for any new SW to be discovered and installed
      const installedPromise = new Promise<ServiceWorker | null>((resolve) => {
        const onUpdateFound = () => {
          const sw = registration.installing;
          if (!sw) return resolve(null);
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') resolve(sw);
            if (sw.state === 'redundant') resolve(null);
          });
        };
        registration.addEventListener('updatefound', onUpdateFound);

        // Also handle case where update() finds one immediately
        if (registration.installing) onUpdateFound();
      });

      toast.info('Procurando nova versão...');
      await registration.update();

      // Race: installed within 20s OR no update
      const result = await Promise.race<ServiceWorker | null | 'timeout'>([
        installedPromise,
        new Promise((r) => setTimeout(() => r('timeout'), 20000)),
      ]);

      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);

      if (result && result !== 'timeout') {
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        toast.success('Nova versão pronta! Recarregando...');
        activateWaiting(result);
        setTimeout(reload, 3000);
        return;
      }

      if (registration.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        toast.success('Nova versão pronta! Recarregando...');
        activateWaiting(registration.waiting);
        setTimeout(reload, 3000);
        return;
      }

      toast.info('Você já está na versão mais recente!');
    } catch (error) {
      console.error('Update check error:', error);
      toast.error('Erro ao verificar atualização');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  
  // Geo settings local state
  const [geoAtivo, setGeoAtivo] = useState(false);
  const [centroLat, setCentroLat] = useState(-26.4841);
  const [centroLng, setCentroLng] = useState(-49.0747);
  const [raioKm, setRaioKm] = useState(50);
  const [isLocating, setIsLocating] = useState(false);

  // Cost settings local state
  const [custoPorKm, setCustoPorKm] = useState(1.50);
  const [custoPorHora, setCustoPorHora] = useState(25.00);
  const [custoFixoParada, setCustoFixoParada] = useState(10.00);

  // Boleto settings local state
  const [bMultaTipo, setBMultaTipo] = useState('PERCENTUAL');
  const [bMultaValor, setBMultaValor] = useState(2.00);
  const [bMultaAtivo, setBMultaAtivo] = useState(false);
  const [bJurosTaxa, setBJurosTaxa] = useState(1.00);
  const [bJurosAtivo, setBJurosAtivo] = useState(false);
  const [bDescontoTipo, setBDescontoTipo] = useState('FIXED');
  const [bDescontoValor, setBDescontoValor] = useState(0);
  const [bDescontoAtivo, setBDescontoAtivo] = useState(false);
  const [bProducao, setBProducao] = useState(false);

  // Sync geo settings from hook
  useEffect(() => {
    if (geoSettings) {
      setGeoAtivo(geoSettings.filtro_geografico_ativo);
      setCentroLat(geoSettings.centro_latitude);
      setCentroLng(geoSettings.centro_longitude);
      setRaioKm(geoSettings.raio_km);
    }
  }, [geoSettings]);

  // Sync cost settings from hook
  useEffect(() => {
    if (costSettings) {
      setCustoPorKm(costSettings.custo_por_km);
      setCustoPorHora(costSettings.custo_por_hora);
      setCustoFixoParada(costSettings.custo_fixo_parada);
    }
  }, [costSettings]);

  // Sync boleto settings from hook
  useEffect(() => {
    if (boletoSettings) {
      setBMultaTipo(boletoSettings.boleto_multa_tipo);
      setBMultaValor(boletoSettings.boleto_multa_valor);
      setBMultaAtivo(boletoSettings.boleto_multa_ativo);
      setBJurosTaxa(boletoSettings.boleto_juros_taxa);
      setBJurosAtivo(boletoSettings.boleto_juros_ativo);
      setBDescontoTipo(boletoSettings.boleto_desconto_tipo);
      setBDescontoValor(boletoSettings.boleto_desconto_valor);
      setBDescontoAtivo(boletoSettings.boleto_desconto_ativo);
      setBProducao(boletoSettings.boleto_producao);
    }
  }, [boletoSettings]);

  // Fetch settings - only for admin
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

  const handleSaveBoletoSettings = () => {
    updateBoletoSettings({
      boleto_multa_tipo: bMultaTipo,
      boleto_multa_valor: bMultaValor,
      boleto_multa_ativo: bMultaAtivo,
      boleto_juros_taxa: bJurosTaxa,
      boleto_juros_ativo: bJurosAtivo,
      boleto_desconto_tipo: bDescontoTipo,
      boleto_desconto_valor: bDescontoValor,
      boleto_desconto_ativo: bDescontoAtivo,
      boleto_producao: bProducao,
    });
  };

  const handleSaveCostSettings = () => {
    if (custoPorKm < 0 || custoPorHora < 0 || custoFixoParada < 0) {
      toast.error('Os valores de custo não podem ser negativos');
      return;
    }
    updateCostSettings({
      custo_por_km: custoPorKm,
      custo_por_hora: custoPorHora,
      custo_fixo_parada: custoFixoParada,
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

  if (authLoading || (isAdmin && isLoading)) {
    return <FullPageLoader />;
  }

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
        {/* Admin-only settings */}
        {isAdmin && (
          <>
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

            {/* Cost Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Custos Operacionais
                </CardTitle>
                <CardDescription>
                  Configure os valores para cálculo de rentabilidade por cliente (rateio simples por rota)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custoPorKm">Custo por km (R$)</Label>
                  <Input
                    id="custoPorKm"
                    type="number"
                    step="0.10"
                    min={0}
                    value={custoPorKm}
                    onChange={(e) => setCustoPorKm(parseFloat(e.target.value) || 0)}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Combustível + desgaste do veículo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custoPorHora">Custo por hora (R$)</Label>
                  <Input
                    id="custoPorHora"
                    type="number"
                    step="1"
                    min={0}
                    value={custoPorHora}
                    onChange={(e) => setCustoPorHora(parseFloat(e.target.value) || 0)}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Salário proporcional do motorista
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custoFixoParada">Custo fixo por parada (R$)</Label>
                  <Input
                    id="custoFixoParada"
                    type="number"
                    step="1"
                    min={0}
                    value={custoFixoParada}
                    onChange={(e) => setCustoFixoParada(parseFloat(e.target.value) || 0)}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Estacionamento, tempo de descarga, etc.
                  </p>
                </div>

                <Button
                  className="w-full h-12"
                  onClick={handleSaveCostSettings}
                  disabled={isUpdatingCost}
                >
                  {isUpdatingCost ? <LoadingSpinner size="sm" /> : 'Salvar Custos Operacionais'}
                </Button>
              </CardContent>
            </Card>

            {/* Boleto Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Configurações do Boleto
                </CardTitle>
                <CardDescription>
                  Configure multa, juros, desconto e ambiente da API Cora para emissão de boletos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Ambiente */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Ambiente de Produção</Label>
                    <p className="text-xs text-muted-foreground">
                      Ativo = boletos reais. Desativado = ambiente de testes (stage).
                    </p>
                  </div>
                  <Switch
                    checked={bProducao}
                    onCheckedChange={setBProducao}
                  />
                </div>

                {/* Multa */}
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Multa por atraso</Label>
                    <Switch
                      checked={bMultaAtivo}
                      onCheckedChange={setBMultaAtivo}
                    />
                  </div>
                  {bMultaAtivo && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Tipo de multa</Label>
                        <Select value={bMultaTipo} onValueChange={setBMultaTipo}>
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                            <SelectItem value="FIXO">Valor fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>
                          {bMultaTipo === 'PERCENTUAL' ? 'Percentual da multa (%)' : 'Valor da multa (R$)'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={bMultaValor}
                          onChange={(e) => setBMultaValor(parseFloat(e.target.value) || 0)}
                          className="h-12"
                        />
                        <p className="text-xs text-muted-foreground">
                          {bMultaTipo === 'PERCENTUAL'
                            ? 'Ex: 2% sobre o valor do boleto'
                            : 'Ex: R$ 5,00 de multa fixa'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Juros */}
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Juros ao mês</Label>
                    <Switch
                      checked={bJurosAtivo}
                      onCheckedChange={setBJurosAtivo}
                    />
                  </div>
                  {bJurosAtivo && (
                    <div className="space-y-2">
                      <Label>Taxa de juros mensal (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={bJurosTaxa}
                        onChange={(e) => setBJurosTaxa(parseFloat(e.target.value) || 0)}
                        className="h-12"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ex: 1% ao mês sobre o valor do boleto
                      </p>
                    </div>
                  )}
                </div>

                {/* Desconto */}
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Desconto para pagamento antecipado</Label>
                    <Switch
                      checked={bDescontoAtivo}
                      onCheckedChange={setBDescontoAtivo}
                    />
                  </div>
                  {bDescontoAtivo && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Tipo de desconto</Label>
                        <Select value={bDescontoTipo} onValueChange={setBDescontoTipo}>
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                            <SelectItem value="PERCENT">Percentual (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>
                          {bDescontoTipo === 'PERCENT' ? 'Percentual de desconto (%)' : 'Valor do desconto (R$)'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={bDescontoValor}
                          onChange={(e) => setBDescontoValor(parseFloat(e.target.value) || 0)}
                          className="h-12"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full h-12"
                  onClick={handleSaveBoletoSettings}
                  disabled={isUpdatingBoleto}
                >
                  {isUpdatingBoleto ? <LoadingSpinner size="sm" /> : 'Salvar Configurações de Boleto'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* System Info - Available to all users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Informações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versão</span>
              <span>{getAppVersion()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sistema</span>
              <span>Graal Beer Delivery</span>
            </div>
            <Button
              variant="outline"
              className="w-full h-10 mt-2 gap-2"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? (
                <LoadingSpinner size="sm" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Verificar Atualização
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
