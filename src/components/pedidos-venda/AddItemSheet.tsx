import { useMemo, useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { useERPProducts, useERPEquipmentTypes } from '@/hooks/useERPCatalog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

type Mode = 'produto' | 'equipamento';

export interface AddedItem {
  tipo: Mode;
  id_erp: string;
  descricao: string;
  quantidade: number;
}

interface Props {
  open: boolean;
  mode: Mode;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: AddedItem) => void;
}

const QUICK = [1, 5, 10, 100];

export function AddItemSheet({ open, mode, onOpenChange, onAdd }: Props) {
  const products = useERPProducts();
  const equipTypes = useERPEquipmentTypes();
  const [step, setStep] = useState<'select' | 'qty'>('select');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; descricao: string } | null>(null);
  const [qty, setQty] = useState<number | ''>('');

  const source = mode === 'produto' ? products : equipTypes;
  const list = source.data || [];
  const isLoading = source.isLoading;
  const isError = source.isError && list.length === 0;

  useEffect(() => {
    if (open) {
      setStep('select');
      setSearch('');
      setSelected(null);
      setQty('');
    }
  }, [open, mode]);

  const filtered = useMemo(() => {
    const s = search.trim().toUpperCase();
    if (!s) return list.slice(0, 200);
    return list.filter((x) => x.description.toUpperCase().includes(s)).slice(0, 200);
  }, [list, search]);

  const handleSave = () => {
    if (!selected) return toast.error('Selecione um item');
    const q = Number(qty);
    if (!q || q < 1) return toast.error('Informe a quantidade');
    onAdd({ tipo: mode, id_erp: selected.id, descricao: selected.descricao, quantidade: q });
    onOpenChange(false);
  };

  const title = mode === 'produto' ? 'Adicionar produto' : 'Adicionar tipo de equipamento';
  const placeholder = mode === 'produto' ? 'Selecione um produto' : 'Selecione um tipo de equipamento';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex flex-row items-center justify-between">
          <DrawerTitle>{step === 'select' ? (mode === 'produto' ? 'Selecione um produto' : 'Selecione um tipo de equipamento') : title}</DrawerTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </Button>
        </DrawerHeader>

        {step === 'select' && (
          <div className="px-4 pb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Digite para pesquisar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[55vh]">
              {isLoading ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
              ) : isError ? (
                <div className="py-10 text-center text-sm text-muted-foreground space-y-3 px-4">
                  <p>Não foi possível conectar ao ERP.</p>
                  <p className="text-xs">Verifique se o servidor está online ou tente novamente.</p>
                  <Button size="sm" variant="outline" onClick={() => source.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Nada encontrado</div>
              ) : (
                <div className="space-y-1.5">
                  {filtered.map((x) => (
                    <button
                      key={x.id}
                      className="w-full text-left px-4 py-3 rounded-md bg-muted/60 hover:bg-muted active:bg-muted/80 transition"
                      onClick={() => {
                        setSelected({ id: String(x.id), descricao: x.description });
                        setStep('qty');
                      }}
                    >
                      {x.description}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {step === 'qty' && (
          <div className="px-4 pb-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                {mode === 'produto' ? 'Produto*' : 'Tipo de equipamento*'}
              </Label>
              <button
                onClick={() => setStep('select')}
                className="w-full text-left px-4 py-3 rounded-md bg-muted/60 mt-1 flex justify-between items-center"
              >
                <span>{selected?.descricao || placeholder}</span>
                <span className="text-xs text-primary">Trocar</span>
              </button>
            </div>
            <div>
              <Label>Quantidade*</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Informe a quantidade"
                value={qty}
                onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1"
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {QUICK.map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setQty((prev) => (Number(prev) || 0) + n)}
                  >
                    +{n}
                  </Button>
                ))}
              </div>
            </div>
            <DrawerFooter className="px-0 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
