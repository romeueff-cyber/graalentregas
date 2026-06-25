import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

export type ClienteVendedorOrigem = 'erp' | 'app' | 'app_sincronizado';

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
  origem: ClienteVendedorOrigem;
  id_empresa?: number | null;
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
  const { user, canApprovePedidoVenda, isVendedor } = useAuth();
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const queryClient = useQueryClient();
  const syncedRef = useRef(false);

  // Dispara a sincronização ERP → app uma vez por sessão (apenas vendedores).
  useEffect(() => {
    if (!user || !isVendedor || syncedRef.current) return;
    syncedRef.current = true;
    supabase.functions
      .invoke('sync-vendedor-clients', { body: {} })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[sync-vendedor-clients] falhou', error);
          return;
        }
        if (data?.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['clientes-vendedor'] });
          toast.success(`${data.synced} cliente(s) do ERP sincronizado(s)`);
        }
      })
      .catch((e) => console.warn('[sync-vendedor-clients] erro', e));
  }, [user, isVendedor, queryClient]);

  const query = useQuery({
    queryKey: ['clientes-vendedor', user?.id, canApprovePedidoVenda],
    enabled: !!user,
    queryFn: async (): Promise<ClienteVendedor[]> => {
      let q = supabase.from('clientes_vendedor').select('*').order('nome');
      if (!canApprovePedidoVenda && user) {
        q = q.or(`vendedor_id.eq.${user.id},vendedor_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as ClienteVendedor[]) || [];
    },
  });

  const syncFromErp = async () => {
    if (!isVendedor) {
      await query.refetch();
      return { synced: 0 };
    }
    try {
      const { data, error } = await supabase.functions.invoke('sync-vendedor-clients', { body: {} });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['clientes-vendedor'] });
      const synced = data?.synced ?? 0;
      if (synced > 0) toast.success(`${synced} cliente(s) do ERP sincronizado(s)`);
      else toast.success('Lista atualizada');
      return { synced };
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar clientes');
      throw e;
    }
  };

  const createCliente = useMutation({
    mutationFn: async (input: NovoClienteInput) => {
      if (!user) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('clientes_vendedor')
        .insert({ ...input, vendedor_id: user.id, origem: 'app' })
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

  // Filtra clientes pela empresa ativa (se houver). Mantém clientes sem empresa definida.
  const clientesFiltrados = useMemo(() => {
    const all = query.data || [];
    if (!selectedEmpresa) return all;
    return all.filter(c => !c.id_empresa || c.id_empresa === selectedEmpresa);
  }, [query.data, selectedEmpresa]);

  return {
    clientes: clientesFiltrados,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    syncFromErp,
    createCliente,
  };
}


