import { useMemo, useRef, useState } from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';

const LIBRARIES: ('places')[] = ['places'];

// Jaraguá do Sul / SC
const JARAGUA = { lat: -26.4858, lng: -49.0667 };
const RADIUS_KM = 150;

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

export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const { apiKey } = useGoogleMapsKey();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searching, setSearching] = useState(false);

  // Build a ~150 km bounding box around Jaraguá do Sul (used as bias)
  const bounds = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;
    const dLat = RADIUS_KM / 111;
    const dLng = RADIUS_KM / (111 * Math.cos((JARAGUA.lat * Math.PI) / 180));
    return new window.google.maps.LatLngBounds(
      { lat: JARAGUA.lat - dLat, lng: JARAGUA.lng - dLng },
      { lat: JARAGUA.lat + dLat, lng: JARAGUA.lng + dLng },
    );
  }, [isLoaded]);

  const handlePlaceChanged = () => {
    const place = acRef.current?.getPlace();
    if (!place) return;
    const formatted = place.formatted_address || place.name || value;
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();
    const parsed = parseComponents(place.address_components);
    onChange(formatted);
    onSelect?.({ formatted, lat, lng, ...parsed });
  };

  const handleManualSearch = async () => {
    if (!value || !isLoaded || !window.google?.maps) return;
    setSearching(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const query = /brasil|brazil/i.test(value) ? value : `${value}, Brasil`;
      const res = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
        geocoder.geocode(
          {
            address: query,
            region: 'br',
            componentRestrictions: { country: 'BR' },
            bounds,
          },
          (results, status) => resolve(status === 'OK' && results?.[0] ? results[0] : null),
        );
      });
      if (res) {
        const formatted = res.formatted_address;
        const lat = res.geometry.location.lat();
        const lng = res.geometry.location.lng();
        const parsed = parseComponents(res.address_components);
        onChange(formatted);
        onSelect?.({ formatted, lat, lng, ...parsed });
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        {isLoaded ? (
          <Autocomplete
            onLoad={(ac) => {
              acRef.current = ac;
              if (bounds) {
                ac.setBounds(bounds);
                ac.setOptions({ strictBounds: false });
              }
            }}
            onPlaceChanged={handlePlaceChanged}
            options={{
              componentRestrictions: { country: 'br' },
              fields: ['formatted_address', 'geometry', 'name', 'address_components'],
              bounds,
              strictBounds: false,
            }}
          >
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || 'Digite o endereço...'}
            />
          </Autocomplete>
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Digite o endereço...'}
          />
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleManualSearch}
        disabled={!isLoaded || searching || !value}
        title="Buscar no mapa (raio de 150 km de Jaraguá do Sul)"
      >
        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </Button>
    </div>
  );
}
