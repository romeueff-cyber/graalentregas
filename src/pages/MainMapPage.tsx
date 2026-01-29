import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEquipments } from '@/hooks/useEquipments';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useDailyOrderLocations } from '@/hooks/useDailyOrderLocations';
import { useHygieneClients } from '@/hooks/useHygieneClients';
import { MapView } from '@/components/map/MapView';
import { DailyOrdersSidebar, type DailyOrder } from '@/components/map/DailyOrdersSidebar';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/ui/sync-indicator';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { SprayCanIcon } from '@/components/icons';
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
  Droplets,
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

  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentWithCreator | null>(null);
  const [selectedDailyOrder, setSelectedDailyOrder] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // All useMemo hooks MUST be before any conditional returns
  // Count by status (separating "Cliente irá avisar" from regular delivered)
  const clienteAvisaraEquipments = useMemo(() => 
    equipments.filter((e) => e.cliente_ira_avisar || e.periodo_recolha === 'CLIENTE_IRA_AVISAR'),
    [equipments]
  );
  
  const regularEquipments = useMemo(() =>
    equipments.filter((e) => !e.cliente_ira_avisar && e.periodo_recolha !== 'CLIENTE_IRA_AVISAR'),
    [equipments]
  );

  const statusCounts = useMemo(() => ({
    delivered: regularEquipments.filter((e) => e.status === 'ENTREGUE').length,
    ready: regularEquipments.filter((e) => e.status === 'LIBERADO_PARA_RECOLHA').length,
    collected: regularEquipments.filter((e) => e.status === 'RECOLHIDO').length,
    clienteAvisara: clienteAvisaraEquipments.filter((e) => e.status !== 'RECOLHIDO').length,
  }), [regularEquipments, clienteAvisaraEquipments]);

  // Day summary calculations
  const daySummary = useMemo(() => {
    const pendingEquipments = equipments.filter(e => e.status !== 'RECOLHIDO');
    
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
  }, [equipments]);

  // Filtered equipments based on active filter
  const filteredEquipments = useMemo(() => {
    // When dailyOrders or hygiene filter is active, hide all equipments
    if (activeFilter === 'dailyOrders' || activeFilter === 'hygiene') return [];
    if (!activeFilter) return equipments;
    
    switch (activeFilter) {
      case 'delivered':
        return regularEquipments.filter((e) => e.status === 'ENTREGUE');
      case 'ready':
        return regularEquipments.filter((e) => e.status === 'LIBERADO_PARA_RECOLHA');
      case 'collected':
        return regularEquipments.filter((e) => e.status === 'RECOLHIDO');
      case 'clienteAvisara':
        return clienteAvisaraEquipments.filter((e) => e.status !== 'RECOLHIDO');
      default:
        return equipments;
    }
  }, [activeFilter, equipments, regularEquipments, clienteAvisaraEquipments]);

  // Get set of delivered order numbers
  const deliveredOrderNumbers = useMemo(() => {
    return new Set(equipments.map(e => e.pedido_dia));
  }, [equipments]);

  // Show daily order locations only when dailyOrders filter is active or no filter
  // EXCLUDE orders that are already delivered (they show as regular equipment markers now)
  const visibleDailyOrderLocations = useMemo(() => {
    if (activeFilter === 'hygiene') return []; // Hide when hygiene filter is active
    if (activeFilter === 'dailyOrders' || !activeFilter) {
      // Filter out already-delivered orders from map markers
      return dailyOrderLocations
        .filter(loc => !deliveredOrderNumbers.has(loc.orderNumber))
        .map(loc => ({
          ...loc,
          isDelivered: false,
        }));
    }
    return [];
  }, [activeFilter, dailyOrderLocations, deliveredOrderNumbers]);

  // Show hygiene locations only when hygiene filter is active
  const visibleHygieneLocations = useMemo(() => {
    if (activeFilter === 'hygiene') {
      return hygieneMapLocations;
    }
    return [];
  }, [activeFilter, hygieneMapLocations]);

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

  const handleConfirmCollection = async (equipment: EquipmentWithCreator) => {
    try {
      await confirmCollection(equipment.id);
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
    setActiveFilter(activeFilter === filter ? null : filter);
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
                          navigate('/users');
                        }}
                      >
                        <Users className="w-5 h-5" />
                        Gerenciar Usuários
                      </Button>
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
                    </>
                  )}
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
              <h1 className="font-semibold text-foreground">Graal Beer</h1>
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
          </div>
        </div>

        {/* Status Filters - Chips with scroll */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => toggleFilter('dailyOrders')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === 'dailyOrders'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-foreground hover:bg-secondary'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>{dailyOrders?.length || 0} Pedidos</span>
          </button>

          <button
            onClick={() => toggleFilter('hygiene')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === 'hygiene'
                ? 'bg-status-ready text-white shadow-sm'
                : 'bg-secondary/60 text-foreground hover:bg-secondary'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>{hygieneSummary.totalClients} Higiene</span>
          </button>

          <div className="w-px h-6 bg-border self-center flex-shrink-0" />

          <button
            onClick={() => toggleFilter('delivered')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === 'delivered'
                ? 'bg-destructive text-destructive-foreground shadow-sm'
                : 'bg-secondary/60 text-foreground hover:bg-secondary'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeFilter === 'delivered' ? 'bg-destructive-foreground' : 'bg-destructive'}`} />
            <span>{statusCounts.delivered} Entregue</span>
          </button>

          <button
            onClick={() => toggleFilter('ready')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === 'ready'
                ? 'bg-status-ready text-white shadow-sm'
                : 'bg-secondary/60 text-foreground hover:bg-secondary'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeFilter === 'ready' ? 'bg-white' : 'bg-status-ready'}`} />
            <span>{statusCounts.ready} Liberado</span>
          </button>

          <button
            onClick={() => toggleFilter('collected')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === 'collected'
                ? 'bg-status-collected text-white shadow-sm'
                : 'bg-secondary/60 text-foreground hover:bg-secondary'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeFilter === 'collected' ? 'bg-white' : 'bg-status-collected'}`} />
            <span>{statusCounts.collected} Recolhido</span>
          </button>

          <button
            onClick={() => toggleFilter('clienteAvisara')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === 'clienteAvisara'
                ? 'bg-status-waiting text-white shadow-sm'
                : 'bg-secondary/60 text-foreground hover:bg-secondary'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeFilter === 'clienteAvisara' ? 'bg-white' : 'bg-status-waiting'}`} />
            <span>{statusCounts.clienteAvisara} Aguardando</span>
          </button>
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

        {/* FAB - New Delivery */}
        <Button
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl bg-gradient-primary hover:opacity-90"
          onClick={() => navigate('/new-delivery')}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}

