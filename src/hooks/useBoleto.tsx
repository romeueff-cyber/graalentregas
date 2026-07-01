import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface ExistingBoleto {
  id: string;
  order_number: string;
  cora_invoice_id: string;
  customer_name: string;
  total_amount: number;
  due_date: string;
  status: string;
  digitable_line: string | null;
  barcode: string | null;
  pdf_url: string | null;
  pix_emv: string | null;
  created_at: string;
}

export interface BoletoCustomer {
  name: string;
  document: string;
  documentType?: 'CPF' | 'CNPJ';
  email?: string;
  address?: {
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    complement?: string;
    zipCode: string;
  };
}

export interface BoletoService {
  name: string;
  description: string;
  amount: number; // in cents
}

export interface CreateBoletoRequest {
  orderNumber: string;
  customer: BoletoCustomer;
  services: BoletoService[];
  dueDate: string; // YYYY-MM-DD
  fine?: {
    rate?: number;
    amount?: number;
  };
  interest?: {
    rate: number;
  };
  discount?: {
    type: 'FIXED' | 'PERCENT';
    value: number;
  };
  notification?: {
    name: string;
    email?: string;
    phone?: string;
    rules?: string[];
  };
  production?: boolean;
  idEmpresa?: number | null;
}

export interface BoletoResponse {
  id: string;
  status: string;
  created_at: string;
  total_amount: number;
  total_paid: number;
  code: string;
  customer: {
    name: string;
    email?: string;
    document: {
      identity: string;
      type: string;
    };
  };
  payment_options: {
    bank_slip: {
      barcode: string;
      digitable: string;
      registered: boolean;
      url: string;
      our_number: string;
    };
  };
  pix?: {
    emv: string;
    qr_code_url: string;
  };
}

