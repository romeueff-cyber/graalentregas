import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ERPSyncBadge } from '@/components/ui/erp-sync-badge';
import { extractTime } from '@/lib/date-utils';
import { useDailyOrders, type DailyOrderData } from '@/hooks/useDailyOrders';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  Navigation,
} from 'lucide-react';
import { BeerBottleIcon, BeerBarrelIcon, BeerTapIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface OrderItem {
  product: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OrderEquipment {
  type: string;
  quantity: number;
}

type Order = DailyOrderData;

type EquipmentFilter = 'all' | 'growler' | 'barril' | 'chopeira';

interface DailyOrdersSidebarProps {
  onOrderSelect?: (order: Order) => void;
  selectedOrderNumber?: string | null;
  ordersWithoutLocation?: string[];
  onRegisterDelivery?: (order: Order) => void;
  deliveredOrderNumbers?: Set<string>;
}

export function DailyOrdersSidebar({ 
  onOrderSelect, 
  selectedOrderNumber, 
  ordersWithoutLocation = [],
  onRegisterDelivery,
  deliveredOrderNumbers = new Set(),
}: DailyOrdersSidebarProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');

  // Use the shared hook with caching
  const { 
    orders, 
    isLoading, 
    isFetching, 
    forceRefresh,
    isOnline,
    cacheStatus
  } = useDailyOrders();

  const hasGrowler = (order: Order) => {
    return order.items.some(item => 
      item.product.toLowerCase().includes('growler')
    );
  };

  const getGrowlerCount = (order: Order) => {
    return order.items
      .filter(item => item.product.toLowerCase().includes('growler'))
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const hasBarrel = (order: Order) => {
    return order.equipments.some(eq => 
      eq.type.toLowerCase().includes('barril')
    );
  };

  const getBarrelCount = (order: Order) => {
    return order.equipments
      .filter(eq => eq.type.toLowerCase().includes('barril'))
      .reduce((sum, eq) => sum + eq.quantity, 0);
  };

  // Get chopp volume for barrels (items that contain 'chopp' or 'l' for liters but not 'growler')
  const getBarrelVolume = (order: Order) => {
    const choppItems = order.items.filter(item => {
      const product = item.product.toLowerCase();
      return !product.includes('growler') && 
             (product.includes('chopp') || product.includes('pilsen') || product.includes('ipa') || product.includes('lager') || product.includes('weiss'));
    });
    return choppItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get detailed barrel breakdown by size (e.g., 4x30L + 1x20L)
  const getBarrelBreakdown = (order: Order): { count: number; unitVolume: number }[] => {
    const barrelCount = getBarrelCount(order);
    const totalVolume = getBarrelVolume(order);
    
    if (barrelCount === 0 || totalVolume === 0) return [];
    
    // Parse equipment types for barrel sizes (e.g., "Barril 30L", "Barril 20L")
    const barrelsBySize: Record<number, number> = {};
    
    order.equipments
      .filter(eq => eq.type.toLowerCase().includes('barril'))
      .forEach(eq => {
        // Try to extract volume from equipment type (e.g., "Barril 30L" -> 30)
        const volumeMatch = eq.type.match(/(\d+)\s*[lL]/);
        if (volumeMatch) {
          const volume = parseInt(volumeMatch[1], 10);
          barrelsBySize[volume] = (barrelsBySize[volume] || 0) + eq.quantity;
        }
      });
    
    // If we found specific sizes from equipment types
    if (Object.keys(barrelsBySize).length > 0) {
      return Object.entries(barrelsBySize)
        .map(([volume, count]) => ({ count, unitVolume: parseInt(volume, 10) }))
        .sort((a, b) => b.unitVolume - a.unitVolume); // Sort by volume descending
    }
    
    // Fallback: calculate average if we can't determine specific sizes
    const avgVolume = Math.round(totalVolume / barrelCount);
    return [{ count: barrelCount, unitVolume: avgVolume }];
  };

  // Format barrel breakdown for display (e.g., "4x30L + 1x20L")
  const formatBarrelDisplay = (order: Order): string => {
    const breakdown = getBarrelBreakdown(order);
    if (breakdown.length === 0) return '';
    return breakdown.map(b => `${b.count}x${b.unitVolume}L`).join(' + ');
  };

  // Format barrel tooltip with full details
  const formatBarrelTooltip = (order: Order): string => {
    const breakdown = getBarrelBreakdown(order);
    const totalVolume = getBarrelVolume(order);
    const barrelCount = getBarrelCount(order);
    
    if (breakdown.length === 0) return 'Barril';
    
    if (breakdown.length === 1) {
      return `${barrelCount} barril(s) de ${breakdown[0].unitVolume}L cada = ${totalVolume}L total`;
    }
    
    const details = breakdown.map(b => `${b.count}x${b.unitVolume}L`).join(' + ');
    return `${details} = ${totalVolume}L total`;
  };

  const hasChopeira = (order: Order) => {
    return order.equipments.some(eq => 
      eq.type.toLowerCase().includes('chopeira')
    );
  };

  const getChopeiraCount = (order: Order) => {
    return order.equipments
      .filter(eq => eq.type.toLowerCase().includes('chopeira'))
      .reduce((sum, eq) => sum + eq.quantity, 0);
  };

  const hasLocationIssue = (order: Order) => {
    const { street, city, neighborhood } = order.address;
    const hasAddressData = !!(street || city || neighborhood);
    const failedGeocoding = ordersWithoutLocation.includes(order.order_number);
    return !hasAddressData || failedGeocoding;
  };

  // Filter orders based on equipment type
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    switch (equipmentFilter) {
      case 'growler':
        return orders.filter(o => hasGrowler(o));
      case 'barril':
        return orders.filter(o => hasBarrel(o));
      case 'chopeira':
        return orders.filter(o => hasChopeira(o));
      default:
        return orders;
    }
  }, [orders, equipmentFilter]);

  // Counts for each filter
  const filterCounts = useMemo(() => {
    if (!orders) return { all: 0, growler: 0, barril: 0, chopeira: 0 };
    return {
      all: orders.length,
      growler: orders.filter(o => hasGrowler(o)).length,
      barril: orders.filter(o => hasBarrel(o)).length,
      chopeira: orders.filter(o => hasChopeira(o)).length,
    };
  }, [orders]);

  const toggleExpand = (orderNumber: string) => {
    setExpandedOrder(expandedOrder === orderNumber ? null : orderNumber);
  };

  const handleRegisterDelivery = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegisterDelivery) {
      onRegisterDelivery(order);
    } else {
      // Navigate to new delivery page with order data
      navigate('/new-delivery', { 
        state: { 
          orderData: order,
          fromDailyOrders: true,
        } 
      });
    }
  };

  // Compact collapsed state - just shows order count
  if (!isExpanded) {
    return (
      <div 
        className="absolute left-2 top-2 z-10 cursor-pointer"
        onClick={() => setIsExpanded(true)}
      >
        <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg p-2 flex items-center gap-2 hover:bg-muted/50 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs font-semibold">
            {orders?.length || 0} pedidos
          </Badge>
        </div>
      </div>
    );
  }

  // Expanded state - full sidebar
  return (
    <div className="absolute left-2 top-2 bottom-20 w-80 bg-card/95 backdrop-blur-sm border rounded-lg shadow-xl z-10 flex flex-col animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-xs">Pedidos do Dia</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {filteredOrders.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => forceRefresh()}
            disabled={isFetching || !isOnline}
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Sync Status Badge */}
      <div className="px-2 py-1.5 border-b bg-muted/30">
        <ERPSyncBadge
          cacheStatus={cacheStatus}
          isOnline={isOnline}
          isSyncing={isFetching}
          onRefresh={forceRefresh}
        />
      </div>

      {/* Equipment Filter Row */}
      <div className="flex gap-1 p-2 border-b overflow-x-auto items-center">
        <button
          onClick={() => setEquipmentFilter('all')}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors",
            equipmentFilter === 'all'
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          Todos ({filterCounts.all})
        </button>

        <button
          onClick={() => setEquipmentFilter('growler')}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors",
            equipmentFilter === 'growler'
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          <BeerBottleIcon className="w-3 h-3" />
          {filterCounts.growler}
        </button>
        <button
          onClick={() => setEquipmentFilter('barril')}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors",
            equipmentFilter === 'barril'
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          <BeerBarrelIcon className="w-3 h-3" />
          {filterCounts.barril}
        </button>
        <button
          onClick={() => setEquipmentFilter('chopeira')}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors",
            equipmentFilter === 'chopeira'
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          <BeerTapIcon className="w-3 h-3" />
          {filterCounts.chopeira}
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground text-xs">
            {equipmentFilter === 'all' 
              ? 'Nenhum pedido para hoje'
              : `Nenhum pedido com ${equipmentFilter}`
            }
          </div>
        ) : (
          <div className="p-1.5 space-y-1">
            {filteredOrders.map((order) => {
              const isOrderExpanded = expandedOrder === order.order_number;
              const isSelected = selectedOrderNumber === order.order_number;
              const locationIssue = hasLocationIssue(order);
              const orderHasGrowler = hasGrowler(order);
              const orderHasBarrel = hasBarrel(order);
              const orderHasChopeira = hasChopeira(order);
              const growlerCount = getGrowlerCount(order);
              const barrelCount = getBarrelCount(order);
              const barrelVolume = getBarrelVolume(order);
              const chopeiraCount = getChopeiraCount(order);
              const isOrderDelivered = deliveredOrderNumbers.has(order.order_number);

              return (
                <div
                  key={order.order_number}
                  className={cn(
                    "rounded-md border transition-all",
                    isOrderDelivered 
                      ? "bg-status-ready/10 border-status-ready/30"
                      : isSelected 
                        ? "bg-primary/10 border-primary/30" 
                        : "bg-background hover:bg-muted/50"
                  )}
                >
                  {/* Order Row */}
                  <div
                    className="flex items-center gap-1.5 p-1.5 cursor-pointer"
                    onClick={() => onOrderSelect?.(order)}
                  >
                    {/* Order Number, Client Name and Time */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className={cn(
                        "font-mono font-semibold text-xs",
                        isOrderDelivered && "text-status-ready"
                      )}>
                        #{order.order_number}
                        {isOrderDelivered && ' ✓'}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60px]" title={order.client_name}>
                        {order.client_name.substring(0, 6)}
                      </span>
                      {order.expected_delivery && extractTime(order.expected_delivery) && (
                        <span className="text-[9px] text-muted-foreground font-medium">
                          {extractTime(order.expected_delivery)}
                        </span>
                      )}
                      {locationIssue && (
                        <span title="Localização não encontrada">
                          <AlertTriangle className="w-3 h-3 text-status-waiting flex-shrink-0" />
                        </span>
                      )}
                    </div>

                    {/* Equipment Icons with Quantities */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span title="Growler" className="flex items-center gap-0.5">
                        <span className={cn(
                          "text-[9px] font-semibold",
                          orderHasGrowler ? "text-primary" : "text-muted-foreground/40"
                        )}>{growlerCount}x</span>
                        <BeerBottleIcon className={cn(
                          "w-3.5 h-3.5",
                          orderHasGrowler ? "text-primary" : "text-muted-foreground/30"
                        )} />
                      </span>
                      <span 
                        title={formatBarrelTooltip(order)} 
                        className="flex items-center gap-0.5"
                      >
                        <span className={cn(
                          "text-[9px] font-semibold whitespace-nowrap",
                          orderHasBarrel ? "text-primary" : "text-muted-foreground/40"
                        )}>
                          {orderHasBarrel ? formatBarrelDisplay(order) : '0x'}
                        </span>
                        <BeerBarrelIcon className={cn(
                          "w-3.5 h-3.5 flex-shrink-0",
                          orderHasBarrel ? "text-primary" : "text-muted-foreground/30"
                        )} />
                      </span>
                      <span title="Chopeira" className="flex items-center gap-0.5">
                        <span className={cn(
                          "text-[9px] font-semibold",
                          orderHasChopeira ? "text-primary" : "text-muted-foreground/40"
                        )}>{chopeiraCount}x</span>
                        <BeerTapIcon className={cn(
                          "w-3.5 h-3.5",
                          orderHasChopeira ? "text-primary" : "text-muted-foreground/30"
                        )} />
                      </span>
                    </div>

                    {/* Expand Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(order.order_number);
                      }}
                    >
                      {isOrderExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  {isOrderExpanded && (
                    <div className="px-2 pb-2 pt-1 border-t text-[10px] space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate flex-1">
                          {order.client_name}
                        </p>
                        {order.erp_status && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted/50 whitespace-nowrap">
                            {order.erp_status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        {order.address.city || 'Cidade não informada'}
                        {order.address.neighborhood && `, ${order.address.neighborhood}`}
                      </p>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-1.5">
                        {/* Route Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            const { street, number, neighborhood, city, state } = order.address;
                            const addressParts = [street, number, neighborhood, city, state].filter(Boolean);
                            const address = addressParts.join(', ');
                            if (address) {
                              window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                            }
                          }}
                        >
                          <Navigation className="w-3 h-3 mr-1" />
                          Rota
                        </Button>
                        
                        {/* Register Delivery Button */}
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 h-7 text-[10px] bg-gradient-primary"
                          onClick={(e) => handleRegisterDelivery(order, e)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Entrega
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export type { Order as DailyOrder };
