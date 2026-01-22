import { useCallback, useMemo, useState } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DailyOrderMarker } from './DailyOrderMarker';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';

interface DailyOrderLocation {
  orderNumber: string;
  clientName: string;
  expectedDelivery?: string | null;
  lat: number;
  lng: number;
  isDelivered?: boolean;
}

interface DailyOrdersMapViewProps {
  locations: DailyOrderLocation[];
  selectedOrderNumber?: string | null;
  onOrderClick?: (orderNumber: string) => void;
  height?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

// Map styles to hide POIs
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

export function DailyOrdersMapView({
  locations,
  selectedOrderNumber,
  onOrderClick,
  height = '250px',
}: DailyOrdersMapViewProps) {
  const { apiKey } = useGoogleMapsKey();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [scriptError, setScriptError] = useState<Error | null>(null);

  // Calculate center based on locations
  const center = useMemo(() => {
    if (locations.length === 0) return defaultCenter;
    
    const sumLat = locations.reduce((sum, loc) => sum + loc.lat, 0);
    const sumLng = locations.reduce((sum, loc) => sum + loc.lng, 0);
    
    return {
      lat: sumLat / locations.length,
      lng: sumLng / locations.length,
    };
  }, [locations]);

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
    
    // Fit bounds to show all markers
    if (locations.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => {
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      });
      m.fitBounds(bounds, 50);
    }
  }, [locations]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (scriptError) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <p className="text-xs text-muted-foreground">Erro ao carregar mapa</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <p className="text-xs text-muted-foreground">Nenhum pedido com localização</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border">
      <LoadScript
        key={apiKey}
        id="daily-orders-map-script"
        googleMapsApiKey={apiKey}
        language="pt-BR"
        region="BR"
        onError={(err) => setScriptError(err)}
        loadingElement={
          <div className="flex items-center justify-center h-full bg-muted">
            <LoadingSpinner text="Carregando..." />
          </div>
        }
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {locations.map((order) => (
            <DailyOrderMarker
              key={order.orderNumber}
              position={{ lat: order.lat, lng: order.lng }}
              orderNumber={order.orderNumber}
              clientName={order.clientName}
              expectedDelivery={order.expectedDelivery}
              isSelected={selectedOrderNumber === order.orderNumber}
              isDelivered={order.isDelivered}
              onClick={() => onOrderClick?.(order.orderNumber)}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}
