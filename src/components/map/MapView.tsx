import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, LoadScript } from '@react-google-maps/api';
import type { EquipmentWithCreator } from '@/types/database';
import type { DriverLocation } from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PeriodBadge } from '@/components/ui/period-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { GoogleMapsSetup } from './GoogleMapsSetup';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { Navigation, ExternalLink } from 'lucide-react';

interface MapViewProps {
  equipments: EquipmentWithCreator[];
  driverLocation: DriverLocation | null;
  onEquipmentClick?: (equipment: EquipmentWithCreator) => void;
  selectedEquipment?: EquipmentWithCreator | null;
  onCloseInfoWindow?: () => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

const statusColors = {
  ENTREGUE: '#ef4444',
  LIBERADO_PARA_RECOLHA: '#22c55e',
  RECOLHIDO: '#6b7280',
};

export function MapView({
  equipments,
  driverLocation,
  onEquipmentClick,
  selectedEquipment,
  onCloseInfoWindow,
}: MapViewProps) {
  const { apiKey, hasApiKey, saveApiKey, clearApiKey } = useGoogleMapsKey();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);
  const [scriptError, setScriptError] = useState<Error | null>(null);

  useEffect(() => {
    setScriptError(null);
  }, [apiKey]);

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    }),
    []
  );

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  useEffect(() => {
    if (map && driverLocation) {
      map.panTo({ lat: driverLocation.latitude, lng: driverLocation.longitude });
    }
  }, [map, driverLocation]);

  const openRoute = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const handleMarkerClick = (equipment: EquipmentWithCreator) => {
    setInfoWindowOpen(true);
    onEquipmentClick?.(equipment);
  };

  const handleInfoWindowClose = () => {
    setInfoWindowOpen(false);
    onCloseInfoWindow?.();
  };

  if (!hasApiKey) {
    return <GoogleMapsSetup onApiKeySubmit={saveApiKey} />;
  }

  if (scriptError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted rounded-lg p-4 text-center">
        <p className="text-muted-foreground mb-2">Erro ao carregar mapa</p>
        <p className="text-xs text-muted-foreground mb-4">
          {scriptError.message || 'Verifique se a chave está correta e se a Maps JavaScript API está ativada.'}
        </p>
        <Button variant="outline" size="sm" onClick={clearApiKey}>
          Configurar chave
        </Button>
      </div>
    );
  }

  const center = driverLocation
    ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
    : defaultCenter;

  const canUseGoogle = typeof google !== 'undefined';

  const getMarkerIcon = (status: string): google.maps.Symbol | undefined => {
    if (!canUseGoogle) return undefined;
    const color = statusColors[status as keyof typeof statusColors] || '#6b7280';
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    };
  };

  const driverMarkerIcon: google.maps.Symbol | undefined = canUseGoogle
    ? {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        rotation: 0,
      }
    : undefined;

  return (
    <LoadScript
      key={apiKey}
      id="google-map-script"
      googleMapsApiKey={apiKey}
      language="pt-BR"
      region="BR"
      onError={(err) => setScriptError(err)}
      loadingElement={
        <div className="flex items-center justify-center h-full bg-muted rounded-lg">
          <LoadingSpinner text="Carregando mapa..." />
        </div>
      }
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {driverLocation && driverMarkerIcon && (
          <Marker
            position={{ lat: driverLocation.latitude, lng: driverLocation.longitude }}
            icon={driverMarkerIcon}
            title="Sua localização"
            zIndex={1000}
          />
        )}

        {equipments.map((equipment) => (
          <Marker
            key={equipment.id}
            position={{ lat: equipment.latitude, lng: equipment.longitude }}
            icon={getMarkerIcon(equipment.status)}
            onClick={() => handleMarkerClick(equipment)}
            title={equipment.nome_cliente}
          />
        ))}

        {selectedEquipment && infoWindowOpen && (
          <InfoWindow
            position={{ lat: selectedEquipment.latitude, lng: selectedEquipment.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-3 min-w-[200px]">
              <h3 className="font-semibold text-foreground mb-2">
                {selectedEquipment.nome_cliente}
              </h3>

              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={selectedEquipment.status} />
                <PeriodBadge period={selectedEquipment.periodo_recolha} />
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                Entregador: {selectedEquipment.creator_name}
              </p>

              <Button
                size="sm"
                className="w-full gap-2"
                onClick={() => openRoute(selectedEquipment.latitude, selectedEquipment.longitude)}
              >
                <Navigation className="w-4 h-4" />
                Obter rota
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
}
