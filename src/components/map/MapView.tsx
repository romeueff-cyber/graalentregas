import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, LoadScript } from '@react-google-maps/api';
import type { EquipmentWithCreator } from '@/types/database';
import type { DriverLocation } from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { GoogleMapsSetup } from './GoogleMapsSetup';
import { MarkerLabel } from './MarkerLabel';
import { EquipmentDialog } from './EquipmentDialog';
import { DailyOrderMarker } from './DailyOrderMarker';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';

interface DailyOrderLocation {
  orderNumber: string;
  clientName: string;
  lat: number;
  lng: number;
  isDelivered?: boolean;
}

interface MapViewProps {
  equipments: EquipmentWithCreator[];
  driverLocation: DriverLocation | null;
  onEquipmentClick?: (equipment: EquipmentWithCreator) => void;
  selectedEquipment?: EquipmentWithCreator | null;
  onCloseInfoWindow?: () => void;
  onConfirmCollection?: (equipment: EquipmentWithCreator) => void;
  onDelete?: (equipment: EquipmentWithCreator) => Promise<void>;
  isAdmin?: boolean;
  dailyOrderLocations?: DailyOrderLocation[];
  selectedDailyOrder?: string | null;
  onDailyOrderClick?: (orderNumber: string) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

const getHslFromCssVar = (varName: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return fallback;

  // Expected format: "38 92% 50%"
  const parts = raw.split(/\s+/);
  if (parts.length >= 3) {
    const [h, s, l] = parts;
    const sVal = s.endsWith('%') ? s : `${s}%`;
    const lVal = l.endsWith('%') ? l : `${l}%`;
    return `hsl(${h}, ${sVal}, ${lVal})`;
  }

  return `hsl(${raw})`;
};

const getEquipmentMarkerColor = (equipment: EquipmentWithCreator) => {
  const isClienteAvisara =
    equipment.cliente_ira_avisar || equipment.periodo_recolha === 'CLIENTE_IRA_AVISAR';

  if (isClienteAvisara && equipment.status !== 'RECOLHIDO') {
    return getHslFromCssVar('--status-waiting', '#f59e0b');
  }

  switch (equipment.status) {
    case 'ENTREGUE':
      return getHslFromCssVar('--status-delivered', '#ef4444');
    case 'LIBERADO_PARA_RECOLHA':
      return getHslFromCssVar('--status-ready', '#22c55e');
    case 'RECOLHIDO':
    default:
      return getHslFromCssVar('--status-collected', '#6b7280');
  }
};

export function MapView({
  equipments,
  driverLocation,
  onEquipmentClick,
  selectedEquipment,
  onCloseInfoWindow,
  onConfirmCollection,
  onDelete,
  isAdmin = false,
  dailyOrderLocations = [],
  selectedDailyOrder,
  onDailyOrderClick,
}: MapViewProps) {
  const { apiKey, hasApiKey, saveApiKey, clearApiKey } = useGoogleMapsKey();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scriptError, setScriptError] = useState<Error | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const [mapCenter, setMapCenter] =
    useState<{ lat: number; lng: number }>(defaultCenter);
  const hasSetInitialCenter = useRef(false);

  useEffect(() => {
    setScriptError(null);
  }, [apiKey]);

  // Define initial center once (avoid recentering on driverLocation updates)
  useEffect(() => {
    if (!driverLocation || hasSetInitialCenter.current) return;

    const center = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    setMapCenter(center);

    // If the map is already loaded, apply it immediately
    if (map) map.setCenter(center);

    hasSetInitialCenter.current = true;
  }, [driverLocation, map]);

  // Map styles to hide POIs (establishments, stores, restaurants, etc.)
  const mapStyles: google.maps.MapTypeStyle[] = [
    {
      featureType: 'poi',
      elementType: 'all',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'poi.business',
      elementType: 'all',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      elementType: 'labels.icon',
      stylers: [{ visibility: 'off' }],
    },
  ];

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy' as const,
      styles: mapStyles,
    }),
    []
  );

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
    setIsMapLoaded(true);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    setIsMapLoaded(false);
  }, []);

  const handleMarkerClick = (equipment: EquipmentWithCreator) => {
    onEquipmentClick?.(equipment);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      onCloseInfoWindow?.();
    }
  };

  const handleConfirmCollection = async (equipment: EquipmentWithCreator) => {
    if (!onConfirmCollection) return;
    await onConfirmCollection(equipment);
  };

  if (scriptError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted rounded-lg p-4 text-center">
        <p className="text-muted-foreground mb-2">Erro ao carregar mapa</p>
        <p className="text-xs text-muted-foreground mb-4">
          {scriptError.message ||
            'Verifique se a chave está ativa e se a Maps JavaScript API está habilitada e restrita ao domínio correto.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => setScriptError(null)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const getMarkerIcon = (
    equipment: EquipmentWithCreator
  ): google.maps.Symbol | undefined => {
    if (typeof google === 'undefined' || !google.maps || !google.maps.SymbolPath) return undefined;
    const color = getEquipmentMarkerColor(equipment);
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    };
  };

  const getDriverMarkerIcon = (): google.maps.Symbol | undefined => {
    if (typeof google === 'undefined' || !google.maps || !google.maps.SymbolPath) return undefined;
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 8,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      rotation: 0,
    };
  };

  return (
    <>
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
          center={mapCenter}
          zoom={14}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {/* Driver marker */}
          {driverLocation && (
            <Marker
              position={{
                lat: driverLocation.latitude,
                lng: driverLocation.longitude,
              }}
              icon={getDriverMarkerIcon()}
              title="Sua localização"
              zIndex={1000}
            />
          )}

          {/* Equipment markers with labels */}
          {equipments.map((equipment) => (
            <div key={equipment.id}>
              <Marker
                position={{ lat: equipment.latitude, lng: equipment.longitude }}
                icon={getMarkerIcon(equipment)}
                onClick={() => handleMarkerClick(equipment)}
                title={equipment.nome_cliente}
              />
              {/* Permanent label next to marker */}
              <MarkerLabel
                equipment={equipment}
                onClick={() => handleMarkerClick(equipment)}
              />
            </div>
          ))}

          {/* Daily order markers (pulsing) */}
          {dailyOrderLocations.map((order) => (
            <DailyOrderMarker
              key={order.orderNumber}
              position={{ lat: order.lat, lng: order.lng }}
              orderNumber={order.orderNumber}
              clientName={order.clientName}
              isSelected={selectedDailyOrder === order.orderNumber}
              isDelivered={order.isDelivered}
              onClick={() => onDailyOrderClick?.(order.orderNumber)}
            />
          ))}
        </GoogleMap>
      </LoadScript>

      {/* Equipment detail dialog */}
      <EquipmentDialog
        equipment={selectedEquipment || null}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onConfirmCollection={onConfirmCollection ? handleConfirmCollection : undefined}
        onDelete={onDelete}
        onReschedule={() => {
          // Close dialog and trigger a refresh
          setDialogOpen(false);
          onCloseInfoWindow?.();
        }}
        isAdmin={isAdmin}
      />
    </>
  );
}
