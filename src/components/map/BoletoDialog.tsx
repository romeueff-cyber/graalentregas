import { useState, useEffect } from 'react';
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
import { Loader2, FileText, Copy, ExternalLink, QrCode, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { useBoleto, type CreateBoletoRequest, type BoletoResponse } from '@/hooks/useBoleto';
import { useERPBoletoData } from '@/hooks/useERPBoletoData';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

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

interface GeneratedBoleto {
  installment: number;
  days: number;
  dueDate: string;
  result: BoletoResponse;
}

interface InstallmentStatus {
  index: number;
  status: 'pending' | 'generating' | 'success' | 'error';
}

export function BoletoDialog({ order, open, onOpenChange }: BoletoDialogProps) {
  const { createBoleto, formatCurrency, openBoletoUrl, copyToClipboard, isLoading } = useBoleto();
  const { 
    fetchBoletoData, 
    calculateDueDates, 
    formatDocument: formatDocumentFromERP,
    data: erpData,
    isLoading: isLoadingERP,
    error: erpError,
    reset: resetERP
  } = useERPBoletoData();
  
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [generatedBoletos, setGeneratedBoletos] = useState<GeneratedBoleto[]>([]);
  const [hasLoadedERP, setHasLoadedERP] = useState(false);
  const [installmentStatuses, setInstallmentStatuses] = useState<InstallmentStatus[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form state
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isBoleto, setIsBoleto] = useState<boolean | null>(null);

  // Load ERP data when dialog opens
  useEffect(() => {
    if (open && order && !hasLoadedERP) {
      setHasLoadedERP(true);
      fetchBoletoData(order.order_number).then((data) => {
        if (data) {
          setIsBoleto(data.payment.method_type === 'BOL');
          
          if (data.customer.document) {
            setDocument(formatDocumentFromERP(data.customer.document, data.customer.document_type));
          }
          
          if (data.customer.email) {
            setEmail(data.customer.email);
          }
          
          // Initialize installment statuses
          setInstallmentStatuses(
            data.payment.due_days.map((_, i) => ({ index: i, status: 'pending' }))
          );
        }
      });
    }
  }, [open, order, hasLoadedERP, fetchBoletoData, formatDocumentFromERP]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasLoadedERP(false);
      setIsBoleto(null);
      setGeneratedBoletos([]);
      setStep('form');
      setInstallmentStatuses([]);
      setIsGenerating(false);
      resetERP();
    }
  }, [open, resetERP]);

  if (!order) return null;

  const totalAmount = order.items.reduce((sum, item) => sum + item.total, 0);
  const numInstallments = erpData?.payment.due_days.length || 1;
  const installmentAmount = totalAmount / numInstallments;

  const getDueDatesFromTerms = () => {
    if (!erpData) return [];
    return calculateDueDates(erpData.payment.terms_code);
  };

  const handleGenerate = async () => {
    if (!document) {
      toast.error('Informe o CPF/CNPJ');
      return;
    }

    const dueDates = getDueDatesFromTerms();
    const installmentsToGenerate = erpData?.payment.due_days.map((days, index) => ({
      index,
      days,
      dueDate: dueDates[index]?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    })) || [];

    if (installmentsToGenerate.length === 0) {
      toast.error('Nenhuma parcela para gerar');
      return;
    }

    setIsGenerating(true);
    const results: GeneratedBoleto[] = [];

    for (let i = 0; i < installmentsToGenerate.length; i++) {
      const inst = installmentsToGenerate[i];
      
      // Update status to generating
      setInstallmentStatuses(prev => 
        prev.map(s => s.index === inst.index ? { ...s, status: 'generating' } : s)
      );

      const installmentTotal = Math.round(installmentAmount * 100);

      const request: CreateBoletoRequest = {
        orderNumber: numInstallments > 1 ? `${order.order_number}-${inst.index + 1}` : order.order_number,
        customer: {
          name: order.client_name,
          document: document,
          documentType: erpData?.customer.document_type,
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
        services: [{
          name: numInstallments > 1 
            ? `Pedido ${order.order_number} - Parcela ${inst.index + 1}/${numInstallments}`
            : `Pedido ${order.order_number}`,
          description: order.items.map(item => `${item.quantity}x ${item.product}`).join(', ').substring(0, 100),
          amount: installmentTotal,
        }],
        dueDate: inst.dueDate,
        fine: { rate: 2 },
        interest: { rate: 1 },
        notification: email ? {
          name: order.client_name,
          email: email,
          rules: ['BEFORE_DUE_DATE', 'DUE_DATE', 'OVERDUE'],
        } : undefined,
        production: true,
      };

      const result = await createBoleto(request);
      
      if (result) {
        results.push({
          installment: inst.index + 1,
          days: inst.days,
          dueDate: inst.dueDate,
          result,
        });
        setInstallmentStatuses(prev => 
          prev.map(s => s.index === inst.index ? { ...s, status: 'success' } : s)
        );
      } else {
        setInstallmentStatuses(prev => 
          prev.map(s => s.index === inst.index ? { ...s, status: 'error' } : s)
        );
      }
    }

    setIsGenerating(false);

    if (results.length > 0) {
      setGeneratedBoletos(results);
      setStep('result');
      toast.success(`${results.length} boleto(s) gerado(s)!`);
    } else {
      toast.error('Nenhum boleto foi gerado');
    }
  };

  const handleClose = () => {
    setStep('form');
    setGeneratedBoletos([]);
    setDocument('');
    setEmail('');
    setZipCode('');
    setInstallmentStatuses([]);
    onOpenChange(false);
  };

  const formatDocumentInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const dueDates = getDueDatesFromTerms();
  const installmentOptions = erpData?.payment.due_days.map((days, index) => ({
    index,
    days,
    dueDate: dueDates[index]?.toISOString().split('T')[0] || '',
    amount: installmentAmount,
  })) || [];

  const getStatusIcon = (index: number) => {
    const status = installmentStatuses.find(s => s.index === index)?.status;
    switch (status) {
      case 'generating':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5" style={{ color: 'hsl(var(--success, 142 76% 36%))' }} />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground/40" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {step === 'form' ? 'Gerar Boleto(s)' : `${generatedBoletos.length} Boleto(s) Gerado(s)`}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Loading ERP Data */}
              {isLoadingERP && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando dados do ERP...
                </div>
              )}

              {/* ERP Error */}
              {erpError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{erpError}</AlertDescription>
                </Alert>
              )}

              {/* Not a boleto order warning */}
              {isBoleto === false && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Este pedido não é boleto bancário ({erpData?.payment.method_description})
                  </AlertDescription>
                </Alert>
              )}

              {/* Order Summary */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">Pedido #{order.order_number}</p>
                <p className="text-sm text-muted-foreground">{order.client_name}</p>
                <p className="text-lg font-semibold mt-1">
                  Total: {formatCurrency(Math.round(totalAmount * 100))}
                </p>
              </div>

              {/* Document Input */}
              <div className="space-y-2">
                <Label htmlFor="document">CPF/CNPJ *</Label>
                <Input
                  id="document"
                  placeholder="000.000.000-00"
                  value={document}
                  onChange={(e) => setDocument(formatDocumentInput(e.target.value))}
                  maxLength={18}
                  disabled={isGenerating}
                />
                {erpData?.customer.document && (
                  <p className="text-xs text-muted-foreground">
                    Preenchido do ERP ({erpData.customer.document_type})
                  </p>
                )}
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
                  disabled={isGenerating}
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
                  disabled={isGenerating}
                />
              </div>

              {/* Installments List */}
              {installmentOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>
                    {installmentOptions.length > 1 
                      ? `Parcelas (${installmentOptions.length}x)`
                      : 'Vencimento'
                    }
                  </Label>
                  <div className="border rounded-lg divide-y">
                    {installmentOptions.map((opt) => (
                      <div key={opt.index} className="flex items-center gap-3 p-3">
                        {getStatusIcon(opt.index)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {installmentOptions.length > 1 
                              ? `${opt.index + 1}ª Parcela`
                              : 'Boleto'
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento: {formatDate(opt.dueDate)} • {opt.days} dias
                          </p>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCurrency(Math.round(opt.amount * 100))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {step === 'result' && generatedBoletos.length > 0 && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {generatedBoletos.map((boleto) => (
                <div key={boleto.installment} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" style={{ color: 'hsl(var(--success, 142 76% 36%))' }} />
                      <div>
                        <p className="font-medium">
                          {generatedBoletos.length > 1 ? `${boleto.installment}ª Parcela` : 'Boleto'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Venc: {formatDate(boleto.dueDate)}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold">
                      {formatCurrency(boleto.result.total_amount)}
                    </span>
                  </div>

                  {/* Digitable Line */}
                  <div className="bg-muted/50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <code className="text-xs flex-1 break-all">
                        {boleto.result.payment_options.bank_slip.digitable}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(boleto.result.payment_options.bank_slip.digitable, 'barcode')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {boleto.result.pix && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => copyToClipboard(boleto.result.pix!.emv, 'pix')}
                      >
                        <QrCode className="w-4 h-4 mr-1" />
                        PIX
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openBoletoUrl(boleto.result.payment_options.bank_slip.url)}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isLoading || isLoadingERP || isGenerating || !document}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar {installmentOptions.length > 1 ? `${installmentOptions.length} Boletos` : 'Boleto'}
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button className="w-full" onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}