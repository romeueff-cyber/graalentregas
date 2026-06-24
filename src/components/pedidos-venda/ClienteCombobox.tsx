import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronsUpDown, Check, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { ClienteVendedor } from '@/hooks/useClientesVendedor';

export type ClienteSelecionado =
  | { tipo: 'app'; cliente: ClienteVendedor }
  | { tipo: 'erp'; id: string; nome: string; apelido?: string; documento?: string };

interface ERPClient {
  id: number | string;
  name: string;
  nickname?: string;
  document?: string;
}

interface Props {
  clientesLocal: ClienteVendedor[];
  value: ClienteSelecionado | null;
  onChange: (v: ClienteSelecionado | null) => void;
}

export function ClienteCombobox({ clientesLocal, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [erpResults, setErpResults] = useState<ERPClient[]>([]);
  const [loadingErp, setLoadingErp] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Busca ERP quando o usuário digita (debounced)
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const term = search.trim();
    if (term.length < 2) {
      setErpResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoadingErp(true);
      try {
        const { data, error } = await supabase.functions.invoke('list-erp-clients', {
          body: {},
          // edge function reads query params from URL; passamos via fetch direto:
        });
        // fallback: usar fetch direto via URL para passar search como query
        if (error || !data) {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-erp-clients?search=${encodeURIComponent(term)}&limit=30`;
          const { data: sess } = await supabase.auth.getSession();
          const r = await fetch(url, {
            headers: {
              Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          });
          const j = await r.json();
          setErpResults(Array.isArray(j) ? j : []);
        } else {
          setErpResults(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.warn('[erp clients search] erro', e);
        setErpResults([]);
      } finally {
        setLoadingErp(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [search, open]);

  const filteredLocal = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientesLocal;
    return clientesLocal.filter((c) =>
      [c.nome, c.nome_fantasia, c.cpf_cnpj].some((f) => (f || '').toLowerCase().includes(term)),
    );
  }, [clientesLocal, search]);

  // Não mostra na lista ERP os que já estão linkados localmente
  const localErpIds = new Set(
    clientesLocal.map((c) => c.id_cliente_erp).filter(Boolean) as string[],
  );
  const filteredErp = erpResults.filter((e) => !localErpIds.has(String(e.id)));

  const label = (() => {
    if (!value) return 'Selecione um cliente';
    if (value.tipo === 'app') return value.cliente.nome_fantasia || value.cliente.nome;
    return value.nome;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente (app ou ERP)..."
            className="h-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filteredLocal.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Cadastrados no app
              </div>
              {filteredLocal.map((c) => {
                const selected = value?.tipo === 'app' && value.cliente.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange({ tipo: 'app', cliente: c });
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2',
                      selected && 'bg-accent',
                    )}
                  >
                    <Check className={cn('h-4 w-4 mt-0.5', selected ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.nome_fantasia || c.nome}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.cpf_cnpj}
                        <span className="ml-2 uppercase">
                          {c.origem === 'erp' || c.origem === 'app_sincronizado' ? 'ERP ✓' : 'Novo'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              Clientes do ERP
              {loadingErp && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            {search.trim().length < 2 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Digite ao menos 2 letras para buscar no ERP
              </div>
            )}
            {search.trim().length >= 2 && !loadingErp && filteredErp.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado no ERP</div>
            )}
            {filteredErp.map((e) => {
              const selected = value?.tipo === 'erp' && value.id === String(e.id);
              return (
                <button
                  key={`erp-${e.id}`}
                  type="button"
                  onClick={() => {
                    onChange({
                      tipo: 'erp',
                      id: String(e.id),
                      nome: e.name,
                      apelido: e.nickname,
                      documento: e.document,
                    });
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2',
                    selected && 'bg-accent',
                  )}
                >
                  <Check className={cn('h-4 w-4 mt-0.5', selected ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{e.nickname || e.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {e.document}
                      <span className="ml-2 uppercase">ERP</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredLocal.length === 0 && filteredErp.length === 0 && search.trim().length < 2 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum cliente cadastrado. Use "+ Novo cliente" ou busque no ERP.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
