import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Package, Calendar, TrendingUp, Clock, Repeat, Award,
  ArrowLeft, Receipt, CalendarClock, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  format, differenceInDays, startOfWeek, startOfMonth, addDays, getDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ERPOrderAnalytics } from '@/hooks/useERPAnalytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
} from 'recharts';

interface ClientDetailViewProps {
  clientName: string;
  erpOrders: ERPOrderAnalytics[];
  localEquipments: any[];
  equipmentHistory: any[];
  onBack: () => void;
}

type Granularity = 'day' | 'week' | 'month';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ClientDetailView({
  clientName, erpOrders, localEquipments, equipmentHistory, onBack,
}: ClientDetailViewProps) {
  const [granularity, setGranularity] = useState<Granularity>('day');

  const stats = useMemo(() => {
    const totalValue = erpOrders.reduce((s, o) => s + (o.value || 0), 0);
    const avgOrderValue = erpOrders.length > 0 ? totalValue / erpOrders.length : 0;

    // Grouping helpers
    const bucketKey = (d: Date) => {
      if (granularity === 'month') return format(startOfMonth(d), 'yyyy-MM');
      if (granularity === 'week') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      return format(d, 'yyyy-MM-dd');
    };
    const bucketLabel = (key: string) => {
      if (granularity === 'month') return format(new Date(key + '-01T12:00:00'), 'MMM/yy', { locale: ptBR });
      if (granularity === 'week') return 'Sem ' + format(new Date(key + 'T12:00:00'), 'dd/MM', { locale: ptBR });
      return format(new Date(key + 'T12:00:00'), 'dd/MM', { locale: ptBR });
    };

    const bucketMap = new Map<string, { value: number; count: number }>();
    erpOrders.forEach(o => {
      if (!o.date) return;
      const k = bucketKey(new Date(o.date));
      const ex = bucketMap.get(k) || { value: 0, count: 0 };
      bucketMap.set(k, { value: ex.value + (o.value || 0), count: ex.count + 1 });
    });
    const salesSeries = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({ key, label: bucketLabel(key), value: d.value, count: d.count }));

    // Peak weekday (1..7 -> labels)
    const weekdayMap = new Map<number, { count: number; value: number }>();
    erpOrders.forEach(o => {
      if (!o.date) return;
      const wd = getDay(new Date(o.date));
      const ex = weekdayMap.get(wd) || { count: 0, value: 0 };
      weekdayMap.set(wd, { count: ex.count + 1, value: ex.value + (o.value || 0) });
    });
    const weekdayData = WEEKDAYS.map((label, idx) => ({
      label,
      count: weekdayMap.get(idx)?.count || 0,
      value: weekdayMap.get(idx)?.value || 0,
    }));
    const peakWeekday = weekdayData.reduce(
      (best, cur) => (cur.count > best.count ? cur : best),
      { label: '-', count: 0, value: 0 }
    );

    // Local delivery stats
    const totalDeliveries = localEquipments.length;
    const collected = localEquipments.filter(e => e.status === 'RECOLHIDO').length;
    const pending = localEquipments.filter(e => e.status !== 'RECOLHIDO').length;
    const confirmed = localEquipments.filter(e => e.token_used_at).length;
    const confirmationRate = totalDeliveries > 0 ? Math.round((confirmed / totalDeliveries) * 100) : 0;

    const withDates = localEquipments.filter(e => e.status === 'RECOLHIDO' && e.data_entrega && e.data_real_recolha);
    const avgDays = withDates.length > 0
      ? withDates.reduce((s, e) => s + Math.max(0, differenceInDays(new Date(e.data_real_recolha!), new Date(e.data_entrega!))), 0) / withDates.length
      : 0;

    const totalReturns = equipmentHistory.length;

    const sortedDates = erpOrders
      .filter(o => o.date)
      .map(o => new Date(o.date))
      .sort((a, b) => a.getTime() - b.getTime());
    const lastDate = sortedDates[sortedDates.length - 1];
    const daysSinceLast = lastDate ? Math.max(0, differenceInDays(new Date(), lastDate)) : null;

    // Avg interval -> next predicted order
    let avgInterval = 0;
    if (sortedDates.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push(Math.max(1, differenceInDays(sortedDates[i], sortedDates[i - 1])));
      }
      avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }
    const predictedNext = lastDate && avgInterval > 0
      ? addDays(lastDate, Math.round(avgInterval))
      : null;

    const recentOrders = [...erpOrders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

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
      totalReturns, salesSeries, weekdayData, peakWeekday,
      recentOrders, periodData,
      erpOrderCount: erpOrders.length,
      daysSinceLast, avgInterval: Math.round(avgInterval * 10) / 10,
      predictedNext,
    };
  }, [erpOrders, localEquipments, equipmentHistory, granularity]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground text-base sm:text-lg truncate">{clientName}</h2>
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
        />
        <KPICard
          title="Entregas"
          value={stats.totalDeliveries}
          subtitle={`${stats.collected} recolhidos`}
          icon={<Package className="w-5 h-5" />}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          subtitle="Registros"
          icon={<Repeat className="w-5 h-5" />}
        />
        <KPICard
          title="Interv. Médio"
          value={stats.avgInterval > 0 ? `${stats.avgInterval}d` : '-'}
          subtitle={stats.daysSinceLast !== null ? `Há ${stats.daysSinceLast}d sem pedir` : 'Sem histórico'}
          icon={<CalendarClock className="w-5 h-5" />}
        />
        <KPICard
          title="Próx. Previsto"
          value={stats.predictedNext ? format(stats.predictedNext, 'dd/MM', { locale: ptBR }) : '-'}
          subtitle={stats.predictedNext ? format(stats.predictedNext, "EEE", { locale: ptBR }) : 'Sem previsão'}
          icon={<Calendar className="w-5 h-5" />}
          variant={
            stats.predictedNext && stats.predictedNext < new Date() ? 'warning' : 'default'
          }
        />
      </div>

      {/* Sales Chart with granularity */}
      {stats.salesSeries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Pedidos e Volume
              </CardTitle>
              <ToggleGroup
                type="single"
                size="sm"
                value={granularity}
                onValueChange={(v) => v && setGranularity(v as Granularity)}
                className="h-8"
              >
                <ToggleGroupItem value="day" className="h-8 px-3 text-xs">Diário</ToggleGroupItem>
                <ToggleGroupItem value="week" className="h-8 px-3 text-xs">Semanal</ToggleGroupItem>
                <ToggleGroupItem value="month" className="h-8 px-3 text-xs">Mensal</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.salesSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Pedidos', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'Volume (R$)' ? [formatCurrency(value), name] : [value, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="count" name="Pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="value"
                    name="Volume (R$)"
                    stroke="hsl(var(--status-collected))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--status-collected))', r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peak by weekday */}
      {stats.erpOrderCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pico por Dia da Semana
              {stats.peakWeekday.count > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  Pico: {stats.peakWeekday.label} ({stats.peakWeekday.count})
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'value' ? [formatCurrency(value), 'Volume'] : [value, 'Pedidos']
                    }
                  />
                  <Bar dataKey="count" name="Pedidos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-foreground">#{order.orderNumber}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {order.date ? format(new Date(order.date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-foreground whitespace-nowrap">{formatCurrency(order.value)}</span>
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
