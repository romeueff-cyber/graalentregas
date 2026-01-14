import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface QRCodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export function QRCodeScanner({ open, onClose, onScan }: QRCodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const startScanner = async () => {
      try {
        setError(null);
        
        // Wait for the container to be in the DOM
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        if (!containerRef.current) return;

        scannerRef.current = new Html5Qrcode('qr-reader');
        
        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
            onClose();
          },
          () => {
            // Ignore scan errors (no QR found)
          }
        );
      } catch (err) {
        console.error('Error starting QR scanner:', err);
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open, onScan, onClose]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

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
              <div
                ref={containerRef}
                id="qr-reader"
                className="w-full rounded-lg overflow-hidden"
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
