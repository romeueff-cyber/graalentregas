import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Wine, Cylinder, GlassWater, MapPin, Phone, Plus, Navigation, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoletoDialog } from './BoletoDialog';

interface OrderItem {
  product: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OrderEquipment {
  type: string;
  description: string | null;
  patrimony: string | null;
  model: string | null;
  quantity: number;
}

interface Order {
  order_number: string;
  client_name: string;
  phone: string | null;
  expected_delivery: string | null;
  expected_return: string | null;
  observations: string | null;
  erp_status: string | null;
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

interface DailyOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegisterDelivery: (order: Order) => void;
  position?: { lat: number; lng: number } | null;
}

export function DailyOrderDialog({
  order,
  open,
  onOpenChange,
  onRegisterDelivery,
  position,
}: DailyOrderDialogProps) {
  const [boletoDialogOpen, setBoletoDialogOpen] = useState(false);

  if (!order) return null;

  const hasGrowler = order.items.some(item => 
    item.product.toLowerCase().includes('growler')
  );
  
  const hasBarrel = order.equipments.some(eq => 
    eq.type.toLowerCase().includes('barril')
  );
  
  const hasChopeira = order.equipments.some(eq => 
    eq.type.toLowerCase().includes('chopeira')
  );

  const formatAddress = () => {
    const parts = [
      order.address.street,
      order.address.number,
      order.address.complement,
      order.address.neighborhood,
      order.address.city,
      order.address.state,
    ].filter(Boolean);
    return parts.join(', ') || 'Endereço não informado';
  };

  const handleNavigate = () => {
    if (position) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleRegister = () => {
    onRegisterDelivery(order);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">#{order.order_number}</span>
            <div className="flex items-center gap-1 ml-auto">
              <Wine className={cn("w-4 h-4", hasGrowler ? "text-primary" : "text-muted-foreground/30")} />
              <Cylinder className={cn("w-4 h-4", hasBarrel ? "text-primary" : "text-muted-foreground/30")} />
              <GlassWater className={cn("w-4 h-4", hasChopeira ? "text-primary" : "text-muted-foreground/30")} />
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Info */}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-lg">{order.client_name}</p>
              {order.erp_status && (
                <Badge variant="outline" className="text-xs">
                  {order.erp_status}
                </Badge>
              )}
            </div>
            {order.phone && (
              <a
                href={`tel:${order.phone}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <Phone className="w-3 h-3" />
                {order.phone}
              </a>
            )}
          </div>

          {/* Address */}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">{formatAddress()}</p>
          </div>

          {/* Items */}
          {order.items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Produtos</p>
              <div className="space-y-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.product}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {order.equipments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Equipamentos</p>
              <div className="space-y-2">
                {order.equipments.map((eq, idx) => (
                  <div key={idx} className="bg-muted/50 rounded-md p-2 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {eq.quantity}x {eq.type}
                      </Badge>
                      {eq.patrimony && (
                        <Badge variant="outline" className="text-xs font-mono">
                          Pat: {eq.patrimony}
                        </Badge>
                      )}
                    </div>
                    {(eq.description || eq.model) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {eq.description}{eq.description && eq.model ? ' • ' : ''}{eq.model}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {order.observations && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{order.observations}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              {position && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleNavigate}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Navegar
                </Button>
              )}
              <Button
                className="flex-1 bg-gradient-primary"
                onClick={handleRegister}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Entrega
              </Button>
            </div>
            
            {/* Boleto Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setBoletoDialogOpen(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Gerar Boleto
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Boleto Dialog */}
      <BoletoDialog
        order={order}
        open={boletoDialogOpen}
        onOpenChange={setBoletoDialogOpen}
      />
    </Dialog>
  );
}
