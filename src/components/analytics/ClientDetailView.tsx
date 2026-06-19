import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Package, Calendar, TrendingUp, TrendingDown, Clock, Repeat, Award,
  ArrowLeft, Receipt, CalendarClock, BarChart2, ShieldAlert, FileText,
  Users, AlertCircle, ExternalLink, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  format, differenceInDays, startOfWeek, startOfMonth, addDays, getDay, isPast,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ERPOrderAnalytics } from '@/hooks/useERPAnalytics';
import { useBoletos } from '@/hooks/useBoletos';
import { ClientNotesCard } from './ClientNotesCard';
import { toast } from 'sonner';
import { toJpeg } from 'html-to-image';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
} from 'recharts';

export interface GroupComparison {
  groupName: string;
  clientCount: number;
  avgOrders: number;
  avgValue: number;
  avgTicket: number;
}

interface ClientDetailViewProps {
  clientName: string;
  erpOrders: ERPOrderAnalytics[];
  localEquipments: any[];
  equipmentHistory: any[];
  onBack: () => void;
  churnScore?: number;
  groupComparison?: GroupComparison;
}

type Granularity = 'day' | 'week' | 'month';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function diffPct(client: number, group: number): number {
  if (!group) return 0;
  return Math.round(((client - group) / group) * 100);
}

