import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react';
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

const normalizeSearch = (value?: string | number | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const matchesTerm = (values: Array<string | number | null | undefined>, term: string) => {
  const normalizedTerm = normalizeSearch(term);
  if (!normalizedTerm) return true;
  return values.some((value) => normalizeSearch(value).includes(normalizedTerm));
};

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
  const [erpError, setErpError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const term = search.trim();

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (term.length < 2) {
      setErpResults([]);
      setErpError(null);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoadingErp(true);
      setErpError(null);
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-erp-clients?search=${encodeURIComponent(term)}&limit=2000`;
        const { data: sess } = await supabase.auth.getSession();
        const r = await fetch(url, {
          headers: {
            Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const text = await r.text();
        let j: any = null;
        try { j = JSON.parse(text); } catch { /* ignore */ }
        if (!r.ok) {
          const msg = String(j?.error || text || `HTTP ${r.status}`);
          if (msg.includes('No route to host') || msg.includes('EHOSTUNREACH') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
            setErpError('Servidor ERP offline ou inacessível. Avise o administrador.');
          } else {
            setErpError(`Erro ao buscar no ERP: ${msg.slice(0, 120)}`);
          }
          setErpResults([]);
          return;
        }
        setErpResults(Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.clients) ? j.clients : []);
      } catch (e: any) {
        console.warn('[erp clients search] erro', e);
        setErpError('Falha de rede ao consultar o ERP.');
        setErpResults([]);
      } finally {
        setLoadingErp(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [term, open]);

  const localErpIds = useMemo(
    () => new Set(clientesLocal.map((c) => c.id_cliente_erp).filter(Boolean) as string[]),
    [clientesLocal],
  );
  const filteredLocal = clientesLocal.filter((c) => (
    !term || matchesTerm([c.nome, c.nome_fantasia, c.cpf_cnpj, c.id_cliente_erp], term)
  ));
  const filteredErp = erpResults.filter((e) => (
    !localErpIds.has(String(e.id)) && matchesTerm([e.name, e.nickname, e.document, e.id], term)
  ));

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
        className="w-[--radix-popover-trigger-width] max-h-[min(340px,45vh)] overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar cliente (app ou ERP)..."
          />
          <CommandList
            className="max-h-[min(280px,34vh)] overflow-y-scroll overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <CommandGroup heading={filteredLocal.length > 0 || !term ? 'Cadastrados no app' : undefined}>
              {!term && clientesLocal.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum</div>
              )}
              {filteredLocal.map((c) => {
                const selected = value?.tipo === 'app' && value.cliente.id === c.id;
                return (
                  <CommandItem
                    key={c.id}
                    value={`app-${c.id}`}
                    onSelect={() => {
                      onChange({ tipo: 'app', cliente: c });
                      setOpen(false);
                    }}
                    className="flex items-start gap-2"
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
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandGroup
              heading={
                <span className="flex items-center gap-2">
                  Clientes do ERP {loadingErp && <Loader2 className="h-3 w-3 animate-spin" />}
                </span>
              }
            >
              {term.length < 2 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Digite ao menos 2 letras para buscar no ERP
                </div>
              )}
              {term.length >= 2 && !loadingErp && erpError && (
                <div className="px-2 py-1.5 text-xs text-destructive">
                  ⚠️ {erpError}
                </div>
              )}
              {term.length >= 2 && !loadingErp && !erpError && filteredErp.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nenhum resultado no ERP
                </div>
              )}
              {filteredErp.map((e) => {
                const selected = value?.tipo === 'erp' && value.id === String(e.id);
                return (
                  <CommandItem
                    key={`erp-${e.id}`}
                    value={`erp-${e.id}`}
                    onSelect={() => {
                      onChange({
                        tipo: 'erp',
                        id: String(e.id),
                        nome: e.name,
                        apelido: e.nickname,
                        documento: e.document,
                      });
                      setOpen(false);
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check className={cn('h-4 w-4 mt-0.5', selected ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{e.nickname || e.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {e.document}
                        <span className="ml-2 uppercase">ERP</span>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandEmpty />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
