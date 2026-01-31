import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, MapPin, Clock, AlertTriangle } from 'lucide-react';
import type { DeliveryPoint } from '@/types/routes';

interface DeliveryPointsListProps {
  points: DeliveryPoint[];
  pointsWithoutLocation: { orderNumber: string; clientName: string }[];
}

export function DeliveryPointsList({ 
  points, 
  pointsWithoutLocation 
}: DeliveryPointsListProps) {
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => {
      // Sort by expected delivery time, then by priority
      if (a.expectedDelivery && b.expectedDelivery) {
        return a.expectedDelivery.localeCompare(b.expectedDelivery);
      }
      if (a.expectedDelivery) return -1;
      if (b.expectedDelivery) return 1;
      return b.priority - a.priority;
    });
  }, [points]);

  const totalVolume = useMemo(() => {
    return points.reduce((sum, p) => sum + (p.volumeLiters || 0), 0);
  }, [points]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Entregas do Dia
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">{points.length} entregas</Badge>
            <Badge variant="outline">{totalVolume}L</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[300px]">
          <div className="px-4 pb-4 space-y-2">
            {/* Warning for orders without location */}
            {pointsWithoutLocation.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {pointsWithoutLocation.length} pedidos sem localização
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {pointsWithoutLocation.slice(0, 5).map(p => (
                    <Badge key={p.orderNumber} variant="outline" className="text-xs">
                      {p.orderNumber}
                    </Badge>
                  ))}
                  {pointsWithoutLocation.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{pointsWithoutLocation.length - 5}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Delivery points list */}
            {sortedPoints.map((point, index) => (
              <div 
                key={point.orderNumber}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{point.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        Pedido: {point.orderNumber}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      {point.expectedDelivery && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {point.expectedDelivery}
                        </Badge>
                      )}
                      {point.volumeLiters && (
                        <Badge variant="secondary" className="text-xs">
                          {point.volumeLiters}L
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{point.address}</span>
                  </div>
                </div>
              </div>
            ))}

            {points.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma entrega encontrada</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
