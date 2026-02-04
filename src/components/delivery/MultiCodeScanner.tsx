import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Camera, CameraOff, Plus, X, Barcode, Hash } from 'lucide-react';
import { toast } from 'sonner';

interface MultiCodeScannerProps {
  scannedCodes: Set<string>;
  onCodesChange: (codes: Set<string>) => void;
  disabled?: boolean;
}

export function MultiCodeScanner({ scannedCodes, onCodesChange, disabled }: MultiCodeScannerProps) {
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
    toast.success(`Código ${normalizedCode} adicionado`);
  }, [scannedCodes, onCodesChange]);

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

  return (
    <div className="space-y-3">
      {/* Manual input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Digite o patrimônio..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            className="pl-9"
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
      <div className="flex items-center gap-2">
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
        
        {/* Counter */}
        <Badge variant="secondary" className="gap-1.5">
          <Barcode className="w-3 h-3" />
          {scannedCodes.size} código(s) lido(s)
        </Badge>
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

      {/* Scanned codes list */}
      {scannedCodes.size > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Array.from(scannedCodes).map((code) => (
            <Badge
              key={code}
              variant="outline"
              className="gap-1 pr-1 font-mono"
            >
              {code}
              <button
                type="button"
                onClick={() => handleRemoveCode(code)}
                className="ml-1 p-0.5 rounded hover:bg-destructive/20"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
