import { useState, useMemo } from 'react';
import { Users, TrendingUp, Repeat, Calendar, Award, DollarSign, Receipt, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KPICard } from './KPICard';
import { ClientDetailView } from './ClientDetailView';
import type { ClientMetrics } from '@/hooks/useAnalyticsData';
import { useERPAnalytics, type ERPAnalyticsMetrics } from '@/hooks/useERPAnalytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts';

interface ClientsDashboardProps {
  metrics: ClientMetrics;
  days?: number;
  localEquipments?: any[];
  equipmentHistory?: any[];
}

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--status-ready))',
  'hsl(var(--status-collected))', 'hsl(var(--amber-500))',
  'hsl(var(--destructive))', 'hsl(var(--muted-foreground))',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ClientsDashboard({ metrics, days = 7, localEquipments = [], equipmentHistory = [] }: ClientsDashboardProps) {
  const { data: erpData, metrics: erpMetrics, isLoading: isLoadingERP, error: erpError } = useERPAnalytics(days);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Build a unified client list from both ERP and local data
  const allClients = useMemo(() => {
    const clientSet = new Map<string, string>(); // normalized -> display name
    
    // From ERP
    erpData.forEach(o => {
      if (o.clientName) {
        clientSet.set(o.clientName.trim().toLowerCase(), o.clientName.trim());
      }
    });
    
    // From local equipments
    localEquipments.forEach(e => {
      if (e.nome_cliente) {
        const key = e.nome_cliente.trim().toLowerCase();
        if (!clientSet.has(key)) {
          clientSet.set(key, e.nome_cliente.trim());
        }
      }
    });

    return Array.from(clientSet.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [erpData, localEquipments]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return allClients.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return allClients.filter(c => c.toLowerCase().includes(q)).slice(0, 20);
  }, [allClients, searchQuery]);

  // If a client is selected, show detail view
  if (selectedClient) {
    const normalizedSelected = selectedClient.trim().toLowerCase();
    const clientErpOrders = erpData.filter(o => o.clientName?.trim().toLowerCase() === normalizedSelected);
    const clientEquipments = localEquipments.filter(e => e.nome_cliente?.trim().toLowerCase() === normalizedSelected);
    const clientHistory = equipmentHistory.filter(h => h.client_name?.trim().toLowerCase() === normalizedSelected);

    return (
      <ClientDetailView
        clientName={selectedClient}
        erpOrders={clientErpOrders}
        localEquipments={clientEquipments}
        equipmentHistory={clientHistory}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Search & Select */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4" />
            Análise por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {filteredClients.length > 0 ? filteredClients.map(name => (
              <button
                key={name}
                onClick={() => setSelectedClient(name)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm text-foreground transition-colors"
              >
                {name}
              </button>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponível'}
              </p>
            )}
          </div>
          {allClients.length > 20 && !searchQuery && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Mostrando 20 de {allClients.length} clientes. Use a busca para filtrar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ERP Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPICard
          title="Valor Total"
          value={isLoadingERP ? '...' : formatCurrency(erpMetrics.totalValue)}
          subtitle="Vendas no período"
          icon={isLoadingERP ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
          variant="success"
        />
        <KPICard
          title="Ticket Médio"
          value={isLoadingERP ? '...' : formatCurrency(erpMetrics.avgOrderValue)}
          subtitle="Valor médio por pedido"
          icon={isLoadingERP ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Pedidos ERP"
          value={isLoadingERP ? '...' : erpMetrics.totalOrders}
          subtitle="Total no período"
          icon={isLoadingERP ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
          variant="default"
        />
      </div>

      {/* Sales Value by Day Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Valor de Vendas por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            {isLoadingERP ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando dados do ERP...
              </div>
            ) : erpError ? (
              <div className="h-full flex items-center justify-center text-destructive text-sm">
                Erro ao carregar dados do ERP
              </div>
            ) : erpMetrics.valueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={erpMetrics.valueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrencyFull(value), 'Valor']}
                    labelFormatter={(label) => `Dia: ${label}`}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--status-ready))" strokeWidth={2} dot={{ fill: 'hsl(var(--status-ready))', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados disponíveis</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Clients by Value */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="w-4 h-4" />
            Top 10 Clientes por Valor de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {isLoadingERP ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando dados do ERP...
              </div>
            ) : erpMetrics.topClientsByValue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={erpMetrics.topClientsByValue} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="clientName" tick={{ fontSize: 11 }} width={150}
                    tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number, name: string, props: any) => [formatCurrencyFull(value), `Valor (${props.payload.orderCount} pedidos)`]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="totalValue" radius={[0, 4, 4, 0]}>
                    {erpMetrics.topClientsByValue.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados disponíveis</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <div className="flex-1 h-px bg-border" />
        <span>Dados do Sistema (Entregas)</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Original Client KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Total de Clientes" value={metrics.totalClients} subtitle="Clientes únicos no período" icon={<Users className="w-5 h-5" />} variant="default" />
        <KPICard title="Total de Entregas" value={metrics.totalOrders} subtitle="Entregas no período" icon={<Calendar className="w-5 h-5" />} variant="default" />
        <KPICard title="Entregas/Cliente" value={metrics.avgOrdersPerClient.toFixed(1)} subtitle="Média de recorrência" icon={<Repeat className="w-5 h-5" />} variant={metrics.avgOrdersPerClient >= 2 ? 'success' : 'default'} />
        <KPICard title="Clientes Recorrentes" value={`${metrics.recurrentRate}%`} subtitle="Com mais de 1 entrega" icon={<TrendingUp className="w-5 h-5" />} variant={metrics.recurrentRate >= 30 ? 'success' : 'warning'} />
      </div>

      {/* Top 10 Clients Chart by Order Count */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="w-4 h-4" />
            Top 10 Clientes por Volume de Entregas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {metrics.topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topClients} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="clientName" tick={{ fontSize: 11 }} width={150}
                    tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [value, 'Entregas']}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="orderCount" radius={[0, 4, 4, 0]}>
                    {metrics.topClients.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados disponíveis</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Frequency Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            Distribuição de Frequência de Entregas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            {metrics.frequencyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.frequencyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [value, 'Clientes']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados disponíveis</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                <strong className="text-foreground">{metrics.newClients}</strong> novos clientes
                {' '}e{' '}
                <strong className="text-foreground">{metrics.recurrentClients}</strong> recorrentes no período
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span>
                Cliente top:{' '}
                <strong className="text-foreground">
                  {erpMetrics.topClientsByValue[0]?.clientName || metrics.topClients[0]?.clientName || 'N/A'}
                </strong>
                {' '}com{' '}
                <strong className="text-foreground">
                  {erpMetrics.topClientsByValue[0]?.totalValue
                    ? formatCurrencyFull(erpMetrics.topClientsByValue[0].totalValue)
                    : `${metrics.topClients[0]?.orderCount || 0} entregas`}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
