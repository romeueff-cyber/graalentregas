import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, RefreshCw, Package, Users, AlertTriangle, Clock } from 'lucide-react';
import { useERPAllocations, type ClientAllocations } from '@/hooks/useERPAllocations';

function daysBadgeColor(days: number | null): string {
  if (days === null) return 'bg-muted text-muted-foreground';
  if (days <= 30) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (days <= 90) return 'bg-amber-100 text-amber-800 border-amber-300';
  if (days <= 180) return 'bg-orange-100 text-orange-800 border-orange-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

function ClientAllocationCard({ client }: { client: ClientAllocations }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{client.client_name}</h3>
            {client.client_full_name && client.client_full_name !== client.client_name && (
              <p className="text-xs text-muted-foreground truncate">{client.client_full_name}</p>
            )}
          </div>
          <Badge variant="outline" className="gap-1 whitespace-nowrap">
            <Package className="w-3 h-3" />
            {client.total_equipments}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-2">
        {client.equipments.map((eq, idx) => (
          <div
            key={`${eq.patrimony ?? 'nopat'}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {eq.type}
                {eq.model ? <span className="text-muted-foreground font-normal"> · {eq.model}</span> : null}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {eq.patrimony && <span className="font-mono">#{eq.patrimony}</span>}
                {eq.delivery_date && (
                  <span>
                    Entrega:{' '}
                    {format(parseISO(eq.delivery_date), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                )}
                {eq.order_number && <span>Ped. {eq.order_number}</span>}
              </div>
            </div>
            <Badge variant="outline" className={`gap-1 whitespace-nowrap ${daysBadgeColor(eq.days_allocated)}`}>
              <Clock className="w-3 h-3" />
              {eq.days_allocated === null ? '--' : `${eq.days_allocated}d`}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AllocationsTab() {
  const { groupedByClient, summary, isLoading, isFetching, error, refetch } = useERPAllocations();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groupedByClient;
    return groupedByClient.filter(c => {
      if (c.client_name.toLowerCase().includes(term)) return true;
      if (c.client_full_name?.toLowerCase().includes(term)) return true;
      return c.equipments.some(eq =>
        (eq.patrimony ?? '').toLowerCase().includes(term) ||
        (eq.model ?? '').toLowerCase().includes(term) ||
        eq.type.toLowerCase().includes(term)
      );
    });
  }, [groupedByClient, search]);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-2 text-xs overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
          <Users className="w-3.5 h-3.5" />
          <span className="font-medium">{summary.totalClients} clientes</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border whitespace-nowrap">
          <Package className="w-3.5 h-3.5" />
          <span className="font-medium">{summary.totalEquipments} equipamentos</span>
        </div>
        {summary.over60 > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-100 border border-orange-300 text-orange-800 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{summary.over60} {'>'} 60d</span>
          </div>
        )}
        {summary.over180 > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-100 border border-red-300 text-red-800 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">{summary.over180} {'>'} 180d</span>
          </div>
        )}
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, patrimônio ou tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive text-sm">
          Erro ao carregar alocações do ERP.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma alocação encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <ClientAllocationCard key={c.client_id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}
