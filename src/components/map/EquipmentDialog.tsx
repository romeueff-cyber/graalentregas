import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PeriodBadge } from '@/components/ui/period-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Navigation, ExternalLink, CheckCircle2, MapPin, User, Calendar } from 'lucide-react';
import type { EquipmentWithCreator } from '@/types/database';

interface EquipmentDialogProps {
  equipment: EquipmentWithCreator | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCollection?: (equipment: EquipmentWithCreator) => Promise<void>;
}

export function EquipmentDialog({
  equipment,
  open,
  onOpenChange,
  onConfirmCollection,
}: EquipmentDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!equipment) return null;

  const openRoute = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${equipment.latitude},${equipment.longitude}`;
    window.open(url, '_blank');
  };

  const handleConfirm = async () => {
    if (!onConfirmCollection || !equipment) return;
    setIsConfirming(true);
    try {
      await onConfirmCollection(equipment);
      // Don't close dialog - let the parent update the equipment prop
      // so user sees the updated status
    } finally {
      setIsConfirming(false);
    }
  };

  const isCollected = equipment.status === 'RECOLHIDO';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {equipment.nome_cliente}
          </DialogTitle>
          <DialogDescription>
            Pedido: {equipment.pedido_dia}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={equipment.status} />
            <PeriodBadge period={equipment.periodo_recolha} />
          </div>

          {/* Info grid */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Entregador: {equipment.creator_name || 'Desconhecido'}</span>
            </div>
            {equipment.data_prevista_recolha && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Recolha prevista: {new Date(equipment.data_prevista_recolha).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>

          {/* Observations */}
          {equipment.observacoes && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground italic">
                {equipment.observacoes}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={openRoute}
            >
              <Navigation className="w-4 h-4" />
              Obter rota
              <ExternalLink className="w-3 h-3" />
            </Button>

            {onConfirmCollection && (
              <Button
                className={`w-full gap-2 ${
                  isCollected
                    ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                onClick={handleConfirm}
                disabled={isConfirming || isCollected}
              >
                {isConfirming ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {isCollected ? 'Já Recolhido' : 'Confirmar Recolha'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
