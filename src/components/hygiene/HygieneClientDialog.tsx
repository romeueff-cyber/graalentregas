import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEquipments } from '@/hooks/useEquipments';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Search, Loader2 } from 'lucide-react';
import type { HygieneClientWithEquipments } from '@/types/hygiene';

interface HygieneClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: HygieneClientWithEquipments | null;
  onSave: (data: Partial<HygieneClientWithEquipments>) => Promise<void>;
}

export function HygieneClientDialog({
  open,
  onOpenChange,
  client,
  onSave,
}: HygieneClientDialogProps) {
  const { user } = useAuth();
  const { equipments } = useEquipments();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);

  const [formData, setFormData] = useState({
    nome_cliente: '',
    telefone_cliente: '',
    endereco: '',
    latitude: 0,
    longitude: 0,
    intervalo_limpeza_dias: 30,
    observacoes: '',
  });

  // Unique client names from equipments for auto-fill
  const existingClients = [...new Set(equipments.map(e => e.nome_cliente))].sort();

  useEffect(() => {
    if (client) {
      setFormData({
        nome_cliente: client.nome_cliente,
        telefone_cliente: client.telefone_cliente || '',
        endereco: client.endereco,
        latitude: client.latitude,
        longitude: client.longitude,
        intervalo_limpeza_dias: client.intervalo_limpeza_dias,
        observacoes: client.observacoes || '',
      });
    } else {
      setFormData({
        nome_cliente: '',
        telefone_cliente: '',
        endereco: '',
        latitude: 0,
        longitude: 0,
        intervalo_limpeza_dias: 30,
        observacoes: '',
      });
    }
  }, [client, open]);

  const handleSelectExisting = async (clientName: string) => {
    const existing = equipments.find(e => e.nome_cliente === clientName);
    if (existing) {
      // Try reverse geocoding to get address from coordinates
      let address = '';
      if (existing.latitude && existing.longitude && window.google?.maps) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          const result = await new Promise<string>((resolve) => {
            geocoder.geocode(
              { location: { lat: existing.latitude, lng: existing.longitude } },
              (results, status) => {
                if (status === 'OK' && results?.[0]) {
                  resolve(results[0].formatted_address);
                } else {
                  resolve('');
                }
              }
            );
          });
          address = result;
        } catch (error) {
          console.error('Reverse geocoding error:', error);
        }
      }
      
      setFormData(prev => ({
        ...prev,
        nome_cliente: existing.nome_cliente,
        telefone_cliente: existing.telefone_cliente || '',
        endereco: address || prev.endereco,
        latitude: existing.latitude,
        longitude: existing.longitude,
      }));
    }
  };

  const handleSearchAddress = async () => {
    if (!formData.endereco || !window.google?.maps) {
      return;
    }
    
    setIsGeolocating(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      
      // Try with Brazil region bias for better results
      const searchQuery = formData.endereco.includes('Brasil') || formData.endereco.includes('Brazil')
        ? formData.endereco
        : `${formData.endereco}, Brasil`;
      
      const result = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
        geocoder.geocode(
          { 
            address: searchQuery,
            region: 'br',
            componentRestrictions: { country: 'BR' }
          },
          (results, status) => {
            if (status === 'OK' && results?.[0]) {
              resolve(results[0]);
            } else {
              // Fallback: try without country restriction for CEP/postal codes
              geocoder.geocode(
                { address: searchQuery, region: 'br' },
                (fallbackResults, fallbackStatus) => {
                  if (fallbackStatus === 'OK' && fallbackResults?.[0]) {
                    resolve(fallbackResults[0]);
                  } else {
                    resolve(null);
                  }
                }
              );
            }
          }
        );
      });
      
      if (result) {
        setFormData(prev => ({
          ...prev,
          latitude: result.geometry.location.lat(),
          longitude: result.geometry.location.lng(),
          endereco: result.formatted_address,
        }));
      } else {
        console.warn('Endereço não encontrado:', formData.endereco);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeolocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome_cliente || !formData.endereco || !formData.latitude) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        ...formData,
        telefone_cliente: formData.telefone_cliente || null,
        observacoes: formData.observacoes || null,
        created_by_user_id: user?.id,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? 'Editar Cliente' : 'Novo Cliente de Higienização'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Auto-fill from existing delivery */}
          {!client && existingClients.length > 0 && (
            <div className="space-y-2">
              <Label>Importar de entrega existente</Label>
              <Select onValueChange={handleSelectExisting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {existingClients.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nome_cliente">Nome do Cliente *</Label>
            <Input
              id="nome_cliente"
              value={formData.nome_cliente}
              onChange={(e) => setFormData(prev => ({ ...prev, nome_cliente: e.target.value }))}
              placeholder="Bar do João"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone_cliente">Telefone</Label>
            <Input
              id="telefone_cliente"
              value={formData.telefone_cliente}
              onChange={(e) => setFormData(prev => ({ ...prev, telefone_cliente: e.target.value }))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço *</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
              placeholder="Rua das Flores, 123 - Centro"
            />
          </div>

          {/* Location Search */}
          <div className="space-y-2">
            <Label>Buscar Localização *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSearchAddress}
                disabled={isGeolocating || !formData.endereco}
              >
                {isGeolocating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Buscar pelo Endereço
              </Button>
            </div>
            {formData.latitude !== 0 && (
              <p className="text-xs text-success flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Localização encontrada
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="intervalo">Intervalo de Limpeza (dias)</Label>
            <Input
              id="intervalo"
              type="number"
              min={1}
              value={formData.intervalo_limpeza_dias}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                intervalo_limpeza_dias: parseInt(e.target.value) || 30 
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.nome_cliente || !formData.endereco || formData.latitude === 0}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {client ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
