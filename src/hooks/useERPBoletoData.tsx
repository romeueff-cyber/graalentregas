import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ERPBoletoData {
  order_id: number;
  order_number: string;
  customer: {
    name: string;
    document: string | null;
    document_type: 'CPF' | 'CNPJ';
    email: string | null;
  };
  address?: string | null;
  location?: string | null;
  address_details?: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code?: string | null;
  } | null;
  payment: {
    method_id: number;
    method_description: string;
    method_type: string;
    terms_id: number;
    terms_code: string;
    terms_description: string;
    due_days: number[];
  };
  total_amount: number | null;
  id_empresa: number | null;
}

export function useERPBoletoData() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ERPBoletoData | null>(null);

  const fetchBoletoData = useCallback(async (orderNumber: string): Promise<ERPBoletoData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[ERP Boleto] Fetching data for order:', orderNumber);

      const { data: responseData, error: fnError } = await supabase.functions.invoke('get-erp-boleto-data', {
        body: { orderNumber },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (responseData.error) {
        throw new Error(responseData.error);
      }

      console.log('[ERP Boleto] Data fetched:', responseData);
      setData(responseData);
      return responseData as ERPBoletoData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar dados do ERP';
      console.error('[ERP Boleto] Error:', message);
      setError(message);
      // Don't show toast here - let the caller decide
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate due dates based on payment terms and order date
  const calculateDueDates = useCallback((paymentCode: string, baseDate?: Date): Date[] => {
    const base = baseDate || new Date();
    const dueDays = paymentCode
      .split(';')
      .map(d => parseInt(d.trim(), 10))
      .filter(d => !isNaN(d) && d >= 0);

    if (dueDays.length === 0) {
      // Default to 7 days if no valid code
      dueDays.push(7);
    }

    return dueDays.map(days => {
      const dueDate = new Date(base);
      dueDate.setDate(dueDate.getDate() + days);
      return dueDate;
    });
  }, []);

  // Format document for display
  const formatDocument = useCallback((doc: string | null, type: 'CPF' | 'CNPJ'): string => {
    if (!doc) return '';
    const digits = doc.replace(/\D/g, '');
    
    if (type === 'CPF' || digits.length <= 11) {
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
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    fetchBoletoData,
    calculateDueDates,
    formatDocument,
    reset,
    data,
    isLoading,
    error,
  };
}
