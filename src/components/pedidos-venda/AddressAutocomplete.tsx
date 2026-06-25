import { useRef, useState } from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';

const LIBRARIES: ('places')[] = ['places'];

export interface AddressResult {
  formatted: string;
  lat?: number;
  lng?: number;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (r: AddressResult) => void;
  placeholder?: string;
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const { apiKey } = useGoogleMapsKey();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searching, setSearching] = useState(false);

  const handlePlaceChanged = () => {
    const place = acRef.current?.getPlace();
    if (!place) return;
    const formatted = place.formatted_address || place.name || value;
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();
    onChange(formatted);
    onSelect?.({ formatted, lat, lng });
  };

  const handleManualSearch = async () => {
    if (!value || !isLoaded || !window.google?.maps) return;
    setSearching(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const query = /brasil|brazil/i.test(value) ? value : `${value}, Brasil`;
      const res = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
        geocoder.geocode(
          { address: query, region: 'br', componentRestrictions: { country: 'BR' } },
          (results, status) => resolve(status === 'OK' && results?.[0] ? results[0] : null),
        );
      });
      if (res) {
        const formatted = res.formatted_address;
        const lat = res.geometry.location.lat();
        const lng = res.geometry.location.lng();
        onChange(formatted);
        onSelect?.({ formatted, lat, lng });
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
            onLoad={(ac) => { acRef.current = ac; }}
            onPlaceChanged={handlePlaceChanged}
            options={{
              componentRestrictions: { country: 'br' },
              fields: ['formatted_address', 'geometry', 'name'],
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
        title="Buscar no mapa"
      >
        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </Button>
    </div>
  );
}
