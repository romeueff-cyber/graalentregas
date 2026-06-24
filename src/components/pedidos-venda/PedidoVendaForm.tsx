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

  const [clienteSel, setClienteSel] = useState<string>('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [horario, setHorario] = useState('');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [produtos, setProdutos] = useState<Item[]>([]);
  const [equipamentos, setEquipamentos] = useState<Item[]>([]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [sheetMode, setSheetMode] = useState<'produto' | 'equipamento' | null>(null);
  const [loadingLast, setLoadingLast] = useState(false);

  const resetForm = () => {
    setClienteSel('');
    setDataEntrega('');
    setHorario('');
    setEnderecoEntrega('');
    setObservacoes('');
    setProdutos([]);
    setEquipamentos([]);
  };

  const handleClienteChange = (v: string) => {
    setClienteSel(v);
    const c = clientes.find((c) => c.id === v);
    if (c && !enderecoEntrega) setEnderecoEntrega(c.endereco);
  };

  const handleAdd = (item: AddedItem) => {
    if (item.tipo === 'produto') setProdutos((a) => [...a, item]);
    else setEquipamentos((a) => [...a, item]);
  };

  const handleRepetirUltimo = async () => {
    const cliente = clientes.find((c) => c.id === clienteSel);
    if (!cliente) return toast.error('Selecione um cliente primeiro');
    if (!cliente.id_cliente_erp) return toast.error('Este cliente ainda não tem vínculo com o ERP');
    setLoadingLast(true);
    try {
      const last = await fetchERPClientLastOrder(cliente.id_cliente_erp);
      if (!last) {
        toast.info('Cliente não tem pedidos anteriores no ERP');
        return;
      }
      const novosProds: Item[] = (last.items || []).map((i) => ({
        tipo: 'produto',
        id_erp: '',
        descricao: i.product,
        quantidade: i.quantity || 1,
      }));
      const novosEqs: Item[] = (last.equipments || []).map((e) => ({
        tipo: 'equipamento',
        id_erp: '',
        descricao: e.type,
        quantidade: e.quantity || 1,
      }));
      setProdutos((p) => [...p, ...novosProds]);
      setEquipamentos((eq) => [...eq, ...novosEqs]);
      toast.success(`Importado do pedido nº ${last.order_number}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar último pedido');
    } finally {
      setLoadingLast(false);
    }
  };

  const handleSubmit = async () => {
    const cliente = clientes.find((c) => c.id === clienteSel);
    if (!cliente) return toast.error('Selecione um cliente');
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

    const input: NovoPedidoVendaInput = {
      cliente_vendedor_id: cliente.id,
      nome_cliente: cliente.nome_fantasia || cliente.nome,
      data_entrega: dataEntrega,
      horario_entrega: horario || undefined,
      endereco_entrega: enderecoEntrega,
      latitude: cliente.latitude ?? undefined,
      longitude: cliente.longitude ?? undefined,
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
              <Select value={clienteSel} onValueChange={handleClienteChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.nome_fantasia || c.nome}
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {c.origem === 'erp' ? 'ERP' : c.origem === 'app_sincronizado' ? 'ERP ✓' : 'Novo'}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clienteSel && (
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
        onCreated={(id) => setClienteSel(id)}
      />

      <AddItemSheet
        open={sheetMode !== null}
        mode={sheetMode ?? 'produto'}
        onOpenChange={(o) => !o && setSheetMode(null)}
        onAdd={handleAdd}
      />
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
