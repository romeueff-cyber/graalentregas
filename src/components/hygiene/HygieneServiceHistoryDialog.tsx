import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Droplets, RefreshCw, Calendar, User, FileText } from 'lucide-react';
import type { HygieneEquipmentWithServices, HygieneService } from '@/types/hygiene';
import { equipmentTypeLabels, serviceTypeLabels } from '@/types/hygiene';

interface HygieneServiceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: HygieneEquipmentWithServices | null;
  history: HygieneService[];
}

export function HygieneServiceHistoryDialog({
  open,
  onOpenChange,
  equipment,
  history,
}: HygieneServiceHistoryDialogProps) {
  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Serviços</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {equipmentTypeLabels[equipment.tipo_equipamento]} - {equipment.numero_serie}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Droplets className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum serviço registrado</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {history.map((service) => (
                <div
                  key={service.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={service.tipo_servico === 'limpeza' ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      {service.tipo_servico === 'limpeza' ? (
                        <Droplets className="w-3 h-3" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      {serviceTypeLabels[service.tipo_servico]}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(service.data_servico), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  {service.tipo_servico === 'troca' && (
                    <div className="text-sm space-y-1 bg-secondary/50 rounded p-2">
                      {service.motivo_troca && (
                        <p>
                          <span className="text-muted-foreground">Motivo:</span>{' '}
                          {service.motivo_troca}
                        </p>
                      )}
                      {service.novo_numero_serie && (
                        <p>
                          <span className="text-muted-foreground">Nova série:</span>{' '}
                          {service.novo_numero_serie}
                        </p>
                      )}
                    </div>
                  )}

                  {service.observacoes && (
                    <div className="flex items-start gap-1 text-sm text-muted-foreground">
                      <FileText className="w-3 h-3 mt-0.5" />
                      <span>{service.observacoes}</span>
                    </div>
                  )}

                  {service.foto_url && (
                    <img
                      src={service.foto_url}
                      alt="Foto do serviço"
                      className="w-full h-32 object-cover rounded"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
