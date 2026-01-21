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
  Beer,
  Coffee,
  Droplets,
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
  const [isOpen, setIsOpen] = useState(true);
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

  if (!isOpen) {
    return (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="rounded-l-none rounded-r-lg shadow-lg h-20"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute left-0 top-0 bottom-0 w-64 bg-card/95 backdrop-blur-sm border-r shadow-xl z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Pedidos do Dia</h3>
          <Badge variant="secondary" className="text-xs">
            {orders?.length || 0}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhum pedido para hoje
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {orders.map((order) => {
              const isExpanded = expandedOrder === order.order_number;
              const isSelected = selectedOrderNumber === order.order_number;
              const validAddress = hasValidAddress(order);

              return (
                <div
                  key={order.order_number}
                  className={cn(
                    "rounded-lg border transition-all",
                    isSelected ? "bg-primary/10 border-primary/30" : "bg-background hover:bg-muted/50"
                  )}
                >
                  {/* Order Row */}
                  <div
                    className="flex items-center gap-2 p-2 cursor-pointer"
                    onClick={() => onOrderSelect?.(order)}
                  >
                    {/* Order Number */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-semibold text-sm">
                        #{order.order_number}
                      </span>
                      {!validAddress && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                    </div>

                    {/* Equipment Icons */}
                    <div className="flex items-center gap-1 ml-auto">
                      <span title="Growler">
                        <Droplets
                          className={cn(
                            "w-4 h-4 transition-colors",
                            hasGrowler(order) ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </span>
                      <span title="Barril">
                        <Beer
                          className={cn(
                            "w-4 h-4 transition-colors",
                            hasBarrel(order) ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </span>
                      <span title="Chopeira">
                        <Coffee
                          className={cn(
                            "w-4 h-4 transition-colors",
                            hasChopeira(order) ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </span>
                    </div>

                    {/* Expand Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(order.order_number);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t text-xs space-y-1.5">
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
