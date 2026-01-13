import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEquipments } from '@/hooks/useEquipments';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { MapView } from '@/components/map/MapView';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/ui/sync-indicator';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import {
  Plus,
  Menu,
  LogOut,
  Settings,
  Users,
  List,
  Map as MapIcon,
  Beer,
  Filter,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { EquipmentWithCreator, EquipmentStatus } from '@/types/database';

type FilterType = 'all' | 'cliente_ira_avisar' | EquipmentStatus;

export default function MainMapPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const { equipments, isLoading, isSyncing, isOnline, confirmCollection, deleteEquipment } =
    useEquipments();
  const { location: driverLocation } = useDriverLocation();

  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentWithCreator | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Filter equipments based on active filter
  const filteredEquipments = useMemo(() => {
    if (activeFilter === 'all') return equipments;
    if (activeFilter === 'cliente_ira_avisar') {
      return equipments.filter((e) => e.cliente_ira_avisar);
    }
    return equipments.filter((e) => e.status === activeFilter);
  }, [equipments, activeFilter]);

  const filterLabels: Record<FilterType, string> = {
    all: 'Todos',
    cliente_ira_avisar: 'Cliente irá Avisar',
    ENTREGUE: 'Entregue',
    LIBERADO_PARA_RECOLHA: 'Liberado',
    RECOLHIDO: 'Recolhido',
  };

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

  // Count by status
  const statusCounts = {
    delivered: equipments.filter((e) => e.status === 'ENTREGUE').length,
    ready: equipments.filter((e) => e.status === 'LIBERADO_PARA_RECOLHA').length,
    collected: equipments.filter((e) => e.status === 'RECOLHIDO').length,
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top z-20">
        <div className="flex items-center justify-between">
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

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-lg p-1">
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
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span>{statusCounts.delivered} Entregue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-status-ready" />
            <span>{statusCounts.ready} Liberado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-status-collected" />
            <span>{statusCounts.collected} Recolhido</span>
          </div>
        </div>
      </div>

      {/* Map or List View */}
      <div className="flex-1 relative">
        {viewMode === 'map' ? (
          <MapView
            equipments={filteredEquipments}
            driverLocation={driverLocation}
            onEquipmentClick={handleEquipmentClick}
            selectedEquipment={selectedEquipment}
            onCloseInfoWindow={() => setSelectedEquipment(null)}
            onConfirmCollection={handleConfirmCollection}
            onDelete={isAdmin ? handleDeleteEquipment : undefined}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="h-full overflow-auto p-4 space-y-3">
            {filteredEquipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground mb-2">
                  {activeFilter === 'all' 
                    ? 'Nenhuma entrega registrada' 
                    : `Nenhuma entrega com filtro "${filterLabels[activeFilter]}"`}
                </p>
                {activeFilter !== 'all' && (
                  <Button variant="outline" className="mb-2" onClick={() => setActiveFilter('all')}>
                    Limpar Filtro
                  </Button>
                )}
                <Button onClick={() => navigate('/new-delivery')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Entrega
                </Button>
              </div>
            ) : (
              filteredEquipments.map((equipment) => (
                <div
                  key={equipment.id}
                  className="bg-card rounded-lg p-4 border shadow-sm cursor-pointer card-interactive"
                  onClick={() => handleViewDetails(equipment)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{equipment.nome_cliente}</h3>
                      <p className="text-sm text-muted-foreground">
                        {equipment.pedido_dia}
                      </p>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        equipment.cliente_ira_avisar
                          ? 'bg-amber-500'
                          : equipment.status === 'ENTREGUE'
                            ? 'bg-destructive'
                            : equipment.status === 'LIBERADO_PARA_RECOLHA'
                              ? 'bg-status-ready'
                              : 'bg-status-collected'
                      }`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* FAB - New Delivery */}
        <Button
          className="fixed bottom-20 right-6 w-14 h-14 rounded-full shadow-xl bg-gradient-primary hover:opacity-90 z-10"
          onClick={() => navigate('/new-delivery')}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Footer Filter Bar */}
      <div className="flex-shrink-0 glass border-t px-4 py-3 safe-area-bottom z-20">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as FilterType)}>
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cliente_ira_avisar">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Cliente irá Avisar
                </span>
              </SelectItem>
              <SelectItem value="ENTREGUE">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  Entregue
                </span>
              </SelectItem>
              <SelectItem value="LIBERADO_PARA_RECOLHA">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-status-ready" />
                  Liberado
                </span>
              </SelectItem>
              <SelectItem value="RECOLHIDO">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-status-collected" />
                  Recolhido
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {activeFilter !== 'all' && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-2"
              onClick={() => setActiveFilter('all')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