function ComparisonBadge({ pct, label }: { pct: number; label: string }) {
  const positive = pct >= 0;
  const color = pct === 0
    ? 'text-muted-foreground bg-muted'
    : positive
    ? 'text-status-collected bg-status-collected/15'
    : 'text-destructive bg-destructive/15';
  const Icon = pct === 0 ? null : positive ? TrendingUp : TrendingDown;
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${color}`}>
      {Icon && <Icon className="w-3 h-3" />}
      <span className="font-semibold">{pct > 0 ? '+' : ''}{pct}%</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  );
}

const EQUIP_STATUS_LABEL: Record<string, string> = {
  ENTREGUE: 'Entregue',
  LIBERADO_PARA_RECOLHA: 'Liberado p/ recolha',
  RECOLHIDO: 'Recolhido',
};

export function ClientDetailView({
  clientName, erpOrders, localEquipments, equipmentHistory, onBack,
  churnScore, groupComparison,
}: ClientDetailViewProps) {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const { boletos } = useBoletos();

  // Sempre abrir o detalhe no topo da página (mobile costuma estar rolado)
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
  }, [clientName]);

  // Pending boletos for this client (status != PAID and != CANCELLED)
  const clientBoletos = useMemo(() => {
    if (!boletos) return { pending: [], all: [] };
    const norm = clientName.trim().toLowerCase();
    const all = boletos.filter(b => b.customer_name?.trim().toLowerCase().includes(norm));
    const pending = all.filter(b => {
      const s = (b.status || '').toUpperCase();
      return s !== 'PAID' && s !== 'CANCELLED';
    });
    return { pending, all };
  }, [boletos, clientName]);

  // Equipment currently in use (not collected)
  const equipInUse = useMemo(
    () => localEquipments.filter(e => e.status !== 'RECOLHIDO'),
    [localEquipments]
  );

  const stats = useMemo(() => {
    const totalValue = erpOrders.reduce((s, o) => s + (o.value || 0), 0);
    const avgOrderValue = erpOrders.length > 0 ? totalValue / erpOrders.length : 0;

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

  // Group comparison values
  const cmpOrders = groupComparison ? diffPct(stats.erpOrderCount, groupComparison.avgOrders) : 0;
  const cmpValue = groupComparison ? diffPct(stats.totalValue, groupComparison.avgValue) : 0;
  const cmpTicket = groupComparison ? diffPct(stats.avgOrderValue, groupComparison.avgTicket) : 0;

  // Churn score color
  const churnColor =
    churnScore == null ? 'text-muted-foreground'
    : churnScore >= 80 ? 'text-destructive'
    : churnScore >= 50 ? 'text-amber-600'
    : 'text-status-collected';

  const handleExportPDF = () => {
    try {
      const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const escapeHtml = (s: string) =>
        String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

      const cmpHtml = groupComparison ? `
        <div class="card">
          <div class="card-title">Comparação com o grupo "${escapeHtml(groupComparison.groupName)}" (${groupComparison.clientCount} clientes)</div>
          <table class="cmp">
            <tr><th>Métrica</th><th>Este cliente</th><th>Média do grupo</th><th>Diferença</th></tr>
            <tr><td>Pedidos</td><td>${stats.erpOrderCount}</td><td>${groupComparison.avgOrders.toFixed(1)}</td>
              <td style="color:${cmpOrders >= 0 ? '#16a34a' : '#dc2626'}">${cmpOrders > 0 ? '+' : ''}${cmpOrders}%</td></tr>
            <tr><td>Valor total</td><td>${formatCurrency(stats.totalValue)}</td><td>${formatCurrency(groupComparison.avgValue)}</td>
              <td style="color:${cmpValue >= 0 ? '#16a34a' : '#dc2626'}">${cmpValue > 0 ? '+' : ''}${cmpValue}%</td></tr>
            <tr><td>Ticket médio</td><td>${formatCurrency(stats.avgOrderValue)}</td><td>${formatCurrency(groupComparison.avgTicket)}</td>
              <td style="color:${cmpTicket >= 0 ? '#16a34a' : '#dc2626'}">${cmpTicket > 0 ? '+' : ''}${cmpTicket}%</td></tr>
          </table>
        </div>` : '';

      const equipInUseHtml = equipInUse.length ? `
        <div class="card">
          <div class="card-title">Equipamentos em uso (${equipInUse.length})</div>
          <table>
            <thead><tr><th>Patrimônio</th><th>Status</th><th>Data entrega</th><th>Período recolha</th></tr></thead>
            <tbody>
              ${equipInUse.map(e => `
                <tr>
                  <td>${escapeHtml(e.numero_patrimonio || '-')}</td>
                  <td>${escapeHtml(EQUIP_STATUS_LABEL[e.status] || e.status || '-')}</td>
                  <td>${e.data_entrega ? format(new Date(e.data_entrega), 'dd/MM/yyyy') : '-'}</td>
                  <td>${escapeHtml(e.periodo_recolha || '-')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '';

      const boletosPendingHtml = clientBoletos.pending.length ? `
        <div class="card">
          <div class="card-title" style="color:#dc2626;">Boletos pendentes (${clientBoletos.pending.length})</div>
          <table>
            <thead><tr><th>Pedido</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              ${clientBoletos.pending.map(b => {
                const overdue = b.due_date && isPast(new Date(b.due_date));
                return `<tr>
                  <td>#${escapeHtml(b.order_number)}</td>
                  <td style="color:${overdue ? '#dc2626' : '#1a1a1a'}">${b.due_date ? format(new Date(b.due_date), 'dd/MM/yyyy') : '-'}${overdue ? ' (vencido)' : ''}</td>
                  <td>${formatCurrency((b.total_amount || 0) / 100)}</td>
                  <td>${escapeHtml(b.status)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : '';

      const recentOrdersHtml = stats.recentOrders.length ? `
        <div class="card">
          <div class="card-title">Últimos pedidos (ERP)</div>
          <table>
            <thead><tr><th>Pedido</th><th>Data</th><th style="text-align:right">Valor</th></tr></thead>
            <tbody>
              ${stats.recentOrders.map(o => `
                <tr>
                  <td>#${escapeHtml(o.orderNumber)}</td>
                  <td>${o.date ? format(new Date(o.date), 'dd/MM/yyyy') : '-'}</td>
                  <td style="text-align:right">${formatCurrency(o.value)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '';

      const churnHtml = churnScore != null ? `
        <div class="kpi">
          <div class="kpi-l">Score de Churn</div>
          <div class="kpi-v" style="color:${churnScore >= 80 ? '#dc2626' : churnScore >= 50 ? '#d97706' : '#16a34a'}">${churnScore}/100</div>
        </div>` : '';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(clientName)} - Detalhe</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:30px;color:#1a1a1a;}
  .header{border-bottom:2px solid #ef4444;padding-bottom:14px;margin-bottom:18px;}
  .header h1{color:#ef4444;font-size:20px;margin-bottom:4px;}
  .header p{color:#666;font-size:11px;}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px;}
  .kpi{border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center;}
  .kpi-v{font-size:16px;font-weight:bold;}
  .kpi-l{font-size:9px;color:#666;text-transform:uppercase;margin-bottom:4px;}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:14px;page-break-inside:avoid;}
  .card-title{font-size:12px;font-weight:600;margin-bottom:8px;color:#1a1a1a;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th,td{padding:5px 6px;border-bottom:1px solid #f1f5f9;text-align:left;}
  th{background:#f9fafb;font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:600;}
  table.cmp td:nth-child(n+2),table.cmp th:nth-child(n+2){text-align:right;}
  .footer{margin-top:18px;text-align:center;color:#999;font-size:10px;}
  @media print{body{padding:15px;}}
</style></head><body>
  <div class="header">
    <h1>${escapeHtml(clientName)}</h1>
    <p>Análise detalhada · Gerado em ${today}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-l">Valor Total</div><div class="kpi-v" style="color:#16a34a">${formatCurrency(stats.totalValue)}</div></div>
    <div class="kpi"><div class="kpi-l">Pedidos</div><div class="kpi-v">${stats.erpOrderCount}</div></div>
    <div class="kpi"><div class="kpi-l">Ticket Médio</div><div class="kpi-v">${formatCurrency(stats.avgOrderValue)}</div></div>
    <div class="kpi"><div class="kpi-l">Intervalo</div><div class="kpi-v">${stats.avgInterval > 0 ? stats.avgInterval + 'd' : '-'}</div></div>
    ${churnHtml || '<div class="kpi"><div class="kpi-l">Há sem pedir</div><div class="kpi-v">' + (stats.daysSinceLast ?? '-') + 'd</div></div>'}
  </div>
  ${cmpHtml}
  ${boletosPendingHtml}
  ${equipInUseHtml}
  ${recentOrdersHtml}
  <div class="footer">Graal Beer - Sistema de Gestão de Entregas</div>
</body></html>`;

      const w = window.open('', '_blank');
      if (!w) throw new Error('Bloqueador de pop-up impediu abrir a janela');
      w.document.write(html);
      w.document.close();
      w.onload = () => w.print();
      toast.success('Relatório gerado! Use Ctrl+P para salvar como PDF.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground text-base sm:text-lg truncate">{clientName}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {groupComparison?.groupName ? `Grupo: ${groupComparison.groupName} · ` : ''}Análise detalhada
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9 shrink-0">
          <FileText className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </div>

      {/* Churn score + group comparison */}
      {(churnScore != null || groupComparison) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {churnScore != null && (
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-14 h-14 rounded-full bg-muted ${churnColor}`}>
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${churnColor}`}>{churnScore}</span>
                    <span className="text-xs text-muted-foreground">/100 score de churn</span>
                  </div>
                  <div className="h-2 mt-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        churnScore >= 80 ? 'bg-destructive'
                        : churnScore >= 50 ? 'bg-amber-500'
                        : 'bg-status-collected'
                      }`}
                      style={{ width: `${churnScore}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {churnScore >= 80 ? 'Alto risco — priorize contato'
                      : churnScore >= 50 ? 'Atenção — acompanhar'
                      : 'Baixo risco'}
                  </p>
                </div>
              </div>
            )}
            {groupComparison && groupComparison.clientCount > 1 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Users className="w-3.5 h-3.5" />
                  Vs. média do grupo <strong className="text-foreground">{groupComparison.groupName}</strong>
                  <span>({groupComparison.clientCount} clientes)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ComparisonBadge pct={cmpOrders} label="pedidos" />
                  <ComparisonBadge pct={cmpValue} label="valor" />
                  <ComparisonBadge pct={cmpTicket} label="ticket" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          subtitle={stats.predictedNext ? format(stats.predictedNext, 'EEE', { locale: ptBR }) : 'Sem previsão'}
          icon={<Calendar className="w-5 h-5" />}
          variant={stats.predictedNext && stats.predictedNext < new Date() ? 'warning' : 'default'}
        />
      </div>

      {/* Notas & Follow-up */}
      <ClientNotesCard clientName={clientName} />

      {/* Boletos pendentes */}
      {clientBoletos.pending.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              Boletos Pendentes ({clientBoletos.pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {clientBoletos.pending.map(b => {
                const overdue = b.due_date && isPast(new Date(b.due_date));
                return (
                  <div key={b.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-foreground">#{b.order_number}</span>
                        <Badge variant={overdue ? 'destructive' : 'secondary'} className="text-[10px]">
                          {overdue ? 'Vencido' : b.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Vence em {b.due_date ? format(new Date(b.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm whitespace-nowrap">
                        {formatCurrency((b.total_amount || 0) / 100)}
                      </span>
                      {b.pdf_url && (
                        <a
                          href={b.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                          title="Abrir boleto"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Equipamentos em uso */}
      {equipInUse.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Equipamentos em Uso ({equipInUse.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {equipInUse.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-foreground">{e.numero_patrimonio || 'sem patrimônio'}</span>
                    <p className="text-xs text-muted-foreground">
                      Entregue {e.data_entrega ? format(new Date(e.data_entrega), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      {e.periodo_recolha ? ` · ${e.periodo_recolha}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      e.status === 'LIBERADO_PARA_RECOLHA'
                        ? 'bg-amber-500/15 text-amber-600'
                        : 'bg-primary/15 text-primary'
                    }
                  >
                    {EQUIP_STATUS_LABEL[e.status] || e.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
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
