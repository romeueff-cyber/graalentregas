import { useState, useMemo, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEquipments } from '@/hooks/useEquipments';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useDailyOrderLocations } from '@/hooks/useDailyOrderLocations';
import { useHygieneClients } from '@/hooks/useHygieneClients';
import { useGeoFilter } from '@/hooks/useGeoFilter';
import { MapView } from '@/components/map/MapView';
import { DailyOrdersSidebar, type DailyOrder } from '@/components/map/DailyOrdersSidebar';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/ui/sync-indicator';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { SprayCanIcon } from '@/components/icons';
import { StandaloneReturnDialog } from '@/components/delivery/StandaloneReturnDialog';
import { InvoicePendingAlert, isOrderInvoiced } from '@/components/delivery/InvoicePendingAlert';
import { useOfflineReturnSync } from '@/hooks/useOfflineReturnSync';
import { usePendingReturns } from '@/hooks/usePendingReturns';
import {
  Plus,
  Menu,
  LogOut,
  Settings,
  Users,
  List,
  Map as MapIcon,
  Beer,
  CalendarCheck,
  AlertTriangle,
  ClipboardList,
  PackageCheck,
  Package,
  Droplets,
  FileText,
  Route,
  BarChart3,
  MapPin,
  PackageOpen,
  Tag,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isToday, isPastDate, daysSince } from '@/lib/date-utils';
import type { EquipmentWithCreator } from '@/types/database';

