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
import { CheckCircle2, Package, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MultiCodeScanner } from './MultiCodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StandaloneReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidatedCode {
  code: string;
  status: 'validating' | 'valid' | 'invalid';
  message?: string;
  erpStatus?: string;
}

export function StandaloneReturnDialog({
  open,
  onOpenChange,
}: StandaloneReturnDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<Set<string>>(new Set());
  const [validatedCodes, setValidatedCodes] = useState<Map<string, ValidatedCode>>(new Map());
  const [processedResults, setProcessedResults] = useState<Array<{
    code: string;
    success: boolean;
    message?: string;
  }>>([]);

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setScannedCodes(new Set());
      setValidatedCodes(new Map());
      setProcessedResults([]);
    }
    onOpenChange(newOpen);
  };

  // Validate a code against ERP
  const validateCode = useCallback(async (code: string) => {
    const normalized = code.toUpperCase();
    
    // Set as validating
    setValidatedCodes(prev => {
      const newMap = new Map(prev);
      newMap.set(normalized, { code: normalized, status: 'validating' });
      return newMap;
    });

    try {
      const { data, error } = await supabase.functions.invoke('validate-equipment-patrimony', {
        body: { patrimonio: normalized }
      });

      if (error) {
        console.error(`[StandaloneReturnDialog] Validation error for ${normalized}:`, error);
        setValidatedCodes(prev => {
          const newMap = new Map(prev);
          newMap.set(normalized, { 
            code: normalized, 
            status: 'invalid', 
            message: 'Erro ao validar' 
          });
          return newMap;
        });
        toast.error(`Erro ao validar ${normalized}`);
        return;
      }

      if (data?.valid) {
        setValidatedCodes(prev => {
          const newMap = new Map(prev);
          newMap.set(normalized, { 
            code: normalized, 
            status: 'valid',
            erpStatus: data.status,
            message: 'Alocado - pode ser devolvido'
          });
          return newMap;
        });
        toast.success(`✓ ${normalized} está ALOCADO e pode ser devolvido`);
      } else {
        setValidatedCodes(prev => {
          const newMap = new Map(prev);
          newMap.set(normalized, { 
            code: normalized, 
            status: 'invalid',
            erpStatus: data?.status,
            message: data?.message || 'Não pode ser devolvido'
          });
          return newMap;
        });
        toast.warning(data?.message || `${normalized} não está alocado`);
      }
    } catch (err) {
      console.error(`[StandaloneReturnDialog] Exception validating ${normalized}:`, err);
      setValidatedCodes(prev => {
        const newMap = new Map(prev);
        newMap.set(normalized, { 
          code: normalized, 
          status: 'invalid', 
          message: 'Erro de conexão' 
        });
        return newMap;
      });
    }
  }, []);

  // Handle code changes from scanner
  const handleCodesChange = useCallback((codes: Set<string>) => {
    // Find new codes that need validation
    const newCodes = Array.from(codes).filter(code => !scannedCodes.has(code));
    
    setScannedCodes(codes);
    
    // Validate new codes
    newCodes.forEach(code => {
      validateCode(code);
    });

    // Remove validation for deleted codes
    const deletedCodes = Array.from(scannedCodes).filter(code => !codes.has(code));
    if (deletedCodes.length > 0) {
      setValidatedCodes(prev => {
        const newMap = new Map(prev);
        deletedCodes.forEach(code => newMap.delete(code.toUpperCase()));
        return newMap;
      });
    }
  }, [scannedCodes, validateCode]);

  const handleConfirm = async () => {
    // Only process valid codes
    const validCodes = Array.from(validatedCodes.entries())
      .filter(([_, v]) => v.status === 'valid')
      .map(([code]) => code);

    if (validCodes.length === 0) {
      toast.warning('Nenhum equipamento válido para devolver');
      return;
    }

    setIsConfirming(true);
    const results: typeof processedResults = [];

    try {
      for (const code of validCodes) {
        try {
          const { data, error } = await supabase.functions.invoke('update-erp-equipment-status', {
            body: { patrimonio: code }
          });

          if (error) {
            console.error(`[StandaloneReturnDialog] Error updating ${code}:`, error);
            results.push({ code, success: false, message: error.message || 'Erro desconhecido' });
          } else if (data?.success === false) {
            results.push({ code, success: false, message: data.warning || 'Erro ao atualizar' });
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

  // Count valid codes
  const validCount = Array.from(validatedCodes.values()).filter(v => v.status === 'valid').length;
  const invalidCount = Array.from(validatedCodes.values()).filter(v => v.status === 'invalid').length;
  const validatingCount = Array.from(validatedCodes.values()).filter(v => v.status === 'validating').length;

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
              <strong>Atenção:</strong> Apenas equipamentos com status <strong>ALOCADO</strong> podem ser devolvidos. 
              Equipamentos com produto devem ser retornados pelo <strong>BeerSales</strong>.
            </AlertDescription>
          </Alert>

          {/* Scanner */}
          <MultiCodeScanner
            scannedCodes={scannedCodes}
            onCodesChange={handleCodesChange}
            validPatrimonies={new Set()}
            disabled={isConfirming}
            standaloneMode={true}
            hideCodeList={true}
          />

          {/* Validated codes list */}
          {validatedCodes.size > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Equipamentos ({validatedCodes.size})</p>
                <div className="flex gap-2 text-xs">
                  {validCount > 0 && (
                    <Badge variant="outline" className="bg-status-ready/10 text-status-ready border-status-ready/30">
                      {validCount} válido(s)
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                      {invalidCount} inválido(s)
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {Array.from(validatedCodes.values()).map((item) => (
                  <div 
                    key={item.code}
                    className={`flex items-center justify-between p-2 rounded text-sm border ${
                      item.status === 'valid' 
                        ? 'bg-status-ready/10 border-status-ready/30' 
                        : item.status === 'invalid'
                          ? 'bg-destructive/10 border-destructive/30'
                          : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.status === 'validating' && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                      {item.status === 'valid' && (
                        <CheckCircle2 className="w-4 h-4 text-status-ready" />
                      )}
                      {item.status === 'invalid' && (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="font-mono">{item.code}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.erpStatus && (
                        <Badge variant="secondary" className="text-xs">
                          {item.erpStatus}
                        </Badge>
                      )}
                      {item.status === 'validating' && (
                        <span className="text-xs text-muted-foreground">Validando...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        ? 'bg-status-ready/10 text-status-ready' 
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    <span className="font-mono">{result.code}</span>
                    <Badge variant={result.success ? 'default' : 'destructive'} className="text-xs">
                      {result.success ? 'Retornado' : result.message || 'Erro'}
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
            disabled={isConfirming || validCount === 0 || validatingCount > 0}
            className="w-full sm:w-auto gap-2 bg-status-waiting hover:bg-status-waiting/90 text-white"
          >
            {isConfirming ? (
              <LoadingSpinner size="sm" />
            ) : validatingCount > 0 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando...
              </>
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
