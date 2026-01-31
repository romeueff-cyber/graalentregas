import { useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import type { OptimizedRoute, RouteOptimizationResult, DeliveryPoint } from '@/types/routes';
import { Loader2 } from 'lucide-react';

interface RouteMapViewProps {
  result: RouteOptimizationResult | null;
  selectedRoute: number | null;
  startLocation: google.maps.LatLngLiteral;
  allPoints: DeliveryPoint[];
}

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '400px',
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  gestureHandling: 'greedy',
  styles: [
    // Hide POIs
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

export function RouteMapView({ 
  result, 
  selectedRoute, 
  startLocation, 
  allPoints 
}: RouteMapViewProps) {
  const { apiKey } = useGoogleMapsKey();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<Map<number, google.maps.DirectionsResult>>(new Map());

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  // Calculate directions for each route
  useEffect(() => {
    if (!isLoaded || !result || !window.google?.maps?.DirectionsService) return;

    const directionsService = new google.maps.DirectionsService();
    const newDirections = new Map<number, google.maps.DirectionsResult>();

    const fetchDirections = async () => {
      for (const route of result.routes) {
        if (selectedRoute !== null && route.driverId !== selectedRoute) {
          continue; // Skip non-selected routes when filtering
        }

        if (route.stops.length === 0) continue;

        const waypoints: google.maps.DirectionsWaypoint[] = route.stops.slice(0, -1).map(stop => ({
          location: { lat: stop.point.lat, lng: stop.point.lng },
          stopover: true,
        }));

        const lastStop = route.stops[route.stops.length - 1];

        try {
          const result = await directionsService.route({
            origin: startLocation,
            destination: { lat: lastStop.point.lat, lng: lastStop.point.lng },
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
          });

          newDirections.set(route.driverId, result);
        } catch (err) {
          console.error(`Error getting directions for route ${route.driverId}:`, err);
        }
      }

      setDirections(newDirections);
    };

    fetchDirections();
  }, [isLoaded, result, selectedRoute, startLocation]);

  // Fit bounds to show all points
  useEffect(() => {
    if (!mapRef.current || allPoints.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(startLocation);
    
    allPoints.forEach(point => {
      bounds.extend({ lat: point.lat, lng: point.lng });
    });

    mapRef.current.fitBounds(bounds, 50);
  }, [allPoints, startLocation]);

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  if (!isLoaded || !window.google?.maps?.SymbolPath) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Create icon config safely after confirming Google Maps is loaded
  const createCircleIcon = (color: string, scale: number = 16) => ({
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
  });

  const visibleRoutes = result?.routes.filter(
    r => selectedRoute === null || r.driverId === selectedRoute
  ) || [];

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={defaultCenter}
      zoom={12}
      options={mapOptions}
      onLoad={onMapLoad}
    >
      {/* Start location marker */}
      <Marker
        position={startLocation}
        icon={{
          ...createCircleIcon('#000', 12),
          strokeWeight: 3,
        }}
        title="Ponto de Partida"
      />

      {/* Directions for each route */}
      {visibleRoutes.map(route => {
        const routeDirections = directions.get(route.driverId);
        if (!routeDirections) return null;

        return (
          <DirectionsRenderer
            key={route.driverId}
            directions={routeDirections}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: route.color,
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        );
      })}

      {/* Stop markers with numbers */}
      {visibleRoutes.map(route => 
        route.stops.map((stop, index) => (
          <Marker
            key={`${route.driverId}-${stop.point.orderNumber}`}
            position={{ lat: stop.point.lat, lng: stop.point.lng }}
            label={{
              text: String(index + 1),
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '12px',
            }}
            icon={createCircleIcon(route.color, 16)}
            title={`${stop.point.clientName} - ${stop.arrivalTime}`}
          />
        ))
      )}

      {/* Show unassigned orders when no result or showing all */}
      {!result && allPoints.map(point => (
        <Marker
          key={point.orderNumber}
          position={{ lat: point.lat, lng: point.lng }}
          icon={createCircleIcon('#94a3b8', 10)}
          title={point.clientName}
        />
      ))}
    </GoogleMap>
  );
}
