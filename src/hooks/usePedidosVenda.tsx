import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

export type PedidoVendaStatus =
  | 'pendente_aprovacao'
  | 'aprovado'
  | 'recusado'
  | 'cancelado'
  | 'entregue';

export interface PedidoVendaItem {
  id: string;
  pedido_id: string;
  produto: string;
  quantidade: number;
  observacao: string | null;
}

export interface PedidoVenda {
  id: string;
  vendedor_id: string;
  id_cliente_erp: string | null;
  cliente_vendedor_id: string | null;
  nome_cliente: string;
  data_entrega: string;
  horario_entrega: string | null;
  endereco_entrega: string;
  latitude: number | null;
  longitude: number | null;
  observacoes: string | null;
  status: PedidoVendaStatus;
  motivo_recusa: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
  itens?: PedidoVendaItem[];
  vendedor_nome?: string;
  id_empresa: number;
}

export interface NovoPedidoVendaInput {
  id_cliente_erp?: string | null;
  cliente_vendedor_id?: string | null;
  nome_cliente: string;
  data_entrega: string;
  horario_entrega?: string;
  endereco_entrega: string;
  latitude?: number;
  longitude?: number;
  id_empresa?: number | null;
  observacoes?: string;
  itens: Array<{
    tipo?: 'produto' | 'equipamento';
    produto: string;
    quantidade: number;
    observacao?: string;
    id_produto_erp?: string | null;
    id_tipo_equipamento_erp?: string | null;
    preco_unitario?: number | null;
    desconto?: number | null;
  }>;
}

interface UsePedidosVendaOptions {
  scope?: 'meus' | 'pendentes' | 'todos';
}

export function usePedidosVenda({ scope = 'meus' }: UsePedidosVendaOptions = {}) {
  const { user, canApprovePedidoVenda } = useAuth();
  const { selectedEmpresa } = useEmpresa();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pedidos-venda', scope, user?.id, selectedEmpresa],
    enabled: !!user,
    queryFn: async (): Promise<PedidoVenda[]> => {
      let q = supabase
        .from('pedidos_venda')
        .select('*, itens:pedidos_venda_itens(*)')
        .order('created_at', { ascending: false });

      if (scope === 'meus' && user) q = q.eq('vendedor_id', user.id);
      if (scope === 'pendentes') q = q.eq('status', 'pendente_aprovacao');
      if (selectedEmpresa) q = q.eq('id_empresa', selectedEmpresa);

      const { data, error } = await q;
      if (error) throw error;

      const pedidos = (data as any[]) || [];
      // hidrata nome do vendedor (apenas para admin/financeiro)
      if (canApprovePedidoVenda && pedidos.length) {
        const ids = Array.from(new Set(pedidos.map((p) => p.vendedor_id)));
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ids);
        const map = new Map((profs || []).map((p: any) => [p.id, p.name]));
        pedidos.forEach((p) => (p.vendedor_nome = map.get(p.vendedor_id) || ''));
      }
      return pedidos as PedidoVenda[];
    },
  });

  const createPedido = useMutation({
    mutationFn: async (input: NovoPedidoVendaInput) => {
      if (!user) throw new Error('Não autenticado');
      const { itens, ...pedidoData } = input;
      const { data: pedido, error } = await supabase
        .from('pedidos_venda')
        .insert({ ...pedidoData, id_empresa: pedidoData.id_empresa ?? selectedEmpresa ?? 1, vendedor_id: user.id })
        .select()
        .single();
      if (error) throw error;

      if (itens.length) {
        const { error: itensErr } = await supabase
          .from('pedidos_venda_itens')
          .insert(itens.map((i) => ({ ...i, pedido_id: pedido.id })));
        if (itensErr) throw itensErr;
      }

      // Notifica grupo do WhatsApp via Zapster (não bloqueia em caso de falha)
      try {
        const { error: notifyErr } = await supabase.functions.invoke('notify-pedido-venda-whatsapp', {
          body: { pedidoId: pedido.id },
        });
        if (notifyErr) console.warn('[pedido venda] notificação WhatsApp falhou', notifyErr);
      } catch (e) {
        console.warn('[pedido venda] notificação WhatsApp erro', e);
      }

      return pedido;
    },
    onSuccess: () => {
      toast.success('Pedido criado! Aguardando aprovação.');
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar pedido'),
  });

  const approvePedido = useMutation({
    mutationFn: async (pedidoId: string) => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('pedidos_venda')
        .update({
          status: 'aprovado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          motivo_recusa: null,
        })
        .eq('id', pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido aprovado');
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao aprovar'),
  });

  const refusePedido = useMutation({
    mutationFn: async ({ pedidoId, motivo }: { pedidoId: string; motivo: string }) => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('pedidos_venda')
        .update({
          status: 'recusado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          motivo_recusa: motivo,
        })
        .eq('id', pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido recusado');
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao recusar'),
  });

  const cancelPedido = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase
        .from('pedidos_venda')
        .update({ status: 'cancelado' })
        .eq('id', pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido cancelado');
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar'),
  });

  return {
    pedidos: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createPedido,
    approvePedido,
    refusePedido,
    cancelPedido,
  };
}
