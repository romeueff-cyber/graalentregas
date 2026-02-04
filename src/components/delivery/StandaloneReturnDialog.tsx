import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Package, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MultiCodeScanner } from './MultiCodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StandaloneReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StandaloneReturnDialog({
  open,
  onOpenChange,
}: StandaloneReturnDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<Set<string>>(new Set());
  const [processedResults, setProcessedResults] = useState<Array<{
    code: string;
    success: boolean;
    message?: string;
  }>>([]);

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setScannedCodes(new Set());
      setProcessedResults([]);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    if (scannedCodes.size === 0) {
      toast.warning('Nenhum código escaneado ou digitado');
      return;
    }

    setIsConfirming(true);
    const results: typeof processedResults = [];

    try {
      const codesArray = Array.from(scannedCodes);
      
      for (const code of codesArray) {
        try {
          const { error } = await supabase.functions.invoke('update-erp-equipment-status', {
            body: { patrimonio: code.toUpperCase() }
          });

          if (error) {
            console.error(`[StandaloneReturnDialog] Error updating ${code}:`, error);
            results.push({ code, success: false, message: error.message || 'Erro desconhecido' });
          } else {
            results.push({ code, success: true });
          }
        } catch (err) {
          console.error(`[StandaloneReturnDialog] Exception for ${code}:`, err);
          results.push({ code, success: false, message: 'Erro de conexão' });
        }
      }

      setProcessedResults(results);

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} equipamento(s) marcado(s) como retornado(s)`);
        handleOpenChange(false);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} sucesso, ${errorCount} erro(s)`);
      } else {
        toast.error('Nenhum equipamento foi atualizado');
      }
    } catch (err) {
      console.error('[StandaloneReturnDialog] Confirm error:', err);
      toast.error('Erro ao processar retorno de equipamentos');
    } finally {
      setIsConfirming(false);
    }
  };

  const validCount = scannedCodes.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-status-waiting" />
            Devolução de Equipamentos
          </DialogTitle>
          <DialogDescription>
            Escaneie ou digite os códigos dos equipamentos para retorno
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

          {/* Scanner - mode standalone sem validação prévia */}
          <MultiCodeScanner
            scannedCodes={scannedCodes}
            onCodesChange={setScannedCodes}
            validPatrimonies={new Set()} // Empty = no pre-validation
            disabled={isConfirming}
            standaloneMode={true}
          />

          {/* Results after processing */}
          {processedResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Resultados:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {processedResults.map((result, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      result.success 
                        ? 'bg-green-500/10 text-green-700' 
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    <span className="font-mono">{result.code}</span>
                    <Badge variant={result.success ? 'default' : 'destructive'} className="text-xs">
                      {result.success ? 'OK' : result.message || 'Erro'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isConfirming}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming || validCount === 0}
            className="w-full sm:w-auto gap-2 bg-status-waiting hover:bg-status-waiting/90 text-white"
          >
            {isConfirming ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar ({validCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
