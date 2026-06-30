import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Share2, MessageCircle, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SharePreCadastroDialog({ open, onOpenChange }: Props) {
  const { selectedEmpresa, allowedEmpresas } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setExpiresAt(null);
      return;
    }
    const idEmpresa = selectedEmpresa ?? allowedEmpresas[0];
    if (!idEmpresa) {
      toast.error('Selecione uma empresa antes de gerar o link.');
      onOpenChange(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-prevenda-link', {
          body: { id_empresa: idEmpresa },
        });
        if (error) throw error;
        if (!data?.token) throw new Error('Resposta inválida');
        setUrl(`${window.location.origin}/pre-cadastro/${data.token}`);
        setExpiresAt(data.expires_at);
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao gerar link');
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, selectedEmpresa, allowedEmpresas, onOpenChange]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const share = async () => {
    if (!url) return;
    const text = `Olá! Por favor preencha seu pré-cadastro neste link: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pré-cadastro', text, url });
        return;
      } catch {/* user cancelled */}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const whatsapp = () => {
    if (!url) return;
    const text = `Olá! Por favor preencha seu pré-cadastro neste link: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4" /> Compartilhar link de pré-cadastro
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : url ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envie este link para o cliente preencher os dados. O pré-cadastro fica vinculado a você e expira em 7 dias.
            </p>
            <div className="flex gap-2">
              <Input value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={copy} title="Copiar">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expira em {new Date(expiresAt).toLocaleString('pt-BR')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={share}>
                <Share2 className="w-4 h-4 mr-1" /> Compartilhar
              </Button>
              <Button onClick={whatsapp} className="bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
