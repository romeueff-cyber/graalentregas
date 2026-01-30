import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Copy, ExternalLink, QrCode } from 'lucide-react';
import { useBoleto, type CreateBoletoRequest, type BoletoResponse } from '@/hooks/useBoleto';
import { Badge } from '@/components/ui/badge';

interface Order {
  order_number: string;
  client_name: string;
  phone: string | null;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: {
    product: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

interface BoletoDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoletoDialog({ order, open, onOpenChange }: BoletoDialogProps) {
  const { createBoleto, formatCurrency, openBoletoUrl, copyToClipboard, isLoading } = useBoleto();
  
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [boletoResult, setBoletoResult] = useState<BoletoResponse | null>(null);
  
  // Form state
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7); // Default: 7 days from now
    return date.toISOString().split('T')[0];
  });
  const [zipCode, setZipCode] = useState('');

  if (!order) return null;

  const totalAmount = order.items.reduce((sum, item) => sum + item.total, 0);

  const handleGenerate = async () => {
    if (!document || !dueDate) {
      return;
    }

    const request: CreateBoletoRequest = {
      orderNumber: order.order_number,
      customer: {
        name: order.client_name,
        document: document,
        email: email || undefined,
        address: order.address.street ? {
          street: order.address.street,
          number: order.address.number || 'S/N',
          district: order.address.neighborhood || 'Centro',
          city: order.address.city || 'Cidade',
          state: order.address.state || 'SP',
          complement: order.address.complement || '',
          zipCode: zipCode || '00000000',
        } : undefined,
      },
      services: order.items.map(item => ({
        name: item.product.substring(0, 50),
        description: `${item.quantity}x ${item.product}`.substring(0, 100),
        amount: Math.round(item.total * 100), // Convert to cents
      })),
      dueDate,
      // Default: 2% fine after due date
      fine: { rate: 2 },
      // Default: 1% monthly interest
      interest: { rate: 1 },
      notification: email ? {
        name: order.client_name,
        email: email,
        rules: ['BEFORE_DUE_DATE', 'DUE_DATE', 'OVERDUE'],
      } : undefined,
      production: false, // Use staging for now
    };

    const result = await createBoleto(request);
    if (result) {
      setBoletoResult(result);
      setStep('result');
    }
  };

  const handleClose = () => {
    setStep('form');
    setBoletoResult(null);
    setDocument('');
    setEmail('');
    setZipCode('');
    onOpenChange(false);
  };

  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      // CPF: 000.000.000-00
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {step === 'form' ? 'Gerar Boleto' : 'Boleto Gerado'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium">Pedido #{order.order_number}</p>
              <p className="text-sm text-muted-foreground">{order.client_name}</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(Math.round(totalAmount * 100))}
              </p>
            </div>

            {/* Document Input */}
            <div className="space-y-2">
              <Label htmlFor="document">CPF/CNPJ *</Label>
              <Input
                id="document"
                placeholder="000.000.000-00"
                value={document}
                onChange={(e) => setDocument(formatDocument(e.target.value))}
                maxLength={18}
              />
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Para enviar notificações de cobrança
              </p>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* ZIP Code */}
            <div className="space-y-2">
              <Label htmlFor="zipCode">CEP (opcional)</Label>
              <Input
                id="zipCode"
                placeholder="00000-000"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').substring(0, 8))}
                maxLength={9}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isLoading || !document || !dueDate}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Boleto
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && boletoResult && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-sm">
                {boletoResult.status}
              </Badge>
              <span className="text-lg font-semibold">
                {formatCurrency(boletoResult.total_amount)}
              </span>
            </div>

            {/* Bank Slip Info */}
            <div className="space-y-3">
              {/* Digitable Line */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Linha Digitável
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs flex-1 break-all">
                    {boletoResult.payment_options.bank_slip.digitable}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(
                      boletoResult.payment_options.bank_slip.digitable, 
                      'barcode'
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* PIX */}
              {boletoResult.pix && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    PIX Copia e Cola
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 truncate">
                      {boletoResult.pix.emv.substring(0, 40)}...
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(boletoResult.pix!.emv, 'pix')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  {boletoResult.pix.qr_code_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => window.open(boletoResult.pix!.qr_code_url, '_blank')}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Ver QR Code
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => openBoletoUrl(boletoResult.payment_options.bank_slip.url)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir PDF
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
