import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Check, X, Clock, CheckCircle2, XCircle, Ban, RefreshCw, Search, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { usePedidosVenda, PedidoVenda, PedidoVendaStatus } from '@/hooks/usePedidosVenda';
import { useClientesVendedor, ClienteVendedor } from '@/hooks/useClientesVendedor';
import { PedidoVendaForm } from '@/components/pedidos-venda/PedidoVendaForm';
import { ClienteVendedorForm } from '@/components/pedidos-venda/ClienteVendedorForm';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ClienteSelecionado } from '@/components/pedidos-venda/ClienteCombobox';
import { supabase } from '@/integrations/supabase/client';
import { getERPClientAddressParts } from '@/hooks/useERPCatalog';
import { useEmpresa } from '@/contexts/EmpresaContext';


interface ERPClientLite {
  id: string | number;
  name: string;
  nickname?: string;
  document?: string;
  id_empresa?: number | null;
  [k: string]: unknown;
}



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
  const [searchParams] = useSearchParams();
  const { isVendedor, canApprovePedidoVenda } = useAuth();
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();

  const [showForm, setShowForm] = useState(false);
  const [showCliente, setShowCliente] = useState(false);
  const [refuseTarget, setRefuseTarget] = useState<PedidoVenda | null>(null);
  const [motivo, setMotivo] = useState('');
  const [initialCliente, setInitialCliente] = useState<ClienteSelecionado | null>(null);

  const meusScope = canApprovePedidoVenda ? 'todos' : 'meus';
  const { pedidos: meus, isLoading: loadingMeus, cancelPedido } = usePedidosVenda({ scope: meusScope });
  const { pedidos: pendentes, isLoading: loadingPend, approvePedido, refusePedido } =
    usePedidosVenda({ scope: 'pendentes' });
  const { clientes, isLoading: loadingClientes, isFetching: fetchingClientes, syncFromErp } = useClientesVendedor();

  const openCreateForCliente = (c: ClienteVendedor) => {
    setInitialCliente({ tipo: 'app', cliente: c });
    setShowForm(true);
  };

  const openCreateForErpCliente = (e: ERPClientLite) => {
    const parts = getERPClientAddressParts(e);
    setInitialCliente({
      tipo: 'erp',
      id: String(e.id),
      nome: e.name,
      apelido: e.nickname,
      documento: e.document,
      endereco: parts.endereco,
      bairro: parts.bairro,
      numero: parts.numero,
      cidade: parts.cidade,
      uf: parts.uf,
      cep: parts.cep,
      lat: parts.lat,
      lng: parts.lng,
      id_empresa: e.id_empresa ?? null,
    });
    setShowForm(true);
  };

  // 7 clientes mais recentes com pedidos (dedupe por cliente, app ou ERP)
  const clientesRecentes = useMemo(() => {
    const seen = new Set<string>();
    const recent: Array<
      | { kind: 'app'; cliente: ClienteVendedor }
      | { kind: 'erp-local'; cliente: ClienteVendedor }
      | { kind: 'erp-only'; idErp: string; nome: string }
    > = [];
    for (const p of meus) {
      const cid = p.cliente_vendedor_id;
      const eid = p.id_cliente_erp;
      const key = cid ? `app:${cid}` : eid ? `erp:${eid}` : '';
      if (!key || seen.has(key)) continue;
      seen.add(key);

      if (cid) {
        const cli = clientes.find((c) => c.id === cid);
        if (cli) recent.push({ kind: 'app', cliente: cli });
        else continue;
      } else if (eid) {
        const cliLocal = clientes.find((c) => c.id_cliente_erp === eid);
        if (cliLocal) recent.push({ kind: 'erp-local', cliente: cliLocal });
        else recent.push({ kind: 'erp-only', idErp: eid, nome: p.nome_cliente });
      }
      if (recent.length >= 7) break;
    }
    return recent;
  }, [meus, clientes]);

  const recentesAppIds = useMemo(
    () => new Set(clientesRecentes.filter((r) => r.kind !== 'erp-only').map((r: any) => r.cliente.id)),
    [clientesRecentes],
  );
  const outrosClientes = useMemo(
    () => clientes.filter((c) => !recentesAppIds.has(c.id)),
    [clientes, recentesAppIds],
  );

  // Busca de clientes do ERP
  const [erpSearch, setErpSearch] = useState('');
  const [erpResults, setErpResults] = useState<ERPClientLite[]>([]);
  const [erpLoading, setErpLoading] = useState(false);
  const [erpError, setErpError] = useState<string | null>(null);
  const erpDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (erpDebounceRef.current) window.clearTimeout(erpDebounceRef.current);
    const term = erpSearch.trim();
    if (term.length < 2) {
      setErpResults([]);
      setErpError(null);
      setErpLoading(false);
      return;
    }
    erpDebounceRef.current = window.setTimeout(async () => {
      setErpLoading(true);
      setErpError(null);
      try {
        const empresasQuery = (selectedEmpresa ? [selectedEmpresa] : allowedEmpresas).join(',');
        const empParam = empresasQuery ? `&empresas=${encodeURIComponent(empresasQuery)}` : '';
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-erp-clients?search=${encodeURIComponent(term)}&limit=200${empParam}`;

        const { data: sess } = await supabase.auth.getSession();
        const r = await fetch(url, {
          headers: {
            Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const text = await r.text();
        let j: any = null;
        try { j = JSON.parse(text); } catch { /* */ }
        if (!r.ok) {
          setErpError(String(j?.error || `HTTP ${r.status}`));
          setErpResults([]);
          return;
        }
        const empresasFiltro = selectedEmpresa ? [selectedEmpresa] : allowedEmpresas;
        const arr: ERPClientLite[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.clients) ? j.clients : [];
        setErpResults(arr.filter((client) => {
          if (!empresasFiltro.length) return true;
          return client.id_empresa != null && empresasFiltro.includes(Number(client.id_empresa) as any);
        }));
      } catch (e: any) {
        setErpError(e?.message || 'Falha de rede');
        setErpResults([]);
      } finally {
        setErpLoading(false);
      }
    }, 350);
    return () => {
      if (erpDebounceRef.current) window.clearTimeout(erpDebounceRef.current);
    };
  }, [erpSearch, selectedEmpresa, allowedEmpresas]);

  const localErpIds = useMemo(
    () => new Set(clientes.map((c) => c.id_cliente_erp).filter(Boolean) as string[]),
    [clientes],
  );
  const erpResultsFiltrados = useMemo(
    () => erpResults.filter((e) => !localErpIds.has(String(e.id))),
    [erpResults, localErpIds],
  );




  const pedidoIdFromUrl = searchParams.get('pedido');
  const pedidoFromUrl = useMemo(() => {
    if (!pedidoIdFromUrl) return null;
    return [...meus, ...pendentes].find((p) => p.id === pedidoIdFromUrl) ?? null;
  }, [pedidoIdFromUrl, meus, pendentes]);

  const handleRefuse = async () => {
    if (!refuseTarget || !motivo.trim()) return;
    await refusePedido.mutateAsync({ pedidoId: refuseTarget.id, motivo });
    setRefuseTarget(null);
    setMotivo('');
  };

  // Modo focado: link direto para um pedido específico
  if (pedidoIdFromUrl) {
    const loading = loadingMeus || loadingPend;
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background border-b">
          <div className="container max-w-3xl py-3 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/pedidos-venda', { replace: true })}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">Detalhes do pedido</h1>
          </div>
        </header>
        <div className="container max-w-3xl py-4">
          {pedidoFromUrl ? (
            <PedidoCard
              pedido={pedidoFromUrl}
              showVendedor
              showActions={
                canApprovePedidoVenda && pedidoFromUrl.status === 'pendente_aprovacao'
                  ? 'aprovacao'
                  : isVendedor && pedidoFromUrl.status === 'pendente_aprovacao'
                  ? 'vendedor'
                  : null
              }
              onApprove={(id) => approvePedido.mutate(id)}
              onRefuse={(p) => setRefuseTarget(p)}
              onCancel={(id) => cancelPedido.mutate(id)}
            />
          ) : loading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Pedido não encontrado ou você não tem permissão para visualizá-lo.
            </Card>
          )}
        </div>

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
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCliente(true)}>
                <Plus className="w-4 h-4 mr-1" />Cadastrar cliente
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => syncFromErp()}
                disabled={fetchingClientes}
                title="Atualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${fetchingClientes ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={erpSearch}
                onChange={(e) => setErpSearch(e.target.value)}
                placeholder="Buscar cliente no ERP (nome, CNPJ)..."
                className="pl-8"
              />
              {erpLoading && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {erpSearch.trim().length >= 2 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide px-1 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Resultados do ERP
                </div>
                {erpError ? (
                  <Card className="p-3 text-sm text-destructive">{erpError}</Card>
                ) : erpResultsFiltrados.length === 0 && !erpLoading ? (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado no ERP.
                  </Card>
                ) : (
                  erpResultsFiltrados.map((e) => (
                    <ErpClienteCard key={String(e.id)} cliente={e} onCreatePedido={openCreateForErpCliente} />
                  ))
                )}
              </div>
            )}

            {loadingClientes ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : clientes.length === 0 && clientesRecentes.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhum cliente cadastrado. Use a busca acima para encontrar clientes do ERP.
              </Card>
            ) : (
              <>
                {clientesRecentes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide px-1">
                      Pedidos recentes
                    </div>
                    {clientesRecentes.map((r, idx) => {
                      if (r.kind === 'erp-only') {
                        return (
                          <ErpOnlyCard
                            key={`erp-only-${r.idErp}`}
                            idErp={r.idErp}
                            nome={r.nome}
                            onCreatePedido={() =>
                              openCreateForErpCliente({ id: r.idErp, name: r.nome })
                            }
                          />
                        );
                      }
                      return (
                        <ClienteCard
                          key={r.cliente.id}
                          cliente={r.cliente}
                          badge={r.kind === 'erp-local' ? 'ERP' : undefined}
                          onCreatePedido={openCreateForCliente}
                        />
                      );
                    })}
                  </div>
                )}
                {outrosClientes.length > 0 && (
                  <div className="space-y-2">
                    {clientesRecentes.length > 0 && (
                      <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide px-1 pt-2">
                        Todos os clientes
                      </div>
                    )}
                    {outrosClientes.map((c) => (
                      <ClienteCard key={c.id} cliente={c} onCreatePedido={openCreateForCliente} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

        </Tabs>
      </div>

      <PedidoVendaForm
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setInitialCliente(null);
        }}
        initialCliente={initialCliente}
      />
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

function ClienteCard({
  cliente,
  badge,
  onCreatePedido,
}: {
  cliente: ClienteVendedor;
  badge?: string;
  onCreatePedido: (c: ClienteVendedor) => void;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{cliente.nome_fantasia || cliente.nome}</div>
            {badge && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">{badge}</Badge>
            )}
          </div>
          {cliente.nome_fantasia && (
            <div className="text-xs text-muted-foreground truncate">{cliente.nome}</div>
          )}
          <div className="text-sm text-muted-foreground">CPF/CNPJ: {cliente.cpf_cnpj}</div>
          <div className="text-sm text-muted-foreground line-clamp-2">{cliente.endereco}</div>
          {(cliente.telefone || cliente.email) && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {cliente.telefone}
              {cliente.telefone && cliente.email && ' • '}
              {cliente.email}
            </div>
          )}
        </div>
        <Button size="sm" className="shrink-0" onClick={() => onCreatePedido(cliente)}>
          <Plus className="w-4 h-4 mr-1" />Pedido
        </Button>
      </div>
    </Card>
  );
}

function ErpClienteCard({
  cliente,
  onCreatePedido,
}: {
  cliente: ERPClientLite;
  onCreatePedido: (c: ERPClientLite) => void;
}) {
  const parts = getERPClientAddressParts(cliente);
  const endereco = [parts.endereco, parts.numero && `nº ${parts.numero}`, parts.bairro, parts.cidade]
    .filter(Boolean)
    .join(', ');
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{cliente.nickname || cliente.name}</div>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">ERP</Badge>
          </div>
          {cliente.nickname && cliente.name !== cliente.nickname && (
            <div className="text-xs text-muted-foreground truncate">{cliente.name}</div>
          )}
          {cliente.document && (
            <div className="text-sm text-muted-foreground">CPF/CNPJ: {cliente.document}</div>
          )}
          {endereco && <div className="text-sm text-muted-foreground line-clamp-2">{endereco}</div>}
        </div>
        <Button size="sm" className="shrink-0" onClick={() => onCreatePedido(cliente)}>
          <Plus className="w-4 h-4 mr-1" />Pedido
        </Button>
      </div>
    </Card>
  );
}

function ErpOnlyCard({
  idErp,
  nome,
  onCreatePedido,
}: {
  idErp: string;
  nome: string;
  onCreatePedido: () => void;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{nome}</div>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">ERP</Badge>
          </div>
          <div className="text-xs text-muted-foreground">ID ERP: {idErp}</div>
        </div>
        <Button size="sm" className="shrink-0" onClick={onCreatePedido}>
          <Plus className="w-4 h-4 mr-1" />Pedido
        </Button>
      </div>
    </Card>
  );
}


