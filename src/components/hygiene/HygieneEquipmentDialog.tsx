import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { HygieneEquipmentWithServices, HygieneEquipmentType, ChoperiaModelo } from '@/types/hygiene';
import { equipmentTypeLabels, choperaModeloLabels } from '@/types/hygiene';

interface HygieneEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: HygieneEquipmentWithServices | null;
  clientId: string;
  onSave: (data: Partial<HygieneEquipmentWithServices>) => Promise<void>;
}

export function HygieneEquipmentDialog({
  open,
  onOpenChange,
  equipment,
  clientId,
  onSave,
}: HygieneEquipmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo_equipamento: 'chopeira' as HygieneEquipmentType,
    modelo_chopeira: null as ChoperiaModelo | null,
    numero_serie: '',
  });

  useEffect(() => {
    if (equipment) {
      setFormData({
        tipo_equipamento: equipment.tipo_equipamento,
        modelo_chopeira: (equipment.modelo_chopeira as ChoperiaModelo) || null,
        numero_serie: equipment.numero_serie,
      });
    } else {
      setFormData({
        tipo_equipamento: 'chopeira',
        modelo_chopeira: null,
        numero_serie: '',
      });
    }
  }, [equipment, open]);

  const handleSubmit = async () => {
    if (!formData.numero_serie) return;
    // Require modelo for chopeira
    if (formData.tipo_equipamento === 'chopeira' && !formData.modelo_chopeira) return;

    setIsLoading(true);
    try {
      await onSave({
        client_id: clientId,
        tipo_equipamento: formData.tipo_equipamento,
        modelo_chopeira: formData.tipo_equipamento === 'chopeira' ? formData.modelo_chopeira : null,
        numero_serie: formData.numero_serie,
        ativo: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {equipment ? 'Editar Equipamento' : 'Novo Equipamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Equipamento</Label>
            <Select
              value={formData.tipo_equipamento}
              onValueChange={(value: HygieneEquipmentType) => 
                setFormData(prev => ({ 
                  ...prev, 
                  tipo_equipamento: value,
                  modelo_chopeira: value === 'chopeira' ? prev.modelo_chopeira : null
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(equipmentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modelo da Chopeira - only show when tipo is chopeira */}
          {formData.tipo_equipamento === 'chopeira' && (
            <div className="space-y-2">
              <Label>Modelo da Chopeira *</Label>
              <Select
                value={formData.modelo_chopeira || ''}
                onValueChange={(value: ChoperiaModelo) => 
                  setFormData(prev => ({ ...prev, modelo_chopeira: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(choperaModeloLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="numero_serie">Número de Série *</Label>
            <Input
              id="numero_serie"
              value={formData.numero_serie}
              onChange={(e) => setFormData(prev => ({ ...prev, numero_serie: e.target.value }))}
              placeholder="SN-12345"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.numero_serie || (formData.tipo_equipamento === 'chopeira' && !formData.modelo_chopeira)}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {equipment ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
