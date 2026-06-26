import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, MapPin } from 'lucide-react';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { toast } from 'sonner';

const LIBRARIES: ('places')[] = ['places'];

// Jaraguá do Sul / SC
const JARAGUA = { lat: -26.4858, lng: -49.0667 };
const RADIUS_KM = 100;

export interface AddressResult {
  formatted: string;
  lat?: number;
  lng?: number;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (r: AddressResult) => void;
  placeholder?: string;
}

const componentByType = (
  comps: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  short = false,
) => {
  const c = comps?.find((x) => x.types.includes(type));
  return c ? (short ? c.short_name : c.long_name) : undefined;
};

const parseComponents = (
  comps: google.maps.GeocoderAddressComponent[] | undefined,
): Pick<AddressResult, 'numero' | 'bairro' | 'cidade' | 'uf' | 'cep'> => ({
  numero: componentByType(comps, 'street_number'),
  bairro:
    componentByType(comps, 'sublocality_level_1') ||
    componentByType(comps, 'sublocality') ||
    componentByType(comps, 'neighborhood'),
  cidade:
    componentByType(comps, 'administrative_area_level_2') ||
    componentByType(comps, 'locality'),
  uf: componentByType(comps, 'administrative_area_level_1', true),
  cep: componentByType(comps, 'postal_code'),
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface Prediction {
  place_id: string;
  description: string;
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const { apiKey } = useGoogleMapsKey();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<number | null>(null);

  const bounds = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;
    const dLat = RADIUS_KM / 111;
    const dLng = RADIUS_KM / (111 * Math.cos((JARAGUA.lat * Math.PI) / 180));
    return new window.google.maps.LatLngBounds(
      { lat: JARAGUA.lat - dLat, lng: JARAGUA.lng - dLng },
      { lat: JARAGUA.lat + dLat, lng: JARAGUA.lng + dLng },
    );
  }, [isLoaded]);

  useEffect(() => {
    if (isLoaded && !sessionToken && window.google?.maps?.places) {
      setSessionToken(new window.google.maps.places.AutocompleteSessionToken());
    }
  }, [isLoaded, sessionToken]);

  const fetchPredictions = useCallback(
    (input: string) => {
      if (!isLoaded || !window.google?.maps?.places || !input || input.length < 3) {
        setPredictions([]);
        return;
      }
      const service = new window.google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: 'br' },
          bounds,
          locationBias: bounds,
          sessionToken: sessionToken || undefined,
        } as google.maps.places.AutocompletionRequest,
        (results) => {
          setPredictions(
            (results || []).map((r) => ({ place_id: r.place_id, description: r.description })),
          );
        },
      );
    },
    [isLoaded, bounds, sessionToken],
  );

  const handleInputChange = (val: string) => {
    onChange(val);
    setOpen(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchPredictions(val), 250);
  };

  const handleSelectPrediction = (p: Prediction) => {
    if (!isLoaded || !window.google?.maps) return;
    const placesService = new window.google.maps.places.PlacesService(
      document.createElement('div'),
    );
    placesService.getDetails(
      {
        placeId: p.place_id,
        fields: ['formatted_address', 'geometry', 'name', 'address_components'],
        sessionToken: sessionToken || undefined,
      },
      (place, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
          toast.error('Não foi possível obter o endereço.');
          return;
        }
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        if (lat != null && lng != null) {
          const dist = haversineKm(JARAGUA.lat, JARAGUA.lng, lat, lng);
          if (dist > RADIUS_KM) {
            toast.error(`Endereço fora do raio de ${RADIUS_KM} km de Jaraguá do Sul (${dist.toFixed(0)} km).`);
            return;
          }
        }
        const formatted = place.formatted_address || place.name || p.description;
        const parsed = parseComponents(place.address_components);
        onChange(formatted);
        onSelect?.({ formatted, lat, lng, ...parsed });
        setPredictions([]);
        setOpen(false);
        // Renew session token after a selection (per Google billing)
        if (window.google?.maps?.places) {
          setSessionToken(new window.google.maps.places.AutocompleteSessionToken());
        }
      },
    );
  };

  const handleManualSearch = async () => {
    if (!value || !isLoaded || !window.google?.maps) return;
    setSearching(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const query = /brasil|brazil/i.test(value) ? value : `${value}, Brasil`;
      const res = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
        geocoder.geocode(
          {
            address: query,
            region: 'br',
            componentRestrictions: { country: 'BR' },
            bounds,
          },
          (results, status) => resolve(status === 'OK' && results ? results : null),
        );
      });
      const valid = (res || []).find((r) => {
        const lat = r.geometry.location.lat();
        const lng = r.geometry.location.lng();
        return haversineKm(JARAGUA.lat, JARAGUA.lng, lat, lng) <= RADIUS_KM;
      });
      if (!valid) {
        toast.error(`Nenhum resultado dentro do raio de ${RADIUS_KM} km de Jaraguá do Sul.`);
        return;
      }
      const lat = valid.geometry.location.lat();
      const lng = valid.geometry.location.lng();
      const parsed = parseComponents(valid.address_components);
      onChange(valid.formatted_address);
      onSelect?.({ formatted: valid.formatted_address, lat, lng, ...parsed });
      setOpen(false);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => predictions.length > 0 && setOpen(true)}
            placeholder={placeholder || `Digite o endereço (raio ${RADIUS_KM} km de Jaraguá)...`}
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleManualSearch}
          disabled={!isLoaded || searching || !value}
          title={`Buscar no mapa (raio de ${RADIUS_KM} km de Jaraguá do Sul)`}
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {open && predictions.length > 0 && (
        <div className="rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => handleSelectPrediction(p)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted active:bg-muted/80 transition flex items-start gap-2 border-b last:border-b-0"
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="text-sm">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
