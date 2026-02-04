import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle2, Package, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ERPEquipment {
  type: string;
  description: string | null;
  patrimony: string | null;
  model: string | null;
  quantity: number;
}

interface CollectionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  clientName: string;
  onConfirm: (selectedPatrimonies: string[]) => Promise<void>;
}

export function CollectionConfirmDialog({
  open,
  onOpenChange,
  orderNumber,
  clientName,
  onConfirm,
}: CollectionConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [equipments, setEquipments] = useState<ERPEquipment[]>([]);
  const [selectedPatrimonies, setSelectedPatrimonies] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch equipments from ERP when dialog opens
  useEffect(() => {
    if (open && orderNumber) {
      fetchEquipments();
    }
  }, [open, orderNumber]);

  const fetchEquipments = async () => {
    setIsLoading(true);
    setError(null);
    setEquipments([]);
    setSelectedPatrimonies(new Set());

    try {
      console.log(`[CollectionConfirmDialog] Fetching equipment for order ${orderNumber}`);
      
      const { data, error: fetchError } = await supabase.functions.invoke(
        'search-erp-order',
        { body: { orderNumber } }
      );

      if (fetchError) {
        console.error('[CollectionConfirmDialog] Error fetching order:', fetchError);
        throw new Error('Erro ao buscar pedido no ERP');
      }

      if (!data) {
        throw new Error('Pedido não encontrado no ERP');
      }

      console.log('[CollectionConfirmDialog] Order data:', data);

      // Filter only equipments with patrimony (specific items that can be returned)
      const equipmentsWithPatrimony = (data.equipments || []).filter(
        (eq: ERPEquipment) => eq.patrimony
      );
      
      setEquipments(data.equipments || []);
      
      // Pre-select all items with patrimony
      const patrimonies = new Set<string>(
        equipmentsWithPatrimony.map((eq: ERPEquipment) => eq.patrimony as string)
      );
      setSelectedPatrimonies(patrimonies);

    } catch (err) {
      console.error('[CollectionConfirmDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePatrimony = (patrimony: string) => {
    const newSet = new Set(selectedPatrimonies);
    if (newSet.has(patrimony)) {
      newSet.delete(patrimony);
    } else {
      newSet.add(patrimony);
    }
    setSelectedPatrimonies(newSet);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(Array.from(selectedPatrimonies));
      onOpenChange(false);
    } catch (err) {
      console.error('[CollectionConfirmDialog] Confirm error:', err);
      toast.error('Erro ao confirmar recolha');
    } finally {
      setIsConfirming(false);
    }
  };

  const equipmentsWithPatrimony = equipments.filter(eq => eq.patrimony);
  const equipmentsWithoutPatrimony = equipments.filter(eq => !eq.patrimony);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Confirmar Recolha
          </DialogTitle>
          <DialogDescription>
            Pedido {orderNumber} - {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-muted-foreground">
                Buscando equipamentos do pedido...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchEquipments}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </Button>
            </div>
          ) : equipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Package className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhum equipamento encontrado para este pedido
              </p>
            </div>
          ) : (
            <>
              {/* Equipments with patrimony - selectable */}
              {equipmentsWithPatrimony.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Equipamentos para devolução ({equipmentsWithPatrimony.length})
                  </p>
                  <div className="space-y-2">
                    {equipmentsWithPatrimony.map((eq, idx) => (
                      <div
                        key={eq.patrimony || idx}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPatrimonies.has(eq.patrimony!)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onClick={() => eq.patrimony && togglePatrimony(eq.patrimony)}
                      >
                        <Checkbox
                          checked={selectedPatrimonies.has(eq.patrimony!)}
                          onCheckedChange={() => eq.patrimony && togglePatrimony(eq.patrimony)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {eq.quantity}x {eq.type}
                            </span>
                            <Badge variant="outline" className="font-mono text-xs">
                              Pat: {eq.patrimony}
                            </Badge>
                          </div>
                          {eq.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {eq.description}
                              {eq.model && ` - ${eq.model}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipments without patrimony - informational only */}
              {equipmentsWithoutPatrimony.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Outros equipamentos (sem patrimônio específico)
                  </p>
                  <div className="space-y-1">
                    {equipmentsWithoutPatrimony.map((eq, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm"
                      >
                        <Badge variant="secondary" className="text-xs">
                          {eq.quantity}x {eq.type}
                        </Badge>
                        {eq.description && (
                          <span className="text-xs text-muted-foreground">
                            {eq.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Equipamentos sem patrimônio não requerem liberação individual no ERP
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || isConfirming || (equipments.length > 0 && equipmentsWithPatrimony.length > 0 && selectedPatrimonies.size === 0)}
            className="w-full sm:w-auto gap-2 bg-status-ready hover:bg-status-ready/90 text-white"
          >
            {isConfirming ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Recolha
                {selectedPatrimonies.size > 0 && ` (${selectedPatrimonies.size})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
