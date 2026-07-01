import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BoletoSettings {
  boleto_multa_tipo: string;
  boleto_multa_valor: number;
  boleto_multa_ativo: boolean;
  boleto_juros_taxa: number;
  boleto_juros_ativo: boolean;
  boleto_desconto_tipo: string;
  boleto_desconto_valor: number;
  boleto_desconto_ativo: boolean;
  boleto_producao: boolean;
}

const DEFAULT_BOLETO_SETTINGS: BoletoSettings = {
  boleto_multa_tipo: 'PERCENTUAL',
  boleto_multa_valor: 2.00,
  boleto_multa_ativo: false,
  boleto_juros_taxa: 1.00,
  boleto_juros_ativo: false,
  boleto_desconto_tipo: 'FIXED',
  boleto_desconto_valor: 0,
  boleto_desconto_ativo: false,
  // Segurança/RLS não pode derrubar o boleto para ambiente de testes: se a
  // configuração não carregar, mantém a emissão na Cora produção.
  boleto_producao: true,
};

export function useBoletoSettings() {
  const queryClient = useQueryClient();

  const { data: boletoSettings, isLoading } = useQuery({
    queryKey: ['boleto-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('boleto_multa_tipo, boleto_multa_valor, boleto_multa_ativo, boleto_juros_taxa, boleto_juros_ativo, boleto_desconto_tipo, boleto_desconto_valor, boleto_desconto_ativo, boleto_producao')
        .single();

      if (error) {
        console.error('Error fetching boleto settings:', error);
        return DEFAULT_BOLETO_SETTINGS;
      }

      return {
        boleto_multa_tipo: data.boleto_multa_tipo ?? DEFAULT_BOLETO_SETTINGS.boleto_multa_tipo,
        boleto_multa_valor: Number(data.boleto_multa_valor) ?? DEFAULT_BOLETO_SETTINGS.boleto_multa_valor,
        boleto_multa_ativo: data.boleto_multa_ativo ?? DEFAULT_BOLETO_SETTINGS.boleto_multa_ativo,
        boleto_juros_taxa: Number(data.boleto_juros_taxa) ?? DEFAULT_BOLETO_SETTINGS.boleto_juros_taxa,
        boleto_juros_ativo: data.boleto_juros_ativo ?? DEFAULT_BOLETO_SETTINGS.boleto_juros_ativo,
        boleto_desconto_tipo: data.boleto_desconto_tipo ?? DEFAULT_BOLETO_SETTINGS.boleto_desconto_tipo,
        boleto_desconto_valor: Number(data.boleto_desconto_valor) ?? DEFAULT_BOLETO_SETTINGS.boleto_desconto_valor,
        boleto_desconto_ativo: data.boleto_desconto_ativo ?? DEFAULT_BOLETO_SETTINGS.boleto_desconto_ativo,
        boleto_producao: data.boleto_producao ?? DEFAULT_BOLETO_SETTINGS.boleto_producao,
      } as BoletoSettings;
    },
  });

  const updateBoletoSettings = useMutation({
    mutationFn: async (newSettings: Partial<BoletoSettings>) => {
      const { data: existingSettings, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('settings')
        .update(newSettings)
        .eq('id', existingSettings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boleto-settings'] });
      toast.success('Configurações de boleto salvas!');
    },
    onError: (error) => {
      console.error('Error updating boleto settings:', error);
      toast.error('Erro ao salvar configurações de boleto');
    },
  });

  // Helper to build fine/interest/discount for CreateBoletoRequest
  function buildBoletoPaymentTerms(settings: BoletoSettings) {
    const terms: {
      fine?: { rate?: number; amount?: number };
      interest?: { rate: number };
      discount?: { type: 'FIXED' | 'PERCENT'; value: number };
      production: boolean;
    } = {
      production: settings.boleto_producao,
    };

    if (settings.boleto_multa_ativo && settings.boleto_multa_valor > 0) {
      if (settings.boleto_multa_tipo === 'PERCENTUAL') {
        terms.fine = { rate: settings.boleto_multa_valor };
      } else {
        terms.fine = { amount: Math.round(settings.boleto_multa_valor * 100) };
      }
    }

    if (settings.boleto_juros_ativo && settings.boleto_juros_taxa > 0) {
      terms.interest = { rate: settings.boleto_juros_taxa };
    }

    if (settings.boleto_desconto_ativo && settings.boleto_desconto_valor > 0) {
      terms.discount = {
        type: settings.boleto_desconto_tipo as 'FIXED' | 'PERCENT',
        value: settings.boleto_desconto_tipo === 'FIXED'
          ? Math.round(settings.boleto_desconto_valor * 100)
          : settings.boleto_desconto_valor,
      };
    }

    return terms;
  }

  return {
    boletoSettings: boletoSettings ?? DEFAULT_BOLETO_SETTINGS,
    isLoading,
    updateBoletoSettings: updateBoletoSettings.mutate,
    isUpdating: updateBoletoSettings.isPending,
    buildBoletoPaymentTerms,
  };
}
