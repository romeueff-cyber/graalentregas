import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EMPRESA_OPTIONS, type EmpresaId } from '@/lib/empresas';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

interface Props {
  userId: string;
}

/**
 * Editor compacto: marca as empresas que o usuário pode acessar.
 * Salva diretamente em public.user_companies (RLS exige admin).
 */
export function UserCompaniesEditor({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EmpresaId | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_companies')
        .select('empresa_id')
        .eq('user_id', userId);
      if (cancel) return;
      if (error) {
        toast.error('Erro ao carregar empresas do usuário');
      } else {
        setSelected(new Set((data ?? []).map((r: any) => r.empresa_id)));
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId]);

  const toggle = async (empresaId: EmpresaId, checked: boolean) => {
    setSaving(empresaId);
    try {
      if (checked) {
        const { error } = await supabase
          .from('user_companies')
          .insert({ user_id: userId, empresa_id: empresaId });
        if (error) throw error;
        setSelected(prev => new Set(prev).add(empresaId));
      } else {
        const { error } = await supabase
          .from('user_companies')
          .delete()
          .eq('user_id', userId)
          .eq('empresa_id', empresaId);
        if (error) throw error;
        setSelected(prev => {
          const n = new Set(prev);
          n.delete(empresaId);
          return n;
        });
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar empresa');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
        <Building2 className="w-3 h-3" />
        Empresas com acesso
      </Label>
      {loading ? (
        <div className="py-2"><LoadingSpinner size="sm" /></div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {EMPRESA_OPTIONS.map(o => {
            const isOn = selected.has(o.id);
            return (
              <label
                key={o.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={isOn}
                  disabled={saving === o.id}
                  onCheckedChange={(v) => toggle(o.id, !!v)}
                />
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: o.color }}
                />
                <span className="text-sm">{o.nome}</span>
                {saving === o.id && <LoadingSpinner size="sm" />}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
