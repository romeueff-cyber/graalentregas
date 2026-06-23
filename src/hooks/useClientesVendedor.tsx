import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ClienteVendedor {
  id: string;
  vendedor_id: string;
  nome: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  endereco: string;
  telefone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  observacoes: string | null;
  id_cliente_erp: string | null;
  created_at: string;
}

export interface NovoClienteInput {
  nome: string;
  nome_fantasia?: string;
  cpf_cnpj: string;
  endereco: string;
  telefone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  observacoes?: string;
}

export function useClientesVendedor() {
  const { user, canApprovePedidoVenda } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['clientes-vendedor', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ClienteVendedor[]> => {
      let q = supabase.from('clientes_vendedor').select('*').order('nome');
      if (!canApprovePedidoVenda && user) {
        // Vendedor vê: seus clientes + clientes sem vendedor atribuído
        q = q.or(`vendedor_id.eq.${user.id},vendedor_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as ClienteVendedor[]) || [];
    },
  });

  const createCliente = useMutation({
    mutationFn: async (input: NovoClienteInput) => {
      if (!user) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('clientes_vendedor')
        .insert({ ...input, vendedor_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as ClienteVendedor;
    },
    onSuccess: () => {
      toast.success('Cliente cadastrado');
      queryClient.invalidateQueries({ queryKey: ['clientes-vendedor'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cadastrar cliente'),
  });

  return {
    clientes: query.data || [],
    isLoading: query.isLoading,
    createCliente,
  };
}
