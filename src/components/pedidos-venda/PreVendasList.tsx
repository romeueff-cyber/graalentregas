import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Clock, CheckCircle2, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PreVenda {
  id: string;
  token: string;
  status: string;
  vendedor_id: string;
  id_empresa: number;
  expires_at: string;
  submitted_at: string | null;
  nome: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco_cadastro: string | null;
  endereco_cadastro_lat: number | null;
  endereco_cadastro_lng: number | null;
  endereco_entrega: string | null;
  endereco_entrega_lat: number | null;
  endereco_entrega_lng: number | null;
  horario_entrega: string | null;
  tolerancia_min: number | null;
  observacoes: string | null;
  created_at: string;
}

export function PreVendasList() {
  const { user } = useAuth();
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const qc = useQueryClient();

  const empresas = selectedEmpresa ? [selectedEmpresa] : allowedEmpresas;

  const { data, isLoading } = useQuery({
    queryKey: ['pre-vendas', user?.id, empresas.join(',')],
    enabled: !!user && empresas.length > 0,
    queryFn: async (): Promise<PreVenda[]> => {
      const { data, error } = await supabase
        .from('pre_vendas')
        .select('*')
        .in('id_empresa', empresas as any)
        .neq('status', 'convertido')
        .neq('status', 'cancelado')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as PreVenda[]) || [];
    },
  });

  const convert = useMutation({
    mutationFn: async (pv: PreVenda) => {
      if (!pv.nome || !pv.cpf_cnpj || !pv.endereco_cadastro) throw new Error('Pré-cadastro incompleto');
      const { data: cli, error: e1 } = await supabase
        .from('clientes_vendedor')
        .insert({
          vendedor_id: pv.vendedor_id,
          id_empresa: pv.id_empresa,
          nome: pv.nome,
          cpf_cnpj: pv.cpf_cnpj,
          endereco: pv.endereco_entrega || pv.endereco_cadastro,
          latitude: pv.endereco_entrega_lat ?? pv.endereco_cadastro_lat,
          longitude: pv.endereco_entrega_lng ?? pv.endereco_cadastro_lng,
          telefone: pv.telefone,
          email: pv.email,
          observacoes: [
            pv.horario_entrega ? `Horário preferido: ${pv.horario_entrega} (±${pv.tolerancia_min ?? 30} min)` : null,
            pv.observacoes,
          ].filter(Boolean).join('\n') || null,
          origem: 'app',
        })
        .select()
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('pre_vendas')
        .update({ status: 'convertido', converted_at: new Date().toISOString(), cliente_vendedor_id: cli.id })
        .eq('id', pv.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success('Cliente cadastrado a partir do pré-cadastro');
      qc.invalidateQueries({ queryKey: ['pre-vendas'] });
      qc.invalidateQueries({ queryKey: ['clientes-vendedor'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao converter'),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pre_vendas').update({ status: 'cancelado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pré-cadastro removido');
      qc.invalidateQueries({ queryKey: ['pre-vendas'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>;
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhum pré-cadastro. Use o botão "Compartilhar link de pré-cadastro" ao criar um cliente para enviar um link.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((pv) => {
        const expired = new Date(pv.expires_at).getTime() < Date.now();
        const isSubmitted = pv.status === 'enviado';
        return (
          <Card key={pv.id} className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{pv.nome || 'Aguardando preenchimento'}</span>
                  {isSubmitted ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Recebido
                    </Badge>
                  ) : expired ? (
                    <Badge variant="outline" className="bg-muted">Expirado</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                      <Clock className="w-3 h-3 mr-1" /> Aguardando
                    </Badge>
                  )}
                </div>
                {pv.cpf_cnpj && <div className="text-xs text-muted-foreground">Doc: {pv.cpf_cnpj}</div>}
                {pv.endereco_cadastro && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{pv.endereco_cadastro}</div>
                )}
                {(pv.telefone || pv.horario_entrega) && (
                  <div className="text-xs text-muted-foreground">
                    {pv.telefone}
                    {pv.telefone && pv.horario_entrega ? ' • ' : ''}
                    {pv.horario_entrega && `${pv.horario_entrega} (±${pv.tolerancia_min ?? 30} min)`}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">
                  {isSubmitted && pv.submitted_at
                    ? `Recebido em ${new Date(pv.submitted_at).toLocaleString('pt-BR')}`
                    : `Expira em ${new Date(pv.expires_at).toLocaleString('pt-BR')}`}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {isSubmitted && (
                  <Button size="sm" onClick={() => convert.mutate(pv)} disabled={convert.isPending}>
                    <UserPlus className="w-4 h-4 mr-1" /> Cadastrar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => cancel.mutate(pv.id)} title="Remover">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
