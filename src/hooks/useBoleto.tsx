import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

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

  const saveBoletoToDatabase = async (
    orderNumber: string,
    customer: BoletoCustomer,
    dueDate: string,
    response: BoletoResponse
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
        });

      if (insertError) {
        console.error('[Boleto] Error saving to database:', insertError);
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
      await saveBoletoToDatabase(request.orderNumber, request.customer, request.dueDate, data);
      
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

  return {
    createBoleto,
    getBoleto,
    formatCurrency,
    openBoletoUrl,
    copyToClipboard,
    isLoading,
    error,
  };
}
