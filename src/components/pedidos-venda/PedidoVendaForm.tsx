import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, History, Beer, Package, MapPin, Pencil, Loader2 } from 'lucide-react';
import { usePedidosVenda, NovoPedidoVendaInput } from '@/hooks/usePedidosVenda';
import { ClienteVendedor, useClientesVendedor } from '@/hooks/useClientesVendedor';
import { ClienteVendedorForm } from './ClienteVendedorForm';
import { AddItemSheet, AddedItem } from './AddItemSheet';
import { ClienteCombobox, ClienteSelecionado } from './ClienteCombobox';
import { AddressAutocomplete } from './AddressAutocomplete';
import { fetchERPClientDetails, fetchERPClientLastOrder, getERPClientAddressParts, lastOrderToAddressParts, ERPClientAddressParts } from '@/hooks/useERPCatalog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Item = AddedItem & { observacao?: string };

export function PedidoVendaForm({ open, onOpenChange }: Props) {
  const { createPedido } = usePedidosVenda();
  const { clientes } = useClientesVendedor();

  const [clienteSel, setClienteSel] = useState<ClienteSelecionado | null>(null);
  const [dataEntrega, setDataEntrega] = useState('');
  const [horario, setHorario] = useState('');
  const [enderecoCadastrado, setEnderecoCadastrado] = useState('');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [latLng, setLatLng] = useState<{ lat?: number; lng?: number }>({});
  const [overrideEndereco, setOverrideEndereco] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [produtos, setProdutos] = useState<Item[]>([]);
  const [equipamentos, setEquipamentos] = useState<Item[]>([]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [sheetMode, setSheetMode] = useState<'produto' | 'equipamento' | null>(null);
  const [loadingLast, setLoadingLast] = useState(false);
  const [loadingEnderecoCliente, setLoadingEnderecoCliente] = useState(false);
  const enderecoRequestRef = useRef(0);
  const [lastOrderPreview, setLastOrderPreview] = useState<{
    order_number: string;
    delivery_date: string | null;
    produtos: Item[];
    equipamentos: Item[];
  } | null>(null);

  const composeEndereco = (rua: string, num: string, bai: string) => {
    const parts = [rua.trim(), num.trim() && `nº ${num.trim()}`, bai.trim() && `Bairro ${bai.trim()}`]
      .filter(Boolean);
    return parts.join(', ');
  };

  const normalizeText = (value?: string | null) =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  const cleanDoc = (value?: string | null) => String(value ?? '').replace(/\D/g, '');

  const isEnderecoValido = (value?: string | null) => {
    const normalized = normalizeText(value);
    return Boolean(normalized && !normalized.includes('enderecoserainformadonopedido'));
  };

  const buildEnderecoCadastrado = (parts: ERPClientAddressParts, fallback = '') => {
    const rua = parts.endereco || fallback;
    const enderecoBase = composeEndereco(rua || '', parts.numero || '', parts.bairro || '') || rua || '';
    const cidadeUf = [parts.cidade, parts.uf].filter(Boolean).join('/');
    return enderecoBase ? [enderecoBase, cidadeUf].filter(Boolean).join(' - ') : '';
  };

  const applyEnderecoParts = (parts: ERPClientAddressParts, fallback = '') => {
    const cadastrado = buildEnderecoCadastrado(parts, fallback);
    const ruaOuEndereco = parts.endereco || fallback || cadastrado;
    setEnderecoCadastrado(cadastrado);
    setEnderecoEntrega(ruaOuEndereco);
    setNumero(parts.numero || '');
    setBairro(parts.bairro || '');
    setLatLng({ lat: parts.lat, lng: parts.lng });
    return cadastrado;
  };

  const buscarEnderecoERP = async (
    idClienteErp: string,
    requestId: number,
    clienteLocalId?: string,
  ) => {
    setLoadingEnderecoCliente(true);
    try {
      // 1) Tenta pelo cadastro do cliente (depende de API atualizada no PM2)
      let parts: ERPClientAddressParts = {};
      try {
        const erpClient = await fetchERPClientDetails(idClienteErp);
        if (requestId !== enderecoRequestRef.current) return;
        parts = getERPClientAddressParts(erpClient ?? undefined);
      } catch (e) {
        console.warn('[pedido venda] cadastro ERP falhou, tentando último pedido', e);
      }

      // 2) Fallback: pega endereço do ÚLTIMO PEDIDO do cliente (sempre funciona)
      if (!parts.endereco) {
        try {
          const last = await fetchERPClientLastOrder(idClienteErp);
          if (requestId !== enderecoRequestRef.current) return;
          const fromOrder = lastOrderToAddressParts(last);
          if (fromOrder.endereco) parts = { ...fromOrder, ...parts, endereco: fromOrder.endereco };
        } catch (e) {
          console.warn('[pedido venda] último pedido ERP falhou', e);
        }
      }

      const cadastrado = applyEnderecoParts(parts);
      if (cadastrado) {
        setOverrideEndereco(false);
        if (clienteLocalId) {
          await supabase
            .from('clientes_vendedor')
            .update({
              endereco: cadastrado,
              latitude: parts.lat ?? null,
              longitude: parts.lng ?? null,
            })
            .eq('id', clienteLocalId);
        }
        return;
      }

      setOverrideEndereco(true);
      toast.warning('Endereço não encontrado. Informe o endereço de entrega manualmente.');
    } catch (error) {
      if (requestId !== enderecoRequestRef.current) return;
      console.warn('[pedido venda] erro ao buscar endereço do cliente', error);
      setOverrideEndereco(true);
      toast.error('Não foi possível buscar o endereço do cadastro do cliente');
    } finally {
      if (requestId === enderecoRequestRef.current) setLoadingEnderecoCliente(false);
    }
  };


  const findClienteLocalCorrespondente = (v: ClienteSelecionado | null, lista = clientes) => {
    if (!v || v.tipo !== 'erp') return null;
    const erpDoc = cleanDoc(v.documento);
    const erpNome = normalizeText(v.nome);
    const erpApelido = normalizeText(v.apelido);

    return lista.find((c) => {
      if (c.id_cliente_erp && c.id_cliente_erp === v.id) return true;
      const localDoc = cleanDoc(c.cpf_cnpj);
      if (erpDoc && localDoc && erpDoc === localDoc) return true;
      const localNome = normalizeText(c.nome);
      const localFantasia = normalizeText(c.nome_fantasia);
      return Boolean(
        (erpNome && (erpNome === localNome || erpNome === localFantasia)) ||
        (erpApelido && (erpApelido === localNome || erpApelido === localFantasia))
      );
    }) ?? null;
  };

  const fetchClienteLocalCorrespondente = async (v: ClienteSelecionado) => {
    if (v.tipo !== 'erp') return null;

    const { data, error } = await supabase
      .from('clientes_vendedor')
      .select('*')
      .limit(2000);

    if (error) {
      console.warn('[pedido venda] erro ao buscar cliente local correspondente', error);
      return null;
    }

    return findClienteLocalCorrespondente(v, (data as ClienteVendedor[]) || []);
  };

  const buscarEnderecoLocalOuERP = async (v: ClienteSelecionado, requestId: number) => {
    if (v.tipo !== 'erp') return;
    setLoadingEnderecoCliente(true);
    const clienteLocal = await fetchClienteLocalCorrespondente(v);
    if (requestId !== enderecoRequestRef.current) return;

    const enderecoLocal = isEnderecoValido(clienteLocal?.endereco) ? clienteLocal!.endereco : '';
    if (enderecoLocal) {
      setEnderecoCadastrado(enderecoLocal);
      setEnderecoEntrega(enderecoLocal);
      setNumero('');
      setBairro('');
      setLatLng({
        lat: clienteLocal?.latitude ?? undefined,
        lng: clienteLocal?.longitude ?? undefined,
      });
      setOverrideEndereco(false);
      setLoadingEnderecoCliente(false);
      return;
    }

    await buscarEnderecoERP(v.id, requestId, clienteLocal?.id);
  };

  const resetForm = () => {
    setClienteSel(null);
    setDataEntrega('');
    setHorario('');
    setEnderecoCadastrado('');
    setEnderecoEntrega('');
    setNumero('');
    setBairro('');
    setLatLng({});
    setOverrideEndereco(false);
    setObservacoes('');
    setProdutos([]);
    setEquipamentos([]);
  };

  const handleClienteChange = (v: ClienteSelecionado | null) => {
    const requestId = ++enderecoRequestRef.current;
    setLoadingEnderecoCliente(false);
    setClienteSel(v);
    setOverrideEndereco(false);
    if (v?.tipo === 'app') {
      const addr = isEnderecoValido(v.cliente.endereco) ? v.cliente.endereco : '';
      setEnderecoCadastrado(addr);
      setEnderecoEntrega(addr);
      setNumero('');
      setBairro('');
      setLatLng({
        lat: v.cliente.latitude ?? undefined,
        lng: v.cliente.longitude ?? undefined,
      });
      if (!addr && v.cliente.id_cliente_erp) {
        void buscarEnderecoERP(v.cliente.id_cliente_erp, requestId, v.cliente.id);
      }
    } else if (v?.tipo === 'erp') {
      const parts = getERPClientAddressParts(v);
      const cadastradoErp = buildEnderecoCadastrado(parts);
      const clienteLocal = findClienteLocalCorrespondente(v);
      const enderecoLocal = isEnderecoValido(clienteLocal?.endereco) ? clienteLocal!.endereco : '';
      const cadastrado = cadastradoErp || enderecoLocal;
      setEnderecoCadastrado(cadastrado);
      setEnderecoEntrega(parts.endereco || enderecoLocal);
      setNumero(parts.numero || '');
      setBairro(parts.bairro || '');
      setLatLng({
        lat: parts.lat ?? clienteLocal?.latitude ?? undefined,
        lng: parts.lng ?? clienteLocal?.longitude ?? undefined,
      });
      if (!cadastrado) {
        setOverrideEndereco(true);
        void buscarEnderecoLocalOuERP(v, requestId);
      }
    } else {
      setEnderecoCadastrado('');
      setEnderecoEntrega('');
      setNumero('');
      setBairro('');
      setLatLng({});
    }
  };

  useEffect(() => {
    if (!open || !clienteSel || overrideEndereco || enderecoCadastrado) return;

    const timer = window.setTimeout(() => {
      if (clienteSel.tipo === 'app') {
        const addr = isEnderecoValido(clienteSel.cliente.endereco) ? clienteSel.cliente.endereco : '';
        if (!addr) return;
        setEnderecoCadastrado(addr);
        setEnderecoEntrega(addr);
        setLatLng({
          lat: clienteSel.cliente.latitude ?? undefined,
          lng: clienteSel.cliente.longitude ?? undefined,
        });
        return;
      }

      const clienteLocal = findClienteLocalCorrespondente(clienteSel);
      const enderecoLocal = isEnderecoValido(clienteLocal?.endereco) ? clienteLocal!.endereco : '';
      if (!enderecoLocal) return;
      setEnderecoCadastrado(enderecoLocal);
      setEnderecoEntrega(enderecoLocal);
      setNumero('');
      setBairro('');
      setLatLng({
        lat: clienteLocal?.latitude ?? undefined,
        lng: clienteLocal?.longitude ?? undefined,
      });
      setOverrideEndereco(false);
    }, 250);

    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteSel, clientes, overrideEndereco, enderecoCadastrado]);


  const handleAdd = (item: AddedItem) => {
    if (item.tipo === 'produto') setProdutos((a) => [...a, item]);
    else setEquipamentos((a) => [...a, item]);
  };

  const getIdClienteErp = (): string | null => {
    if (!clienteSel) return null;
    if (clienteSel.tipo === 'erp') return clienteSel.id;
    return clienteSel.cliente.id_cliente_erp || null;
  };

  const handleRepetirUltimo = async () => {
    const idErp = getIdClienteErp();
    if (!clienteSel) return toast.error('Selecione um cliente primeiro');
    if (!idErp) return toast.error('Este cliente ainda não tem vínculo com o ERP');
    setLoadingLast(true);
    try {
      const last = await fetchERPClientLastOrder(idErp);
      if (!last) {
        toast.info('Cliente não tem pedidos anteriores no ERP');
        return;
      }
      setLastOrderPreview({
        order_number: last.order_number,
        delivery_date: last.delivery_date,
        produtos: (last.items || []).map((i) => ({
          tipo: 'produto',
          id_erp: '',
          descricao: i.product,
          quantidade: i.quantity || 1,
        })),
        equipamentos: (last.equipments || []).map((e) => ({
          tipo: 'equipamento',
          id_erp: '',
          descricao: e.type,
          quantidade: e.quantity || 1,
        })),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('non-2xx') || msg.includes('404')) {
        toast.error('Endpoint de "último pedido" ainda não está disponível no servidor ERP. Avise o administrador para atualizar a API.');
      } else {
        toast.error(msg || 'Erro ao buscar último pedido');
      }
    } finally {
      setLoadingLast(false);
    }
  };

  const confirmUsarUltimoPedido = () => {
    if (!lastOrderPreview) return;
    setProdutos((p) => [...p, ...lastOrderPreview.produtos]);
    setEquipamentos((eq) => [...eq, ...lastOrderPreview.equipamentos]);
    toast.success(`Importado do pedido nº ${lastOrderPreview.order_number}`);
    setLastOrderPreview(null);
  };


  const handleSubmit = async () => {
    if (!clienteSel) return toast.error('Selecione um cliente');
    if (!dataEntrega) return toast.error('Informe a data de entrega');

    const enderecoFinal = overrideEndereco || !enderecoCadastrado
      ? composeEndereco(enderecoEntrega, numero, bairro)
      : enderecoCadastrado;

    if (!enderecoFinal.trim()) return toast.error('Informe o endereço');
    if (!produtos.length && !equipamentos.length)
      return toast.error('Adicione ao menos um produto ou equipamento');

    const itens = [...produtos, ...equipamentos].map((i) => ({
      tipo: i.tipo,
      produto: i.descricao,
      quantidade: i.quantidade,
      observacao: i.observacao,
      id_produto_erp: i.tipo === 'produto' ? i.id_erp || null : null,
      id_tipo_equipamento_erp: i.tipo === 'equipamento' ? i.id_erp || null : null,
    }));

    const isApp = clienteSel.tipo === 'app';
    const nomeCliente = isApp
      ? clienteSel.cliente.nome_fantasia || clienteSel.cliente.nome
      : clienteSel.apelido || clienteSel.nome;

    const input: NovoPedidoVendaInput = {
      cliente_vendedor_id: isApp ? clienteSel.cliente.id : null,
      id_cliente_erp: isApp ? clienteSel.cliente.id_cliente_erp || null : clienteSel.id,
      nome_cliente: nomeCliente,
      data_entrega: dataEntrega,
      horario_entrega: horario || undefined,
      endereco_entrega: enderecoFinal,
      latitude: latLng.lat ?? (isApp ? clienteSel.cliente.latitude ?? undefined : undefined),
      longitude: latLng.lng ?? (isApp ? clienteSel.cliente.longitude ?? undefined : undefined),
      observacoes: observacoes || undefined,
      itens,
    };

    await createPedido.mutateAsync(input);
    resetForm();
    onOpenChange(false);
  };


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo pedido de venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Cliente *</Label>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowNovoCliente(true)}>
                  + Novo cliente
                </Button>
              </div>
              <ClienteCombobox
                clientesLocal={clientes}
                value={clienteSel}
                onChange={handleClienteChange}
              />
              {clienteSel && getIdClienteErp() && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleRepetirUltimo}
                  disabled={loadingLast}
                >
                  <History className="w-4 h-4 mr-1" />
                  {loadingLast ? 'Buscando...' : 'Repetir itens do último pedido'}
                </Button>
              )}
            </div>


            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data entrega *</Label>
                <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
              </div>
              <div>
                <Label>Horário / período</Label>
                <Input placeholder="ex: MANHA, 14:00" value={horario} onChange={(e) => setHorario(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Endereço de entrega *</Label>
                <div className="flex items-center gap-2 text-right">
                  {loadingEnderecoCliente && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Buscando endereço
                    </span>
                  )}
                  {clienteSel && enderecoCadastrado && !overrideEndereco && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => setOverrideEndereco(true)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Informar novo endereço
                    </Button>
                  )}
                  {overrideEndereco && enderecoCadastrado && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => {
                        setOverrideEndereco(false);
                        setEnderecoEntrega(enderecoCadastrado);
                      }}
                    >
                      Usar endereço cadastrado
                    </Button>
                  )}
                </div>
              </div>

              {clienteSel && enderecoCadastrado && !overrideEndereco ? (
                <div className="flex items-start gap-2 px-3 py-2 rounded-md border bg-muted/40 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="flex-1">{enderecoCadastrado}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <AddressAutocomplete
                    value={enderecoEntrega}
                    onChange={setEnderecoEntrega}
                    onSelect={(r) => {
                      setLatLng({ lat: r.lat, lng: r.lng });
                      if (r.numero) setNumero(r.numero);
                      if (r.bairro) setBairro(r.bairro);
                    }}
                    placeholder="Rua / logradouro..."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Número"
                      inputMode="numeric"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                    />
                    <Input
                      placeholder="Bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                    />
                  </div>
                </div>
              )}

            </div>

            <ItemsSection
              title="Produtos"
              icon={<Beer className="w-4 h-4" />}
              items={produtos}
              onAdd={() => setSheetMode('produto')}
              onRemove={(idx) => setProdutos((a) => a.filter((_, i) => i !== idx))}
              emptyLabel="Nenhum produto adicionado"
            />

            <ItemsSection
              title="Equipamentos"
              icon={<Package className="w-4 h-4" />}
              items={equipamentos}
              onAdd={() => setSheetMode('equipamento')}
              onRemove={(idx) => setEquipamentos((a) => a.filter((_, i) => i !== idx))}
              emptyLabel="Nenhum equipamento adicionado"
            />

            <div>
              <Label>Observações (instruções etc.)</Label>
              <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createPedido.isPending}>
              {createPedido.isPending ? 'Enviando...' : 'Enviar para aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClienteVendedorForm
        open={showNovoCliente}
        onOpenChange={setShowNovoCliente}
        onCreated={(cliente) => {
          handleClienteChange({ tipo: 'app', cliente });
        }}

      />

      <AddItemSheet
        open={sheetMode !== null}
        mode={sheetMode ?? 'produto'}
        onOpenChange={(o) => !o && setSheetMode(null)}
        onAdd={handleAdd}
      />

      <Dialog open={!!lastOrderPreview} onOpenChange={(o) => !o && setLastOrderPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Último pedido nº {lastOrderPreview?.order_number}</DialogTitle>
          </DialogHeader>
          {lastOrderPreview && (
            <div className="space-y-3 text-sm">
              {lastOrderPreview.delivery_date && (
                <div className="text-xs text-muted-foreground">
                  Entrega: {new Date(lastOrderPreview.delivery_date).toLocaleDateString('pt-BR')}
                </div>
              )}
              <div>
                <div className="font-medium mb-1 flex items-center gap-1"><Beer className="w-4 h-4" /> Produtos</div>
                {lastOrderPreview.produtos.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum</div>
                ) : (
                  <ul className="space-y-1">
                    {lastOrderPreview.produtos.map((p, i) => (
                      <li key={i} className="flex justify-between bg-muted/40 px-2 py-1 rounded">
                        <span className="truncate">{p.descricao}</span>
                        <span className="ml-2 text-muted-foreground">x{p.quantidade}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="font-medium mb-1 flex items-center gap-1"><Package className="w-4 h-4" /> Equipamentos</div>
                {lastOrderPreview.equipamentos.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum</div>
                ) : (
                  <ul className="space-y-1">
                    {lastOrderPreview.equipamentos.map((e, i) => (
                      <li key={i} className="flex justify-between bg-muted/40 px-2 py-1 rounded">
                        <span className="truncate">{e.descricao}</span>
                        <span className="ml-2 text-muted-foreground">x{e.quantidade}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLastOrderPreview(null)}>Cancelar</Button>
            <Button onClick={confirmUsarUltimoPedido}>Usar este pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

function ItemsSection({
  title, icon, items, onAdd, onRemove, emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: Item[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="flex items-center gap-2">{icon}{title}</Label>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" />Adicionar
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2 px-3 border border-dashed rounded-md text-center">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.descricao}</div>
                <div className="text-xs text-muted-foreground">Qtd: {it.quantidade}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemove(idx)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
