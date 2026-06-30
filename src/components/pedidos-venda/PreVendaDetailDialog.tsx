import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface PreVendaRow {
  id: string;
  nome: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco_cadastro: string | null;
  endereco_entrega: string | null;
  usar_mesmo_endereco?: boolean | null;
  horario_entrega: string | null;
  tolerancia_min: number | null;
  observacoes: string | null;
  status: string;
}

interface Props {
  prevenda: PreVendaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreVendaDetailDialog({ prevenda, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PreVendaRow | null>(prevenda);

  useEffect(() => {
    setForm(prevenda);
  }, [prevenda]);

  if (!form) return null;

  const set = <K extends keyof PreVendaRow>(k: K, v: PreVendaRow[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pre_vendas')
        .update({
          nome: form.nome,
          cpf_cnpj: form.cpf_cnpj,
          telefone: form.telefone,
          email: form.email,
          endereco_cadastro: form.endereco_cadastro,
          endereco_entrega: form.usar_mesmo_endereco ? form.endereco_cadastro : form.endereco_entrega,
          usar_mesmo_endereco: !!form.usar_mesmo_endereco,
          horario_entrega: form.horario_entrega,
          tolerancia_min: form.tolerancia_min,
          observacoes: form.observacoes,
        })
        .eq('id', form.id);
      if (error) throw error;
      toast.success('Pré-cadastro atualizado');
      qc.invalidateQueries({ queryKey: ['pre-vendas'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferir pré-cadastro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome / Razão social</Label>
            <Input value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div>
            <Label>CPF / CNPJ</Label>
            <Input value={form.cpf_cnpj ?? ''} onChange={(e) => set('cpf_cnpj', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Endereço de cadastro</Label>
            <Textarea
              rows={2}
              value={form.endereco_cadastro ?? ''}
              onChange={(e) => set('endereco_cadastro', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={!!form.usar_mesmo_endereco}
              onCheckedChange={(v) => set('usar_mesmo_endereco', !!v)}
            />
            <span className="text-sm">Usar mesmo endereço para entrega</span>
          </label>
          {!form.usar_mesmo_endereco && (
            <div>
              <Label>Endereço de entrega</Label>
              <Textarea
                rows={2}
                value={form.endereco_entrega ?? ''}
                onChange={(e) => set('endereco_entrega', e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Horário</Label>
              <Input
                type="time"
                value={form.horario_entrega ?? ''}
                onChange={(e) => set('horario_entrega', e.target.value)}
              />
            </div>
            <div>
              <Label>Tolerância (min)</Label>
              <Input
                type="number"
                value={form.tolerancia_min ?? 30}
                onChange={(e) => set('tolerancia_min', Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.observacoes ?? ''}
              onChange={(e) => set('observacoes', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
