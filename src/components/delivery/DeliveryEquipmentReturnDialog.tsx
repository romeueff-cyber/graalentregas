import { useState, useEffect, useCallback } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Package, AlertCircle, RefreshCw, AlertTriangle, SkipForward } from 'lucide-react';
import { useClientAllocatedEquipment, type ERPEquipment } from '@/hooks/useClientAllocatedEquipment';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeliveryEquipmentReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  clientName: string;
  clientId?: string | number;
  onComplete: () => void;
}

export function DeliveryEquipmentReturnDialog({
  open,
  onOpenChange,
  orderNumber,
  clientName,
  clientId,
  onComplete,
}: DeliveryEquipmentReturnDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedPatrimonies, setSelectedPatrimonies] = useState<Set<string>>(new Set());
  const [isInteractive, setIsInteractive] = useState(false);

  const { equipments, isLoading, error, clientListEmpty, refetch } = useClientAllocatedEquipment({
    clientId,
    orderNumber,
  });

  // Normalize patrimony for consistent comparison
  const normalizePatrimony = useCallback((value: string | null | undefined) => {
    return typeof value === 'string' ? value.trim() : '';
  }, []);

  // Filter equipments with patrimony
  const equipmentsWithPatrimony = equipments.filter(eq => normalizePatrimony(eq.patrimony));
  const equipmentsWithoutPatrimony = equipments.filter(eq => !normalizePatrimony(eq.patrimony));

  // Enable interaction after a short delay to prevent timing issues
  useEffect(() => {
    if (!open || isLoading) {
      setIsInteractive(false);
      return;
    }
    setIsInteractive(false);
    const t = window.setTimeout(() => setIsInteractive(true), 300);
    return () => window.clearTimeout(t);
  }, [open, isLoading, equipmentsWithPatrimony.length]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPatrimonies(new Set());
      refetch();
    }
  }, [open, refetch]);

  const togglePatrimony = (patrimony: string) => {
    if (!isInteractive) return;
    const normalized = normalizePatrimony(patrimony);
    if (!normalized) return;
    
    setSelectedPatrimonies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(normalized)) {
        newSet.delete(normalized);
      } else {
        newSet.add(normalized);
      }
      return newSet;
    });
  };

  const handleConfirm = async () => {
    if (selectedPatrimonies.size === 0) {
      // No equipment selected, just close
      onComplete();
      onOpenChange(false);
      return;
    }

    setIsConfirming(true);
    try {
      // Process each selected patrimony
      const patrimoniesArray = Array.from(selectedPatrimonies);
      
      for (const patrimony of patrimoniesArray) {
        const { error } = await supabase.functions.invoke('update-erp-equipment-status', {
          body: { patrimonio: patrimony, orderNumber: orderNumber } // patrimonio field expected by edge function
        });

        if (error) {
          console.error(`[DeliveryEquipmentReturnDialog] Error updating ${patrimony}:`, error);
          toast.error(`Erro ao atualizar patrimônio ${patrimony}`);
        }
      }

      toast.success(`${patrimoniesArray.length} equipamento(s) marcado(s) como retornado(s)`);
      onComplete();
      onOpenChange(false);
    } catch (err) {
      console.error('[DeliveryEquipmentReturnDialog] Confirm error:', err);
      toast.error('Erro ao processar retorno de equipamentos');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-status-waiting" />
            Equipamentos para Devolução
          </DialogTitle>
          <DialogDescription>
            Pedido {orderNumber} - {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alert about equipment with products */}
          <Alert className="border-status-waiting/50 bg-status-waiting/10">
            <AlertTriangle className="h-4 w-4 text-status-waiting" />
            <AlertDescription className="text-xs">
              <strong>Atenção:</strong> Equipamentos com produto alocado (ex: chopeiras com barril) 
              devem ser retornados diretamente no <strong>BeerSales</strong>, não por este app.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-muted-foreground">
                Buscando equipamentos do cliente...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refetch}
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
                Nenhum equipamento alocado encontrado para este cliente
              </p>
            </div>
          ) : (
            <>
              {/* Warning if client list was empty */}
              {clientListEmpty && (
                <Alert className="border-status-waiting/50 bg-status-waiting/10">
                  <AlertTriangle className="h-4 w-4 text-status-waiting" />
                  <AlertDescription className="text-xs">
                    Não foi possível carregar todos os equipamentos do cliente. Mostrando apenas itens do pedido.
                  </AlertDescription>
                </Alert>
              )}

              {/* Info about selection */}
              <p className="text-xs text-muted-foreground text-center italic">
                {isInteractive 
                  ? 'Marque os equipamentos que serão devolvidos nesta entrega'
                  : 'Aguarde a lista carregar...'}
              </p>

              {/* Equipments with patrimony - selectable */}
              {equipmentsWithPatrimony.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Equipamentos alocados ao cliente ({equipmentsWithPatrimony.length})
                  </p>
                  <div className={`space-y-2 ${isInteractive ? '' : 'pointer-events-none opacity-60'}`}>
                    {equipmentsWithPatrimony.map((eq, idx) => {
                      const patrimony = normalizePatrimony(eq.patrimony);
                      if (!patrimony) return null;
                      
                      const isSelected = selectedPatrimonies.has(patrimony);
                      
                      return (
                        <div
                          key={patrimony || `eq-${idx}`}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => togglePatrimony(patrimony)}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {eq.quantity}x {eq.type}
                              </span>
                              <Badge variant="outline" className="font-mono text-xs">
                                Pat: {patrimony}
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
                      );
                    })}
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
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={isConfirming}
            className="w-full sm:w-auto gap-2"
          >
            <SkipForward className="w-4 h-4" />
            Pular
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || isConfirming}
            className="w-full sm:w-auto gap-2 bg-status-waiting hover:bg-status-waiting/90 text-white"
          >
            {isConfirming ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {selectedPatrimonies.size > 0 
                  ? `Confirmar (${selectedPatrimonies.size})`
                  : 'Continuar'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
