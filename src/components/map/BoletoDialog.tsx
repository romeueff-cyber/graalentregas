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
import { Loader2, FileText, Copy, ExternalLink, QrCode, AlertCircle, CheckCircle2, Circle, RefreshCw, Printer, Eye, Trash2 } from 'lucide-react';
import { useBoleto, type CreateBoletoRequest, type BoletoResponse, type ExistingBoleto } from '@/hooks/useBoleto';
import { useBoletoSettings } from '@/hooks/useBoletoSettings';
import { useERPBoletoData } from '@/hooks/useERPBoletoData';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { parseDateInSaoPaulo, getNowSaoPaulo, toSaoPauloDateString } from '@/lib/date-utils';

interface Order {
  order_number: string;
  client_name: string;
  phone: string | null;
  expected_delivery: string | null;
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
  const { createBoleto, formatCurrency, openBoletoUrl, copyToClipboard, printBoleto, checkExistingBoletos, getAllBoletos, deleteExistingBoletos, cancelBoleto, isLoading } = useBoleto();
  const { boletoSettings, buildBoletoPaymentTerms } = useBoletoSettings();
  const { 
    fetchBoletoData, 
    calculateDueDates, 
    formatDocument: formatDocumentFromERP,
    data: erpData,
    isLoading: isLoadingERP,
    error: erpError,
    reset: resetERP
  } = useERPBoletoData();
  
  const [step, setStep] = useState<'checking' | 'existing' | 'form' | 'result' | 'preview'>('checking');
  const [generatedBoletos, setGeneratedBoletos] = useState<GeneratedBoleto[]>([]);
  const [existingBoletos, setExistingBoletos] = useState<ExistingBoleto[]>([]);
  const [cancelledBoletos, setCancelledBoletos] = useState<ExistingBoleto[]>([]);
  const [hasLoadedERP, setHasLoadedERP] = useState(false);
  const [installmentStatuses, setInstallmentStatuses] = useState<InstallmentStatus[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Form state
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isBoleto, setIsBoleto] = useState<boolean | null>(null);
  const [erpIdEmpresa, setErpIdEmpresa] = useState<number | null>(null);

