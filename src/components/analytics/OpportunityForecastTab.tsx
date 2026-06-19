import { useMemo, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, Circle } from '@react-google-maps/api';
import { useOpportunityForecast, type OpportunityRow } from '@/hooks/useOpportunityForecast';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { KPICard } from './KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Calendar, MapPin, Sparkles, Target, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  days: number;
}

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: -23.5505, lng: -46.6333 };

const COLOR_PROVAVEL = '#22c55e'; // green
const COLOR_ATRASADO = '#eab308'; // yellow
const COLOR_CONFIRMED = '#3b82f6'; // blue

const mapStyles = [
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

export function OpportunityForecastTab({ days }: Props) {
  const { opportunities, confirmedDeliveries, summary, nearRadiusKm, isLoading, grupos } =
    useOpportunityForecast(days);
  const { apiKey } = useGoogleMapsKey();
  const [grupoFilter, setGrupoFilter] = useState<string>('all');
  const [onlyNear, setOnlyNear] = useState<'all' | 'near'>('all');
  const [selected, setSelected] = useState<OpportunityRow | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (grupoFilter !== 'all' && o.grupoCliente !== grupoFilter) return false;
      if (onlyNear === 'near' && !o.nearestDelivery) return false;
      return true;
    });
  }, [opportunities, grupoFilter, onlyNear]);

  const opportunityMarkers = useMemo(
    () => filtered.filter((o) => o.lat !== null && o.lng !== null),
    [filtered]
  );

  const center = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [
      ...confirmedDeliveries.map((d) => ({ lat: d.lat, lng: d.lng })),
      ...opportunityMarkers.map((o) => ({ lat: o.lat!, lng: o.lng! })),
    ];
    if (!pts.length) return defaultCenter;
    const sumLat = pts.reduce((s, p) => s + p.lat, 0);
    const sumLng = pts.reduce((s, p) => s + p.lng, 0);
    return { lat: sumLat / pts.length, lng: sumLng / pts.length };
  }, [confirmedDeliveries, opportunityMarkers]);

  const [mapReady, setMapReady] = useState(false);

  const onMapLoad = useCallback(
    (m: google.maps.Map) => {
      setMap(m);
      setMapReady(true);
      const pts = [
        ...confirmedDeliveries.map((d) => ({ lat: d.lat, lng: d.lng })),
        ...opportunityMarkers.map((o) => ({ lat: o.lat!, lng: o.lng! })),
      ];
      if (pts.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        pts.forEach((p) => bounds.extend(p));
        m.fitBounds(bounds, 60);
      }
    },
    [confirmedDeliveries, opportunityMarkers]
  );

  const handleSelect = useCallback(
    (o: OpportunityRow) => {
      setSelected(o);
      if (map && o.lat && o.lng) {
        map.panTo({ lat: o.lat, lng: o.lng });
        map.setZoom(14);
      }
    },
    [map]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text="Calculando previsão..." />
      </div>
    );
  }

  const circleOptions = (color: string) => ({
    strokeColor: color,
    strokeOpacity: 0.4,
    strokeWeight: 1,
    fillColor: color,
    fillOpacity: 0.08,
    clickable: false,
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Prováveis hoje"
          value={summary.provaveis}
          icon={<Sparkles className="w-4 h-4" />}
        />
        <KPICard
          title={`Perto da rota (${nearRadiusKm}km)`}
          value={summary.proximos}
          icon={<Target className="w-4 h-4" />}
        />
        <KPICard
          title="Atrasados"
          value={summary.atrasados}
          icon={<Calendar className="w-4 h-4" />}
        />
        <KPICard
          title="Entregas confirmadas hoje"
          value={summary.confirmedToday}
          icon={<MapPin className="w-4 h-4" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={grupoFilter} onValueChange={setGrupoFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={onlyNear} onValueChange={(v) => setOnlyNear(v as 'all' | 'near')}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prováveis</SelectItem>
            <SelectItem value="near">Apenas perto da rota</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Clientes prováveis ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum cliente provável para hoje com os filtros atuais.
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((o) => {
                    const isSelected = selected?.clientId === o.clientId;
                    return (
                      <li
                        key={`${o.clientId}-${o.clientName}`}
                        onClick={() => handleSelect(o)}
                        className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{o.clientName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {o.grupoCliente}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor:
                                o.status === 'provavel' ? COLOR_PROVAVEL : COLOR_ATRASADO,
                              color:
                                o.status === 'provavel' ? COLOR_PROVAVEL : COLOR_ATRASADO,
                            }}
                            className="shrink-0 text-[10px]"
                          >
                            {o.status === 'provavel' ? '🟢 Provável' : '🟡 Atrasado'}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Há <span className="font-medium text-foreground">{o.daysSinceLast}d</span>{' '}
                          sem pedir · média {o.avgIntervalDays}d
                        </div>
                        {o.nearestDelivery && (
                          <div className="mt-1 text-xs flex items-center gap-1 text-primary">
                            <MapPin className="w-3 h-3" />
                            {o.nearestDelivery.distanceKm}km de {o.nearestDelivery.clientName}
                          </div>
                        )}
                        {!o.lat && (
                          <div className="mt-1 text-[10px] text-muted-foreground italic">
                            sem coordenada conhecida
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Map */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Visualização geográfica
            </CardTitle>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLOR_CONFIRMED }} />
                Entregas confirmadas hoje
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLOR_PROVAVEL }} />
                Provável
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: COLOR_ATRASADO }} />
                Atrasado
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] rounded-lg overflow-hidden border">
              <LoadScript
                key={apiKey}
                id="google-map-script"
                googleMapsApiKey={apiKey}
                language="pt-BR"
                region="BR"
                loadingElement={
                  <div className="flex items-center justify-center h-full bg-muted">
                    <LoadingSpinner text="Carregando mapa..." />
                  </div>
                }
              >
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={center}
                  zoom={12}
                  onLoad={onMapLoad}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    styles: mapStyles as google.maps.MapTypeStyle[],
                  }}
                >
                  {/* Confirmed delivery 5km circles */}
                  {confirmedDeliveries.map((d) => (
                    <Circle
                      key={`circle-${d.orderNumber}`}
                      center={{ lat: d.lat, lng: d.lng }}
                      radius={nearRadiusKm * 1000}
                      options={circleOptions(COLOR_CONFIRMED)}
                    />
                  ))}
                  {/* Confirmed delivery markers */}
                  {confirmedDeliveries.map((d) => (
                    <Marker
                      key={`conf-${d.orderNumber}`}
                      position={{ lat: d.lat, lng: d.lng }}
                      title={`Entrega: ${d.clientName}`}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: COLOR_CONFIRMED,
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                      }}
                    />
                  ))}
                  {/* Opportunity markers */}
                  {opportunityMarkers.map((o) => (
                    <Marker
                      key={`opp-${o.clientId}-${o.clientName}`}
                      position={{ lat: o.lat!, lng: o.lng! }}
                      title={`${o.clientName} (há ${o.daysSinceLast}d)`}
                      onClick={() => setSelected(o)}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: selected?.clientId === o.clientId ? 10 : 7,
                        fillColor:
                          o.status === 'provavel' ? COLOR_PROVAVEL : COLOR_ATRASADO,
                        fillOpacity: 0.9,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                      }}
                    />
                  ))}
                </GoogleMap>
              </LoadScript>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Coordenadas dos clientes prováveis vêm da última entrega registrada. Clientes sem
              histórico de entrega não aparecem no mapa, mas estão na lista.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
