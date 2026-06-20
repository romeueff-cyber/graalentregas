import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KPICard } from './KPICard';
import { useFinancialHealth } from '@/hooks/useFinancialHealth';
import {
  DollarSign, AlertTriangle, TrendingDown, CalendarClock, Ban,
  CircleDollarSign, Receipt, Flame, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  days?: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLfull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

const AGING_COLORS = [
  'hsl(48 96% 53%)',   // 1-15
  'hsl(35 91% 55%)',   // 16-30
  'hsl(20 90% 55%)',   // 31-60
  'hsl(0 84% 60%)',    // 61-90
  'hsl(340 82% 52%)',  // 90+
];

export function FinancialHealthDashboard({ days = 180 }: Props) {
  const { metrics, isLoading } = useFinancialHealth(days);

  const agingChart = useMemo(
    () => metrics.aging.map((b, i) => ({ ...b, fill: AGING_COLORS[i] })),
    [metrics.aging]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Inadimplência"
          value={fmtPct(metrics.inadimplenciaPct)}
          subtitle={`${fmtBRL(metrics.totalVencido)} vencidos`}
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={metrics.inadimplenciaPct > 10 ? 'danger' : metrics.inadimplenciaPct > 5 ? 'warning' : 'success'}
        />
        <KPICard
          title="A Receber"
          value={fmtBRL(metrics.totalAberto)}
          subtitle={`${metrics.countAberto} boletos em aberto`}
          icon={<CircleDollarSign className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Próx. 30 dias"
          value={fmtBRL(metrics.aReceber30)}
          subtitle={`${fmtBRL(metrics.aReceber7)} em 7d`}
          icon={<CalendarClock className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Pago no período"
          value={fmtBRL(metrics.totalPago)}
          subtitle={`${metrics.countPago} boletos · ticket ${fmtBRL(metrics.ticketMedio)}`}
          icon={<DollarSign className="w-5 h-5" />}
          variant="success"
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Pagamento em dia"
          value={fmtPct(metrics.taxaPagamentoEmDia)}
          icon={<Receipt className="w-5 h-5" />}
          variant={metrics.taxaPagamentoEmDia >= 80 ? 'success' : 'warning'}
        />
        <KPICard
          title="DSO médio"
          value={`${metrics.dsoDias}d`}
          subtitle="Prazo médio de recebimento"
          icon={<TrendingDown className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Cancelados"
          value={fmtPct(metrics.cancelamentoPct)}
          subtitle={`${metrics.countCancelado} · ${fmtBRL(metrics.totalCancelado)}`}
          icon={<Ban className="w-5 h-5" />}
          variant={metrics.cancelamentoPct > 10 ? 'warning' : 'default'}
        />
        <KPICard
          title="Alertas vermelhos"
          value={metrics.redAlerts.length}
          subtitle="Parados/Risco com débito"
          icon={<Flame className="w-5 h-5" />}
          variant={metrics.redAlerts.length > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Aging */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aging de recebíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.totalVencido === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum boleto vencido 🎉
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
                <Tooltip
                  formatter={(v: number, _n, p: any) => [
                    `${fmtBRLfull(v)} · ${p.payload.count} boletos`, 'Vencidos'
                  ]}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {agingChart.map((b, i) => <Cell key={i} fill={b.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Alerta vermelho */}
      {metrics.redAlerts.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-destructive" />
              Alerta vermelho — parados/risco com débito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.redAlerts.slice(0, 10).map((r) => (
              <div key={r.customerName} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-destructive/5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.healthStatus === 'parado' ? 'Parado' : 'Em risco'} ·
                    {' '}último pedido há {r.daysSinceLast}d · {r.count} boleto(s) · {r.maxDaysLate}d atraso
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0">{fmtBRL(r.totalOpen)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top devedores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 devedores</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.topDebtors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum boleto vencido no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {metrics.topDebtors.map((d, i) => (
                <div key={d.customerName} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.count} boleto(s) · venc. mais antigo{' '}
                        {format(parseISO(d.oldestDueDate), "dd/MM/yy", { locale: ptBR })} ·{' '}
                        {d.maxDaysLate}d atraso
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-semibold text-destructive border-destructive/40">
                    {fmtBRL(d.totalOpen)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
