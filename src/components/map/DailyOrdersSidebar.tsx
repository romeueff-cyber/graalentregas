import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Wine,
  Cylinder,
  GlassWater,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
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

interface Order {
  order_number: string;
  client_name: string;
  phone: string | null;
  expected_delivery: string | null;
  expected_return: string | null;
  observations: string | null;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: OrderItem[];
  equipments: OrderEquipment[];
}

interface DailyOrdersSidebarProps {
  onOrderSelect?: (order: Order) => void;
  selectedOrderNumber?: string | null;
}

export function DailyOrdersSidebar({ onOrderSelect, selectedOrderNumber }: DailyOrdersSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const { data: orders, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-orders-sidebar', today],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-erp-orders', {
        body: { date: today },
      });
      if (error) throw error;
      return data as Order[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const hasGrowler = (order: Order) => {
    return order.items.some(item => 
      item.product.toLowerCase().includes('growler')
    );
  };

  const hasBarrel = (order: Order) => {
    return order.equipments.some(eq => 
      eq.type.toLowerCase().includes('barril')
    );
  };

  const hasChopeira = (order: Order) => {
    return order.equipments.some(eq => 
      eq.type.toLowerCase().includes('chopeira')
    );
  };

  const hasValidAddress = (order: Order) => {
    const { street, city, neighborhood } = order.address;
    return !!(street || city || neighborhood);
  };

  const toggleExpand = (orderNumber: string) => {
    setExpandedOrder(expandedOrder === orderNumber ? null : orderNumber);
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
    <div className="absolute left-2 top-2 bottom-20 w-56 bg-card/95 backdrop-blur-sm border rounded-lg shadow-xl z-10 flex flex-col animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-xs">Pedidos do Dia</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {orders?.length || 0}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isFetching}
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

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground text-xs">
            Nenhum pedido para hoje
          </div>
        ) : (
          <div className="p-1.5 space-y-1">
            {orders.map((order) => {
              const isOrderExpanded = expandedOrder === order.order_number;
              const isSelected = selectedOrderNumber === order.order_number;
              const validAddress = hasValidAddress(order);

              return (
                <div
                  key={order.order_number}
                  className={cn(
                    "rounded-md border transition-all",
                    isSelected ? "bg-primary/10 border-primary/30" : "bg-background hover:bg-muted/50"
                  )}
                >
                  {/* Order Row */}
                  <div
                    className="flex items-center gap-1.5 p-1.5 cursor-pointer"
                    onClick={() => onOrderSelect?.(order)}
                  >
                    {/* Order Number */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-mono font-semibold text-xs">
                        #{order.order_number}
                      </span>
                      {!validAddress && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>

                    {/* Equipment Icons - Wine bottle for Growler, Cylinder for Barril, GlassWater for Chopeira */}
                    <div className="flex items-center gap-0.5 ml-auto">
                      <span title="Growler">
                        <Wine
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            hasGrowler(order) ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </span>
                      <span title="Barril">
                        <Cylinder
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            hasBarrel(order) ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </span>
                      <span title="Chopeira">
                        <GlassWater
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            hasChopeira(order) ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
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
                    <div className="px-2 pb-2 pt-1 border-t text-[10px] space-y-1">
                      <p className="font-medium text-foreground truncate">
                        {order.client_name}
                      </p>
                      <p className="text-muted-foreground">
                        {order.address.city || 'Cidade não informada'}
                        {order.address.neighborhood && `, ${order.address.neighborhood}`}
                      </p>
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
