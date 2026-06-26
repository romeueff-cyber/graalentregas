import { useMemo, useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, Loader2 } from 'lucide-react';
import { useERPProducts, useERPEquipmentTypes, fetchERPProductPrice } from '@/hooks/useERPCatalog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

type Mode = 'produto' | 'equipamento';

export interface AddedItem {
  tipo: Mode;
  id_erp: string;
  descricao: string;
  quantidade: number;
  valor_unitario?: number | null;
}

interface Props {
  open: boolean;
  mode: Mode;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: AddedItem) => void;
  clientErpId?: string | null;
}

const QUICK_BARRIL = [10, 20, 30, 50];
const QUICK_UNIT = [1, 5, 10];

// Produtos "chopp" usam quantidades de barril (10/20/30/50L).
// Demais (growler, garrafa, etc) usam quantidades unitárias.
const isChoppProduct = (desc: string) => /\bchopp?\b/i.test(desc || '');

// Equipamentos só devem listar chopeira/barril.
const isChoperaOuBarril = (desc: string) => /\b(chopeira|barril)\b/i.test(desc || '');

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AddItemSheet({ open, mode, onOpenChange, onAdd, clientErpId }: Props) {
  const products = useERPProducts();
  const equipTypes = useERPEquipmentTypes();
  const [step, setStep] = useState<'select' | 'qty'>('select');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; descricao: string } | null>(null);
  const [qty, setQty] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [priceSource, setPriceSource] = useState<'cliente' | 'tabela' | 'manual' | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

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
      setUnitPrice('');
      setPriceSource(null);
      setLoadingPrice(false);
    }
  }, [open, mode]);

  const filtered = useMemo(() => {
    const s = search.trim().toUpperCase();
    if (!s) return list.slice(0, 200);
    return list.filter((x) => x.description.toUpperCase().includes(s)).slice(0, 200);
  }, [list, search]);

  const handleSelect = async (x: { id: string | number; description: string }) => {
    const id = String(x.id);
    setSelected({ id, descricao: x.description });
    setStep('qty');
    setUnitPrice('');
    setPriceSource(null);

    if (mode !== 'produto') return;

    setLoadingPrice(true);
    try {
      const price = await fetchERPProductPrice(id, clientErpId);
      if (price.valor != null && price.valor > 0) {
        setUnitPrice(Number(price.valor.toFixed(4)));
        setPriceSource(price.fonte);
      } else {
        setPriceSource(null);
      }
    } catch (e: any) {
      console.warn('[AddItemSheet] preço falhou', e);
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleSave = () => {
    if (!selected) return toast.error('Selecione um item');
    const q = Number(qty);
    if (!q || q < 1) return toast.error('Informe a quantidade');
    const valor = mode === 'produto' && unitPrice !== '' ? Number(unitPrice) : null;
    onAdd({
      tipo: mode,
      id_erp: selected.id,
      descricao: selected.descricao,
      quantidade: q,
      valor_unitario: valor != null && !Number.isNaN(valor) ? valor : null,
    });
    onOpenChange(false);
  };

  const title = mode === 'produto' ? 'Adicionar produto' : 'Adicionar tipo de equipamento';
  const placeholder = mode === 'produto' ? 'Selecione um produto' : 'Selecione um tipo de equipamento';

  const qtyNum = Number(qty) || 0;
  const priceNum = Number(unitPrice) || 0;
  const subtotal = qtyNum * priceNum;

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
                      onClick={() => handleSelect(x)}
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
              {(() => {
                const isBarril = mode === 'equipamento' || isChoppProduct(selected?.descricao || '');
                const buttons = isBarril ? QUICK_BARRIL : QUICK_UNIT;
                return (
                  <div className={`grid gap-2 mt-2 ${buttons.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    {buttons.map((n) => (
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
                );
              })()}
            </div>

            {mode === 'produto' && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Valor unitário (R$)</Label>
                  {loadingPrice && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> buscando preço...
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={unitPrice}
                  onChange={(e) => {
                    setUnitPrice(e.target.value === '' ? '' : Number(e.target.value));
                    setPriceSource('manual');
                  }}
                  className="mt-1"
                />
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-muted-foreground">
                    {priceSource === 'cliente' && '✓ Preço específico do cliente'}
                    {priceSource === 'tabela' && '✓ Tabela de preço padrão'}
                    {priceSource === 'manual' && 'Valor informado manualmente'}
                    {!priceSource && !loadingPrice && 'Sem preço cadastrado — informe manualmente'}
                  </span>
                  {subtotal > 0 && (
                    <span className="font-medium text-foreground">Subtotal: {formatBRL(subtotal)}</span>
                  )}
                </div>
              </div>
            )}

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
