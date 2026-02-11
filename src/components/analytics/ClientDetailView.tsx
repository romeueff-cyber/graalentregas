import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Package, Calendar, TrendingUp, Clock, Repeat, MapPin, Award,
  ArrowLeft, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ERPOrderAnalytics } from '@/hooks/useERPAnalytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

interface ClientDetailViewProps {
  clientName: string;
  erpOrders: ERPOrderAnalytics[];
  localEquipments: any[];
  equipmentHistory: any[];
  onBack: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(value);
}

export function ClientDetailView({
  clientName, erpOrders, localEquipments, equipmentHistory, onBack,
}: ClientDetailViewProps) {
  const stats = useMemo(() => {
    // ERP stats
    const totalValue = erpOrders.reduce((s, o) => s + (o.value || 0), 0);
    const avgOrderValue = erpOrders.length > 0 ? totalValue / erpOrders.length : 0;

    // Sales by day
    const dayMap = new Map<string, { value: number; count: number }>();
    erpOrders.forEach(o => {
      const d = o.date ? format(new Date(o.date), 'yyyy-MM-dd') : 'unknown';
      const ex = dayMap.get(d) || { value: 0, count: 0 };
      dayMap.set(d, { value: ex.value + (o.value || 0), count: ex.count + 1 });
    });
    const salesByDay = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        value: data.value,
        count: data.count,
        label: format(new Date(date), 'dd/MM', { locale: ptBR }),
      }));

    // Local delivery stats
    const totalDeliveries = localEquipments.length;
    const collected = localEquipments.filter(e => e.status === 'RECOLHIDO').length;
    const pending = localEquipments.filter(e => e.status !== 'RECOLHIDO').length;
    const confirmed = localEquipments.filter(e => e.token_used_at).length;
    const confirmationRate = totalDeliveries > 0 ? Math.round((confirmed / totalDeliveries) * 100) : 0;

    // Average collection time
    const withDates = localEquipments.filter(e => e.status === 'RECOLHIDO' && e.data_entrega && e.data_real_recolha);
    const avgDays = withDates.length > 0
      ? withDates.reduce((s, e) => s + Math.max(0, differenceInDays(new Date(e.data_real_recolha!), new Date(e.data_entrega!))), 0) / withDates.length
      : 0;

    // Equipment history (returns)
    const totalReturns = equipmentHistory.length;

    // Recent orders list
    const recentOrders = [...erpOrders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    // Delivery timeline
    const deliveryDays = new Map<string, number>();
    localEquipments.forEach(e => {
      if (e.data_entrega) {
        const d = format(new Date(e.data_entrega), 'yyyy-MM-dd');
        deliveryDays.set(d, (deliveryDays.get(d) || 0) + 1);
      }
    });
    const deliveryTimeline = Array.from(deliveryDays.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        count,
        label: format(new Date(date), 'dd/MM', { locale: ptBR }),
      }));

    // Collection period distribution
    const periods: Record<string, number> = {};
    localEquipments.forEach(e => {
      const p = e.periodo_recolha || 'N/A';
      const label = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', DIA_TODO: 'Dia Todo', CLIENTE_IRA_AVISAR: 'Avisará' }[p] || p;
      periods[label] = (periods[label] || 0) + 1;
    });
    const periodData = Object.entries(periods).map(([period, count]) => ({ period, count }));

    return {
      totalValue, avgOrderValue, totalDeliveries, collected, pending,
      confirmationRate, avgDays: Math.round(avgDays * 10) / 10,
      totalReturns, salesByDay, recentOrders, deliveryTimeline, periodData,
      erpOrderCount: erpOrders.length,
    };
  }, [erpOrders, localEquipments, equipmentHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-semibold text-foreground text-lg">{clientName}</h2>
          <p className="text-xs text-muted-foreground">Análise detalhada do cliente</p>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Valor Total"
          value={formatCurrency(stats.totalValue)}
          subtitle={`${stats.erpOrderCount} pedidos ERP`}
          icon={<DollarSign className="w-5 h-5" />}
          variant="success"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(stats.avgOrderValue)}
          subtitle="Valor médio por pedido"
          icon={<Receipt className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Entregas"
          value={stats.totalDeliveries}
          subtitle={`${stats.collected} recolhidos`}
          icon={<Package className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Confirmação"
          value={`${stats.confirmationRate}%`}
          subtitle="Taxa de confirmação"
          icon={<TrendingUp className="w-5 h-5" />}
          variant={stats.confirmationRate >= 50 ? 'success' : 'warning'}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          title="Pendentes"
          value={stats.pending}
          subtitle="Aguardando recolha"
          icon={<Clock className="w-5 h-5" />}
          variant={stats.pending > 0 ? 'warning' : 'default'}
        />
        <KPICard
          title="Devoluções"
          value={stats.totalReturns}
          subtitle="Registros de devolução"
          icon={<Repeat className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Tempo Médio"
          value={`${stats.avgDays}d`}
          subtitle="Dias até recolha"
          icon={<Calendar className="w-5 h-5" />}
          variant={stats.avgDays <= 7 ? 'success' : 'warning'}
        />
      </div>

      {/* Sales Chart */}
      {stats.salesByDay.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Vendas por Dia (ERP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--status-ready))" strokeWidth={2} dot={{ fill: 'hsl(var(--status-ready))', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Timeline */}
      {stats.deliveryTimeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Entregas por Dia (Sistema)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.deliveryTimeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value, 'Entregas']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period distribution */}
      {stats.periodData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Período de Recolha Preferido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.periodData.map(p => (
                <Badge key={p.period} variant="secondary" className="text-sm py-1 px-3">
                  {p.period}: <strong className="ml-1">{p.count}</strong>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders Table */}
      {stats.recentOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4" />
              Últimos Pedidos (ERP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {stats.recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="font-mono text-sm text-foreground">#{order.orderNumber}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {order.date ? format(new Date(order.date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-foreground">{formatCurrency(order.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {stats.erpOrderCount === 0 && stats.totalDeliveries === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum dado encontrado para este cliente no período selecionado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
