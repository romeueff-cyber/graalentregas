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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Package, AlertCircle, RefreshCw, AlertTriangle, SkipForward, List, Barcode } from 'lucide-react';
import { useClientAllocatedEquipment, type ERPEquipment } from '@/hooks/useClientAllocatedEquipment';
import { MultiCodeScanner } from './MultiCodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { recordEquipmentHistory, HISTORY_ACTIONS } from '@/hooks/useEquipmentHistory';
import { toast } from 'sonner';
import { isOnline as checkOnline } from '@/lib/offline-storage';
import { offlineReturnQueue } from '@/lib/offline-return-queue';

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
  const { user, profile } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedPatrimonies, setSelectedPatrimonies] = useState<Set<string>>(new Set());
  const [scannedCodes, setScannedCodes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [isInteractive, setIsInteractive] = useState(false);

  const { equipments, isLoading, error, clientListEmpty, refetch } = useClientAllocatedEquipment({
    clientId,
    orderNumber,
  });

  // Normalize patrimony for consistent comparison
  const normalizePatrimony = useCallback((value: string | null | undefined) => {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }, []);

  // Filter equipments with patrimony
  const equipmentsWithPatrimony = equipments.filter(eq => normalizePatrimony(eq.patrimony));
  const equipmentsWithoutPatrimony = equipments.filter(eq => !normalizePatrimony(eq.patrimony));

  // Create a map of patrimony -> equipment for quick lookup
  const patrimonyMap = new Map<string, typeof equipmentsWithPatrimony[0]>();
  const validPatrimoniesSet = new Set<string>();
  equipmentsWithPatrimony.forEach(eq => {
    const p = normalizePatrimony(eq.patrimony);
    if (p) {
      patrimonyMap.set(p, eq);
      validPatrimoniesSet.add(p);
    }
  });

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
      setScannedCodes(new Set());
      setActiveTab('scanner');
      refetch();
    }
  }, [open, refetch]);

  // Sync scanned codes to selected patrimonies when switching tabs or confirming
  const syncScannedToSelected = useCallback(() => {
    const newSelected = new Set(selectedPatrimonies);
    let matchedCount = 0;
    let unmatchedCodes: string[] = [];
    
    scannedCodes.forEach(code => {
      const normalized = code.toUpperCase();
      if (patrimonyMap.has(normalized)) {
        newSelected.add(normalized);
        matchedCount++;
      } else {
        unmatchedCodes.push(code);
      }
    });
    
    setSelectedPatrimonies(newSelected);
    return { matchedCount, unmatchedCodes };
  }, [scannedCodes, selectedPatrimonies, patrimonyMap]);

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
    // Sync scanned codes before confirming
    const { matchedCount, unmatchedCodes } = syncScannedToSelected();
    
    // Get updated selection (need to recalculate since syncScannedToSelected updates state)
    const finalPatrimonies = new Set(selectedPatrimonies);
    scannedCodes.forEach(code => {
      const normalized = code.toUpperCase();
      if (patrimonyMap.has(normalized)) {
        finalPatrimonies.add(normalized);
      }
    });

    if (unmatchedCodes.length > 0) {
      toast.warning(`${unmatchedCodes.length} código(s) não encontrado(s) na lista: ${unmatchedCodes.join(', ')}`);
    }

    if (finalPatrimonies.size === 0) {
      onComplete();
      onOpenChange(false);
      return;
    }

    setIsConfirming(true);
    try {
      const patrimoniesArray = Array.from(finalPatrimonies);
      const isCurrentlyOnline = checkOnline();
      
      for (const patrimony of patrimoniesArray) {
        if (!isCurrentlyOnline) {
          // Queue for offline sync
          await offlineReturnQueue.add({
            id: crypto.randomUUID(),
            patrimony,
            clientName,
            clientId: clientId?.toString(),
            orderNumber,
            userId: user?.id || '',
            userName: profile?.name || user?.email || 'Usuário',
            timestamp: new Date().toISOString(),
            type: 'delivery',
          });
          
          if (user && profile) {
            await recordEquipmentHistory({
              userId: user.id,
              userName: profile.name || user.email || 'Usuário',
              patrimony,
              clientName,
              clientId: clientId?.toString(),
              actionType: HISTORY_ACTIONS.DEVOLUCAO,
              orderNumber,
              notes: 'Registrado offline - pendente sincronização ERP',
            });
          }
          continue;
        }

        // Online: update ERP
        const { error } = await supabase.functions.invoke('update-erp-equipment-status', {
          body: { patrimonio: patrimony, orderNumber: orderNumber }
        });

        if (error) {
          console.error(`[DeliveryEquipmentReturnDialog] Error updating ${patrimony}:`, error);
          // Queue for later sync on error
          await offlineReturnQueue.add({
            id: crypto.randomUUID(),
            patrimony,
            clientName,
            clientId: clientId?.toString(),
            orderNumber,
            userId: user?.id || '',
            userName: profile?.name || user?.email || 'Usuário',
            timestamp: new Date().toISOString(),
            type: 'delivery',
          });
          toast.warning(`${patrimony} salvo para sincronizar depois`);
        } else {
          if (user && profile) {
            await recordEquipmentHistory({
              userId: user.id,
              userName: profile.name || user.email || 'Usuário',
              patrimony,
              clientName,
              clientId: clientId?.toString(),
              actionType: HISTORY_ACTIONS.DEVOLUCAO,
              orderNumber,
            });
          }
        }
      }

      const offlineMsg = !isCurrentlyOnline ? ' (pendente sincronização)' : '';
      toast.success(`${patrimoniesArray.length} equipamento(s) marcado(s) como retornado(s)${offlineMsg}`);
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

  // Calculate total selected (manual + scanned that match)
  const getEffectiveSelectedCount = () => {
    const combined = new Set(selectedPatrimonies);
    scannedCodes.forEach(code => {
      const normalized = code.toUpperCase();
      if (patrimonyMap.has(normalized)) {
        combined.add(normalized);
      }
    });
    return combined.size;
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

              {/* Tabs for Scanner vs Manual selection */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="scanner" className="gap-1.5 text-xs">
                    <Barcode className="w-3.5 h-3.5" />
                    Scanner
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="gap-1.5 text-xs">
                    <List className="w-3.5 h-3.5" />
                    Lista Manual
                  </TabsTrigger>
                </TabsList>

                {/* Scanner Tab */}
                <TabsContent value="scanner" className="space-y-3 mt-3">
                  <MultiCodeScanner
                    scannedCodes={scannedCodes}
                    onCodesChange={setScannedCodes}
                    validPatrimonies={validPatrimoniesSet}
                    disabled={isConfirming}
                  />
                </TabsContent>

                {/* Manual Tab */}
                <TabsContent value="manual" className="space-y-3 mt-3">
                  <p className="text-xs text-muted-foreground text-center italic">
                    {isInteractive 
                      ? 'Marque os equipamentos que serão devolvidos nesta entrega'
                      : 'Aguarde a lista carregar...'}
                  </p>

                  {/* Equipments with patrimony - selectable */}
                  {equipmentsWithPatrimony.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Equipamentos alocados ({equipmentsWithPatrimony.length})
                      </p>
                      <div className={`space-y-2 max-h-[200px] overflow-y-auto ${isInteractive ? '' : 'pointer-events-none opacity-60'}`}>
                        {equipmentsWithPatrimony.map((eq, idx) => {
                          const patrimony = normalizePatrimony(eq.patrimony);
                          if (!patrimony) return null;
                          
                          const isSelected = selectedPatrimonies.has(patrimony) || scannedCodes.has(patrimony);
                          const isFromScanner = scannedCodes.has(patrimony) && !selectedPatrimonies.has(patrimony);
                          
                          return (
                            <div
                              key={patrimony || `eq-${idx}`}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? isFromScanner
                                    ? 'border-primary bg-primary/10'
                                    : 'border-primary bg-primary/5'
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
                                  {isFromScanner && (
                                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                      Escaneado
                                    </Badge>
                                  )}
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
                        Outros equipamentos (sem patrimônio)
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
                        Equipamentos sem patrimônio não requerem liberação individual
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
                {getEffectiveSelectedCount() > 0 
                  ? `Confirmar (${getEffectiveSelectedCount()})`
                  : 'Continuar'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
