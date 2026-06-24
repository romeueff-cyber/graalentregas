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

  const localErpIds = useMemo(
    () => new Set(clientesLocal.map((c) => c.id_cliente_erp).filter(Boolean) as string[]),
    [clientesLocal],
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
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar cliente (app ou ERP)..."
          />
          <CommandList
            className="max-h-[60vh] overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <CommandGroup heading="Cadastrados no app">
              {clientesLocal.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum</div>
              )}
              {clientesLocal.map((c) => {
                const selected = value?.tipo === 'app' && value.cliente.id === c.id;
                const haystack = `${c.nome} ${c.nome_fantasia ?? ''} ${c.cpf_cnpj}`.toLowerCase();
                if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return null;
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
              {search.trim().length < 2 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Digite ao menos 2 letras para buscar no ERP
                </div>
              )}
              {search.trim().length >= 2 && !loadingErp && filteredErp.length === 0 && (
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
