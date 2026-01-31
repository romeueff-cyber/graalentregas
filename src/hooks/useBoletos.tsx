import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

export interface Boleto {
  id: string;
  order_number: string;
  cora_invoice_id: string;
  customer_name: string;
  customer_document: string;
  customer_email: string | null;
  total_amount: number; // in cents
  due_date: string;
  status: string;
  digitable_line: string | null;
  barcode: string | null;
  pdf_url: string | null;
  pix_emv: string | null;
  pix_qr_code_url: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by_user_id: string | null;
}

export interface CreateBoletoRecord {
  order_number: string;
  cora_invoice_id: string;
  customer_name: string;
  customer_document: string;
  customer_email?: string;
  total_amount: number;
  due_date: string;
  status: string;
  digitable_line?: string;
  barcode?: string;
  pdf_url?: string;
  pix_emv?: string;
  pix_qr_code_url?: string;
  created_by_user_id?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  updated: number;
  newlyPaid: { order_number: string; id: string }[];
  errors: number;
}

export function useBoletos() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: boletos, isLoading, error, refetch } = useQuery({
    queryKey: ['boletos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boletos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Boleto[];
    },
  });

  const createBoletoRecord = useMutation({
    mutationFn: async (boleto: CreateBoletoRecord) => {
      const { data, error } = await supabase
        .from('boletos')
        .insert(boleto)
        .select()
        .single();

      if (error) throw error;
      return data as Boleto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
    },
  });

  const updateBoletoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('boletos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Boleto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
    },
  });

  const markAsReconciled = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { data, error } = await supabase
        .from('boletos')
        .update({ 
          reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by_user_id: userId || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Boleto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boletos'] });
    },
  });

  const syncWithCora = async (): Promise<SyncResult> => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-boletos-status');
      
      if (error) throw error;
      
      // Refetch boletos after sync
      await refetch();
      
      return data as SyncResult;
    } finally {
      setIsSyncing(false);
    }
  };

  // Stats helpers
  const getUnreconciledPaidCount = () => {
    return boletos?.filter(b => 
      b.status.toUpperCase() === 'PAID' && !b.reconciled
    ).length || 0;
  };

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amountInCents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
      case 'PAGO':
        return 'text-status-ready bg-status-ready/10';
      case 'PENDING':
      case 'REGISTERED':
        return 'text-status-waiting bg-status-waiting/10';
      case 'OVERDUE':
      case 'VENCIDO':
        return 'text-destructive bg-destructive/10';
      case 'CANCELLED':
      case 'CANCELADO':
        return 'text-muted-foreground bg-muted';
      default:
        return 'text-foreground bg-muted';
    }
  };

  const translateStatus = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
        return 'Pago';
      case 'PENDING':
        return 'Pendente';
      case 'REGISTERED':
        return 'Registrado';
      case 'OVERDUE':
        return 'Vencido';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  return {
    boletos,
    isLoading,
    error,
    refetch,
    createBoletoRecord,
    updateBoletoStatus,
    markAsReconciled,
    syncWithCora,
    isSyncing,
    getUnreconciledPaidCount,
    formatCurrency,
    getStatusColor,
    translateStatus,
  };
}