  // Check for existing boletos and load ERP data when dialog opens
  useEffect(() => {
    if (open && order && !hasLoadedERP) {
      setHasLoadedERP(true);
      setStep('checking');
      
      // Check for all boletos (including cancelled for history)
      getAllBoletos(order.order_number).then((allBoletos) => {
        const active = allBoletos.filter(b => b.status !== 'CANCELLED' && b.status !== 'CANCELADO');
        const cancelled = allBoletos.filter(b => b.status === 'CANCELLED' || b.status === 'CANCELADO');
        
        setCancelledBoletos(cancelled);
        
        if (active.length > 0) {
          setExistingBoletos(active);
          setStep('existing');
        } else if (cancelled.length > 0) {
          // Only cancelled boletos exist - show form to generate new ones but with history visible
          setExistingBoletos([]);
          setStep('form');
        } else {
          setStep('form');
        }
      });
      
      // Load ERP data in parallel
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
  }, [open, order, hasLoadedERP, fetchBoletoData, formatDocumentFromERP, getAllBoletos]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasLoadedERP(false);
      setIsBoleto(null);
      setGeneratedBoletos([]);
      setExistingBoletos([]);
      setCancelledBoletos([]);
      setStep('checking');
      setInstallmentStatuses([]);
      setIsGenerating(false);
      setIsCanceling(false);
      setPreviewUrl(null);
      resetERP();
    }
  }, [open, resetERP]);

  const handleRegenerate = async () => {
    if (!order) return;
    
    const confirmed = window.confirm(
      `Já existem ${existingBoletos.length} boleto(s) gerado(s) para este pedido.\n\nDeseja gerar novos boletos? Os registros anteriores serão removidos do sistema (os boletos já emitidos na Cora continuarão válidos).`
    );
    
    if (confirmed) {
      await deleteExistingBoletos(order.order_number);
      setExistingBoletos([]);
      setStep('form');
      toast.success('Boletos anteriores removidos. Pronto para gerar novos.');
    }
  };

  const handleCancelBoleto = async () => {
    if (!order) return;
    
    const confirmed = window.confirm(
      `Tem certeza que deseja cancelar ${existingBoletos.length} boleto(s) para o pedido #${order.order_number}?\n\nEsta ação irá:\n• Cancelar o(s) boleto(s) na instituição bancária (Cora)\n• Manter o(s) registro(s) no histórico como cancelado(s)\n\nBoletos já pagos não podem ser cancelados.`
    );
    
    if (confirmed) {
      setIsCanceling(true);
      const success = await cancelBoleto(order.order_number);
      setIsCanceling(false);
      
      if (success) {
        // Move to cancelled list
        setCancelledBoletos(prev => [...prev, ...existingBoletos.map(b => ({ ...b, status: 'CANCELLED' }))]);
        setExistingBoletos([]);
        setStep('form'); // Go to form to allow generating new boletos
      }
    }
  };

  const handleViewExisting = () => {
    // Convert existing boletos to generatedBoletos format for display
    const converted: GeneratedBoleto[] = existingBoletos.map((b, index) => ({
      installment: index + 1,
      days: 0,
      dueDate: b.due_date,
      result: {
        id: b.cora_invoice_id,
        status: b.status,
        created_at: b.created_at,
        total_amount: b.total_amount,
        total_paid: 0,
        code: '',
        customer: {
          name: b.customer_name,
          document: { identity: '', type: '' },
        },
        payment_options: {
          bank_slip: {
            barcode: '',
            digitable: b.digitable_line || '',
            registered: true,
            url: b.pdf_url || '',
            our_number: '',
          },
        },
        pix: b.pix_emv ? { emv: b.pix_emv, qr_code_url: '' } : undefined,
      },
    }));
    setGeneratedBoletos(converted);
    setStep('result');
  };

  const handleOpenPreview = (url: string) => {
    setPreviewUrl(url);
    setStep('preview');
  };

  const handlePrint = () => {
    if (previewUrl) {
      printBoleto(previewUrl);
    }
  };

  if (!order) return null;

  const totalAmount = order.items.reduce((sum, item) => sum + item.total, 0);
  const numInstallments = erpData?.payment.due_days.length || 1;
  const installmentAmount = totalAmount / numInstallments;

  const getDueDatesFromTerms = () => {
    if (!erpData) return [];
    // Use expected_delivery as base date for due date calculation
    // Parse the date in São Paulo timezone to avoid UTC offset issues
    // Example: "2026-01-31T01:12:00.000Z" is actually "2026-01-30 22:12" in São Paulo
    const baseDate = parseDateInSaoPaulo(order.expected_delivery);
    return calculateDueDates(erpData.payment.terms_code, baseDate);
  };

  const handleGenerate = async () => {
    if (!document) {
      toast.error('Informe o CPF/CNPJ');
      return;
    }

    const dueDates = getDueDatesFromTerms();
    const today = getNowSaoPaulo();
    today.setHours(0, 0, 0, 0);
    
    const installmentsToGenerate = erpData?.payment.due_days.map((days, index) => {
      let dueDate = dueDates[index] || new Date();
      
      // If the calculated due date is in the past, use today instead
      // Cora API doesn't accept past dates for boleto creation
      if (dueDate < today) {
        dueDate = today;
      }
      
      return {
        index,
        days,
        dueDate: toSaoPauloDateString(dueDate),
      };
    }) || [];

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
        ...buildBoletoPaymentTerms(boletoSettings),
        notification: email ? {
          name: order.client_name,
          email: email,
          rules: ['BEFORE_DUE_DATE', 'DUE_DATE', 'OVERDUE'],
        } : undefined,
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
      <DialogContent className={step === 'preview' ? 'max-w-4xl max-h-[95vh]' : 'max-w-md max-h-[90vh]'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {step === 'checking' && 'Verificando...'}
            {step === 'existing' && 'Boleto(s) já Emitido(s)'}
            {step === 'form' && 'Gerar Boleto(s)'}
            {step === 'result' && `${generatedBoletos.length} Boleto(s)`}
            {step === 'preview' && 'Visualizar Boleto'}
          </DialogTitle>
        </DialogHeader>

        {/* Checking Step */}
        {step === 'checking' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Existing Boletos Warning */}
        {step === 'existing' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Já existe(m) <strong>{existingBoletos.length}</strong> boleto(s) gerado(s) para o pedido #{order.order_number}.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg divide-y">
              {existingBoletos.map((boleto, index) => (
                <div key={boleto.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium">
                      {existingBoletos.length > 1 ? `${index + 1}ª Parcela` : 'Boleto'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Venc: {formatDate(boleto.due_date)} • {formatCurrency(boleto.total_amount)}
                    </p>
                  </div>
                  <Badge variant={boleto.status === 'PAID' ? 'default' : 'secondary'}>
                    {boleto.status === 'PAID' ? 'Pago' : boleto.status === 'REGISTERED' ? 'Registrado' : 'Pendente'}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleViewExisting}>
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Boletos
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleRegenerate}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reemitir
                </Button>
              </div>
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={handleCancelBoleto}
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Cancelar Boleto(s)
              </Button>
            </div>
          </div>
        )}

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

              {/* Cancelled Boletos History */}
              {cancelledBoletos.length > 0 && (
                <Alert className="border-status-waiting/50 bg-status-waiting/5">
                  <AlertCircle className="h-4 w-4 text-status-waiting" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium">Histórico:</span> {cancelledBoletos.length} boleto(s) cancelado(s)
                    <div className="mt-2 space-y-1">
                      {cancelledBoletos.map((b, i) => (
                        <div key={b.id} className="flex justify-between text-xs text-muted-foreground">
                          <span>{b.order_number}</span>
                          <span>Venc: {formatDate(b.due_date)}</span>
                          <span>{formatCurrency(b.total_amount)}</span>
                        </div>
                      ))}
                    </div>
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
                  {boleto.result.payment_options.bank_slip.digitable && (
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
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {boleto.result.pix && boleto.result.pix.emv && (
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
                    {boleto.result.payment_options.bank_slip.url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleOpenPreview(boleto.result.payment_options.bank_slip.url)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openBoletoUrl(boleto.result.payment_options.bank_slip.url)}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* PDF Preview Step */}
        {step === 'preview' && previewUrl && (
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '70vh' }}>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                className="w-full h-full"
                title="Boleto PDF"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'checking' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          {step === 'existing' && (
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          )}
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
          {step === 'preview' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setStep('result')}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}