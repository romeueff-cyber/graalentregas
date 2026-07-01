import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
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
import { useBoletoSettings } from '@/hooks/useBoletoSettings';
import { useERPBoletoData } from '@/hooks/useERPBoletoData';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  emptyBoletoAddressFields,
  getMissingCoraBoletoAddressFields,
  normalizeBoletoAddressFields,
  toCoraBoletoAddress,
  type BoletoAddressFields,
} from '@/lib/boleto-address';

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
  const { boletoSettings, buildBoletoPaymentTerms } = useBoletoSettings();
  const { fetchBoletoData } = useERPBoletoData();
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  
  
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
  const [manualIdEmpresa, setManualIdEmpresa] = useState<number | null>(null);
  const [manualAddress, setManualAddress] = useState<BoletoAddressFields>(() => ({ ...emptyBoletoAddressFields }));
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [editableAmount, setEditableAmount] = useState('');
  const [editableDueDate, setEditableDueDate] = useState('');
  const [selectedOrderAddress, setSelectedOrderAddress] = useState<BoletoAddressFields>(() => ({ ...emptyBoletoAddressFields }));
  
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
      setManualAddress({ ...emptyBoletoAddressFields });
      setEditableAmount('');
      setEditableDueDate('');
      setSelectedOrderAddress({ ...emptyBoletoAddressFields });
    }
  }, [open]);

  const updateAddressField = (
    setter: Dispatch<SetStateAction<BoletoAddressFields>>,
    field: keyof BoletoAddressFields,
    value: string,
  ) => {
    setter((prev) => ({
      ...prev,
      [field]: field === 'zipCode'
        ? value.replace(/\D/g, '').substring(0, 8)
        : field === 'state'
          ? value.toUpperCase().substring(0, 2)
          : value,
    }));
  };

  const renderAddressFields = (
    address: BoletoAddressFields,
    setter: Dispatch<SetStateAction<BoletoAddressFields>>,
    prefix: string,
  ) => (
    <div className="space-y-3 rounded-lg border p-3">
      <Label>Endereço para registro</Label>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-street`} className="text-xs">Rua *</Label>
          <Input
            id={`${prefix}-street`}
            value={address.street}
            onChange={(e) => updateAddressField(setter, 'street', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-number`} className="text-xs">Número</Label>
          <Input
            id={`${prefix}-number`}
            value={address.number}
            onChange={(e) => updateAddressField(setter, 'number', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-district`} className="text-xs">Bairro *</Label>
          <Input
            id={`${prefix}-district`}
            value={address.district}
            onChange={(e) => updateAddressField(setter, 'district', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-city`} className="text-xs">Cidade *</Label>
          <Input
            id={`${prefix}-city`}
            value={address.city}
            onChange={(e) => updateAddressField(setter, 'city', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-[88px_1fr] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-state`} className="text-xs">UF *</Label>
          <Input
            id={`${prefix}-state`}
            value={address.state}
            maxLength={2}
            onChange={(e) => updateAddressField(setter, 'state', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-zip`} className="text-xs">CEP *</Label>
          <Input
            id={`${prefix}-zip`}
            value={address.zipCode}
            maxLength={8}
            inputMode="numeric"
            placeholder="00000000"
            onChange={(e) => updateAddressField(setter, 'zipCode', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  // Search clients in ERP (mock for now - would need ERP endpoint)
  const handleSearchClients = async () => {
    if (!clientSearch.trim()) {
      toast.error('Digite um termo de busca');
      return;
    }
    
    setIsSearching(true);
    try {
      // For now, search in existing boletos
      let q = supabase
        .from('boletos')
        .select('customer_name, customer_document, customer_email')
        .or(`customer_name.ilike.%${clientSearch}%,customer_document.ilike.%${clientSearch}%`)
        .limit(20);
      if (selectedEmpresa) q = q.eq('id_empresa', selectedEmpresa);
      else if (allowedEmpresas.length) q = q.in('id_empresa', allowedEmpresas);
      const { data, error } = await q;
      
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
    setSelectedOrderAddress({ ...emptyBoletoAddressFields });

    fetchBoletoData(order.order_number).then((data) => {
      if (data?.address_details) {
        setSelectedOrderAddress(normalizeBoletoAddressFields({
          street: data.address_details.street,
          number: data.address_details.number,
          neighborhood: data.address_details.neighborhood,
          city: data.address_details.city,
          state: data.address_details.state,
          complement: data.address_details.complement,
          zip_code: data.address_details.zip_code,
        }));
      }
    });
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

    const normalizedAddress = normalizeBoletoAddressFields(selectedOrderAddress);
    const missingAddressFields = getMissingCoraBoletoAddressFields(normalizedAddress);
    if (missingAddressFields.length > 0) {
      toast.error(`Complete o endereço para registrar o boleto: ${missingAddressFields.join(', ')}`);
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
          address: toCoraBoletoAddress(normalizedAddress),
        },
        services: [{
          name: `Pedido ${selectedOrderNumber}`,
          description: 'Boleto gerado manualmente',
          amount: Math.round(amountValue * 100),
        }],
        dueDate: editableDueDate,
        idEmpresa: selectedEmpresa ?? (allowedEmpresas.length === 1 ? allowedEmpresas[0] : null),
        ...buildBoletoPaymentTerms(boletoSettings),
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

    const normalizedAddress = normalizeBoletoAddressFields(manualAddress);
    const missingAddressFields = getMissingCoraBoletoAddressFields(normalizedAddress);
    if (missingAddressFields.length > 0) {
      toast.error(`Complete o endereço para registrar o boleto: ${missingAddressFields.join(', ')}`);
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
          address: toCoraBoletoAddress(normalizedAddress),
        },
        services: [{
          name: `Pedido ${manualOrderNumber}`,
          description: manualDescription || 'Boleto gerado manualmente',
          amount: Math.round(amountValue * 100),
        }],
        dueDate: manualDueDate,
        idEmpresa: manualIdEmpresa ?? selectedEmpresa ?? (allowedEmpresas.length === 1 ? allowedEmpresas[0] : null),
        ...buildBoletoPaymentTerms(boletoSettings),
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
      if (data.total_amount != null) {
        // ERP returns amount in reais (e.g. 540.00), not cents
        setManualAmount(Number(data.total_amount).toFixed(2).replace('.', ','));
      }
      setManualIdEmpresa(data.id_empresa ?? null);
      if (data.address_details) {
        setManualAddress(normalizeBoletoAddressFields({
          street: data.address_details.street,
          number: data.address_details.number,
          neighborhood: data.address_details.neighborhood,
          city: data.address_details.city,
          state: data.address_details.state,
          complement: data.address_details.complement,
          zip_code: data.address_details.zip_code,
        }));
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
                    {renderAddressFields(selectedOrderAddress, setSelectedOrderAddress, 'selected-order-address')}
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

                {renderAddressFields(manualAddress, setManualAddress, 'manual-address')}

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
