import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface QRCodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export function QRCodeScanner({ open, onClose, onScan }: QRCodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  }, []);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  useEffect(() => {
    if (!open) {
      setIsLoading(true);
      setError(null);
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        // Wait for the container to be in the DOM
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        if (!mounted || !containerRef.current) return;

        // Dynamically import html5-qrcode to avoid React conflicts
        const { Html5Qrcode } = await import('html5-qrcode');
        
        if (!mounted) return;

        scannerRef.current = new Html5Qrcode('qr-reader');
        
        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            onScan(decodedText);
            stopScanner();
            onClose();
          },
          () => {
            // Ignore scan errors (no QR found)
          }
        );
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error starting QR scanner:', err);
        if (mounted) {
          setError('Não foi possível acessar a câmera. Verifique as permissões.');
          setIsLoading(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [open, onScan, onClose, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Escanear QR Code</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="p-4 pt-0">
          {error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <LoadingSpinner text="Iniciando câmera..." />
                </div>
              )}
              <div
                ref={containerRef}
                id="qr-reader"
                className="w-full rounded-lg overflow-hidden min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Aponte a câmera para o QR Code
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
