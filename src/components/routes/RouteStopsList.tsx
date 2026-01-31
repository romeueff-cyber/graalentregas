import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, MapPin, User } from 'lucide-react';
import type { OptimizedRoute } from '@/types/routes';

interface RouteStopsListProps {
  route: OptimizedRoute;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }
  return `${minutes} min`;
}

export function RouteStopsList({ route }: RouteStopsListProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: route.color }}
            />
            {route.driverLabel}
          </CardTitle>
          <Badge>{route.stops.length} paradas</Badge>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {route.startTime} - {route.endTime}
          </span>
          <span>{formatDistance(route.totalDistance)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="px-4 pb-6 space-y-1 overflow-hidden">
            {/* Start point */}
            <div className="flex items-start gap-3 py-3">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background text-sm font-bold">
                  P
                </div>
                <div className="w-0.5 h-full bg-border flex-1 mt-2" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="font-medium">Ponto de Partida</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saída: {route.startTime}
                </p>
              </div>
            </div>

            {/* Stops */}
            {route.stops.map((stop, index) => (
              <div 
                key={stop.point.orderNumber} 
                className="flex items-start gap-3 py-3"
              >
                <div className="flex flex-col items-center flex-shrink-0">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: route.color }}
                  >
                    {index + 1}
                  </div>
                  {index < route.stops.length - 1 && (
                    <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1 overflow-hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{stop.point.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Pedido: {stop.point.orderNumber}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium">{stop.arrivalTime}</p>
                      {stop.point.expectedDelivery && (
                        <p className={`text-xs ${
                          stop.arrivalTime > stop.point.expectedDelivery 
                            ? 'text-destructive' 
                            : 'text-muted-foreground'
                        }`}>
                          Prev: {stop.point.expectedDelivery}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground min-w-0">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{stop.point.address}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span>{formatDistance(stop.distanceFromPrevious)}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{formatDuration(stop.durationFromPrevious)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
