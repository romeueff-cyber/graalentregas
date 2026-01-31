import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Route, Truck, MapPin } from 'lucide-react';
import type { RouteOptimizationResult, OptimizedRoute } from '@/types/routes';

interface RouteResultSummaryProps {
  result: RouteOptimizationResult;
  selectedRoute: number | null;
  onSelectRoute: (driverId: number | null) => void;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

function RouteCard({ 
  route, 
  isSelected, 
  onClick 
}: { 
  route: OptimizedRoute; 
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div 
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected 
          ? 'border-primary bg-primary/5 shadow-md' 
          : 'border-border hover:border-primary/50 bg-card'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: route.color }}
          />
          <span className="font-semibold">{route.driverLabel}</span>
        </div>
        <Badge variant="secondary">{route.stops.length} paradas</Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Route className="w-4 h-4" />
          <span>{formatDistance(route.totalDistance)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{formatDuration(route.totalDuration)}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span>Início: {route.startTime}</span>
        <span>•</span>
        <span>Fim: {route.endTime}</span>
      </div>
    </div>
  );
}

export function RouteResultSummary({ result, selectedRoute, onSelectRoute }: RouteResultSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Rotas Geradas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
              <AlertTriangle className="w-4 h-4" />
              Atenção
            </div>
            <ul className="text-xs text-amber-600 space-y-0.5 pl-6 list-disc">
              {result.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Unassigned Orders */}
        {result.unassignedOrders.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-2">
              <MapPin className="w-4 h-4" />
              Pedidos não atribuídos: {result.unassignedOrders.length}
            </div>
            <div className="flex flex-wrap gap-1">
              {result.unassignedOrders.map(order => (
                <Badge key={order.orderNumber} variant="outline" className="text-xs">
                  {order.orderNumber}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Overall Stats */}
        <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{result.routes.length}</p>
            <p className="text-xs text-muted-foreground">Rotas</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatDistance(result.totalDistance)}</p>
            <p className="text-xs text-muted-foreground">Distância Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatDuration(result.totalDuration)}</p>
            <p className="text-xs text-muted-foreground">Tempo Total</p>
          </div>
        </div>

        {/* Route Cards */}
        <div className="space-y-3">
          <button
            className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
              selectedRoute === null 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onSelectRoute(null)}
          >
            <span className="font-medium">Ver todas as rotas</span>
          </button>
          
          {result.routes.map(route => (
            <RouteCard
              key={route.driverId}
              route={route}
              isSelected={selectedRoute === route.driverId}
              onClick={() => onSelectRoute(route.driverId)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
