import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, History, Beer, Package } from 'lucide-react';
import { usePedidosVenda, NovoPedidoVendaInput } from '@/hooks/usePedidosVenda';
import { useClientesVendedor } from '@/hooks/useClientesVendedor';
import { ClienteVendedorForm } from './ClienteVendedorForm';
import { AddItemSheet, AddedItem } from './AddItemSheet';
import { ClienteCombobox, ClienteSelecionado } from './ClienteCombobox';
import { fetchERPClientLastOrder } from '@/hooks/useERPCatalog';
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
  const [enderecoEntrega, setEnderecoEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [produtos, setProdutos] = useState<Item[]>([]);
  const [equipamentos, setEquipamentos] = useState<Item[]>([]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [sheetMode, setSheetMode] = useState<'produto' | 'equipamento' | null>(null);
  const [loadingLast, setLoadingLast] = useState(false);
  const [lastOrderPreview, setLastOrderPreview] = useState<{
    order_number: string;
    delivery_date: string | null;
    produtos: Item[];
    equipamentos: Item[];
  } | null>(null);


  const resetForm = () => {
    setClienteSel(null);
    setDataEntrega('');
    setHorario('');
    setEnderecoEntrega('');
    setObservacoes('');
    setProdutos([]);
    setEquipamentos([]);
  };

  const handleClienteChange = (v: ClienteSelecionado | null) => {
    setClienteSel(v);
    if (v?.tipo === 'app' && !enderecoEntrega) {
      setEnderecoEntrega(v.cliente.endereco);
    }
  };

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
    } catch (e: any) {
      const msg = String(e?.message || e);
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
    if (!enderecoEntrega.trim()) return toast.error('Informe o endereço');
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
      endereco_entrega: enderecoEntrega,
      latitude: isApp ? clienteSel.cliente.latitude ?? undefined : undefined,
      longitude: isApp ? clienteSel.cliente.longitude ?? undefined : undefined,
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

            <div>
              <Label>Endereço de entrega *</Label>
              <Textarea rows={2} value={enderecoEntrega} onChange={(e) => setEnderecoEntrega(e.target.value)} />
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
        onCreated={(id) => {
          const c = clientes.find((x) => x.id === id);
          if (c) setClienteSel({ tipo: 'app', cliente: c });
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
