import { Users, Wrench, CheckCircle, AlertTriangle, Calendar, Droplets } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import type { HygieneMetrics } from '@/hooks/useAnalyticsData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface HygieneDashboardProps {
  metrics: HygieneMetrics;
}

export function HygieneDashboard({ metrics }: HygieneDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Clientes"
          value={metrics.totalClients}
          subtitle="Cadastrados na agenda"
          icon={<Users className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Equipamentos"
          value={metrics.totalEquipment}
          subtitle="Ativos para higienização"
          icon={<Wrench className="w-5 h-5" />}
          variant="default"
        />
        <KPICard
          title="Serviços (7 dias)"
          value={metrics.servicesCompleted}
          subtitle="Limpezas e trocas realizadas"
          icon={<CheckCircle className="w-5 h-5" />}
          variant="success"
        />
        <KPICard
          title="Atrasados"
          value={metrics.overdueCleanings}
          subtitle="Limpezas em atraso"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={metrics.overdueCleanings > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Serviços por Dia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Serviços por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.cleaningsByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="label" 
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
                    formatter={(value: number) => [value, 'Serviços']}
                    labelFormatter={(label) => `Dia: ${label}`}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--status-ready))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Equipamentos por Tipo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Equipamentos por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {metrics.equipmentByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.equipmentByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="type"
                    >
                      {metrics.equipmentByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend 
                      formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem equipamentos cadastrados
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Serviços por Tipo */}
      {metrics.servicesByType.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Tipos de Serviço Realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {metrics.servicesByType.map((service) => (
                <div key={service.type} className="flex-1 text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{service.count}</p>
                  <p className="text-xs text-muted-foreground">{service.type}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              <strong className="text-foreground">{metrics.upcomingCleanings}</strong> limpezas programadas para os próximos 7 dias
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