export default function MainMapPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const { equipments, isLoading, isSyncing, isOnline, confirmCollection, deleteEquipment } =
    useEquipments();
  const { location: driverLocation } = useDriverLocation();
  const { orders: dailyOrders, locations: dailyOrderLocations, ordersWithoutLocation, getOrderLocation } = useDailyOrderLocations();
  const { summary: hygieneSummary, mapLocations: hygieneMapLocations } = useHygieneClients();
  const { filterByGeo, isGeoFilterActive, geoSettings } = useGeoFilter();
  useOfflineReturnSync();
  const { count: pendingReturnCount } = usePendingReturns();

  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentWithCreator | null>(null);
  const [selectedDailyOrder, setSelectedDailyOrder] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [pendingInvoiceOrder, setPendingInvoiceOrder] = useState<DailyOrder | null>(null);

  // Apply geo filter to equipments
  const geoFilteredEquipments = useMemo(() => filterByGeo(equipments), [equipments, filterByGeo]);

  // Apply geo filter to daily order locations
  const geoFilteredDailyOrderLocations = useMemo(() => 
    filterByGeo(dailyOrderLocations), 
    [dailyOrderLocations, filterByGeo]
  );

  // Apply geo filter to hygiene locations
  const geoFilteredHygieneLocations = useMemo(() => 
    filterByGeo(hygieneMapLocations), 
    [hygieneMapLocations, filterByGeo]
  );

  // All useMemo hooks MUST be before any conditional returns
  // Count by status (separating "Cliente irá avisar" from regular delivered)
  // Use geo-filtered equipments for counting and filtering
  const clienteAvisaraEquipments = useMemo(() => 
    geoFilteredEquipments.filter((e) => e.cliente_ira_avisar || e.periodo_recolha === 'CLIENTE_IRA_AVISAR'),
    [geoFilteredEquipments]
  );
  
  const regularEquipments = useMemo(() =>
    geoFilteredEquipments.filter((e) => !e.cliente_ira_avisar && e.periodo_recolha !== 'CLIENTE_IRA_AVISAR'),
    [geoFilteredEquipments]
  );

  const statusCounts = useMemo(() => ({
    delivered: regularEquipments.filter((e) => e.status === 'ENTREGUE').length,
    ready: regularEquipments.filter((e) => e.status === 'LIBERADO_PARA_RECOLHA').length,
    collected: regularEquipments.filter((e) => e.status === 'RECOLHIDO').length,
    clienteAvisara: clienteAvisaraEquipments.filter((e) => e.status !== 'RECOLHIDO').length,
  }), [regularEquipments, clienteAvisaraEquipments]);

  // Day summary calculations (use geo-filtered)
  const daySummary = useMemo(() => {
    const pendingEquipments = geoFilteredEquipments.filter(e => e.status !== 'RECOLHIDO');
    
    // Today's scheduled collections
    const todayCollections = pendingEquipments.filter(e => 
      !e.cliente_ira_avisar && 
      e.periodo_recolha !== 'CLIENTE_IRA_AVISAR' &&
      isToday(e.data_prevista_recolha)
    );
    
    // Overdue collections (past the expected date)
    const overdueCollections = pendingEquipments.filter(e =>
      !e.cliente_ira_avisar && 
      e.periodo_recolha !== 'CLIENTE_IRA_AVISAR' &&
      isPastDate(e.data_prevista_recolha) &&
      !isToday(e.data_prevista_recolha)
    );
    
    // Long stays (more than 7 days with client)
    const longStays = pendingEquipments.filter(e => daysSince(e.data_entrega) > 7);
    
    return {
      todayCount: todayCollections.length,
      overdueCount: overdueCollections.length,
      longStaysCount: longStays.length,
    };
  }, [geoFilteredEquipments]);

  // Filtered equipments based on active filters (multi-select)
  const filteredEquipments = useMemo(() => {
    // If no filters active, show nothing - user must select a filter
    if (activeFilters.size === 0) return [];
    
    // Check if any equipment filters are active
    const hasEquipmentFilters = activeFilters.has('delivered') || 
      activeFilters.has('ready') || 
      activeFilters.has('collected') || 
      activeFilters.has('clienteAvisara');
    
    // If no equipment filters, hide all equipments
    if (!hasEquipmentFilters) return [];
    
    // Filter by selected equipment statuses
    const results: EquipmentWithCreator[] = [];
    
    if (activeFilters.has('delivered')) {
      results.push(...regularEquipments.filter((e) => e.status === 'ENTREGUE'));
    }
    if (activeFilters.has('ready')) {
      results.push(...regularEquipments.filter((e) => e.status === 'LIBERADO_PARA_RECOLHA'));
    }
    if (activeFilters.has('collected')) {
      results.push(...regularEquipments.filter((e) => e.status === 'RECOLHIDO'));
    }
    if (activeFilters.has('clienteAvisara')) {
      results.push(...clienteAvisaraEquipments.filter((e) => e.status !== 'RECOLHIDO'));
    }
    
    return results;
  }, [activeFilters, geoFilteredEquipments, regularEquipments, clienteAvisaraEquipments]);

  // Get set of delivered order numbers
  const deliveredOrderNumbers = useMemo(() => {
    return new Set(geoFilteredEquipments.map(e => e.pedido_dia));
  }, [geoFilteredEquipments]);

  // Show daily order locations ONLY when dailyOrders filter is active
  // EXCLUDE orders that are already delivered (they show as regular equipment markers now)
  const visibleDailyOrderLocations = useMemo(() => {
    // Only show if dailyOrders is explicitly selected
    if (activeFilters.has('dailyOrders')) {
      // Use geo-filtered locations and filter out already-delivered orders
      return geoFilteredDailyOrderLocations
        .filter(loc => !deliveredOrderNumbers.has(loc.orderNumber))
        .map(loc => ({
          ...loc,
          isDelivered: false,
        }));
    }
    return [];
  }, [activeFilters, geoFilteredDailyOrderLocations, deliveredOrderNumbers]);

  // Show hygiene locations when hygiene filter is active
  const visibleHygieneLocations = useMemo(() => {
    if (activeFilters.has('hygiene')) {
      return geoFilteredHygieneLocations;
    }
    return [];
  }, [activeFilters, geoFilteredHygieneLocations]);

  // Now we can have conditional returns - after all hooks
  if (authLoading || isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleEquipmentClick = (equipment: EquipmentWithCreator) => {
    setSelectedEquipment(equipment);
  };

  const handleViewDetails = (equipment: EquipmentWithCreator) => {
    navigate(`/equipment/${equipment.id}`);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleConfirmCollection = async (equipment: EquipmentWithCreator, patrimonies?: string[]) => {
    try {
      await confirmCollection(equipment.id, patrimonies);
      // Update selected equipment to reflect new status immediately
      setSelectedEquipment({
        ...equipment,
        status: 'RECOLHIDO',
        data_real_recolha: new Date().toISOString()
      });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleDeleteEquipment = async (equipment: EquipmentWithCreator) => {
    try {
      await deleteEquipment(equipment.id);
      setSelectedEquipment(null);
    } catch (error) {
      // Error already handled in hook
    }
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top z-20">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and status */}
          <div className="flex items-center gap-3">
            <Sheet open={showMenu} onOpenChange={setShowMenu}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                      <Beer className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <SheetTitle className="text-left">
                      <p className="font-semibold">{profile?.name}</p>
                      <p className="text-xs text-muted-foreground font-normal">
                        {isAdmin ? 'Administrador' : 'Entregador'}
                      </p>
                    </SheetTitle>
                  </div>
                </SheetHeader>

                <div className="space-y-2">
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        onClick={() => {
                          setShowMenu(false);
                          navigate('/analytics');
                        }}
                      >
                        <BarChart3 className="w-5 h-5" />
                        Analytics & Relatórios
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3"
                        onClick={() => {
                          setShowMenu(false);
                          navigate('/users');
                        }}
                      >
                        <Users className="w-5 h-5" />
                        Gerenciar Usuários
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      navigate('/settings');
                    }}
                  >
                    <Settings className="w-5 h-5" />
                    Configurações
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      navigate('/alocacoes');
                    }}
                  >
                    <Package className="w-5 h-5" />
                    Equipamentos Alocados
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      navigate('/rotas');
                    }}
                  >
                    <Route className="w-5 h-5" />
                    Otimização de Rotas
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      navigate('/etiquetas');
                    }}
                  >
                    <Tag className="w-5 h-5" />
                    Etiquetas
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-5 h-5" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-semibold text-foreground">Graal Beer</h1>
                {isGeoFilterActive && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        <MapPin className="w-3 h-3" />
                        {geoSettings.raio_km}km
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Filtro geográfico ativo: {geoSettings.raio_km}km de raio
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <SyncIndicator isOnline={isOnline} isSyncing={isSyncing} />
            </div>
          </div>

          {/* Right side - Quick actions */}
          <div className="flex items-center gap-1">
            {/* View Toggle */}
            <div className="flex bg-secondary rounded-lg p-1 mr-1">
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('map')}
              >
                <MapIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Pedidos do Dia */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate('/pedidos-dia')}
              title="Pedidos do Dia"
            >
              <ClipboardList className="w-5 h-5" />
              {dailyOrders && dailyOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {dailyOrders.length}
                </span>
              )}
            </Button>

            {/* Higienização */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate('/higienizacao')}
              title="Agenda de Higienização"
            >
              <SprayCanIcon className="w-5 h-5" />
              {(hygieneSummary.next7Days > 0 || hygieneSummary.overdue > 0) && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center ${
                  hygieneSummary.overdue > 0 
                    ? 'bg-destructive text-destructive-foreground' 
                    : 'bg-amber-500 text-white'
                }`}>
                  {hygieneSummary.overdue > 0 ? hygieneSummary.overdue : hygieneSummary.next7Days}
                </span>
              )}
            </Button>

            {/* Financeiro */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/financeiro')}
              title="Financeiro"
            >
              <FileText className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Status Filters - Two rows */}
        <div className="flex flex-col gap-1.5 mt-3">
          {/* Row 1: Pedidos & Higiene */}
          <div className="flex gap-1.5">
            <button
              onClick={() => toggleFilter('dailyOrders')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilters.has('dailyOrders')
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>{dailyOrders?.length || 0} Pedidos</span>
            </button>

            <button
              onClick={() => toggleFilter('hygiene')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilters.has('hygiene')
                  ? 'bg-status-ready text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>{hygieneSummary.totalClients} Higiene</span>
            </button>
          </div>

          {/* Row 2: Equipment Status */}
          <div className="flex gap-1">
            <button
              onClick={() => toggleFilter('delivered')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('delivered')
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeFilters.has('delivered') ? 'bg-destructive-foreground' : 'bg-destructive'}`} />
              <span>{statusCounts.delivered}</span>
            </button>

            <button
              onClick={() => toggleFilter('ready')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('ready')
                  ? 'bg-status-ready text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeFilters.has('ready') ? 'bg-white' : 'bg-status-ready'}`} />
              <span>{statusCounts.ready}</span>
            </button>

            <button
              onClick={() => toggleFilter('collected')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('collected')
                  ? 'bg-status-collected text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeFilters.has('collected') ? 'bg-white' : 'bg-status-collected'}`} />
              <span>{statusCounts.collected}</span>
            </button>

            <button
              onClick={() => toggleFilter('clienteAvisara')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('clienteAvisara')
                  ? 'bg-status-waiting text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeFilters.has('clienteAvisara') ? 'bg-white' : 'bg-status-waiting'}`} />
              <span>{statusCounts.clienteAvisara}</span>
            </button>
          </div>
        </div>

        {/* Day Summary Card */}
        {(daySummary.todayCount > 0 || daySummary.overdueCount > 0) && (
          <div className="flex gap-2 mt-2 text-xs">
            {daySummary.todayCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                <CalendarCheck className="w-3.5 h-3.5" />
                <span className="font-medium">{daySummary.todayCount} recolha prevista hoje</span>
              </div>
            )}
            {daySummary.overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-medium">{daySummary.overdueCount} atrasadas</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map or List View */}
      <div className="flex-1 relative">
        {viewMode === 'map' ? (
          <>
            {/* Daily Orders Sidebar */}
            <DailyOrdersSidebar
              onOrderSelect={(order: DailyOrder) => setSelectedDailyOrder(order.order_number)}
              selectedOrderNumber={selectedDailyOrder}
              ordersWithoutLocation={ordersWithoutLocation}
              deliveredOrderNumbers={deliveredOrderNumbers}
              onRegisterDelivery={(order: DailyOrder) => {
                const orderLoc = getOrderLocation(order.order_number);
                navigate('/new-delivery', { 
                  state: { 
                    orderData: order,
                    fromDailyOrders: true,
                    orderLocation: orderLoc || undefined,
                  } 
                });
              }}
            />
            <MapView
              equipments={filteredEquipments}
              driverLocation={driverLocation}
              onEquipmentClick={handleEquipmentClick}
              selectedEquipment={selectedEquipment}
              onCloseInfoWindow={() => setSelectedEquipment(null)}
              onConfirmCollection={handleConfirmCollection}
              onDelete={isAdmin ? handleDeleteEquipment : undefined}
              isAdmin={isAdmin}
              dailyOrderLocations={visibleDailyOrderLocations}
              selectedDailyOrder={selectedDailyOrder}
              onDailyOrderClick={(orderNumber) => {
                // Find the order data and navigate to registration page
                const orderData = dailyOrders?.find(o => o.order_number === orderNumber);
                const orderLoc = visibleDailyOrderLocations.find(l => l.orderNumber === orderNumber);
                if (orderData) {
                  // Check if order is invoiced (ID_STATUS = 3)
                  // Cast to access erp_status which may exist on the full order data
                  const orderWithStatus = orderData as { erp_status?: string | null } & typeof orderData;
                  if (!isOrderInvoiced(orderWithStatus.erp_status)) {
                    setPendingInvoiceOrder({
                      order_number: orderData.order_number,
                      client_name: orderData.client_name,
                      erp_status: orderWithStatus.erp_status ?? null,
                    } as DailyOrder);
                    return;
                  }
                  
                  navigate('/new-delivery', { 
                    state: { 
                      orderData,
                      fromDailyOrders: true,
                      orderLocation: orderLoc ? { lat: orderLoc.lat, lng: orderLoc.lng } : undefined,
                    } 
                  });
                }
              }}
              hygieneLocations={visibleHygieneLocations}
              onHygieneClick={(clientId) => {
                navigate('/higienizacao');
              }}
            />
          </>
        ) : (
          <div className="h-full overflow-auto p-4 space-y-3">
            {filteredEquipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground mb-2">
                  Nenhuma entrega registrada
                </p>
                <Button onClick={() => navigate('/new-delivery')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Entrega
                </Button>
              </div>
            ) : (
              filteredEquipments.map((equipment) => {
                const isClienteAvisara = equipment.cliente_ira_avisar || equipment.periodo_recolha === 'CLIENTE_IRA_AVISAR';
                const isCollected = equipment.status === 'RECOLHIDO';
                const daysWithClient = !isCollected ? daysSince(equipment.data_entrega) : 0;
                
                return (
                  <div
                    key={equipment.id}
                    className="bg-card rounded-lg p-4 border shadow-sm cursor-pointer card-interactive"
                    onClick={() => handleViewDetails(equipment)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{equipment.nome_cliente}</h3>
                        <p className="text-sm text-muted-foreground">
                          {equipment.pedido_dia}
                        </p>
                        {/* Days counter in list */}
                        {!isCollected && daysWithClient > 0 && (
                          <p className={`text-xs mt-1 font-medium ${
                            daysWithClient > 7 ? 'text-red-600' : 
                            daysWithClient > 3 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {daysWithClient === 1 ? '1 dia' : `${daysWithClient} dias`} com cliente
                          </p>
                        )}
                      </div>
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isClienteAvisara && !isCollected
                            ? 'bg-status-waiting'
                            : equipment.status === 'ENTREGUE'
                              ? 'bg-destructive'
                              : equipment.status === 'LIBERADO_PARA_RECOLHA'
                                ? 'bg-status-ready'
                                : 'bg-status-collected'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* FAB Group - Return Equipment & New Delivery */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 items-end">
          {/* Return Equipment Button */}
          <Button
            className="w-12 h-12 rounded-full shadow-lg bg-status-waiting hover:bg-status-waiting/90 relative"
            onClick={() => setShowReturnDialog(true)}
            title="Devolução de Equipamentos"
          >
            <PackageOpen className="w-5 h-5" />
            {pendingReturnCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {pendingReturnCount}
              </span>
            )}
          </Button>
          
          {/* New Delivery Button */}
          <Button
            className="w-14 h-14 rounded-full shadow-xl bg-gradient-primary hover:opacity-90"
            onClick={() => navigate('/new-delivery')}
            title="Nova Entrega"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>

        {/* Standalone Return Dialog */}
        <StandaloneReturnDialog
          open={showReturnDialog}
          onOpenChange={setShowReturnDialog}
        />

        {/* Invoice Pending Alert */}
        <InvoicePendingAlert
          open={!!pendingInvoiceOrder}
          onOpenChange={(open) => !open && setPendingInvoiceOrder(null)}
          orderNumber={pendingInvoiceOrder?.order_number}
        />
      </div>
    </div>
  );
}