export function useBoleto() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Check if boletos already exist for an order (checks base order number)
  // By default, returns only active (non-cancelled) boletos
  const checkExistingBoletos = async (orderNumber: string, includeAll = false): Promise<ExistingBoleto[]> => {
    try {
      // Search for boletos matching the order number (including installments like 7163-1, 7163-2)
      let query = supabase
        .from('boletos')
        .select('*')
        .or(`order_number.eq.${orderNumber},order_number.like.${orderNumber}-%`);
      
      // By default, exclude cancelled boletos
      if (!includeAll) {
        query = query.not('status', 'in', '("CANCELLED","CANCELADO")');
      }
      
      const { data, error: queryError } = await query.order('order_number', { ascending: true });

      if (queryError) {
        console.error('[Boleto] Error checking existing:', queryError);
        return [];
      }

      return (data || []) as ExistingBoleto[];
    } catch (err) {
      console.error('[Boleto] Error checking existing boletos:', err);
      return [];
    }
  };

  // Get all boletos including cancelled (for history)
  const getAllBoletos = async (orderNumber: string): Promise<ExistingBoleto[]> => {
    return checkExistingBoletos(orderNumber, true);
  };

  // Delete existing boletos for regeneration
  const deleteExistingBoletos = async (orderNumber: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('boletos')
        .delete()
        .or(`order_number.eq.${orderNumber},order_number.like.${orderNumber}-%`);

      if (deleteError) {
        console.error('[Boleto] Error deleting existing:', deleteError);
        toast.error('Erro ao remover boletos existentes');
        return false;
      }

      return true;
    } catch (err) {
      console.error('[Boleto] Error deleting boletos:', err);
      return false;
    }
  };

  // Cancel boletos in Cora and update status in database (keep history)
  const cancelBoleto = async (orderNumber: string): Promise<boolean> => {
    try {
      // First, get existing boletos to get their Cora invoice IDs
      const existingBoletos = await checkExistingBoletos(orderNumber);
      
      // Filter only active boletos (not already cancelled)
      const activeBoletos = existingBoletos.filter(b => 
        b.status !== 'CANCELLED' && b.status !== 'CANCELADO'
      );
      
      if (activeBoletos.length === 0) {
        toast.error('Nenhum boleto ativo encontrado para cancelar');
        return false;
      }

      console.log(`[Boleto] Canceling ${activeBoletos.length} boleto(s) for order ${orderNumber}`);

      // Cancel each boleto in Cora and update local status
      let allCanceled = true;
      let canceledCount = 0;
      
      for (const boleto of activeBoletos) {
        try {
          console.log(`[Boleto] Canceling invoice ${boleto.cora_invoice_id}`);
          
          const { data, error: fnError } = await supabase.functions.invoke('gerar-boleto', {
            body: {
              action: 'cancel',
              invoiceId: boleto.cora_invoice_id,
              production: true,
            },
          });

          let canceledInCora = true;
          
          if (fnError) {
            console.error(`[Boleto] Error canceling ${boleto.cora_invoice_id}:`, fnError);
            allCanceled = false;
            canceledInCora = false;
          }

          if (data?.error) {
            console.error(`[Boleto] Cora error for ${boleto.cora_invoice_id}:`, data.error);
            // Check if already paid - can't cancel
            if (data.error.includes('já está pago') || data.error.includes('PAID')) {
              toast.error(`Boleto ${boleto.order_number} já está pago e não pode ser cancelado`);
              allCanceled = false;
              canceledInCora = false;
            }
          }

          // Update status to CANCELLED in local database (keep for history)
          if (canceledInCora) {
            const { error: updateError } = await supabase
              .from('boletos')
              .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
              .eq('id', boleto.id);

            if (updateError) {
              console.error('[Boleto] Error updating status:', updateError);
            } else {
              canceledCount++;
              console.log(`[Boleto] Updated ${boleto.order_number} status to CANCELLED`);
            }
          }
        } catch (err) {
          console.error(`[Boleto] Exception canceling ${boleto.cora_invoice_id}:`, err);
          allCanceled = false;
        }
      }

      if (canceledCount === 0) {
        toast.error('Nenhum boleto foi cancelado');
        return false;
      }

      if (allCanceled) {
        toast.success(`${canceledCount} boleto(s) cancelado(s) com sucesso`);
      } else {
        toast.warning(`${canceledCount} de ${activeBoletos.length} boleto(s) cancelado(s)`);
      }
      
      return true;
    } catch (err) {
      console.error('[Boleto] Error canceling boleto:', err);
      toast.error('Erro ao cancelar boleto');
      return false;
    }
  };

  const saveBoletoToDatabase = async (
    orderNumber: string,
    customer: BoletoCustomer,
    dueDate: string,
    response: BoletoResponse,
    idEmpresa?: number | null
  ) => {
    try {
      const { error: insertError } = await supabase
        .from('boletos')
        .insert({
          order_number: orderNumber,
          cora_invoice_id: response.id,
          customer_name: customer.name,
          customer_document: customer.document.replace(/\D/g, ''),
          customer_email: customer.email || null,
          total_amount: response.total_amount,
          due_date: dueDate,
          status: response.status,
          digitable_line: response.payment_options.bank_slip.digitable,
          barcode: response.payment_options.bank_slip.barcode,
          pdf_url: response.payment_options.bank_slip.url,
          pix_emv: response.pix?.emv || null,
          pix_qr_code_url: response.pix?.qr_code_url || null,
          created_by_user_id: user?.id || null,
          id_empresa: idEmpresa ?? null,
        });

      if (insertError) {
        console.error('[Boleto] Error saving to database:', insertError);
        toast.error(`Boleto criado na Cora, mas não salvo no app: ${insertError.message}`);
      } else {
        console.log('[Boleto] Saved to database successfully');
      }
    } catch (err) {
      console.error('[Boleto] Error saving to database:', err);
    }
  };

  const createBoleto = async (request: CreateBoletoRequest): Promise<BoletoResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Boleto] Creating boleto for order:', request.orderNumber);

      const { data, error: fnError } = await supabase.functions.invoke('gerar-boleto', {
        body: {
          action: 'create',
          ...request,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('[Boleto] Created successfully:', data.id);
      
      // Save to database
      await saveBoletoToDatabase(request.orderNumber, request.customer, request.dueDate, data, request.idEmpresa ?? null);
      
      toast.success('Boleto gerado com sucesso!');
      
      return data as BoletoResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar boleto';
      console.error('[Boleto] Error:', message);
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getBoleto = async (invoiceId: string, production = false): Promise<BoletoResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('gerar-boleto', {
        body: {
          action: 'get',
          invoiceId,
          production,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as BoletoResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar boleto';
      console.error('[Boleto] Error:', message);
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const openBoletoUrl = (url: string) => {
    window.open(url, '_blank');
  };

  const copyToClipboard = async (text: string, type: 'barcode' | 'pix') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(type === 'barcode' ? 'Código de barras copiado!' : 'Código PIX copiado!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Open PDF viewer in new window for printing
  const printBoleto = (url: string) => {
    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
    window.open(viewerUrl, '_blank');
    toast.info('Use Ctrl+P (ou Cmd+P no Mac) para imprimir');
  };

  return {
    createBoleto,
    getBoleto,
    checkExistingBoletos,
    getAllBoletos,
    deleteExistingBoletos,
    cancelBoleto,
    formatCurrency,
    openBoletoUrl,
    copyToClipboard,
    printBoleto,
    isLoading,
    error,
  };
}
