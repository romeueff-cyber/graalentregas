import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Check, X, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { usePedidosVenda, PedidoVenda, PedidoVendaStatus } from '@/hooks/usePedidosVenda';
import { useClientesVendedor } from '@/hooks/useClientesVendedor';
import { PedidoVendaForm } from '@/components/pedidos-venda/PedidoVendaForm';
import { ClienteVendedorForm } from '@/components/pedidos-venda/ClienteVendedorForm';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const statusMeta: Record<PedidoVendaStatus, { label: string; icon: any; className: string }> = {
  pendente_aprovacao: { label: 'Pendente', icon: Clock, className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30' },
  aprovado: { label: 'Aprovado', icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 border-green-500/30' },
  recusado: { label: 'Recusado', icon: XCircle, className: 'bg-red-500/10 text-red-700 border-red-500/30' },
  cancelado: { label: 'Cancelado', icon: Ban, className: 'bg-muted text-muted-foreground' },
  entregue: { label: 'Entregue', icon: CheckCircle2, className: 'bg-primary/10 text-primary border-primary/30' },
};

function PedidoCard({
  pedido,
  showVendedor,
  showActions,
  onApprove,
  onRefuse,
  onCancel,
}: {
  pedido: PedidoVenda;
  showVendedor?: boolean;
  showActions?: 'aprovacao' | 'vendedor' | null;
  onApprove?: (id: string) => void;
  onRefuse?: (p: PedidoVenda) => void;
  onCancel?: (id: string) => void;
}) {
  const meta = statusMeta[pedido.status];
  const Icon = meta.icon;
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{pedido.nome_cliente}</div>
          {showVendedor && pedido.vendedor_nome && (
            <div className="text-xs text-muted-foreground">Vendedor: {pedido.vendedor_nome}</div>
          )}
          <div className="text-sm text-muted-foreground">
            Entrega: {new Date(pedido.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR')}
            {pedido.horario_entrega && ` • ${pedido.horario_entrega}`}
          </div>
        </div>
        <Badge variant="outline" className={meta.className}>
          <Icon className="w-3 h-3 mr-1" />
          {meta.label}
        </Badge>
      </div>

      <div className="text-sm">{pedido.endereco_entrega}</div>

      {pedido.itens && pedido.itens.length > 0 && (
        <div className="text-sm">
          <div className="text-xs text-muted-foreground mb-1">Itens:</div>
          <ul className="list-disc pl-5">
            {pedido.itens.map((it) => (
              <li key={it.id}>
                {it.quantidade}× {it.produto}
                {it.observacao && <span className="text-muted-foreground"> — {it.observacao}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pedido.observacoes && (
        <div className="text-sm text-muted-foreground">Obs: {pedido.observacoes}</div>
      )}

      {pedido.motivo_recusa && (
        <div className="text-sm text-red-600">Motivo da recusa: {pedido.motivo_recusa}</div>
      )}

      {showActions === 'aprovacao' && pedido.status === 'pendente_aprovacao' && (
        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1" onClick={() => onApprove?.(pedido.id)}>
            <Check className="w-4 h-4 mr-1" />Aprovar
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onRefuse?.(pedido)}>
            <X className="w-4 h-4 mr-1" />Recusar
          </Button>
        </div>
      )}
      {showActions === 'vendedor' && pedido.status === 'pendente_aprovacao' && (
        <div className="pt-2">
          <Button size="sm" variant="outline" onClick={() => onCancel?.(pedido.id)}>
            Cancelar pedido
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function PedidosVendaPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isVendedor, canApprovePedidoVenda } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showCliente, setShowCliente] = useState(false);
  const [refuseTarget, setRefuseTarget] = useState<PedidoVenda | null>(null);
  const [motivo, setMotivo] = useState('');
  const [detailPedido, setDetailPedido] = useState<PedidoVenda | null>(null);

  const meusScope = canApprovePedidoVenda ? 'todos' : 'meus';
  const { pedidos: meus, isLoading: loadingMeus, cancelPedido } = usePedidosVenda({ scope: meusScope });
  const { pedidos: pendentes, isLoading: loadingPend, approvePedido, refusePedido } =
    usePedidosVenda({ scope: 'pendentes' });
  const { clientes, isLoading: loadingClientes } = useClientesVendedor();

  const pedidoIdFromUrl = searchParams.get('pedido');
  const pedidoFromUrl = useMemo(() => {
    if (!pedidoIdFromUrl) return null;
    return [...meus, ...pendentes].find((p) => p.id === pedidoIdFromUrl) ?? null;
  }, [pedidoIdFromUrl, meus, pendentes]);

  useEffect(() => {
    if (pedidoFromUrl) setDetailPedido(pedidoFromUrl);
  }, [pedidoFromUrl]);

  const handleRefuse = async () => {
    if (!refuseTarget || !motivo.trim()) return;
    await refusePedido.mutateAsync({ pedidoId: refuseTarget.id, motivo });
    setRefuseTarget(null);
    setMotivo('');
  };

  const closeDetail = () => {
    setDetailPedido(null);
    if (searchParams.get('pedido')) {
      searchParams.delete('pedido');
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-3xl py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">Pedidos de Venda</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" />Criar pedido
          </Button>
        </div>
      </header>

      <div className="container max-w-3xl py-4">
        <Tabs defaultValue={canApprovePedidoVenda ? 'pendentes' : 'meus'}>
          <TabsList className="w-full">
            <TabsTrigger value="meus" className="flex-1">
              {canApprovePedidoVenda ? 'Todos' : 'Meus pedidos'}
            </TabsTrigger>
            {canApprovePedidoVenda && (
              <TabsTrigger value="pendentes" className="flex-1">
                Aprovação {pendentes.length > 0 && <Badge className="ml-2">{pendentes.length}</Badge>}
              </TabsTrigger>
            )}
            <TabsTrigger value="clientes" className="flex-1">Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="meus" className="space-y-3 mt-4">
            {loadingMeus ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : meus.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhum pedido ainda.</Card>
            ) : (
              meus.map((p) => (
                <PedidoCard
                  key={p.id}
                  pedido={p}
                  showVendedor={canApprovePedidoVenda}
                  showActions={isVendedor ? 'vendedor' : null}
                  onCancel={(id) => cancelPedido.mutate(id)}
                />
              ))
            )}
          </TabsContent>

          {canApprovePedidoVenda && (
            <TabsContent value="pendentes" className="space-y-3 mt-4">
              {loadingPend ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
              ) : pendentes.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">Nada pendente.</Card>
              ) : (
                pendentes.map((p) => (
                  <PedidoCard
                    key={p.id}
                    pedido={p}
                    showVendedor
                    showActions="aprovacao"
                    onApprove={(id) => approvePedido.mutate(id)}
                    onRefuse={setRefuseTarget}
                  />
                ))
              )}
            </TabsContent>
          )}

          <TabsContent value="clientes" className="space-y-3 mt-4">
            <Button variant="outline" className="w-full" onClick={() => setShowCliente(true)}>
              <Plus className="w-4 h-4 mr-1" />Cadastrar cliente
            </Button>
            {loadingClientes ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : clientes.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhum cliente cadastrado.</Card>
            ) : (
              clientes.map((c) => (
                <Card key={c.id} className="p-3">
                  <div className="font-medium">{c.nome_fantasia || c.nome}</div>
                  {c.nome_fantasia && <div className="text-xs text-muted-foreground">{c.nome}</div>}
                  <div className="text-sm text-muted-foreground">CPF/CNPJ: {c.cpf_cnpj}</div>
                  <div className="text-sm text-muted-foreground">{c.endereco}</div>
                  {(c.telefone || c.email) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.telefone}{c.telefone && c.email && ' • '}{c.email}
                    </div>
                  )}
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PedidoVendaForm open={showForm} onOpenChange={setShowForm} />
      <ClienteVendedorForm open={showCliente} onOpenChange={setShowCliente} />

      <Dialog open={!!refuseTarget} onOpenChange={(o) => !o && setRefuseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar pedido</DialogTitle>
          </DialogHeader>
          <div>
            <Textarea
              placeholder="Motivo da recusa"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRefuse} disabled={!motivo.trim()}>
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
