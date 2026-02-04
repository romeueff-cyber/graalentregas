import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Package, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useClientAllocatedEquipment } from '@/hooks/useClientAllocatedEquipment';
import { toast } from 'sonner';

function toDisplayString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  // Ensures we never accidentally try to render a raw object
  return String(value);
}

interface ClientEquipmentReturnSectionProps {
  clientId?: string | number;
  orderNumber?: string;
  onSelectionChange: (selectedPatrimonies: string[]) => void;
  selectedPatrimonies: string[];
}

export function ClientEquipmentReturnSection({
  clientId,
  orderNumber,
  onSelectionChange,
  selectedPatrimonies,
}: ClientEquipmentReturnSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizePatrimony = useCallback((value: string | null | undefined) => {
    return typeof value === 'string' ? value.trim() : '';
  }, []);

  const safeSelectedPatrimonies = useMemo(
    () => (Array.isArray(selectedPatrimonies) ? selectedPatrimonies : []),
    [selectedPatrimonies]
  );

  const normalizedSelectedPatrimonies = useMemo(() => {
    const normalized = safeSelectedPatrimonies
      .map((p) => normalizePatrimony(p))
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }, [normalizePatrimony, safeSelectedPatrimonies]);

  const {
    equipments,
    isLoading,
    error,
    clientListEmpty,
    refetch,
  } = useClientAllocatedEquipment({ clientId, orderNumber });

  // If we found equipment, open the section
  useEffect(() => {
    if (equipments.length > 0) setIsOpen(true);
  }, [equipments.length]);

  /**
   * IMPORTANT: This must be idempotent.
   * React error #185 (maximum update depth) can happen if a controlled Checkbox
   * fires onCheckedChange on prop updates and we "toggle" back and forth.
   */
  const setPatrimonySelected = useCallback(
    (patrimonyRaw: string | null | undefined, nextSelected: boolean) => {
      try {
        const patrimony = normalizePatrimony(patrimonyRaw);
        if (!patrimony) return;

        const current = normalizedSelectedPatrimonies;
        const has = current.includes(patrimony);

        // No-op when state is already correct (prevents infinite loops)
        if (nextSelected === has) return;

        const newSelection = nextSelected
          ? Array.from(new Set([...current, patrimony]))
          : current.filter((p) => p !== patrimony);

        if (typeof onSelectionChange === 'function') {
          onSelectionChange(newSelection);
        } else {
          console.error('[ClientEquipmentReturnSection] onSelectionChange is not a function:', onSelectionChange);
        }
      } catch (err) {
        console.error('[ClientEquipmentReturnSection] setPatrimonySelected error:', err);
        toast.error('Erro ao selecionar equipamento para retorno');
      }
    },
    [normalizePatrimony, normalizedSelectedPatrimonies, onSelectionChange]
  );

  const togglePatrimony = useCallback(
    (patrimonyRaw: string | null | undefined) => {
      const patrimony = normalizePatrimony(patrimonyRaw);
      if (!patrimony) return;

      const nextSelected = !normalizedSelectedPatrimonies.includes(patrimony);
      setPatrimonySelected(patrimony, nextSelected);
    },
    [normalizePatrimony, normalizedSelectedPatrimonies, setPatrimonySelected]
  );

  const equipmentsWithPatrimony = useMemo(
    () => equipments.filter((eq) => Boolean(normalizePatrimony(eq.patrimony))),
    [equipments, normalizePatrimony]
  );

  // Don't render anything if no equipment and not loading
  if (!isLoading && equipments.length === 0 && !error) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Package className="w-4 h-4" />
                Equipamentos Alocados ao Cliente
                {equipmentsWithPatrimony.length > 0 && (
                  <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-700 dark:text-amber-300">
                    {equipmentsWithPatrimony.length}
                  </Badge>
                )}
                {normalizedSelectedPatrimonies.length > 0 && (
                  <Badge className="ml-1 bg-primary text-primary-foreground">
                    {normalizedSelectedPatrimonies.length} selecionado(s)
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-amber-700 dark:text-amber-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-700 dark:text-amber-300" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Alert about equipment with products */}
            <Alert className="border-amber-500/50 bg-amber-100/50 dark:bg-amber-900/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                Equipamentos com produto alocado devem ser retornados no <strong>BeerSales</strong>.
                Selecione apenas equipamentos SEM produto para retorno.
              </AlertDescription>
            </Alert>

            {isLoading ? (
              <div className="flex items-center justify-center py-4 gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-muted-foreground">Buscando equipamentos...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
                  <RefreshCw className="w-3 h-3" />
                  Tentar novamente
                </Button>
              </div>
            ) : equipmentsWithPatrimony.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum equipamento alocado encontrado
              </p>
            ) : (
              <div className="space-y-2">
                {clientListEmpty && Boolean(orderNumber) && (
                  <Alert className="border-amber-500/50 bg-amber-100/50 dark:bg-amber-900/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      Não foi possível carregar a lista completa de equipamentos do cliente no ERP. Abaixo pode estar aparecendo apenas o que veio no pedido.
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground italic">
                  Marque os equipamentos que serão devolvidos nesta entrega
                </p>
                {equipmentsWithPatrimony.map((eq, idx) => {
                  const patrimony = normalizePatrimony(eq.patrimony);
                  if (!patrimony) return null;
                  
                  const isSelected = normalizedSelectedPatrimonies.includes(patrimony);

                  const qtyText = toDisplayString(eq.quantity);
                  const typeText = toDisplayString(eq.type);
                  const descriptionText = toDisplayString(eq.description);
                  const modelText = toDisplayString(eq.model);
                  
                  return (
                    <div
                      key={patrimony || `eq-${idx}`}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:bg-muted/50'
                      }`}
                      onClick={() => togglePatrimony(patrimony)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => setPatrimonySelected(patrimony, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {qtyText}x {typeText}
                          </span>
                          <Badge variant="outline" className="font-mono text-xs">
                            Pat: {patrimony}
                          </Badge>
                        </div>
                        {descriptionText && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {descriptionText}
                            {modelText && ` - ${modelText}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
