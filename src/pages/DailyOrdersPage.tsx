import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEquipments } from '@/hooks/useEquipments';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getTodaySaoPaulo, extractTime } from '@/lib/date-utils';
import { DailyOrdersMapView } from '@/components/map/DailyOrdersMapView';
import { BeerBottleIcon, BeerBarrelIcon, BeerTapIcon } from '@/components/icons';
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Calendar,
  ShoppingCart,
  Beer,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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

interface OrderLocation {
  orderNumber: string;
  clientName: string;
  expectedDelivery?: string | null;
  lat: number;
  lng: number;
  isDelivered?: boolean;
}

// Simple geocoding function
async function geocodeAddress(address: Order['address']): Promise<{ lat: number; lng: number } | null> {
  const parts = [
    address.street,
    address.number,
    address.neighborhood,
    address.city,
    address.state,
    'Brasil',
  ].filter(Boolean);

  if (parts.length < 3) return null;

  const addressString = parts.join(', ');

  try {
    if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      
      return new Promise((resolve) => {
        geocoder.geocode({ address: addressString }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({ lat: location.lat(), lng: location.lng() });
          } else {
            resolve(null);
          }
        });
      });
    }
    return null;
  } catch {
    return null;
  }
}

export default function DailyOrdersPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => getTodaySaoPaulo());
  const [orderLocations, setOrderLocations] = useState<OrderLocation[]>([]);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  const { equipments } = useEquipments();

  const { data: orders, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['daily-orders', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-erp-orders', {
        body: { date: selectedDate },
      });

      if (error) throw error;
      return data as Order[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Helper functions for equipment detection
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

  const getBarrelBreakdown = (order: Order): { count: number; unitVolume: number }[] => {
    const barrelsBySize: Record<number, number> = {};
    
    order.equipments
      .filter(eq => eq.type.toLowerCase().includes('barril'))
      .forEach(eq => {
        const volumeMatch = eq.type.match(/(\d+)\s*[lL]/);
        if (volumeMatch) {
          const volume = parseInt(volumeMatch[1], 10);
          barrelsBySize[volume] = (barrelsBySize[volume] || 0) + eq.quantity;
        }
      });
    
    if (Object.keys(barrelsBySize).length > 0) {
      return Object.entries(barrelsBySize)
        .map(([volume, count]) => ({ count, unitVolume: parseInt(volume, 10) }))
        .sort((a, b) => b.unitVolume - a.unitVolume);
    }
    
    return [];
  };

  const formatBarrelDisplay = (order: Order): string => {
    const breakdown = getBarrelBreakdown(order);
    if (breakdown.length === 0) {
      const count = getBarrelCount(order);
      return count > 0 ? `${count}x` : '0x';
    }
    return breakdown.map(b => `${b.count}x${b.unitVolume}L`).join(' + ');
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

  // Filter counts
  const filterCounts = useMemo(() => {
    if (!orders) return { all: 0, growler: 0, barril: 0, chopeira: 0 };
    return {
      all: orders.length,
      growler: orders.filter(o => hasGrowler(o)).length,
      barril: orders.filter(o => hasBarrel(o)).length,
      chopeira: orders.filter(o => hasChopeira(o)).length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) =>
      order.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_number.includes(searchTerm)
    );
  }, [orders, searchTerm]);

  // Count equipments by status for the selected date
  const statusCounts = useMemo(() => {
    const todayEquipments = equipments.filter(eq => {
      const eqDate = eq.data_entrega?.split('T')[0];
      return eqDate === selectedDate;
    });
    
    return {
      delivered: todayEquipments.filter(eq => eq.status === 'ENTREGUE').length,
      ready: todayEquipments.filter(eq => eq.status === 'LIBERADO_PARA_RECOLHA').length,
      collected: todayEquipments.filter(eq => eq.status === 'RECOLHIDO').length,
    };
  }, [equipments, selectedDate]);

  // Get delivered order numbers
  const deliveredOrderNumbers = useMemo(() => {
    return new Set(equipments.map(e => e.pedido_dia));
  }, [equipments]);

  // Geocode orders for map
  const geocodeOrders = useCallback(async () => {
    if (!orders || orders.length === 0) return;
    if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) return;
    
    setIsGeocoding(true);
    const locations: OrderLocation[] = [];

    for (const order of orders) {
      const coords = await geocodeAddress(order.address);
      if (coords) {
        locations.push({
          orderNumber: order.order_number,
          clientName: order.client_name,
          expectedDelivery: order.expected_delivery,
          lat: coords.lat,
          lng: coords.lng,
          isDelivered: deliveredOrderNumbers.has(order.order_number),
        });
      }
    }

    setOrderLocations(locations);
    setIsGeocoding(false);
  }, [orders, deliveredOrderNumbers]);

  // Trigger geocoding when orders change
  useEffect(() => {
    if (orders && orders.length > 0) {
      // Wait for Google Maps to be ready
      const checkAndGeocode = () => {
        if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
          geocodeOrders();
        } else {
          setTimeout(checkAndGeocode, 500);
        }
      };
      checkAndGeocode();
    }
  }, [orders, geocodeOrders]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const formatAddress = (address: Order['address']) => {
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.number) parts.push(address.number);
    if (address.complement) parts.push(address.complement);
    if (address.neighborhood) parts.push(address.neighborhood);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    return parts.join(', ') || 'Endereço não informado';
  };

  const handleOrderClick = (orderNumber: string) => {
    setSelectedOrderNumber(orderNumber);
    // Scroll to the order in the list
    const element = document.getElementById(`order-${orderNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">Pedidos do Dia</h1>
            <p className="text-xs text-muted-foreground">
              {filteredOrders.length} pedido(s) encontrado(s)
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Date, Status Circles and Search */}
        <div className="flex gap-2 mt-3 items-center">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          
          {/* Status indicator circles with counters */}
          <div className="flex items-center gap-1.5">
            <div 
              className="w-7 h-7 rounded-full bg-status-delivered flex items-center justify-center"
              title="Entregue (aguardando recolha)"
            >
              <span className="text-[10px] font-bold text-white">{statusCounts.delivered}</span>
            </div>
            <div 
              className="w-7 h-7 rounded-full bg-status-ready flex items-center justify-center"
              title="Liberado para recolha"
            >
              <span className="text-[10px] font-bold text-white">{statusCounts.ready}</span>
            </div>
            <div 
              className="w-7 h-7 rounded-full bg-status-collected flex items-center justify-center"
              title="Recolhido"
            >
              <span className="text-[10px] font-bold text-white">{statusCounts.collected}</span>
            </div>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Equipment Filter Icons */}
        <div className="flex gap-2 mt-3 items-center">
          <span className="text-xs text-muted-foreground">Produtos:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs">
              <BeerBottleIcon className="w-4 h-4 text-primary" />
              <span className="font-semibold">{filterCounts.growler}</span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <BeerBarrelIcon className="w-4 h-4 text-primary" />
              <span className="font-semibold">{filterCounts.barril}</span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <BeerTapIcon className="w-4 h-4 text-primary" />
              <span className="font-semibold">{filterCounts.chopeira}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="p-4 pb-2">
        {isLoading || isGeocoding ? (
          <div className="h-[250px] flex items-center justify-center bg-muted rounded-lg">
            <LoadingSpinner text={isGeocoding ? 'Carregando localizações...' : 'Carregando...'} />
          </div>
        ) : (
          <DailyOrdersMapView
            locations={orderLocations}
            selectedOrderNumber={selectedOrderNumber}
            onOrderClick={handleOrderClick}
            height="250px"
          />
        )}
      </div>

      {/* Content */}
      <div className="p-4 pt-2 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-center text-destructive">
                Erro ao carregar pedidos: {(error as Error).message}
              </p>
              <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Nenhum pedido encontrado para esta data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-3">
            {filteredOrders.map((order) => {
              const orderHasGrowler = hasGrowler(order);
              const orderHasBarrel = hasBarrel(order);
              const orderHasChopeira = hasChopeira(order);
              const growlerCount = getGrowlerCount(order);
              const chopeiraCount = getChopeiraCount(order);
              const isOrderDelivered = deliveredOrderNumbers.has(order.order_number);

              return (
                <AccordionItem
                  key={order.order_number}
                  id={`order-${order.order_number}`}
                  value={order.order_number}
                  className={cn(
                    "border rounded-lg bg-card shadow-sm",
                    isOrderDelivered && "bg-status-ready/10 border-status-ready/30",
                    selectedOrderNumber === order.order_number && "ring-2 ring-primary"
                  )}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-start gap-3 text-left w-full">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "font-semibold",
                            isOrderDelivered && "text-status-ready"
                          )}>
                            #{order.order_number}
                            {isOrderDelivered && ' ✓'}
                          </span>
                          {order.expected_delivery && extractTime(order.expected_delivery) && (
                            <span className="text-xs text-muted-foreground">
                              {extractTime(order.expected_delivery)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {order.client_name}
                        </p>
                        {/* Equipment Icons Row */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="flex items-center gap-0.5">
                            <span className={cn(
                              "text-[10px] font-semibold",
                              orderHasGrowler ? "text-primary" : "text-muted-foreground/40"
                            )}>{growlerCount}x</span>
                            <BeerBottleIcon className={cn(
                              "w-4 h-4",
                              orderHasGrowler ? "text-primary" : "text-muted-foreground/30"
                            )} />
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className={cn(
                              "text-[10px] font-semibold whitespace-nowrap",
                              orderHasBarrel ? "text-primary" : "text-muted-foreground/40"
                            )}>
                              {formatBarrelDisplay(order)}
                            </span>
                            <BeerBarrelIcon className={cn(
                              "w-4 h-4 flex-shrink-0",
                              orderHasBarrel ? "text-primary" : "text-muted-foreground/30"
                            )} />
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className={cn(
                              "text-[10px] font-semibold",
                              orderHasChopeira ? "text-primary" : "text-muted-foreground/40"
                            )}>{chopeiraCount}x</span>
                            <BeerTapIcon className={cn(
                              "w-4 h-4",
                              orderHasChopeira ? "text-primary" : "text-muted-foreground/30"
                            )} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-2">
                      {/* Client Info */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <span>{order.client_name}</span>
                        </div>
                        {order.phone && (
                          <div className="flex items-start gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <a href={`tel:${order.phone}`} className="text-primary">
                              {order.phone}
                            </a>
                          </div>
                        )}
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground">
                            {formatAddress(order.address)}
                          </span>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>Entrega: {formatDate(order.expected_delivery)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>Retorno: {formatDate(order.expected_return)}</span>
                        </div>
                      </div>

                      {/* Items */}
                      {order.items.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">Itens</span>
                          </div>
                          <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>
                                  {item.quantity}x {item.product}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatCurrency(item.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Equipment */}
                      {order.equipments.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Beer className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">Equipamentos</span>
                          </div>
                          <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                            {order.equipments.map((eq, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{eq.type}</span>
                                <Badge variant="outline">{eq.quantity}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Observations */}
                      {order.observations && (
                        <div className="text-sm bg-muted/50 rounded-lg p-3">
                          <span className="font-medium">Obs:</span>{' '}
                          <span className="text-muted-foreground">{order.observations}</span>
                        </div>
                      )}

                      {/* Action */}
                      <Button
                        className="w-full"
                        onClick={() =>
                          navigate(`/new-delivery?order=${order.order_number}`)
                        }
                      >
                        Registrar Entrega
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
