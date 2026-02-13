import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  FileText, 
  Loader2, 
  User, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Package,
  Building,
} from 'lucide-react';
import { useBoleto, type CreateBoletoRequest, type BoletoResponse } from '@/hooks/useBoleto';
import { useERPBoletoData } from '@/hooks/useERPBoletoData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ManualBoletoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ERPClient {
  id: number;
  name: string;
  document: string;
  documentType: 'CPF' | 'CNPJ';
  email?: string;
}

interface ERPOrder {
  order_number: string;
  client_name: string;
  total_amount: number;
  expected_delivery: string | null;
  status: string;
  selected?: boolean;
}

export function ManualBoletoDialog({ open, onOpenChange, onSuccess }: ManualBoletoDialogProps) {
  const { createBoleto, formatCurrency, isLoading: isBoletoLoading } = useBoleto();
  const { fetchBoletoData } = useERPBoletoData();
  
  const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search');
  
  // Search mode state
  const [clientSearch, setClientSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [clients, setClients] = useState<ERPClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<ERPClient | null>(null);
  const [orders, setOrders] = useState<ERPOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return format(date, 'yyyy-MM-dd');
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  
  // Manual mode state
  const [manualOrderNumber, setManualOrderNumber] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualDocument, setManualDocument] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualDueDate, setManualDueDate] = useState(() => format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [manualDescription, setManualDescription] = useState('');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [editableAmount, setEditableAmount] = useState('');
  const [editableDueDate, setEditableDueDate] = useState('');
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setActiveTab('search');
      setClientSearch('');
      setClients([]);
      setSelectedClient(null);
      setOrders([]);
      setSelectedOrderNumber(null);
      setManualOrderNumber('');
      setManualCustomerName('');
      setManualDocument('');
      setManualEmail('');
      setManualAmount('');
      setManualDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
      setManualDescription('');
      setEditableAmount('');
      setEditableDueDate('');
    }
  }, [open]);

  // Search clients in ERP (mock for now - would need ERP endpoint)
  const handleSearchClients = async () => {
    if (!clientSearch.trim()) {
      toast.error('Digite um termo de busca');
      return;
    }
    
    setIsSearching(true);
    try {
      // For now, search in existing boletos
      const { data, error } = await supabase
        .from('boletos')
        .select('customer_name, customer_document, customer_email')
        .or(`customer_name.ilike.%${clientSearch}%,customer_document.ilike.%${clientSearch}%`)
        .limit(20);
      
      if (error) throw error;
      
      // Deduplicate by document
      const uniqueClients = new Map<string, ERPClient>();
      data?.forEach((b, idx) => {
        if (!uniqueClients.has(b.customer_document)) {
          uniqueClients.set(b.customer_document, {
            id: idx,
            name: b.customer_name,
            document: b.customer_document,
            documentType: b.customer_document.length > 11 ? 'CNPJ' : 'CPF',
            email: b.customer_email || undefined,
          });
        }
      });
      
      setClients(Array.from(uniqueClients.values()));
      
      if (uniqueClients.size === 0) {
        toast.info('Nenhum cliente encontrado');
      }
    } catch (err) {
      console.error('Error searching clients:', err);
      toast.error('Erro ao buscar clientes');
    } finally {
      setIsSearching(false);
    }
  };

  // Load orders for selected client
  const handleSelectClient = async (client: ERPClient) => {
    setSelectedClient(client);
    setOrders([]);
    setIsLoadingOrders(true);
    
    try {
      // Search for existing boletos for this client
      const { data, error } = await supabase
        .from('boletos')
        .select('order_number, customer_name, total_amount, due_date, status')
        .eq('customer_document', client.document)
        .gte('due_date', dateFrom)
        .lte('due_date', dateTo)
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      
      // Convert to order format
      const ordersList: ERPOrder[] = (data || []).map(b => ({
        order_number: b.order_number,
        client_name: b.customer_name,
        total_amount: b.total_amount,
        expected_delivery: b.due_date,
        status: b.status,
      }));
      
      setOrders(ordersList);
    } catch (err) {
      console.error('Error loading orders:', err);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Select an order for boleto generation
  const handleSelectOrder = (order: ERPOrder) => {
    setSelectedOrderNumber(order.order_number);
    setEditableAmount((order.total_amount / 100).toFixed(2).replace('.', ','));
    setEditableDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  };

  // Generate boleto for selected order
  const handleGenerateFromOrder = async () => {
    if (!selectedClient || !selectedOrderNumber) {
      toast.error('Selecione um pedido');
      return;
    }
    
    // Parse amount
    const amountValue = parseFloat(editableAmount.replace(',', '.'));
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Valor inválido');
      return;
    }
    
    if (!editableDueDate) {
      toast.error('Data de vencimento inválida');
      return;
    }
    
    setIsGenerating(true);
    try {
      const request: CreateBoletoRequest = {
        orderNumber: selectedOrderNumber,
        customer: {
          name: selectedClient.name,
          document: selectedClient.document,
          documentType: selectedClient.documentType,
          email: selectedClient.email,
        },
        services: [{
          name: `Pedido ${selectedOrderNumber}`,
          description: 'Boleto gerado manualmente',
          amount: Math.round(amountValue * 100),
        }],
        dueDate: editableDueDate,
        fine: { rate: 2 },
        interest: { rate: 1 },
        production: true,
      };
      
      const result = await createBoleto(request);
      
      if (result) {
        toast.success('Boleto gerado com sucesso!');
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Error generating boleto:', err);
      toast.error('Erro ao gerar boleto');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate manual boleto
  const handleGenerateManual = async () => {
    if (!manualOrderNumber) {
      toast.error('Informe o número do pedido');
      return;
    }
    if (!manualCustomerName) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (!manualDocument) {
      toast.error('Informe o CPF/CNPJ');
      return;
    }
    
    const amountValue = parseFloat(manualAmount.replace(',', '.'));
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Valor inválido');
      return;
    }
    
    if (!manualDueDate) {
      toast.error('Data de vencimento inválida');
      return;
    }
    
    setIsGenerating(true);
    try {
      const cleanDoc = manualDocument.replace(/\D/g, '');
      const request: CreateBoletoRequest = {
        orderNumber: manualOrderNumber,
        customer: {
          name: manualCustomerName,
          document: cleanDoc,
          documentType: cleanDoc.length > 11 ? 'CNPJ' : 'CPF',
          email: manualEmail || undefined,
        },
        services: [{
          name: `Pedido ${manualOrderNumber}`,
          description: manualDescription || 'Boleto gerado manualmente',
          amount: Math.round(amountValue * 100),
        }],
        dueDate: manualDueDate,
        fine: { rate: 2 },
        interest: { rate: 1 },
        production: true,
      };
      
      const result = await createBoleto(request);
      
      if (result) {
        toast.success('Boleto gerado com sucesso!');
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Error generating boleto:', err);
      toast.error('Erro ao gerar boleto');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch ERP data for manual order
  const handleFetchERPData = async () => {
    if (!manualOrderNumber) {
      toast.error('Informe o número do pedido');
      return;
    }
    
    const data = await fetchBoletoData(manualOrderNumber);
    if (data) {
      setManualCustomerName(data.customer.name);
      if (data.customer.document) {
        setManualDocument(formatDocumentInput(data.customer.document));
      }
      if (data.customer.email) {
        setManualEmail(data.customer.email);
      }
      if (data.total_amount) {
        setManualAmount((data.total_amount / 100).toFixed(2).replace('.', ','));
      }
      toast.success('Dados carregados do ERP');
    } else {
      toast.error('Pedido não encontrado no ERP');
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Emitir Boleto
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="gap-2">
              <Search className="w-4 h-4" />
              Buscar Cliente
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="w-4 h-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* Search Mode */}
          <TabsContent value="search" className="space-y-4 mt-4">
            {!selectedClient ? (
              <>
                {/* Client Search */}
                <div className="space-y-2">
                  <Label>Buscar Cliente</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome ou CPF/CNPJ..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchClients()}
                    />
                    <Button onClick={handleSearchClients} disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Client Results */}
                {clients.length > 0 && (
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="divide-y">
                      {clients.map((client) => (
                        <button
                          key={client.id}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => handleSelectClient(client)}
                        >
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">{client.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {client.documentType}: {formatDocumentInput(client.document)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              <>
                {/* Selected Client */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium">{selectedClient.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDocumentInput(selectedClient.document)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClient(null)}
                    >
                      Trocar
                    </Button>
                  </div>
                </div>

                {/* Date Filter */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">De</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                {/* Orders List */}
                {isLoadingOrders ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum pedido encontrado</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[180px] border rounded-lg">
                    <div className="divide-y">
                      {orders.map((order) => (
                        <button
                          key={order.order_number}
                          className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                            selectedOrderNumber === order.order_number ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => handleSelectOrder(order)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono font-medium">#{order.order_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(order.total_amount)}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {order.status}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Edit Amount/Due Date for selected order */}
                {selectedOrderNumber && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          value={editableAmount}
                          onChange={(e) => setEditableAmount(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Vencimento</Label>
                        <Input
                          type="date"
                          value={editableDueDate}
                          onChange={(e) => setEditableDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleGenerateFromOrder}
                      disabled={isGenerating || isBoletoLoading}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Gerar Boleto
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Manual Mode */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Order Number with ERP fetch */}
                <div className="space-y-1">
                  <Label>Número do Pedido</Label>
                  <div className="flex gap-2">
                    <Input
                      value={manualOrderNumber}
                      onChange={(e) => setManualOrderNumber(e.target.value)}
                      placeholder="Ex: 7163"
                    />
                    <Button
                      variant="outline"
                      onClick={handleFetchERPData}
                      title="Buscar dados do ERP"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>


                <div className="space-y-1">
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={manualCustomerName}
                    onChange={(e) => setManualCustomerName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>

                {/* Document */}
                <div className="space-y-1">
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={manualDocument}
                    onChange={(e) => setManualDocument(formatDocumentInput(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={18}
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <Label>Email (opcional)</Label>
                  <Input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={manualDueDate}
                    onChange={(e) => setManualDueDate(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="Descrição do serviço"
                  />
                </div>
              </div>
            </ScrollArea>

            <Button
              className="w-full"
              onClick={handleGenerateManual}
              disabled={isGenerating || isBoletoLoading}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Gerar Boleto
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
