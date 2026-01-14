import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEquipments } from '@/hooks/useEquipments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, MapPin, Camera, Calendar, User, Package, QrCode } from 'lucide-react';
import { QRCodeScanner } from '@/components/QRCodeScanner';
import { toast } from 'sonner';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import type { CollectionPeriod } from '@/types/database';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { GoogleMapsInlineSetup } from '@/components/map/GoogleMapsInlineSetup';

const mapContainerStyle = {
  width: '100%',
  height: '200px',
};

export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const { createEquipment } = useEquipments();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [nomeCliente, setNomeCliente] = useState('');
  const [pedidoDia, setPedidoDia] = useState('');
  const [periodoRecolha, setPeriodoRecolha] = useState<CollectionPeriod>('DIA_TODO');
  const [dataPrevistaRecolha, setDataPrevistaRecolha] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [clienteIraAvisar, setClienteIraAvisar] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [mapScriptError, setMapScriptError] = useState<Error | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const { apiKey, hasApiKey, saveApiKey, clearApiKey } = useGoogleMapsKey();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        toast.error('Não foi possível obter sua localização');
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setLocation({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If client will notify, date and period are not required
    if (!nomeCliente || !pedidoDia || !location) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!clienteIraAvisar && !dataPrevistaRecolha) {
      toast.error('Preencha a data prevista ou marque "Cliente irá avisar"');
      return;
    }

    setIsSubmitting(true);
    try {
      await createEquipment({
        nome_cliente: nomeCliente,
        pedido_dia: pedidoDia,
        periodo_recolha: clienteIraAvisar ? 'CLIENTE_IRA_AVISAR' : periodoRecolha,
        data_prevista_recolha: clienteIraAvisar 
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year from now as placeholder
          : dataPrevistaRecolha,
        observacoes: observacoes || null,
        foto_local_path: photo || null,
        foto_url: null,
        latitude: location.lat,
        longitude: location.lng,
        cliente_ira_avisar: clienteIraAvisar,
      });

      // Small delay to ensure state propagates before navigation
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (error) {
      console.error('Error creating delivery:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Nova Entrega</h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomeCliente">Nome do Cliente *</Label>
              <Input
                id="nomeCliente"
                placeholder="Nome do cliente"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pedidoDia">Número do Pedido *</Label>
              <div className="flex gap-2">
                <Input
                  id="pedidoDia"
                  placeholder="Ex: 12345"
                  value={pedidoDia}
                  onChange={(e) => setPedidoDia(e.target.value)}
                  className="h-12 flex-1"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => setQrScannerOpen(true)}
                  title="Escanear QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recolha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Previsão de Recolha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cliente irá avisar checkbox */}
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Checkbox
                id="clienteIraAvisar"
                checked={clienteIraAvisar}
                onCheckedChange={(checked) => setClienteIraAvisar(checked === true)}
              />
              <Label 
                htmlFor="clienteIraAvisar" 
                className="text-sm font-medium text-amber-800 cursor-pointer"
              >
                Cliente irá avisar
              </Label>
            </div>

            <div className={`space-y-2 ${clienteIraAvisar ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label htmlFor="dataPrevistaRecolha">Data Prevista {!clienteIraAvisar && '*'}</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="dataPrevistaRecolha"
                  type="date"
                  value={dataPrevistaRecolha}
                  onChange={(e) => setDataPrevistaRecolha(e.target.value)}
                  className="h-12 pl-10"
                  disabled={clienteIraAvisar}
                />
              </div>
            </div>

            <div className={`space-y-2 ${clienteIraAvisar ? 'opacity-50 pointer-events-none' : ''}`}>
              <Label>Período {!clienteIraAvisar && '*'}</Label>
              <Select
                value={periodoRecolha}
                onValueChange={(v) => setPeriodoRecolha(v as CollectionPeriod)}
                disabled={clienteIraAvisar}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIA_TODO">Dia Todo</SelectItem>
                  <SelectItem value="MANHA">Manhã</SelectItem>
                  <SelectItem value="TARDE">Tarde</SelectItem>
                  <SelectItem value="NOITE">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Localização */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg overflow-hidden border">
              {!hasApiKey ? (
                <GoogleMapsInlineSetup onApiKeySubmit={saveApiKey} />
              ) : mapScriptError ? (
                <div className="h-[200px] flex flex-col items-center justify-center bg-muted p-3 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Erro ao carregar mapa
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {mapScriptError.message}
                  </p>
                  <Button variant="outline" size="sm" onClick={clearApiKey}>
                    Configurar chave
                  </Button>
                </div>
              ) : (
                <LoadScript
                  key={apiKey}
                  id="google-map-script"
                  googleMapsApiKey={apiKey}
                  language="pt-BR"
                  region="BR"
                  onError={(err) => setMapScriptError(err)}
                  loadingElement={
                    <div className="h-[200px] flex items-center justify-center bg-muted">
                      <LoadingSpinner text="Carregando mapa..." />
                    </div>
                  }
                >
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={location || { lat: -23.5505, lng: -46.6333 }}
                    zoom={16}
                    onClick={handleMapClick}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                      gestureHandling: 'greedy',
                    }}
                  >
                    {location && <Marker position={location} />}
                  </GoogleMap>
                </LoadScript>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Toque no mapa para ajustar a localização
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0"
                onClick={clearApiKey}
              >
                Configurar chave
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Foto e Observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto e Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Foto do Local (opcional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
              {photo ? (
                <div className="relative">
                  <img
                    src={photo}
                    alt="Foto do local"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="w-6 h-6" />
                    <span>Tirar foto</span>
                  </div>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-14 text-base font-semibold bg-gradient-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? <LoadingSpinner size="sm" /> : 'Registrar Entrega'}
        </Button>
      </form>

      {/* QR Code Scanner Modal */}
      <QRCodeScanner
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScan={(result) => setPedidoDia(result)}
      />
    </div>
  );
}

