import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEquipments } from '@/hooks/useEquipments';
import { useAuth } from '@/hooks/useAuth';
import { recordEquipmentHistory, HISTORY_ACTIONS } from '@/hooks/useEquipmentHistory';
import { useDailyOrders, type DailyOrderData } from '@/hooks/useDailyOrders';
import { useDailyOrderLocations } from '@/hooks/useDailyOrderLocations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, MapPin, Camera, Calendar, User, Package, QrCode, Navigation, WifiOff, RefreshCw, Phone, Search, ChevronDown, Wine, Cylinder, GlassWater, AlertCircle, LocateFixed } from 'lucide-react';
import { QRCodeScanner } from '@/components/QRCodeScanner';
import { toast } from 'sonner';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import type { CollectionPeriod } from '@/types/database';
import { useGoogleMapsKey } from '@/hooks/useGoogleMapsKey';
import { GoogleMapsInlineSetup } from '@/components/map/GoogleMapsInlineSetup';
import { isOnline } from '@/lib/offline-storage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { DeliveryEquipmentReturnDialog } from '@/components/delivery/DeliveryEquipmentReturnDialog';

const mapContainerStyle = {
  width: '100%',
  height: '200px',
};

interface LocationState {
  orderData?: DailyOrderData;
  fromDailyOrders?: boolean;
  orderLocation?: { lat: number; lng: number };
}

