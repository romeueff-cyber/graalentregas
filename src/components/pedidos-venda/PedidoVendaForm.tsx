import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { usePedidosVenda, NovoPedidoVendaInput } from '@/hooks/usePedidosVenda';
import { useClientesVendedor } from '@/hooks/useClientesVendedor';
import { ClienteVendedorForm } from './ClienteVendedorForm';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Item = { produto: string; quantidade: number; observacao?: string };

export function PedidoVendaForm({ open, onOpenChange }: Props) {
  const { createPedido } = usePedidosVenda();
  const { clientes } = useClientesVendedor();

  const [clienteSel, setClienteSel] = useState<string>('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [horario, setHorario] = useState('');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<Item[]>([{ produto: '', quantidade: 1 }]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);

  const resetForm = () => {
    setClienteSel('');
    setDataEntrega('');
    setHorario('');
    setEnderecoEntrega('');
    setObservacoes('');
    setItens([{ produto: '', quantidade: 1 }]);
  };

  const handleClienteChange = (v: string) => {
    setClienteSel(v);
    const c = clientes.find((c) => c.id === v);
    if (c && !enderecoEntrega) setEnderecoEntrega(c.endereco);
  };

  const handleSubmit = async () => {
    const cliente = clientes.find((c) => c.id === clienteSel);
    if (!cliente) return toast.error('Selecione um cliente');
    if (!dataEntrega) return toast.error('Informe a data de entrega');
    if (!enderecoEntrega.trim()) return toast.error('Informe o endereço');
    const itensValidos = itens.filter((i) => i.produto.trim() && i.quantidade > 0);
    if (!itensValidos.length) return toast.error('Adicione pelo menos um item');

    const input: NovoPedidoVendaInput = {
      cliente_vendedor_id: cliente.id,
      nome_cliente: cliente.nome_fantasia || cliente.nome,
      data_entrega: dataEntrega,
      horario_entrega: horario || undefined,
      endereco_entrega: enderecoEntrega,
      latitude: cliente.latitude ?? undefined,
      longitude: cliente.longitude ?? undefined,
      observacoes: observacoes || undefined,
      itens: itensValidos,
    };

    await createPedido.mutateAsync(input);
    resetForm();
    onOpenChange(false);
  };

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

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
                      {c.nome_fantasia || c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens *</Label>
                <Button variant="outline" size="sm" onClick={() => setItens((a) => [...a, { produto: '', quantidade: 1 }])}>
                  <Plus className="w-4 h-4 mr-1" />Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Input
                      className="flex-1"
                      placeholder="Produto"
                      value={it.produto}
                      onChange={(e) => updateItem(idx, { produto: e.target.value })}
                    />
                    <Input
                      className="w-20"
                      type="number"
                      min={1}
                      value={it.quantidade}
                      onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItens((a) => a.filter((_, i) => i !== idx))}
                      disabled={itens.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Observações (equipamentos, instruções etc.)</Label>
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
    </>
  );
}
