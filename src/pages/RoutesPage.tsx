import { useState, useMemo, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteOrderLocations } from '@/hooks/useRouteOrderLocations';
import { useRouteOptimization } from '@/hooks/useRouteOptimization';
import { RouteConfigForm } from '@/components/routes/RouteConfigForm';
import { RouteResultSummary } from '@/components/routes/RouteResultSummary';
import { RouteMapView } from '@/components/routes/RouteMapView';
import { RouteStopsList } from '@/components/routes/RouteStopsList';
import { Button } from '@/components/ui/button';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, RefreshCw, AlertTriangle, Loader2, Settings, Route } from 'lucide-react';
import type { DeliveryPoint, RouteConfig } from '@/types/routes';

// Default start location (Graal Beer)
const DEFAULT_START = {
  lat: -23.5505,
  lng: -46.6333,
};

export default function RoutesPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, isLoading: authLoading } = useAuth();
  
  // Date selection state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  
  const { 
    orders, 
    locations, 
    ordersWithoutLocation, 
    isLoading: ordersLoading, 
    isGoogleReady 
  } = useRouteOrderLocations(selectedDateString);
  
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
  const [mobileTab, setMobileTab] = useState<string>('config');
  const [showRouteDetails, setShowRouteDetails] = useState(false);

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

  const handleOptimize = useCallback(async (config: RouteConfig, date: string) => {
    setStartLocation(config.startLocation);
    setSelectedRoute(null);
    await optimizeRoutes(deliveryPoints, config);
    // Switch to results tab on mobile after optimization
    if (isMobile) {
      setMobileTab('results');
    }
  }, [deliveryPoints, optimizeRoutes, isMobile]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    clearResult(); // Clear previous results when date changes
  }, [clearResult]);

  const handleResetRoutes = useCallback(() => {
    clearResult();
    setSelectedRoute(null);
    setMobileTab('config');
  }, [clearResult]);

  const handleSelectRoute = useCallback((driverId: number | null) => {
    setSelectedRoute(driverId);
    if (driverId !== null && isMobile) {
      setShowRouteDetails(true);
    }
  }, [isMobile]);

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

  // Sidebar content component for reuse
  const SidebarContent = () => (
    <>
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

          {/* Configuration or Results based on mobile tab or desktop view */}
          {isMobile ? (
            <Tabs value={mobileTab} onValueChange={setMobileTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="config" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configurar
                </TabsTrigger>
                <TabsTrigger value="results" disabled={!result} className="flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Rotas
                </TabsTrigger>
              </TabsList>
              <TabsContent value="config" className="mt-4">
                <RouteConfigForm
                  deliveryCount={deliveryPoints.length}
                  onOptimize={handleOptimize}
                  isOptimizing={isOptimizing}
                  progress={progress}
                  selectedDate={selectedDate}
                  onDateChange={handleDateChange}
                />
              </TabsContent>
              <TabsContent value="results" className="mt-4">
                {result && (
                  <RouteResultSummary
                    result={result}
                    selectedRoute={selectedRoute}
                    onSelectRoute={handleSelectRoute}
                  />
                )}
              </TabsContent>
            </Tabs>
          ) : (
            // Desktop: show config or results based on whether we have results
            !result ? (
              <RouteConfigForm
                deliveryCount={deliveryPoints.length}
                onOptimize={handleOptimize}
                isOptimizing={isOptimizing}
                progress={progress}
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
              />
            ) : (
              <RouteResultSummary
                result={result}
                selectedRoute={selectedRoute}
                onSelectRoute={handleSelectRoute}
              />
            )
          )}
        </>
      )}
    </>
  );

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
              <span className="hidden sm:inline">Recalcular</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className={`flex-1 flex overflow-hidden min-h-0 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        
        {/* Mobile: Map on top */}
        {isMobile && (
          <div className="h-[250px] flex-shrink-0 relative">
            <RouteMapView
              result={result}
              selectedRoute={selectedRoute}
              startLocation={startLocation}
              allPoints={deliveryPoints}
              height="250px"
            />
          </div>
        )}

        {/* Sidebar - full width on mobile, fixed width on desktop */}
        <div className={`
          ${isMobile 
            ? 'flex-1 overflow-y-auto' 
            : 'w-80 border-r flex-shrink-0 overflow-y-auto'
          } 
          bg-card p-4 space-y-4
        `}>
          <SidebarContent />
        </div>

        {/* Desktop: Map Area */}
        {!isMobile && (
          <div className="flex-1 flex min-h-0 min-w-0">
            <div className="flex-1 relative min-h-full">
              <RouteMapView
                result={result}
                selectedRoute={selectedRoute}
                startLocation={startLocation}
                allPoints={deliveryPoints}
              />
            </div>

            {/* Route Details Panel - Desktop only */}
            {selectedRouteData && (
              <div className="w-96 border-l flex-shrink-0 overflow-y-auto">
                <RouteStopsList route={selectedRouteData} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: Route Details Sheet */}
      {isMobile && (
        <Sheet open={showRouteDetails} onOpenChange={setShowRouteDetails}>
          <SheetContent side="bottom" className="h-[70vh] p-0">
            <SheetHeader className="p-4 pb-0">
              <SheetTitle>Detalhes da Rota</SheetTitle>
            </SheetHeader>
            {selectedRouteData && (
              <div className="h-full overflow-y-auto">
                <RouteStopsList route={selectedRouteData} />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg z-30">
          <p className="font-medium">Erro ao otimizar rotas</p>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      )}
    </div>
  );
}
