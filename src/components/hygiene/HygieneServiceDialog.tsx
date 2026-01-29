import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Droplets, RefreshCw, Camera } from 'lucide-react';
import type { HygieneEquipmentWithServices, HygieneServiceType } from '@/types/hygiene';
import { equipmentTypeLabels } from '@/types/hygiene';

interface HygieneServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: HygieneEquipmentWithServices | null;
  clientName: string;
  onSave: (data: {
    equipment_id: string;
    tipo_servico: HygieneServiceType;
    data_servico: string;
    foto_url: string | null;
    observacoes: string | null;
    motivo_troca: string | null;
    novo_numero_serie: string | null;
    executado_por_user_id: string;
  }) => Promise<void>;
}

export function HygieneServiceDialog({
  open,
  onOpenChange,
  equipment,
  clientName,
  onSave,
}: HygieneServiceDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<{
    tipo_servico: HygieneServiceType;
    observacoes: string;
    motivo_troca: string;
    novo_numero_serie: string;
    foto_url: string;
  }>({
    tipo_servico: 'limpeza',
    observacoes: '',
    motivo_troca: '',
    novo_numero_serie: '',
    foto_url: '',
  });

  const handleSubmit = async () => {
    if (!equipment || !user) return;

    setIsLoading(true);
    try {
      await onSave({
        equipment_id: equipment.id,
        tipo_servico: formData.tipo_servico,
        data_servico: new Date().toISOString(),
        foto_url: formData.foto_url || null,
        observacoes: formData.observacoes || null,
        motivo_troca: formData.tipo_servico === 'troca' ? formData.motivo_troca || null : null,
        novo_numero_serie: formData.tipo_servico === 'troca' ? formData.novo_numero_serie || null : null,
        executado_por_user_id: user.id,
      });
      
      // Reset form
      setFormData({
        tipo_servico: 'limpeza',
        observacoes: '',
        motivo_troca: '',
        novo_numero_serie: '',
        foto_url: '',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoCapture = async () => {
    // For now, just show a placeholder - in production this would use camera
    // Could integrate with Supabase Storage for photo upload
    console.log('Photo capture not implemented yet');
  };

  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client and Equipment Info */}
          <div className="bg-secondary/50 rounded-lg p-3 text-sm">
            <p className="font-medium">{clientName}</p>
            <p className="text-muted-foreground">
              {equipmentTypeLabels[equipment.tipo_equipamento]} - {equipment.numero_serie}
            </p>
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <Label>Tipo de Serviço</Label>
            <RadioGroup
              value={formData.tipo_servico}
              onValueChange={(value: HygieneServiceType) =>
                setFormData(prev => ({ ...prev, tipo_servico: value }))
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="limpeza" id="limpeza" />
                <Label htmlFor="limpeza" className="flex items-center gap-1 cursor-pointer">
                  <Droplets className="w-4 h-4 text-primary" />
                  Limpeza
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="troca" id="troca" />
                <Label htmlFor="troca" className="flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="w-4 h-4 text-primary" />
                  Troca
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Replacement-specific fields */}
          {formData.tipo_servico === 'troca' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="motivo_troca">Motivo da Troca</Label>
                <Textarea
                  id="motivo_troca"
                  value={formData.motivo_troca}
                  onChange={(e) => setFormData(prev => ({ ...prev, motivo_troca: e.target.value }))}
                  placeholder="Descreva o motivo da troca..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="novo_numero_serie">Novo Número de Série *</Label>
                <Input
                  id="novo_numero_serie"
                  value={formData.novo_numero_serie}
                  onChange={(e) => setFormData(prev => ({ ...prev, novo_numero_serie: e.target.value }))}
                  placeholder="SN-NOVO-12345"
                />
              </div>
            </>
          )}

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações sobre o serviço..."
              rows={3}
            />
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <Label>Foto do Serviço</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handlePhotoCapture}
            >
              <Camera className="w-4 h-4 mr-2" />
              Tirar Foto
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              (formData.tipo_servico === 'troca' && !formData.novo_numero_serie)
            }
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
