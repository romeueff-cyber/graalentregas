import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Camera, CameraOff, Plus, X, Barcode, Hash, CheckCircle2, AlertCircle, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const handleCodeScannedRef = useRef<(code: string) => void>(() => {});

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

    // Cooldown: ignore same code within 3 seconds
    const now = Date.now();
    if (lastScannedRef.current.code === normalizedCode && now - lastScannedRef.current.time < 3000) {
      return;
    }
    lastScannedRef.current = { code: normalizedCode, time: now };
    
    if (scannedCodes.has(normalizedCode)) {
      console.log(`[MultiCodeScanner] Code ${normalizedCode} already scanned, ignoring`);
      return;
    }
    
    const newCodes = new Set(scannedCodes);
    newCodes.add(normalizedCode);
    onCodesChange(newCodes);
    
    if (standaloneMode) {
      toast.success(`✓ Código ${normalizedCode} adicionado`);
    } else {
      const isValid = validPatrimonies.has(normalizedCode);
      if (isValid) {
        toast.success(`✓ Patrimônio ${normalizedCode} encontrado na lista`);
      } else {
        toast.warning(`⚠ Código ${normalizedCode} não encontrado na lista do cliente`);
      }
    }
  }, [scannedCodes, onCodesChange, validPatrimonies, standaloneMode]);

  // Keep ref updated so the scanner callback always uses the latest handler
  useEffect(() => {
    handleCodeScannedRef.current = handleCodeScanned;
  }, [handleCodeScanned]);

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

  // OCR photo handling
  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    event.target.value = '';

    try {
      setIsOcrLoading(true);

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log('[MultiCodeScanner] Sending image for OCR...');

      const { data, error: fnError } = await supabase.functions.invoke('ocr-patrimony', {
        body: { image: base64 }
      });

      if (fnError) {
        console.error('[MultiCodeScanner] OCR function error:', fnError);
        toast.error('Erro ao processar imagem. Tente novamente.');
        return;
      }

      if (data.error) {
        console.error('[MultiCodeScanner] OCR error:', data.error);
        toast.error(data.error);
        return;
      }

      console.log('[MultiCodeScanner] OCR result:', data);

      if (data.codes && data.codes.length > 0) {
        let addedCount = 0;
        for (const code of data.codes) {
          if (!scannedCodes.has(code)) {
            handleCodeScanned(code);
            addedCount++;
          }
        }
        
        if (addedCount > 0) {
          toast.success(`📷 ${addedCount} código(s) reconhecido(s) pela IA`);
        } else {
          toast.info('Código(s) já foram adicionados anteriormente');
        }
      } else {
        toast.warning('Nenhum código de patrimônio encontrado na imagem. Tente uma foto mais clara.');
      }
    } catch (err) {
      console.error('[MultiCodeScanner] Photo processing error:', err);
      toast.error('Erro ao processar foto');
    } finally {
      setIsOcrLoading(false);
    }
  };

  const startScanner = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setIsScannerActive(true);
      
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
          formatsToSupport: undefined,
        },
        (decodedText: string) => {
          handleCodeScannedRef.current(decodedText);
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

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const validCount = Array.from(scannedCodes).filter(c => validPatrimonies.has(c)).length;
  const invalidCount = scannedCodes.size - validCount;

  return (
    <div className="space-y-3">
      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

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

      {/* Scanner and OCR buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant={isScannerActive ? "destructive" : "secondary"}
          size="sm"
          onClick={isScannerActive ? stopScanner : startScanner}
          disabled={disabled || isOcrLoading}
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
              Código de Barras
            </>
          )}
        </Button>

        {/* OCR Photo button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePhotoCapture}
          disabled={disabled || isOcrLoading}
          className="gap-2"
        >
          {isOcrLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              Foto (IA)
            </>
          )}
        </Button>
        
        {/* Counter with validation status */}
        <Badge variant="secondary" className="gap-1.5">
          <Barcode className="w-3 h-3" />
          {scannedCodes.size} lido(s)
        </Badge>
        
        {!standaloneMode && validCount > 0 && (
          <Badge variant="default" className="gap-1 bg-primary/90">
            <CheckCircle2 className="w-3 h-3" />
            {validCount} válido(s)
          </Badge>
        )}
        
        {!standaloneMode && invalidCount > 0 && (
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

      {/* Scanned codes list with validation status */}
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
