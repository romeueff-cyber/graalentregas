import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, LoadScript } from '@react-google-maps/api';
import type { EquipmentWithCreator } from '@/types/database';
import type { DriverLocation } from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PeriodBadge } from '@/components/ui/period-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { GoogleMapsSetup } from './GoogleMapsSetup';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { Navigation, ExternalLink, CheckCircle2 } from 'lucide-react';

interface MapViewProps {
  equipments: EquipmentWithCreator[];
  driverLocation: DriverLocation | null;
  onEquipmentClick?: (equipment: EquipmentWithCreator) => void;
  selectedEquipment?: EquipmentWithCreator | null;
  onCloseInfoWindow?: () => void;
  onConfirmCollection?: (equipment: EquipmentWithCreator) => void;
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
  onConfirmCollection,
}: MapViewProps) {
  const { apiKey, hasApiKey, saveApiKey, clearApiKey } = useGoogleMapsKey();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);
  const [scriptError, setScriptError] = useState<Error | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [mapCenter, setMapCenter] =
    useState<google.maps.LatLngLiteral>(defaultCenter);
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

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      // Enable one-finger scrolling on mobile
      gestureHandling: 'greedy',
    }),
    []
  );

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

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

  const handleConfirmCollection = async () => {
    if (!selectedEquipment || !onConfirmCollection) return;
    setIsConfirming(true);
    try {
      await onConfirmCollection(selectedEquipment);
      handleInfoWindowClose();
    } finally {
      setIsConfirming(false);
    }
  };

  if (!hasApiKey) {
    return <GoogleMapsSetup onApiKeySubmit={saveApiKey} />;
  }

  if (scriptError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted rounded-lg p-4 text-center">
        <p className="text-muted-foreground mb-2">Erro ao carregar mapa</p>
        <p className="text-xs text-muted-foreground mb-4">
          {scriptError.message ||
            'Verifique se a chave está correta e se a Maps JavaScript API está ativada.'}
        </p>
        <Button variant="outline" size="sm" onClick={clearApiKey}>
          Configurar chave
        </Button>
      </div>
    );
  }

  // Map center is controlled by state above to avoid unexpected recentering.

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
        center={mapCenter}
        zoom={14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Driver marker */}
        {driverLocation && driverMarkerIcon && (
          <Marker
            position={{
              lat: driverLocation.latitude,
              lng: driverLocation.longitude,
            }}
            icon={driverMarkerIcon}
            title="Sua localização"
            zIndex={1000}
          />
        )}

        {/* Equipment markers */}
        {equipments.map((equipment) => (
          <Marker
            key={equipment.id}
            position={{ lat: equipment.latitude, lng: equipment.longitude }}
            icon={getMarkerIcon(equipment.status)}
            onClick={() => handleMarkerClick(equipment)}
            title={equipment.nome_cliente}
          />
        ))}

        {/* Info Window */}
        {selectedEquipment && infoWindowOpen && (
          <InfoWindow
            position={{
              lat: selectedEquipment.latitude,
              lng: selectedEquipment.longitude,
            }}
            onCloseClick={handleInfoWindowClose}
          >
            <div style={{ 
              padding: '12px', 
              minWidth: '220px', 
              maxWidth: '280px',
              backgroundColor: 'white',
              color: '#1f2937',
              fontFamily: 'system-ui, sans-serif'
            }}>
              <h3 style={{ 
                fontWeight: 600, 
                fontSize: '14px', 
                marginBottom: '4px',
                color: '#1f2937'
              }}>
                {selectedEquipment.nome_cliente}
              </h3>
              <p style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginBottom: '8px' 
              }}>
                Pedido: {selectedEquipment.pedido_dia}
              </p>

              <div style={{ 
                display: 'flex', 
                gap: '6px', 
                marginBottom: '8px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: selectedEquipment.status === 'ENTREGUE' 
                    ? '#fee2e2' 
                    : selectedEquipment.status === 'LIBERADO_PARA_RECOLHA'
                      ? '#dcfce7'
                      : '#f3f4f6',
                  color: selectedEquipment.status === 'ENTREGUE'
                    ? '#dc2626'
                    : selectedEquipment.status === 'LIBERADO_PARA_RECOLHA'
                      ? '#16a34a'
                      : '#6b7280',
                  fontWeight: 500
                }}>
                  {selectedEquipment.status === 'ENTREGUE' 
                    ? 'Entregue' 
                    : selectedEquipment.status === 'LIBERADO_PARA_RECOLHA'
                      ? 'Liberado'
                      : 'Recolhido'}
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  fontWeight: 500
                }}>
                  {selectedEquipment.periodo_recolha}
                </span>
              </div>

              <p style={{ 
                fontSize: '11px', 
                color: '#6b7280', 
                marginBottom: '8px' 
              }}>
                Entregador: {selectedEquipment.creator_name || 'Desconhecido'}
              </p>

              {selectedEquipment.observacoes && (
                <p style={{ 
                  fontSize: '11px', 
                  color: '#9ca3af', 
                  marginBottom: '12px',
                  fontStyle: 'italic'
                }}>
                  {selectedEquipment.observacoes}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() =>
                    openRoute(
                      selectedEquipment.latitude,
                      selectedEquipment.longitude
                    )
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer'
                  }}
                >
                  <Navigation style={{ width: '14px', height: '14px' }} />
                  Obter rota
                  <ExternalLink style={{ width: '12px', height: '12px' }} />
                </button>

                {/* Show confirm collection button only if not already collected */}
                {selectedEquipment.status !== 'RECOLHIDO' && onConfirmCollection && (
                  <button
                    onClick={handleConfirmCollection}
                    disabled={isConfirming}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isConfirming ? '#9ca3af' : '#16a34a',
                      color: 'white',
                      cursor: isConfirming ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isConfirming ? (
                      'Confirmando...'
                    ) : (
                      <>
                        <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                        Confirmar Recolha
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
}
