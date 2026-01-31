import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  AlertTriangle, 
  Clock, 
  Route, 
  Truck, 
  MapPin, 
  GripVertical, 
  ArrowRight,
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { RouteOptimizationResult, OptimizedRoute, DeliveryStop } from '@/types/routes';
import type { Driver } from '@/hooks/useDrivers';
import { cn } from '@/lib/utils';

interface RouteDriverAssignmentProps {
  result: RouteOptimizationResult;
  drivers: Driver[];
  driverAssignments: Record<number, string>; // routeId -> driverId
  onAssignDriver: (routeId: number, driverId: string) => void;
  onMoveStop: (fromRouteId: number, toRouteId: number, stopIndex: number) => void;
  selectedRoute: number | null;
  onSelectRoute: (routeId: number | null) => void;
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

interface RouteCardProps {
  route: OptimizedRoute;
  drivers: Driver[];
  assignedDriverId: string | undefined;
  onAssignDriver: (driverId: string) => void;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onMoveStop: (stopIndex: number, toRouteId: number) => void;
  allRoutes: OptimizedRoute[];
  isMobile: boolean;
}

function RouteCard({ 
  route, 
  drivers,
  assignedDriverId,
  onAssignDriver,
  isSelected, 
  isExpanded,
  onSelect,
  onToggleExpand,
  onMoveStop,
  allRoutes,
  isMobile
}: RouteCardProps) {
  const [movingStopIndex, setMovingStopIndex] = useState<number | null>(null);
  
  const assignedDriver = drivers.find(d => d.id === assignedDriverId);
  const otherRoutes = allRoutes.filter(r => r.driverId !== route.driverId);

  const handleDragStart = (e: React.DragEvent, stopIndex: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      fromRouteId: route.driverId,
      stopIndex
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.fromRouteId !== route.driverId) {
        onMoveStop(data.stopIndex, route.driverId);
      }
    } catch (err) {
      console.error('Error handling drop:', err);
    }
  };

  return (
    <div 
      className={cn(
        "rounded-lg border-2 transition-all overflow-hidden",
        isSelected 
          ? "border-primary bg-primary/5 shadow-md" 
          : "border-border hover:border-primary/50 bg-card"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div 
        className="p-3 sm:p-4 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" 
              style={{ backgroundColor: route.color }}
            />
            <span className="font-semibold text-sm sm:text-base">{route.driverLabel}</span>
          </div>
          <Badge variant="secondary" className="text-xs">{route.stops.length} paradas</Badge>
        </div>
        
        {/* Driver Assignment */}
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
            <User className="w-3 h-3" />
            Entregador Responsável
          </label>
          <Select 
            value={assignedDriverId || ''} 
            onValueChange={onAssignDriver}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecionar entregador..." />
            </SelectTrigger>
            <SelectContent>
              {drivers.map(driver => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Route className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{formatDistance(route.totalDistance)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{formatDuration(route.totalDuration)}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{route.startTime} - {route.endTime}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Entregas
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Stops List */}
      {isExpanded && (
        <div className="border-t bg-muted/30">
          <ScrollArea className="max-h-[250px]">
            <div className="p-3 space-y-2">
              {route.stops.map((stop, index) => (
                <div
                  key={stop.point.orderNumber}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg bg-background border transition-all",
                    !isMobile && "cursor-grab active:cursor-grabbing",
                    movingStopIndex === index && "ring-2 ring-primary"
                  )}
                  draggable={!isMobile}
                  onDragStart={(e) => handleDragStart(e, index)}
                >
                  {!isMobile && (
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: route.color }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{stop.point.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {stop.point.orderNumber} • {stop.arrivalTime}
                    </p>
                  </div>
                  
                  {/* Mobile move button */}
                  {isMobile && otherRoutes.length > 0 && (
                    <div className="flex-shrink-0">
                      {movingStopIndex === index ? (
                        <div className="flex flex-col gap-1">
                          {otherRoutes.map(r => (
                            <Button
                              key={r.driverId}
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => {
                                onMoveStop(index, r.driverId);
                                setMovingStopIndex(null);
                              }}
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              {r.driverLabel}
                            </Button>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setMovingStopIndex(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setMovingStopIndex(index)}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export function RouteDriverAssignment({ 
  result, 
  drivers,
  driverAssignments,
  onAssignDriver,
  onMoveStop,
  selectedRoute, 
  onSelectRoute 
}: RouteDriverAssignmentProps) {
  const isMobile = useIsMobile();
  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(new Set());

  const toggleExpand = useCallback((routeId: number) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  }, []);

  const handleMoveStop = useCallback((fromRouteId: number, stopIndex: number, toRouteId: number) => {
    onMoveStop(fromRouteId, toRouteId, stopIndex);
  }, [onMoveStop]);

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
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
              <AlertTriangle className="w-4 h-4" />
              Atenção
            </div>
            <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5 pl-6 list-disc">
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
            <p className="text-xs text-muted-foreground">Distância</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatDuration(result.totalDuration)}</p>
            <p className="text-xs text-muted-foreground">Tempo</p>
          </div>
        </div>

        {/* Drag hint for desktop */}
        {!isMobile && (
          <p className="text-xs text-muted-foreground text-center">
            💡 Arraste as entregas entre rotas para realocar
          </p>
        )}

        {/* Route Cards */}
        <div className="space-y-3">
          <button
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all text-sm",
              selectedRoute === null 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}
            onClick={() => onSelectRoute(null)}
          >
            <span className="font-medium">Ver todas as rotas</span>
          </button>
          
          {result.routes.map(route => (
            <RouteCard
              key={route.driverId}
              route={route}
              drivers={drivers}
              assignedDriverId={driverAssignments[route.driverId]}
              onAssignDriver={(driverId) => onAssignDriver(route.driverId, driverId)}
              isSelected={selectedRoute === route.driverId}
              isExpanded={expandedRoutes.has(route.driverId)}
              onSelect={() => onSelectRoute(route.driverId)}
              onToggleExpand={() => toggleExpand(route.driverId)}
              onMoveStop={(stopIndex, toRouteId) => handleMoveStop(route.driverId, stopIndex, toRouteId)}
              allRoutes={result.routes}
              isMobile={isMobile}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
