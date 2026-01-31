import { useState, useMemo, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDailyOrderLocations } from '@/hooks/useDailyOrderLocations';
import { useRouteOptimization } from '@/hooks/useRouteOptimization';
import { RouteConfigForm } from '@/components/routes/RouteConfigForm';
import { RouteResultSummary } from '@/components/routes/RouteResultSummary';
import { RouteMapView } from '@/components/routes/RouteMapView';
import { RouteStopsList } from '@/components/routes/RouteStopsList';
import { Button } from '@/components/ui/button';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { ArrowLeft, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import type { DeliveryPoint, RouteConfig } from '@/types/routes';

// Default start location (Graal Beer)
const DEFAULT_START = {
  lat: -23.5505,
  lng: -46.6333,
};

export default function RoutesPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { 
    orders, 
    locations, 
    ordersWithoutLocation, 
    isLoading: ordersLoading, 
    isGoogleReady 
  } = useDailyOrderLocations();
  
  const { 
    optimizeRoutes, 
    isOptimizing, 
    progress, 
    result, 
    error,
    clearResult 
  } = useRouteOptimization();

  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [startLocation, setStartLocation] = useState(DEFAULT_START);

  // Convert orders with locations to DeliveryPoints
  const deliveryPoints: DeliveryPoint[] = useMemo(() => {
    if (!orders || !locations) return [];

    return locations.map(loc => {
      const order = orders.find(o => o.order_number === loc.orderNumber);
      
      // Extract time from expected_delivery
      let expectedTime: string | null = null;
      if (order?.expected_delivery) {
        try {
          const date = new Date(order.expected_delivery);
          expectedTime = date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
        } catch {
          expectedTime = null;
        }
      }

      // Build address string
      const addr = order?.address;
      const addressParts = [
        addr?.street,
        addr?.number,
        addr?.neighborhood,
        addr?.city,
      ].filter(Boolean);

      return {
        orderNumber: loc.orderNumber,
        clientName: loc.clientName,
        address: addressParts.join(', ') || 'Endereço não disponível',
        lat: loc.lat,
        lng: loc.lng,
        expectedDelivery: expectedTime,
        estimatedServiceTime: 30,
        priority: expectedTime ? 1440 - parseInt(expectedTime.split(':')[0]) * 60 : 0,
      };
    });
  }, [orders, locations]);

  const handleOptimize = useCallback(async (config: RouteConfig) => {
    setStartLocation(config.startLocation);
    setSelectedRoute(null);
    await optimizeRoutes(deliveryPoints, config);
  }, [deliveryPoints, optimizeRoutes]);

  const handleResetRoutes = useCallback(() => {
    clearResult();
    setSelectedRoute(null);
  }, [clearResult]);

  // Get selected route for detail view
  const selectedRouteData = useMemo(() => {
    if (selectedRoute === null || !result) return null;
    return result.routes.find(r => r.driverId === selectedRoute) || null;
  }, [selectedRoute, result]);

  // Conditional returns after all hooks
  if (authLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isLoading = ordersLoading || !isGoogleReady;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">Otimização de Rotas</h1>
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Carregando pedidos...' : `${deliveryPoints.length} entregas geocodificadas`}
              </p>
            </div>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={handleResetRoutes}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Recalcular
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r bg-card flex-shrink-0 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Carregando pedidos do ERP...</p>
              <p className="text-xs mt-1">Geocodificando endereços...</p>
            </div>
          ) : (
            <>
              {/* Warning for orders without location */}
              {ordersWithoutLocation.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {ordersWithoutLocation.length} pedidos sem localização
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    Esses pedidos não serão incluídos nas rotas
                  </p>
                </div>
              )}

              {/* Configuration or Results */}
              {!result ? (
                <RouteConfigForm
                  deliveryCount={deliveryPoints.length}
                  onOptimize={handleOptimize}
                  isOptimizing={isOptimizing}
                  progress={progress}
                />
              ) : (
                <RouteResultSummary
                  result={result}
                  selectedRoute={selectedRoute}
                  onSelectRoute={setSelectedRoute}
                />
              )}
            </>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 flex">
          <div className={`flex-1 relative ${selectedRouteData ? 'hidden lg:block' : ''}`}>
            <RouteMapView
              result={result}
              selectedRoute={selectedRoute}
              startLocation={startLocation}
              allPoints={deliveryPoints}
            />
          </div>

          {/* Route Details Panel */}
          {selectedRouteData && (
            <div className="w-96 border-l flex-shrink-0">
              <RouteStopsList route={selectedRouteData} />
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg">
          <p className="font-medium">Erro ao otimizar rotas</p>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      )}
    </div>
  );
}
