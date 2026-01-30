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
import { Loader2, FileText, Copy, ExternalLink, QrCode, AlertCircle, CheckCircle2, ListChecks } from 'lucide-react';
import { useBoleto, type CreateBoletoRequest, type BoletoResponse } from '@/hooks/useBoleto';
import { useERPBoletoData } from '@/hooks/useERPBoletoData';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
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
  
  const [step, setStep] = useState<'form' | 'generating' | 'result'>('form');
  const [generatedBoletos, setGeneratedBoletos] = useState<GeneratedBoleto[]>([]);
  const [hasLoadedERP, setHasLoadedERP] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  
  // Form state
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([]);
  const [zipCode, setZipCode] = useState('');
  const [isBoleto, setIsBoleto] = useState<boolean | null>(null);

  // Load ERP data when dialog opens
  useEffect(() => {
    if (open && order && !hasLoadedERP) {
      setHasLoadedERP(true);
      fetchBoletoData(order.order_number).then((data) => {
        if (data) {
          // Check if it's a boleto order
          setIsBoleto(data.payment.method_type === 'BOL');
          
          // Auto-fill document
          if (data.customer.document) {
            setDocument(formatDocumentFromERP(data.customer.document, data.customer.document_type));
          }
          
          // Auto-fill email
          if (data.customer.email) {
            setEmail(data.customer.email);
          }
          
          // Select all installments by default
          if (data.payment.due_days.length > 0) {
            setSelectedInstallments(data.payment.due_days.map((_, i) => i));
          }
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
      setSelectedInstallments([]);
      setGeneratingProgress({ current: 0, total: 0 });
      resetERP();
    }
  }, [open, resetERP]);

  // Toggle installment selection
  const toggleInstallment = (index: number) => {
    setSelectedInstallments(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  };

  // Select/deselect all
  const toggleAllInstallments = () => {
    if (erpData) {
      if (selectedInstallments.length === erpData.payment.due_days.length) {
        setSelectedInstallments([]);
      } else {
        setSelectedInstallments(erpData.payment.due_days.map((_, i) => i));
      }
    }
  };

  if (!order) return null;

  const totalAmount = order.items.reduce((sum, item) => sum + item.total, 0);
  const installmentAmount = erpData && erpData.payment.due_days.length > 0
    ? totalAmount / erpData.payment.due_days.length
    : totalAmount;

  // Calculate due dates based on payment terms
  const getDueDatesFromTerms = () => {
    if (!erpData) return [];
    return calculateDueDates(erpData.payment.terms_code);
  };

  const handleGenerate = async () => {
    if (!document || selectedInstallments.length === 0) {
      toast.error('Selecione pelo menos uma parcela');
      return;
    }

    const dueDates = getDueDatesFromTerms();
    const installmentsToGenerate = selectedInstallments.map(index => ({
      index,
      days: erpData?.payment.due_days[index] || 0,
      dueDate: dueDates[index]?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    }));

    setStep('generating');
    setGeneratingProgress({ current: 0, total: installmentsToGenerate.length });
    
    const results: GeneratedBoleto[] = [];

    for (let i = 0; i < installmentsToGenerate.length; i++) {
      const inst = installmentsToGenerate[i];
      setGeneratingProgress({ current: i + 1, total: installmentsToGenerate.length });

      // Calculate amount per installment
      const numInstallments = erpData?.payment.due_days.length || 1;
      const installmentTotal = Math.round(totalAmount / numInstallments * 100); // in cents

      const request: CreateBoletoRequest = {
        orderNumber: `${order.order_number}-${inst.index + 1}`, // Add installment suffix
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
          name: `Pedido ${order.order_number} - Parcela ${inst.index + 1}/${numInstallments}`,
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
        production: false,
      };

      const result = await createBoleto(request);
      if (result) {
        results.push({
          installment: inst.index + 1,
          days: inst.days,
          dueDate: inst.dueDate,
          result,
        });
      } else {
        toast.error(`Erro ao gerar parcela ${inst.index + 1}`);
      }
    }

    if (results.length > 0) {
      setGeneratedBoletos(results);
      setStep('result');
      toast.success(`${results.length} boleto(s) gerado(s) com sucesso!`);
    } else {
      toast.error('Nenhum boleto foi gerado');
      setStep('form');
    }
  };

  const handleClose = () => {
    setStep('form');
    setGeneratedBoletos([]);
    setDocument('');
    setEmail('');
    setZipCode('');
    setSelectedInstallments([]);
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

  // Get installment options from ERP data
  const installmentOptions = erpData?.payment.due_days.map((days, index) => {
    const dueDates = getDueDatesFromTerms();
    return {
      index,
      label: `${index + 1}ª parcela`,
      days,
      dueDate: dueDates[index]?.toISOString().split('T')[0] || '',
      amount: installmentAmount,
    };
  }) || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {step === 'form' && 'Gerar Boleto(s)'}
            {step === 'generating' && 'Gerando Boletos...'}
            {step === 'result' && `${generatedBoletos.length} Boleto(s) Gerado(s)`}
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
                  <AlertDescription>
                    {erpError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Not a boleto order warning */}
              {isBoleto === false && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Este pedido não é boleto bancário no ERP ({erpData?.payment.method_description})
                  </AlertDescription>
                </Alert>
              )}

              {/* ERP Data loaded successfully */}
              {erpData && isBoleto && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--success, 142 76% 36%))' }}>
                  <CheckCircle2 className="w-4 h-4" />
                  Dados do ERP: {erpData.payment.terms_description}
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">Pedido #{order.order_number}</p>
                <p className="text-sm text-muted-foreground">{order.client_name}</p>
                <p className="text-lg font-semibold mt-1">
                  Total: {formatCurrency(Math.round(totalAmount * 100))}
                </p>
                {installmentOptions.length > 1 && (
                  <p className="text-sm text-muted-foreground">
                    {installmentOptions.length}x de {formatCurrency(Math.round(installmentAmount * 100))}
                  </p>
                )}
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
                />
                {erpData?.customer.document && (
                  <p className="text-xs text-muted-foreground">
                    Preenchido automaticamente do ERP ({erpData.customer.document_type})
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
                />
              </div>

              {/* Installment Selection */}
              {installmentOptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Parcelas a gerar</Label>
                    {installmentOptions.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={toggleAllInstallments}
                        className="h-auto py-1 px-2 text-xs"
                      >
                        <ListChecks className="w-3 h-3 mr-1" />
                        {selectedInstallments.length === installmentOptions.length ? 'Desmarcar' : 'Selecionar'} todas
                      </Button>
                    )}
                  </div>
                  <div className="border rounded-lg divide-y">
                    {installmentOptions.map((opt) => (
                      <div 
                        key={opt.index} 
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleInstallment(opt.index)}
                      >
                        <Checkbox 
                          checked={selectedInstallments.includes(opt.index)}
                          onCheckedChange={() => toggleInstallment(opt.index)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Venc: {formatDate(opt.dueDate)} ({opt.days} dias)
                          </p>
                        </div>
                        <span className="text-sm font-medium">
                          {formatCurrency(Math.round(opt.amount * 100))}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedInstallments.length} de {installmentOptions.length} selecionada(s)
                  </p>
                </div>
              )}

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
            </div>
          </ScrollArea>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-lg font-medium">
              Gerando boleto {generatingProgress.current} de {generatingProgress.total}...
            </p>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto processamos os boletos
            </p>
          </div>
        )}

        {step === 'result' && generatedBoletos.length > 0 && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {generatedBoletos.map((boleto) => (
                <div key={boleto.installment} className="border rounded-lg p-3 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {generatedBoletos.length > 1 ? `${boleto.installment}ª Parcela` : 'Boleto'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Venc: {formatDate(boleto.dueDate)} ({boleto.days} dias)
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {boleto.result.status}
                    </Badge>
                  </div>

                  {/* Amount */}
                  <p className="text-lg font-semibold">
                    {formatCurrency(boleto.result.total_amount)}
                  </p>

                  {/* Digitable Line */}
                  <div className="bg-muted/50 p-2 rounded">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Linha Digitável
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs flex-1 break-all">
                        {boleto.result.payment_options.bank_slip.digitable}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(
                          boleto.result.payment_options.bank_slip.digitable, 
                          'barcode'
                        )}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* PIX */}
                  {boleto.result.pix && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => copyToClipboard(boleto.result.pix!.emv, 'pix')}
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Copiar PIX
                      </Button>
                    </div>
                  )}

                  {/* PDF Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openBoletoUrl(boleto.result.payment_options.bank_slip.url)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir PDF
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isLoading || isLoadingERP || !document || selectedInstallments.length === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar {selectedInstallments.length > 1 ? `${selectedInstallments.length} Boletos` : 'Boleto'}
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