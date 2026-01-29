import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ChoperaIcon, KegotaterIcon } from '@/components/icons';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Plus,
  Phone,
  MapPin,
  Calendar,
  History,
  Droplets,
  RefreshCw,
} from 'lucide-react';
import type {
  HygieneClientWithEquipments,
  HygieneEquipmentWithServices,
  HygieneService,
  HygieneEquipment,
} from '@/types/hygiene';
import { getUrgencyLevel, getUrgencyColor, equipmentTypeLabels } from '@/types/hygiene';
import { HygieneEquipmentDialog } from './HygieneEquipmentDialog';
import { HygieneServiceHistoryDialog } from './HygieneServiceHistoryDialog';

interface HygieneClientCardProps {
  client: HygieneClientWithEquipments;
  onEdit: (client: HygieneClientWithEquipments) => void;
  onDelete: (id: string) => void;
  onAddEquipment: (equipment: Omit<HygieneEquipment, 'id' | 'created_at' | 'updated_at'>) => void;
  onEditEquipment: (id: string, updates: Partial<HygieneEquipment>) => void;
  onDeleteEquipment: (id: string) => void;
  onRegisterService: (equipment: HygieneEquipmentWithServices, clientName: string) => void;
  getServiceHistory: (equipmentId: string) => Promise<HygieneService[]>;
}

export function HygieneClientCard({
  client,
  onEdit,
  onDelete,
  onAddEquipment,
  onEditEquipment,
  onDeleteEquipment,
  onRegisterService,
  getServiceHistory,
}: HygieneClientCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<HygieneEquipmentWithServices | null>(null);
  const [historyDialogData, setHistoryDialogData] = useState<{
    open: boolean;
    equipment: HygieneEquipmentWithServices | null;
    history: HygieneService[];
  }>({ open: false, equipment: null, history: [] });

  const today = new Date();

  // Find the most urgent equipment
  const getEquipmentUrgency = (eq: HygieneEquipmentWithServices) => {
    if (!eq.proxima_limpeza) return null;
    return differenceInDays(parseISO(eq.proxima_limpeza), today);
  };

  const mostUrgent = client.equipments.reduce((min, eq) => {
    const days = getEquipmentUrgency(eq);
    if (days === null) return min;
    if (min === null) return days;
    return days < min ? days : min;
  }, null as number | null);

  const urgencyLevel = getUrgencyLevel(mostUrgent);
  const urgencyColor = getUrgencyColor(urgencyLevel);

  const handleShowHistory = async (equipment: HygieneEquipmentWithServices) => {
    const history = await getServiceHistory(equipment.id);
    setHistoryDialogData({ open: true, equipment, history });
  };

  const handleAddEquipment = () => {
    setEditingEquipment(null);
    setShowEquipmentDialog(true);
  };

  const handleEditEquipment = (equipment: HygieneEquipmentWithServices) => {
    setEditingEquipment(equipment);
    setShowEquipmentDialog(true);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">
                    {client.nome_cliente}
                  </h3>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: urgencyColor }}
                    title={mostUrgent !== null ? `${mostUrgent} dias` : 'Sem data'}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{client.endereco}</span>
                </div>
                {client.telefone_cliente && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>{client.telefone_cliente}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(client)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover Cliente</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja remover {client.nome_cliente}? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(client.id)}>
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Equipment summary badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {client.equipments.map((eq) => {
                const days = getEquipmentUrgency(eq);
                const eqUrgency = getUrgencyLevel(days);
                const eqColor = getUrgencyColor(eqUrgency);
                
                return (
                  <Badge
                    key={eq.id}
                    variant="outline"
                    className="text-xs gap-1"
                    style={{ borderColor: eqColor, color: eqColor }}
                  >
                    {eq.tipo_equipamento === 'chopeira' ? (
                      <ChoperaIcon size={12} />
                    ) : (
                      <KegotaterIcon size={12} />
                    )}
                    {days !== null && (
                      <span>{days <= 0 ? 'Atrasado' : `${days}d`}</span>
                    )}
                  </Badge>
                );
              })}
              {client.equipments.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum equipamento</span>
              )}
            </div>

            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground"
              >
                {isOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Ocultar equipamentos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Ver {client.equipments.length} equipamento(s)
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4 space-y-3">
              {client.equipments.map((equipment) => {
                const days = getEquipmentUrgency(equipment);
                const eqUrgency = getUrgencyLevel(days);
                const eqColor = getUrgencyColor(eqUrgency);

                return (
                  <div
                    key={equipment.id}
                    className="bg-secondary/50 rounded-lg p-3 border-l-4"
                    style={{ borderLeftColor: eqColor }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {equipment.tipo_equipamento === 'chopeira' ? (
                          <ChoperaIcon size={20} className="text-muted-foreground" />
                        ) : (
                          <KegotaterIcon size={20} className="text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {equipmentTypeLabels[equipment.tipo_equipamento]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Série: {equipment.numero_serie}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleShowHistory(equipment)}
                          title="Ver histórico"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditEquipment(equipment)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Equipamento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover este equipamento?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteEquipment(equipment.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Última: </span>
                        <span className="text-foreground">
                          {equipment.ultima_limpeza
                            ? format(parseISO(equipment.ultima_limpeza), 'dd/MM/yy', { locale: ptBR })
                            : '--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" style={{ color: eqColor }} />
                        <span className="text-muted-foreground">Próxima: </span>
                        <span style={{ color: eqColor, fontWeight: 500 }}>
                          {equipment.proxima_limpeza
                            ? format(parseISO(equipment.proxima_limpeza), 'dd/MM/yy', { locale: ptBR })
                            : '--'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => onRegisterService(equipment, client.nome_cliente)}
                      >
                        <Droplets className="w-3.5 h-3.5 mr-1" />
                        Limpeza
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => onRegisterService(equipment, client.nome_cliente)}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Troca
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Add equipment button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleAddEquipment}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Equipamento
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Equipment Dialog */}
      <HygieneEquipmentDialog
        open={showEquipmentDialog}
        onOpenChange={setShowEquipmentDialog}
        equipment={editingEquipment}
        clientId={client.id}
        onSave={async (data) => {
          if (editingEquipment) {
            await onEditEquipment(editingEquipment.id, data);
          } else {
            await onAddEquipment(data as any);
          }
          setShowEquipmentDialog(false);
        }}
      />

      {/* History Dialog */}
      <HygieneServiceHistoryDialog
        open={historyDialogData.open}
        onOpenChange={(open) => setHistoryDialogData(prev => ({ ...prev, open }))}
        equipment={historyDialogData.equipment}
        history={historyDialogData.history}
      />
    </>
  );
}
