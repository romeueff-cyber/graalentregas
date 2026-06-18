import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { KPICard } from './KPICard';
import { useClientHealth, type ClientHealthStatus } from '@/hooks/useClientHealth';
import {
  Users, TrendingDown, TrendingUp, AlertTriangle, Sparkles, Loader2,
  Search, ArrowUpDown, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClientHealthRow } from '@/hooks/useClientHealth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  /** Janela de análise em dias (recomendado 90-180). */
  days?: number;
  onSelectClient?: (clientName: string) => void;
}

const STATUS_LABEL: Record<ClientHealthStatus, string> = {
  ativo: 'Ativo',
  risco: 'Em risco',
  parado: 'Parado',
  novo: 'Novo',
};

const STATUS_VARIANT: Record<ClientHealthStatus, 'default' | 'success' | 'warning' | 'destructive'> = {
  ativo: 'success',
  risco: 'warning',
  parado: 'destructive',
  novo: 'default',
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

export function ClientHealthDashboard({ days: _ignored = 180, onSelectClient }: Props) {
  const [windowDays, setWindowDays] = useState<number>(180);
  const { metrics, isLoading, error } = useClientHealth(windowDays);
  const [grupoFilter, setGrupoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientHealthStatus>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'daysSinceLast' | 'totalValue' | 'trendPct'>('daysSinceLast');
  const days = windowDays;

  const filteredRows = useMemo(() => {
    let rows = metrics.rows;
    if (grupoFilter !== 'all') rows = rows.filter(r => r.grupoCliente === grupoFilter);
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.clientName.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      if (sortBy === 'totalValue') return b.totalValue - a.totalValue;
      if (sortBy === 'trendPct') return a.trendPct - b.trendPct; // worst first
      return b.daysSinceLast - a.daysSinceLast;
    });
    return rows;
  }, [metrics.rows, grupoFilter, statusFilter, search, sortBy]);

  const visibleRows = filteredRows.slice(0, 100);

  const handleExportPDF = () => {
    try {
      const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      const filtros: string[] = [];
      if (search.trim()) filtros.push(`Busca: "${search.trim()}"`);
      if (grupoFilter !== 'all') filtros.push(`Grupo: ${grupoFilter}`);
      if (statusFilter !== 'all') filtros.push(`Status: ${STATUS_LABEL[statusFilter as ClientHealthStatus]}`);
      const filtrosTxt = filtros.length ? filtros.join(' · ') : 'Nenhum filtro aplicado';

      const totalValorFiltrado = filteredRows.reduce((s, r) => s + r.totalValue, 0);
      const totalPedidosFiltrado = filteredRows.reduce((s, r) => s + r.totalOrders, 0);

      const escapeHtml = (s: string) =>
        String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

      const rowsHtml = filteredRows.map((r: ClientHealthRow) => {
        const statusColor =
          r.status === 'ativo' ? '#16a34a'
          : r.status === 'risco' ? '#d97706'
          : r.status === 'parado' ? '#dc2626'
          : '#2563eb';
        const trendColor = r.trendPct > 0 ? '#16a34a' : r.trendPct < 0 ? '#dc2626' : '#6b7280';
        return `
          <tr>
            <td>${escapeHtml(r.clientName)}</td>
            <td style="font-size:11px;color:#6b7280;">${escapeHtml(r.grupoCliente)}</td>
            <td style="text-align:right;">${r.totalOrders}</td>
            <td style="text-align:right;">${formatCurrency(r.totalValue)}</td>
            <td style="text-align:right;">${r.avgIntervalDays > 0 ? r.avgIntervalDays + 'd' : '-'}</td>
            <td style="text-align:right;">${r.daysSinceLast}d</td>
            <td style="text-align:right;color:${trendColor};">${r.trendPct > 0 ? '+' : ''}${r.trendPct}%</td>
            <td style="text-align:center;color:${statusColor};font-weight:600;">${STATUS_LABEL[r.status]}</td>
          </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Saúde de Clientes - Graal Beer</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding:30px; color:#1a1a1a; }
  .header { text-align:center; margin-bottom:24px; border-bottom:2px solid #ef4444; padding-bottom:14px; }
  .header h1 { color:#ef4444; font-size:22px; margin-bottom:6px; }
  .header p { color:#666; font-size:12px; }
  .meta { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px 14px; margin-bottom:18px; font-size:12px; color:#374151; }
  .kpis { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:20px; }
  .kpi { border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center; }
  .kpi .v { font-size:18px; font-weight:bold; }
  .kpi .l { font-size:9px; color:#666; text-transform:uppercase; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  th,td { padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:11px; text-align:left; }
  th { background:#f9fafb; font-weight:600; font-size:10px; text-transform:uppercase; color:#6b7280; }
  .footer { margin-top:20px; text-align:center; color:#999; font-size:10px; }
  @media print { body { padding:15px; } .kpis { gap:6px; } tr { page-break-inside: avoid; } }
</style></head><body>
  <div class="header">
    <h1>Saúde de Clientes - Graal Beer</h1>
    <p>Janela: ${windowDays >= 3650 ? 'Todo o período' : 'Últimos ' + windowDays + ' dias'} · Gerado em ${today}</p>
  </div>
  <div class="meta">
    <strong>Filtros:</strong> ${escapeHtml(filtrosTxt)}<br/>
    <strong>${filteredRows.length}</strong> cliente(s) · <strong>${totalPedidosFiltrado}</strong> pedido(s) · <strong>${formatCurrency(totalValorFiltrado)}</strong> em valor total
  </div>
  <div class="kpis">
    <div class="kpi"><div class="v">${metrics.totalClients}</div><div class="l">Total</div></div>
    <div class="kpi"><div class="v" style="color:#16a34a;">${metrics.ativos}</div><div class="l">Ativos</div></div>
    <div class="kpi"><div class="v" style="color:#2563eb;">${metrics.novos}</div><div class="l">Novos</div></div>
    <div class="kpi"><div class="v" style="color:#d97706;">${metrics.emRisco}</div><div class="l">Em risco</div></div>
    <div class="kpi"><div class="v" style="color:#dc2626;">${metrics.parados}</div><div class="l">Parados</div></div>
    <div class="kpi"><div class="v">${filteredRows.length}</div><div class="l">Filtrados</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Cliente</th><th>Grupo</th>
      <th style="text-align:right;">Pedidos</th>
      <th style="text-align:right;">Valor</th>
      <th style="text-align:right;">Interv. médio</th>
      <th style="text-align:right;">Últ. pedido</th>
      <th style="text-align:right;">Tendência</th>
      <th style="text-align:center;">Status</th>
    </tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999;">Sem clientes para exportar</td></tr>'}</tbody>
  </table>
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


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Analisando saúde dos clientes…
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Erro ao carregar dados do ERP. Verifique a conexão.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Window selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Janela de análise (independente do período global):
        </p>
        <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(parseInt(v))}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 180 dias</SelectItem>
            <SelectItem value="365">Últimos 365 dias</SelectItem>
            <SelectItem value="730">Últimos 2 anos</SelectItem>
            <SelectItem value="3650">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard
          title="Total de Clientes"
          value={metrics.totalClients}
          subtitle={`Últimos ${days} dias`}
          icon={<Users className="w-5 h-5" />}
        />
        <KPICard
          title="Ativos"
          value={metrics.ativos}
          subtitle="Comprando no ritmo"
          icon={<TrendingUp className="w-5 h-5" />}
          variant="success"
        />
        <KPICard
          title="Em risco"
          value={metrics.emRisco}
          subtitle="> 2× intervalo médio"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="warning"
        />
        <KPICard
          title="Parados"
          value={metrics.parados}
          subtitle="> 3× intervalo ou 120d"
          icon={<TrendingDown className="w-5 h-5" />}
          variant="warning"
        />
        <KPICard
          title="Novos"
          value={metrics.novos}
          subtitle="1º pedido no período"
          icon={<Sparkles className="w-5 h-5" />}
        />
      </div>

      {/* By grupo chart */}
      {metrics.byGrupo.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status por Grupo de Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.byGrupo}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="grupo" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ativos" stackId="a" name="Ativos" fill="hsl(var(--status-collected))" />
                  <Bar dataKey="novos" stackId="a" name="Novos" fill="hsl(var(--primary))" />
                  <Bar dataKey="risco" stackId="a" name="Em risco" fill="hsl(var(--amber-500))" />
                  <Bar dataKey="parado" stackId="a" name="Parados" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={grupoFilter} onValueChange={setGrupoFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {metrics.grupos.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | ClientHealthStatus)}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="novo">Novos</SelectItem>
                <SelectItem value="risco">Em risco</SelectItem>
                <SelectItem value="parado">Parados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <ArrowUpDown className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daysSinceLast">Dias sem comprar</SelectItem>
                <SelectItem value="trendPct">Maior queda</SelectItem>
                <SelectItem value="totalValue">Maior valor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {filteredRows.length} cliente(s) — mostrando {visibleRows.length}
          </p>

          {/* Table */}
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 px-2 font-medium">Cliente</th>
                  <th className="py-2 px-2 font-medium hidden md:table-cell">Grupo</th>
                  <th className="py-2 px-2 font-medium text-right">Pedidos</th>
                  <th className="py-2 px-2 font-medium text-right hidden sm:table-cell">Valor</th>
                  <th className="py-2 px-2 font-medium text-right hidden lg:table-cell">Interv. médio</th>
                  <th className="py-2 px-2 font-medium text-right">Últ. pedido</th>
                  <th className="py-2 px-2 font-medium text-right hidden md:table-cell">Tendência</th>
                  <th className="py-2 px-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      Nenhum cliente encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : visibleRows.map(r => {
                  const variant = STATUS_VARIANT[r.status];
                  return (
                    <tr
                      key={`${r.clientId}-${r.clientName}`}
                      className="border-b last:border-0 hover:bg-accent/40 cursor-pointer"
                      onClick={() => onSelectClient?.(r.clientName)}
                    >
                      <td className="py-2 px-2 font-medium text-foreground max-w-[200px] truncate">
                        {r.clientName}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground hidden md:table-cell text-xs">
                        {r.grupoCliente}
                      </td>
                      <td className="py-2 px-2 text-right">{r.totalOrders}</td>
                      <td className="py-2 px-2 text-right hidden sm:table-cell">
                        {formatCurrency(r.totalValue)}
                      </td>
                      <td className="py-2 px-2 text-right hidden lg:table-cell">
                        {r.avgIntervalDays > 0 ? `${r.avgIntervalDays}d` : '-'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={r.daysSinceLast > 60 ? 'text-destructive' : r.daysSinceLast > 30 ? 'text-amber-500' : ''}>
                          {r.daysSinceLast}d
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right hidden md:table-cell">
                        <span
                          className={
                            r.trendPct > 0
                              ? 'text-status-collected'
                              : r.trendPct < 0
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          }
                        >
                          {r.trendPct > 0 ? '+' : ''}{r.trendPct}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant={variant === 'destructive' ? 'destructive' : 'secondary'}
                          className={
                            variant === 'success'
                              ? 'bg-status-collected/15 text-status-collected hover:bg-status-collected/20'
                              : variant === 'warning'
                              ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/20'
                              : ''
                          }
                        >
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRows.length > visibleRows.length && (
            <p className="text-xs text-muted-foreground text-center">
              Refine os filtros para ver os {filteredRows.length - visibleRows.length} clientes restantes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
