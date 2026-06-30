import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { useClientesVendedor, NovoClienteInput, ClienteVendedor } from '@/hooks/useClientesVendedor';
import { AddressAutocomplete } from './AddressAutocomplete';
import { SharePreCadastroDialog } from './SharePreCadastroDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (cliente: ClienteVendedor) => void;
}

export function ClienteVendedorForm({ open, onOpenChange, onCreated }: Props) {
  const { createCliente } = useClientesVendedor();
  const [showShare, setShowShare] = useState(false);
  const [form, setForm] = useState<NovoClienteInput>({
    nome: '',
    nome_fantasia: '',
    cpf_cnpj: '',
    endereco: '',
    telefone: '',
    email: '',
  });

  const update = <K extends keyof NovoClienteInput>(k: K, v: NovoClienteInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.cpf_cnpj.trim() || !form.endereco.trim()) return;
    const cliente = await createCliente.mutateAsync(form);
    onCreated?.(cliente);
    setForm({ nome: '', nome_fantasia: '', cpf_cnpj: '', endereco: '', telefone: '', email: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowShare(true)}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar link de pré-cadastro
        </Button>
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou preencha manualmente</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Nome / Razão social *</Label>
            <Input value={form.nome} onChange={(e) => update('nome', e.target.value)} />
          </div>
          <div>
            <Label>Nome fantasia</Label>
            <Input value={form.nome_fantasia} onChange={(e) => update('nome_fantasia', e.target.value)} />
          </div>
          <div>
            <Label>CPF / CNPJ *</Label>
            <Input value={form.cpf_cnpj} onChange={(e) => update('cpf_cnpj', e.target.value)} />
          </div>
          <div>
            <Label>Endereço *</Label>
            <AddressAutocomplete
              value={form.endereco}
              onChange={(v) => update('endereco', v)}
              onSelect={(r) => {
                update('endereco', r.formatted);
                if (r.lat != null) update('latitude', r.lat);
                if (r.lng != null) update('longitude', r.lng);
              }}
              placeholder="Digite e selecione o endereço"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes || ''} onChange={(e) => update('observacoes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createCliente.isPending}>
            {createCliente.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SharePreCadastroDialog open={showShare} onOpenChange={setShowShare} />
    </Dialog>
  );
}