export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const locationState = routerLocation.state as LocationState | undefined;
  const routeOrderNumber = locationState?.orderData?.order_number ?? null;
  const routeOrderLocation = locationState?.orderLocation ?? null;
  
  const { createEquipment } = useEquipments();
  const { user, profile } = useAuth();
  const { orders: dailyOrders, isLoading: ordersLoading, hasGrowler, hasBarrel, hasChopeira, needsCollectionDate, shouldAutoCollect } = useDailyOrders();
  const { getOrderLocation } = useDailyOrderLocations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DailyOrderData | null>(null);
  const [usingOrderLocation, setUsingOrderLocation] = useState(false);

  // Form state
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [pedidoDia, setPedidoDia] = useState('');
  const [periodoRecolha, setPeriodoRecolha] = useState<CollectionPeriod>('DIA_TODO');
  const [dataPrevistaRecolha, setDataPrevistaRecolha] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [clienteIraAvisar, setClienteIraAvisar] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [mapScriptError, setMapScriptError] = useState<Error | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [erpSearching, setErpSearching] = useState(false);
  const [equipmentReturnDialogOpen, setEquipmentReturnDialogOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{ orderNumber: string; clientName: string; clientId?: string | number } | null>(null);

  // Derived state: should collection date be disabled?
  const isCollectionDisabled = selectedOrder ? !needsCollectionDate(selectedOrder) : false;
  const willAutoCollect = selectedOrder ? shouldAutoCollect(selectedOrder) : false;

  const { apiKey, hasApiKey, saveApiKey, clearApiKey } = useGoogleMapsKey();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent re-processing route state when hooks update (e.g., geocoding finishes)
  const routePrefillOrderRef = useRef<string | null>(null);
  const routeLocationToastShownRef = useRef(false);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pre-fill form if coming from daily orders (run once per order number)
  useEffect(() => {
    if (!routeOrderNumber || !locationState?.orderData) return;

    if (routePrefillOrderRef.current === routeOrderNumber) return;
    routePrefillOrderRef.current = routeOrderNumber;
    routeLocationToastShownRef.current = false;

    const order = locationState.orderData;
    setSelectedOrder(order);
    setPedidoDia(order.order_number);
    setNomeCliente(order.client_name);
    if (order.phone) setTelefoneCliente(order.phone);
    if (order.expected_return) {
      const returnDate = new Date(order.expected_return);
      if (!isNaN(returnDate.getTime())) {
        setDataPrevistaRecolha(returnDate.toISOString().split('T')[0]);
      }
    }
    if (order.observations) setObservacoes(order.observations);

    // If order only has growler/barril (no chopeira), disable collection date
    // (Intentionally not depending on shouldAutoCollect to avoid effect loops)
    if (shouldAutoCollect(order)) {
      setClienteIraAvisar(false);
    }

    // Prefer route-provided location (from map click) to avoid waiting for geocoding
    if (routeOrderLocation) {
      setGpsLocation(routeOrderLocation);
      setUsingOrderLocation(true);
      toast.success('Localização do pedido carregada!');
      routeLocationToastShownRef.current = true;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOrderNumber]);

  // If we didn't receive coordinates via route, try to use the geocoded order location (once)
  useEffect(() => {
    if (!routeOrderNumber) return;
    if (routeLocationToastShownRef.current) return;

    const orderLoc = getOrderLocation(routeOrderNumber);
    if (orderLoc) {
      setGpsLocation(orderLoc);
      setUsingOrderLocation(true);
      toast.success('Localização do pedido carregada!');
      routeLocationToastShownRef.current = true;
    }
  }, [routeOrderNumber, getOrderLocation]);

  // Get current location via GPS
  const getGPSLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS não suportado neste dispositivo');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsLoading(false);
        toast.success('Localização obtida com sucesso!');
      },
      (error) => {
        console.error('Error getting location:', error);
        setGpsLoading(false);
        let errorMsg = 'Não foi possível obter sua localização';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Permissão de localização negada';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Localização indisponível';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Tempo esgotado ao obter localização';
        }
        setGpsError(errorMsg);
        toast.error(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Get current location on mount (skip when we opened from a daily order)
  useEffect(() => {
    if (routeOrderNumber) return;
    getGPSLocation();
  }, [getGPSLocation, routeOrderNumber]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setGpsLocation({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  };

  // Select order from daily orders
  const handleSelectDailyOrder = (order: DailyOrderData) => {
    setSelectedOrder(order);
    setPedidoDia(order.order_number);
    setNomeCliente(order.client_name);
    if (order.phone) setTelefoneCliente(order.phone);
    if (order.expected_return) {
      const returnDate = new Date(order.expected_return);
      if (!isNaN(returnDate.getTime())) {
        setDataPrevistaRecolha(returnDate.toISOString().split('T')[0]);
      }
    }
    if (order.observations) setObservacoes(order.observations);
    setOrderSearchOpen(false);
    
    // Try to use order's geocoded location
    const orderLoc = getOrderLocation(order.order_number);
    if (orderLoc) {
      setGpsLocation(orderLoc);
      setUsingOrderLocation(true);
      toast.success('Dados e localização do pedido carregados!');
    } else {
      toast.success('Dados do pedido carregados!');
    }
  };

  // Switch to driver's GPS location
  const useDriverLocation = useCallback(() => {
    setUsingOrderLocation(false);
    getGPSLocation();
  }, [getGPSLocation]);

  // Geocode address using Google Maps API
  // Supports incomplete addresses - will geocode with just city/state if no street
  const geocodeAddress = useCallback(async (addressDetails: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }): Promise<{ lat: number; lng: number } | null> => {
    const parts = [
      addressDetails.street,
      addressDetails.number,
      addressDetails.neighborhood,
      addressDetails.city,
      addressDetails.state,
      'Brasil',
    ].filter(Boolean);

    // Require at least city or state for a meaningful geocode
    const hasMinimumAddress = addressDetails.city || addressDetails.state;
    if (!hasMinimumAddress || parts.length < 2) return null;

    const addressString = parts.join(', ');

    try {
      if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        
        return new Promise((resolve) => {
          geocoder.geocode({ address: addressString }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location;
              console.log(`Geocoded "${addressString}" -> (${location.lat()}, ${location.lng()})`);
              resolve({ lat: location.lat(), lng: location.lng() });
            } else {
              console.warn(`Geocoding failed for "${addressString}": ${status}`);
              resolve(null);
            }
          });
        });
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  }, []);

  // Search order in ERP
  const searchOrderInERP = async () => {
    if (!pedidoDia.trim()) {
      toast.error('Digite o número do pedido');
      return;
    }

    if (!online) {
      toast.error('Busca no ERP requer conexão com a internet');
      return;
    }

    setErpSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-erp-order', {
        body: { orderNumber: pedidoDia.trim() }
      });

      if (error) {
        console.error('ERP search error:', error);
        toast.error('Erro ao buscar pedido no ERP');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Fill form with ERP data
      if (data.customer_name) {
        setNomeCliente(data.customer_name);
      }
      if (data.phone) {
        setTelefoneCliente(data.phone);
      }
      if (data.pickup_date) {
        // Convert to YYYY-MM-DD format
        const pickupDate = new Date(data.pickup_date);
        if (!isNaN(pickupDate.getTime())) {
          setDataPrevistaRecolha(pickupDate.toISOString().split('T')[0]);
        }
      }
      if (data.observations) {
        setObservacoes(data.observations);
      }

      // Geocode the address from ERP data
      // The proxy returns address_details with street, number, neighborhood, city, state
      const addressDetails = data.address_details;
      if (addressDetails && (addressDetails.street || addressDetails.city)) {
        console.log('Attempting to geocode address from ERP:', addressDetails);
        const coords = await geocodeAddress(addressDetails);
        if (coords) {
          setGpsLocation(coords);
          setUsingOrderLocation(true);
          toast.success('Dados e localização do pedido carregados do ERP!');
        } else {
          // Fallback to GPS if geocoding fails
          toast.success('Dados do pedido carregados! Localização será obtida via GPS.');
          getGPSLocation();
        }
      } else {
        toast.success('Dados do pedido carregados do ERP!');
        // No address, fallback to GPS
        if (!gpsLocation) {
          getGPSLocation();
        }
      }
    } catch (err) {
      console.error('Error searching ERP:', err);
      toast.error('Erro ao conectar com o ERP');
    } finally {
      setErpSearching(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If client will notify, date and period are not required
    if (!nomeCliente || !pedidoDia || !gpsLocation) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Only require date if collection is enabled and not auto-collect
    if (!isCollectionDisabled && !willAutoCollect && !clienteIraAvisar && !dataPrevistaRecolha) {
      toast.error('Preencha a data prevista ou marque "Cliente irá avisar"');
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine the status and date based on equipment type
      let finalStatus: 'ENTREGUE' | 'LIBERADO_PARA_RECOLHA' | 'RECOLHIDO' = 'ENTREGUE';
      let finalPeriodo: CollectionPeriod = periodoRecolha;
      let finalDataRecolha = dataPrevistaRecolha;

      if (willAutoCollect) {
        // Growler/Barril without Chopeira: mark as RECOLHIDO immediately
        finalStatus = 'RECOLHIDO';
        finalPeriodo = 'DIA_TODO';
        finalDataRecolha = new Date().toISOString().split('T')[0]; // Today
      } else if (clienteIraAvisar) {
        finalPeriodo = 'CLIENTE_IRA_AVISAR';
        finalDataRecolha = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      await createEquipment({
        nome_cliente: nomeCliente,
        telefone_cliente: telefoneCliente || null,
        pedido_dia: pedidoDia,
        periodo_recolha: finalPeriodo,
        data_prevista_recolha: finalDataRecolha || new Date().toISOString().split('T')[0],
        observacoes: observacoes || null,
        foto_local_path: photo || null,
        foto_url: null,
        latitude: gpsLocation.lat,
        longitude: gpsLocation.lng,
        cliente_ira_avisar: clienteIraAvisar && !willAutoCollect,
        ...(willAutoCollect && { status: 'RECOLHIDO' as const }),
      });

      // Record equipment history for each equipment with patrimony
      if (user && selectedOrder?.equipments) {
        const userName = profile?.name || user.email || 'Usuário';
        for (const eq of selectedOrder.equipments) {
          if (eq.patrimony) {
            recordEquipmentHistory({
              userId: user.id,
              userName,
              patrimony: eq.patrimony,
              clientName: nomeCliente,
              clientId: selectedOrder.client_id?.toString(),
              actionType: HISTORY_ACTIONS.ENTREGA,
              orderNumber: pedidoDia,
            });
          }
        }
      }

      // Update ERP status to ENTREGUE (ID 4) - fire and forget, don't block
      if (online) {
        supabase.functions.invoke('update-erp-order-status', {
          body: { orderNumber: pedidoDia.trim(), statusId: 4 }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Failed to update ERP status:', error);
          } else {
            console.log('ERP status updated:', data);
          }
        }).catch(err => {
          console.error('Error calling update-erp-order-status:', err);
        });
      }

      // Check if we should show the equipment return dialog
      if (online && selectedOrder?.client_id) {
        setPendingOrderData({
          orderNumber: pedidoDia,
          clientName: nomeCliente,
          clientId: selectedOrder.client_id,
        });
        setEquipmentReturnDialogOpen(true);
        setIsSubmitting(false);
      } else {
        // No client ID or offline, navigate directly
        setTimeout(() => {
          navigate('/');
        }, 100);
      }
    } catch (error) {
      console.error('Error creating delivery:', error);
      setIsSubmitting(false);
    }
  };

  const handleEquipmentReturnComplete = () => {
    setPendingOrderData(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Nova Entrega</h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomeCliente">Nome do Cliente *</Label>
              <Input
                id="nomeCliente"
                placeholder="Nome do cliente"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefoneCliente" className="flex items-center gap-2">
                <Phone className="w-3 h-3" />
                Telefone do Cliente
                {clienteIraAvisar && <span className="text-xs text-status-waiting">(recomendado)</span>}
              </Label>
              <Input
                id="telefoneCliente"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(e.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Para enviar link de confirmação via WhatsApp
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pedidoDia">Número do Pedido *</Label>
              <div className="flex gap-2">
                {/* Order number with daily orders dropdown */}
                <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={orderSearchOpen}
                      className="h-12 flex-1 justify-between font-normal"
                    >
                      {pedidoDia || "Selecionar ou digitar pedido..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar pedido..." 
                        value={pedidoDia}
                        onValueChange={setPedidoDia}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {ordersLoading ? (
                            <div className="flex justify-center py-4">
                              <LoadingSpinner size="sm" />
                            </div>
                          ) : (
                            <span>Nenhum pedido encontrado</span>
                          )}
                        </CommandEmpty>
                        {dailyOrders.length > 0 && (
                          <CommandGroup heading="Pedidos do Dia">
                            {dailyOrders.map((order) => (
                              <CommandItem
                                key={order.order_number}
                                value={`${order.order_number} ${order.client_name}`}
                                onSelect={() => handleSelectDailyOrder(order)}
                                className="flex items-center gap-2"
                              >
                                <span className="font-mono font-semibold">#{order.order_number}</span>
                                <span className="text-sm text-muted-foreground truncate flex-1">
                                  {order.client_name}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <Wine className={cn("w-3 h-3", hasGrowler(order) ? "text-primary" : "text-muted-foreground/30")} />
                                  <Cylinder className={cn("w-3 h-3", hasBarrel(order) ? "text-primary" : "text-muted-foreground/30")} />
                                  <GlassWater className={cn("w-3 h-3", hasChopeira(order) ? "text-primary" : "text-muted-foreground/30")} />
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => setQrScannerOpen(true)}
                  title="Escanear QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </Button>
              </div>

              {/* Selected order info */}
              {selectedOrder && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-xs">
                  <div className="flex items-center gap-1">
                    <Wine className={cn("w-3 h-3", hasGrowler(selectedOrder) ? "text-primary" : "text-muted-foreground/30")} />
                    <Cylinder className={cn("w-3 h-3", hasBarrel(selectedOrder) ? "text-primary" : "text-muted-foreground/30")} />
                    <GlassWater className={cn("w-3 h-3", hasChopeira(selectedOrder) ? "text-primary" : "text-muted-foreground/30")} />
                  </div>
                  {willAutoCollect && (
                    <span className="text-status-collected flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Será marcado como recolhido
                    </span>
                  )}
                </div>
              )}

              {/* Equipment checklist for verification */}
              {selectedOrder && selectedOrder.equipments.length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Equipamentos para Conferência
                  </p>
                  <div className="space-y-1.5">
                    {selectedOrder.equipments.map((eq, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-background/80 rounded px-2 py-1.5">
                        <Checkbox id={`eq-check-${idx}`} className="w-4 h-4" />
                        <label htmlFor={`eq-check-${idx}`} className="flex-1 cursor-pointer">
                          <span className="font-medium">{eq.quantity}x {eq.type}</span>
                          {eq.patrimony && (
                            <span className="ml-2 text-muted-foreground">Pat: {eq.patrimony}</span>
                          )}
                          {eq.patrimony && eq.model && (
                            <span className="ml-1 text-muted-foreground/70">• {eq.model}</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* ERP Search Button */}
              {online && !selectedOrder && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-10"
                  onClick={searchOrderInERP}
                  disabled={erpSearching || !pedidoDia.trim()}
                >
                  {erpSearching ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Buscar no ERP
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recolha - only show if not auto-collect */}
        {!willAutoCollect && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Previsão de Recolha
                {isCollectionDisabled && (
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    (Não aplicável para este pedido)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cliente irá avisar checkbox */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border",
                isCollectionDisabled ? "opacity-50 pointer-events-none bg-muted" : "bg-status-waiting/10 border-status-waiting/30"
              )}>
                <Checkbox
                  id="clienteIraAvisar"
                  checked={clienteIraAvisar}
                  onCheckedChange={(checked) => setClienteIraAvisar(checked === true)}
                  disabled={isCollectionDisabled}
                />
                <Label 
                  htmlFor="clienteIraAvisar" 
                  className={cn(
                    "text-sm font-medium cursor-pointer",
                    isCollectionDisabled ? "text-muted-foreground" : "text-status-waiting"
                  )}
                >
                  Cliente irá avisar
                </Label>
              </div>

              <div className={cn("space-y-2", (clienteIraAvisar || isCollectionDisabled) && "opacity-50 pointer-events-none")}>
                <Label htmlFor="dataPrevistaRecolha">Data Prevista {!clienteIraAvisar && !isCollectionDisabled && '*'}</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="dataPrevistaRecolha"
                    type="date"
                    value={dataPrevistaRecolha}
                    onChange={(e) => setDataPrevistaRecolha(e.target.value)}
                    className="h-12 pl-10"
                    disabled={clienteIraAvisar || isCollectionDisabled}
                  />
                </div>
              </div>

              <div className={cn("space-y-2", (clienteIraAvisar || isCollectionDisabled) && "opacity-50 pointer-events-none")}>
                <Label>Período {!clienteIraAvisar && !isCollectionDisabled && '*'}</Label>
                <Select
                  value={periodoRecolha}
                  onValueChange={(v) => setPeriodoRecolha(v as CollectionPeriod)}
                  disabled={clienteIraAvisar || isCollectionDisabled}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIA_TODO">Dia Todo</SelectItem>
                    <SelectItem value="MANHA">Manhã</SelectItem>
                    <SelectItem value="TARDE">Tarde</SelectItem>
                    <SelectItem value="NOITE">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-collect notice */}
        {willAutoCollect && (
          <Card className="border-status-collected/30 bg-status-collected/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-status-collected">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium text-sm">Pedido apenas com Growler/Barril</p>
                  <p className="text-xs text-muted-foreground">
                    Este pedido será marcado como recolhido automaticamente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Localização */}
        <Card>
          <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Localização
              {!online && (
                <span className="flex items-center gap-1 text-xs font-normal text-status-waiting ml-auto">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location Source Toggle (when order location is available) */}
            {selectedOrder && getOrderLocation(selectedOrder.order_number) && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={usingOrderLocation ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const orderLoc = getOrderLocation(selectedOrder.order_number);
                    if (orderLoc) {
                      setGpsLocation(orderLoc);
                      setUsingOrderLocation(true);
                    }
                  }}
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  Endereço do Pedido
                </Button>
                <Button
                  type="button"
                  variant={!usingOrderLocation ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={useDriverLocation}
                >
                  <LocateFixed className="w-3 h-3 mr-1" />
                  Localização Atual
                </Button>
              </div>
            )}

            {/* GPS Location Display (always shown) */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {usingOrderLocation ? (
                    <MapPin className="w-4 h-4 text-primary" />
                  ) : (
                    <Navigation className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">
                    {usingOrderLocation ? 'Localização do Pedido' : 'Localização GPS'}
                  </span>
                </div>
                {!usingOrderLocation && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={getGPSLocation}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Atualizar
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {gpsError && !usingOrderLocation ? (
                <p className="text-sm text-destructive">{gpsError}</p>
              ) : gpsLocation ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Lat: {gpsLocation.lat.toFixed(6)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lng: {gpsLocation.lng.toFixed(6)}
                  </p>
                  <p className="text-xs text-status-ready mt-2">
                    ✓ {usingOrderLocation ? 'Usando endereço do pedido' : 'Localização capturada'}
                  </p>
                </div>
              ) : gpsLoading ? (
                <p className="text-sm text-muted-foreground">Obtendo localização...</p>
              ) : (
                <p className="text-sm text-muted-foreground">Localização não disponível</p>
              )}
            </div>

            {/* Map (only shown when online) */}
            {online && (
              <div className="rounded-lg overflow-hidden border">
                {mapScriptError ? (
                  <div className="h-[200px] flex flex-col items-center justify-center bg-muted p-3 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Erro ao carregar mapa</p>
                    <p className="text-xs text-muted-foreground mb-3">{mapScriptError.message}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setMapScriptError(null)}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <LoadScript
                    key={apiKey}
                    id="google-map-script"
                    googleMapsApiKey={apiKey}
                    language="pt-BR"
                    region="BR"
                    onError={(err) => setMapScriptError(err)}
                    loadingElement={
                      <div className="h-[200px] flex items-center justify-center bg-muted">
                        <LoadingSpinner text="Carregando mapa..." />
                      </div>
                    }
                  >
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={gpsLocation || { lat: -23.5505, lng: -46.6333 }}
                      zoom={16}
                      onClick={handleMapClick}
                      options={{
                        disableDefaultUI: true,
                        zoomControl: true,
                        gestureHandling: 'greedy',
                      }}
                    >
                      {gpsLocation && <Marker position={gpsLocation} />}
                    </GoogleMap>
                  </LoadScript>
                )}
              </div>
            )}

            {online && !mapScriptError && (
              <p className="text-xs text-muted-foreground">Toque no mapa para ajustar a localização</p>
            )}

            {!online && (
              <p className="text-xs text-muted-foreground text-center">
                Mapa indisponível offline. A localização GPS será usada.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Foto e Observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto e Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Foto do Local (opcional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
              {photo ? (
                <div className="relative">
                  <img
                    src={photo}
                    alt="Foto do local"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="w-6 h-6" />
                    <span>Tirar foto</span>
                  </div>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-14 text-base font-semibold bg-gradient-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <LoadingSpinner size="sm" />
          ) : willAutoCollect ? (
            'Registrar Entrega (Recolhido)'
          ) : (
            'Registrar Entrega'
          )}
        </Button>
      </form>

      {/* QR Code Scanner Modal */}
      <QRCodeScanner
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScan={(result) => {
          setPedidoDia(result);
          // Try to find the order in daily orders
          const found = dailyOrders.find(o => o.order_number === result);
          if (found) {
            handleSelectDailyOrder(found);
          }
        }}
      />

      {/* Equipment Return Dialog - shown after delivery is registered */}
      {pendingOrderData && (
        <DeliveryEquipmentReturnDialog
          open={equipmentReturnDialogOpen}
          onOpenChange={setEquipmentReturnDialogOpen}
          orderNumber={pendingOrderData.orderNumber}
          clientName={pendingOrderData.clientName}
          clientId={pendingOrderData.clientId}
          onComplete={handleEquipmentReturnComplete}
        />
      )}
    </div>
  );
}
