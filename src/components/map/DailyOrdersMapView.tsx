import { useCallback, useMemo, useState, useEffect } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DailyOrderMarker } from './DailyOrderMarker';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { Button } from '@/components/ui/button';

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
  onGoogleReady?: () => void;
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

// Map styles to hide POIs - defined as simple object to avoid google type issues
const mapStylesArray = [
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
  onGoogleReady,
  height = '250px',
}: DailyOrdersMapViewProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [scriptError, setScriptError] = useState<Error | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const { apiKey } = useGoogleMapsKey();

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
      styles: mapStylesArray as google.maps.MapTypeStyle[],
    }),
    []
  );

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
    
    // Notify parent that Google is ready (first load)
    if (!isScriptLoaded) {
      setIsScriptLoaded(true);
      onGoogleReady?.();
    }
    
    // Fit bounds to show all markers
    if (locations.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => {
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      });
      m.fitBounds(bounds, 50);
    }
  }, [locations, isScriptLoaded, onGoogleReady]);

  // Update bounds when locations change
  useEffect(() => {
    if (map && locations.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => {
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      });
      map.fitBounds(bounds, 50);
    } else if (map && locations.length === 1) {
      map.setCenter({ lat: locations[0].lat, lng: locations[0].lng });
      map.setZoom(15);
    }
  }, [map, locations]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (scriptError) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-muted rounded-lg p-4 text-center"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground mb-2">Erro ao carregar mapa</p>
        <p className="text-xs text-muted-foreground mb-3">
          {scriptError.message || 'Verifique sua conexão e tente novamente.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => setScriptError(null)}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border relative">
      <LoadScript
        key={apiKey}
        id="google-map-script"
        googleMapsApiKey={apiKey}
        language="pt-BR"
        region="BR"
        onError={(err) => setScriptError(err)}
        loadingElement={
          <div className="flex items-center justify-center bg-muted" style={{ height }}>
            <LoadingSpinner text="Carregando mapa..." />
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
      
      {/* Overlay message when no locations */}
      {locations.length === 0 && isScriptLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">Aguardando localizações...</p>
        </div>
      )}
    </div>
  );
}
