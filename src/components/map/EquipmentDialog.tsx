import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PeriodBadge } from '@/components/ui/period-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Navigation, ExternalLink, CheckCircle2, MapPin, User, Calendar, Trash2, Bell } from 'lucide-react';
import type { EquipmentWithCreator } from '@/types/database';

interface EquipmentDialogProps {
  equipment: EquipmentWithCreator | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCollection?: (equipment: EquipmentWithCreator) => Promise<void>;
  onDelete?: (equipment: EquipmentWithCreator) => Promise<void>;
  isAdmin?: boolean;
}

const periodLabels: Record<string, string> = {
  DIA_TODO: 'Dia Todo',
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  CLIENTE_IRA_AVISAR: 'Cliente Avisará',
};

export function EquipmentDialog({
  equipment,
  open,
  onOpenChange,
  onConfirmCollection,
  onDelete,
  isAdmin = false,
}: EquipmentDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !equipment) return;
    setIsDeleting(true);
    try {
      await onDelete(equipment);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isCollected = equipment.status === 'RECOLHIDO';
  const isClienteAvisara = equipment.cliente_ira_avisar || equipment.periodo_recolha === 'CLIENTE_IRA_AVISAR';
  const hasPhoto = equipment.foto_local_path || equipment.foto_url;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {equipment.pedido_dia} - {equipment.nome_cliente}
            </DialogTitle>
            <DialogDescription>
              Cliente: {equipment.nome_cliente}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo */}
            {hasPhoto && (
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={equipment.foto_url || equipment.foto_local_path || ''}
                  alt="Foto do local"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {isClienteAvisara ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                  <Bell className="w-3 h-3" />
                  Aguardando Cliente
                </span>
              ) : (
                <StatusBadge status={equipment.status} />
              )}
              <PeriodBadge period={equipment.periodo_recolha} />
            </div>

            {/* Info grid */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Entregador: {equipment.creator_name || 'Desconhecido'}</span>
              </div>
              {!isClienteAvisara && equipment.data_prevista_recolha && (
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

              {/* Delete button - Admin only */}
              {isAdmin && onDelete && (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Excluir Entrega
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a entrega "{equipment.pedido_dia} - {equipment.nome_cliente}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <LoadingSpinner size="sm" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
