import { Users, TrendingUp, Repeat, Calendar, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import type { ClientMetrics } from '@/hooks/useAnalyticsData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ClientsDashboardProps {
  metrics: ClientMetrics;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--status-ready))',
  'hsl(var(--status-collected))',
  'hsl(var(--amber-500))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
];

export function ClientsDashboard({ metrics }: ClientsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Total de Clientes"
          value={metrics.totalClients}
          subtitle="Clientes únicos no período"
          icon={<Users className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Total de Pedidos"
          value={metrics.totalOrders}
          subtitle="Pedidos no período"
          icon={<Calendar className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Pedidos/Cliente"
          value={metrics.avgOrdersPerClient.toFixed(1)}
          subtitle="Média de recorrência"
          icon={<Repeat className="w-5 h-5" />}
          variant={metrics.avgOrdersPerClient >= 2 ? 'success' : 'default'}
        />
        <KPICard
          title="Clientes Recorrentes"
          value={`${metrics.recurrentRate}%`}
          subtitle="Com mais de 1 pedido"
          icon={<TrendingUp className="w-5 h-5" />}
          variant={metrics.recurrentRate >= 30 ? 'success' : 'warning'}
        />
      </div>

      {/* Top 10 Clients Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="w-4 h-4" />
            Top 10 Clientes por Volume de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {metrics.topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.topClients}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="clientName"
                    tick={{ fontSize: 11 }}
                    width={150}
                    tickFormatter={(value) =>
                      value.length > 20 ? `${value.substring(0, 20)}...` : value
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value, 'Pedidos']}
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
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Frequency Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            Distribuição de Frequência de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            {metrics.frequencyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.frequencyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value, 'Clientes']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
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
              <Award className="w-4 h-4" />
              <span>
                Cliente top:{' '}
                <strong className="text-foreground">
                  {metrics.topClients[0]?.clientName || 'N/A'}
                </strong>
                {' '}com{' '}
                <strong className="text-foreground">{metrics.topClients[0]?.orderCount || 0}</strong> pedidos
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
