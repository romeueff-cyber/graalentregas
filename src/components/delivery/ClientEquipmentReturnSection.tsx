import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Package, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ERPEquipment {
  type: string;
  description: string | null;
  patrimony: string | null;
  model: string | null;
  quantity: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [equipments, setEquipments] = useState<ERPEquipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch all equipments allocated to client
  useEffect(() => {
    if (clientId || orderNumber) {
      fetchEquipments();
    }
  }, [clientId, orderNumber]);

  const fetchEquipments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`[ClientEquipmentReturn] Fetching equipment for client ${clientId || 'via order ' + orderNumber}`);
      
      let allEquipments: ERPEquipment[] = [];

      // If we have clientId, try to fetch all client equipment first
      if (clientId) {
        try {
          const { data: clientData, error: clientError } = await supabase.functions.invoke(
            'get-client-equipment',
            { body: { clientId } }
          );

          if (!clientError && clientData?.equipments?.length > 0) {
            allEquipments = clientData.equipments;
            console.log(`[ClientEquipmentReturn] Found ${allEquipments.length} equipment(s) via get-client-equipment`);
          } else {
            console.log('[ClientEquipmentReturn] No equipment from get-client-equipment, will try fallback');
          }
        } catch (clientErr) {
          console.error('[ClientEquipmentReturn] Error fetching client equipment:', clientErr);
        }
      }

      // If no equipment found yet and we have orderNumber, use order-based fallback
      if (allEquipments.length === 0 && orderNumber) {
        console.log('[ClientEquipmentReturn] Using order-based fallback for equipment');
        const { data: orderData, error: orderError } = await supabase.functions.invoke(
          'search-erp-order',
          { body: { orderNumber } }
        );

        if (!orderError && orderData) {
          // First try to get equipment from the order response directly
          if (orderData.equipments?.length > 0) {
            allEquipments = orderData.equipments;
            console.log(`[ClientEquipmentReturn] Found ${allEquipments.length} equipment(s) from search-erp-order`);
          }
          
          // If still no equipment but we have client_id, try one more time with client endpoint
          if (allEquipments.length === 0 && orderData.client_id) {
            try {
              const { data: clientData, error: clientError } = await supabase.functions.invoke(
                'get-client-equipment',
                { body: { clientId: orderData.client_id } }
              );

              if (!clientError && clientData?.equipments?.length > 0) {
                allEquipments = clientData.equipments;
                console.log(`[ClientEquipmentReturn] Found ${allEquipments.length} equipment(s) via client fallback`);
              }
            } catch (clientErr) {
              console.error('[ClientEquipmentReturn] Error in client fallback:', clientErr);
            }
          }
        }
      }
      
      setEquipments(allEquipments);
      
      // If we found equipment, open the section
      if (allEquipments.length > 0) {
        setIsOpen(true);
      }

    } catch (err) {
      console.error('[ClientEquipmentReturn] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePatrimony = (patrimony: string) => {
    const newSelection = selectedPatrimonies.includes(patrimony)
      ? selectedPatrimonies.filter(p => p !== patrimony)
      : [...selectedPatrimonies, patrimony];
    onSelectionChange(newSelection);
  };

  const equipmentsWithPatrimony = equipments.filter(eq => eq.patrimony);

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
                {selectedPatrimonies.length > 0 && (
                  <Badge className="ml-1 bg-primary text-primary-foreground">
                    {selectedPatrimonies.length} selecionado(s)
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
                <Button variant="outline" size="sm" onClick={fetchEquipments} className="gap-2">
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
                <p className="text-xs text-muted-foreground italic">
                  Marque os equipamentos que serão devolvidos nesta entrega
                </p>
                {equipmentsWithPatrimony.map((eq, idx) => (
                  <div
                    key={eq.patrimony || idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPatrimonies.includes(eq.patrimony!)
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                    onClick={() => eq.patrimony && togglePatrimony(eq.patrimony)}
                  >
                    <Checkbox
                      checked={selectedPatrimonies.includes(eq.patrimony!)}
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
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
