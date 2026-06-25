import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { EMPRESA_OPTIONS } from '@/lib/empresas';

interface Row {
  empresa_id: number;
  whatsapp_recipient: string | null;
}

export function WhatsAppEmpresaSettingsCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['empresa_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresa_settings' as never)
        .select('empresa_id, whatsapp_recipient');
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [values, setValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!data) return;
    const map: Record<number, string> = {};
    for (const r of data) map[r.empresa_id] = r.whatsapp_recipient ?? '';
    setValues(map);
  }, [data]);

  const save = useMutation({
    mutationFn: async (empresaId: number) => {
      const recipient = values[empresaId]?.trim() || null;
      const { error } = await supabase
        .from('empresa_settings' as never)
        .upsert({ empresa_id: empresaId, whatsapp_recipient: recipient } as never, {
          onConflict: 'empresa_id',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresa_settings'] });
      toast.success('Destinatário salvo!');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Grupos do WhatsApp por Empresa
        </CardTitle>
        <CardDescription>
          Define o grupo (ou número) que receberá a notificação de novos pedidos de venda de cada empresa.
          Use o ID do grupo (ex: <code>120363xxxxxxxxxxxxx@g.us</code>) ou número no formato internacional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          EMPRESA_OPTIONS.map((emp) => (
            <div key={emp.id} className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: emp.color }}
                />
                <Label className="font-medium">{emp.nome}</Label>
              </div>
              <Input
                placeholder="120363xxxxxxxxxxxxx@g.us ou 5547999999999"
                value={values[emp.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [emp.id]: e.target.value }))}
                className="h-12"
              />
              <Button
                size="sm"
                className="w-full h-10"
                onClick={() => save.mutate(emp.id)}
                disabled={save.isPending}
              >
                {save.isPending ? <LoadingSpinner size="sm" /> : `Salvar ${emp.abrev}`}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
