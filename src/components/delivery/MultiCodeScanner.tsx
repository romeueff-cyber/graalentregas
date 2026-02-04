import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Camera, CameraOff, Plus, X, Barcode, Hash, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MultiCodeScannerProps {
  scannedCodes: Set<string>;
  onCodesChange: (codes: Set<string>) => void;
  /** Set of valid patrimony codes from ERP proxy for validation */
  validPatrimonies: Set<string>;
  disabled?: boolean;
  /** Standalone mode: no pre-validation, all codes accepted */
  standaloneMode?: boolean;
  /** Hide the code list (parent manages display) */
  hideCodeList?: boolean;
}

export function MultiCodeScanner({ 
  scannedCodes, 
  onCodesChange, 
  validPatrimonies,
  disabled,
  standaloneMode = false,
  hideCodeList = false,
}: MultiCodeScannerProps) {
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScannerActive(false);
  }, []);

  const handleCodeScanned = useCallback((code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;
    
    if (scannedCodes.has(normalizedCode)) {
      // Code already scanned, don't do anything (as requested)
      console.log(`[MultiCodeScanner] Code ${normalizedCode} already scanned, ignoring`);
      return;
    }
    
    const newCodes = new Set(scannedCodes);
    newCodes.add(normalizedCode);
    onCodesChange(newCodes);
    
    // In standalone mode, no validation - just confirm it was added
    if (standaloneMode) {
      toast.success(`✓ Código ${normalizedCode} adicionado`);
    } else {
      // Check if code is valid against ERP list
      const isValid = validPatrimonies.has(normalizedCode);
      if (isValid) {
        toast.success(`✓ Patrimônio ${normalizedCode} encontrado na lista`);
      } else {
        toast.warning(`⚠ Código ${normalizedCode} não encontrado na lista do cliente`);
      }
    }
  }, [scannedCodes, onCodesChange, validPatrimonies, standaloneMode]);

  const handleManualAdd = () => {
    const code = manualInput.trim().toUpperCase();
    if (!code) return;
    
    if (scannedCodes.has(code)) {
      toast.info('Código já foi adicionado');
      return;
    }
    
    handleCodeScanned(code);
    setManualInput('');
  };

  const handleRemoveCode = (code: string) => {
    const newCodes = new Set(scannedCodes);
    newCodes.delete(code);
    onCodesChange(newCodes);
  };

  const startScanner = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setIsScannerActive(true);
      
      // Wait for container
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      if (!containerRef.current) {
        throw new Error('Container not ready');
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      
      scannerRef.current = new Html5Qrcode('multi-code-reader');
      
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          // Enable barcode formats
          formatsToSupport: undefined, // All formats
        },
        (decodedText: string) => {
          handleCodeScanned(decodedText);
          // Don't stop - keep scanning for more codes
        },
        () => {
          // Ignore scan errors
        }
      );
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
      setIsLoading(false);
      setIsScannerActive(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // Count valid/invalid codes
  const validCount = Array.from(scannedCodes).filter(c => validPatrimonies.has(c)).length;
  const invalidCount = scannedCodes.size - validCount;

  return (
    <div className="space-y-3">
      {/* Manual input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Digite o patrimônio..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            className="pl-9 uppercase"
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleManualAdd}
          disabled={!manualInput.trim() || disabled}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Scanner toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant={isScannerActive ? "destructive" : "secondary"}
          size="sm"
          onClick={isScannerActive ? stopScanner : startScanner}
          disabled={disabled}
          className="gap-2"
        >
          {isScannerActive ? (
            <>
              <CameraOff className="w-4 h-4" />
              Parar Scanner
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              Escanear Códigos
            </>
          )}
        </Button>
        
        {/* Counter with validation status */}
        <Badge variant="secondary" className="gap-1.5">
          <Barcode className="w-3 h-3" />
          {scannedCodes.size} lido(s)
        </Badge>
        
        {validCount > 0 && (
          <Badge variant="default" className="gap-1 bg-primary/90">
            <CheckCircle2 className="w-3 h-3" />
            {validCount} válido(s)
          </Badge>
        )}
        
        {invalidCount > 0 && (
          <Badge variant="outline" className="gap-1 border-status-waiting text-status-waiting">
            <AlertCircle className="w-3 h-3" />
            {invalidCount} não encontrado(s)
          </Badge>
        )}
      </div>

      {/* Scanner area */}
      {isScannerActive && (
        <div className="relative rounded-lg overflow-hidden border bg-muted/30">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <LoadingSpinner text="Iniciando câmera..." />
            </div>
          )}
          {error ? (
            <div className="text-center py-6">
              <p className="text-destructive text-sm mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={stopScanner}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={containerRef}
                id="multi-code-reader"
                className="w-full min-h-[180px]"
              />
              <p className="text-xs text-muted-foreground text-center py-2 bg-background/80">
                Aponte para o código de barras ou QR Code
              </p>
            </>
          )}
        </div>
      )}

      {/* Scanned codes list with validation status - can be hidden if parent manages display */}
      {!hideCodeList && scannedCodes.size > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Códigos lidos:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(scannedCodes).map((code) => {
              const isValid = standaloneMode || validPatrimonies.has(code);
              return (
                <Badge
                  key={code}
                  variant={isValid ? "default" : "outline"}
                  className={`gap-1 pr-1 font-mono ${
                    standaloneMode 
                      ? '' 
                      : isValid 
                        ? 'bg-primary/90' 
                        : 'border-status-waiting text-status-waiting'
                  }`}
                >
                  {!standaloneMode && (isValid ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  ))}
                  {code}
                  <button
                    type="button"
                    onClick={() => handleRemoveCode(code)}
                    className={`ml-1 p-0.5 rounded ${
                      isValid 
                        ? 'hover:bg-primary-foreground/20' 
                        : 'hover:bg-destructive/20'
                    }`}
                    disabled={disabled}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
