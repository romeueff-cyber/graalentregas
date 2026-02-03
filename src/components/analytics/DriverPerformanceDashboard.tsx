import { useMemo } from 'react';
import { KPICard } from './KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Package, CheckCircle, Clock, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface DriverMetrics {
  userId: string;
  userName: string;
  totalDeliveries: number;
  confirmationRate: number;
  avgCollectionDays: number;
  score: number;
}

interface DriverPerformanceDashboardProps {
  driverMetrics: DriverMetrics[];
  isLoading?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--status-ready))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function DriverPerformanceDashboard({ driverMetrics, isLoading }: DriverPerformanceDashboardProps) {
  const sortedByScore = useMemo(() => 
    [...driverMetrics].sort((a, b) => b.score - a.score),
    [driverMetrics]
  );

  const sortedByDeliveries = useMemo(() => 
    [...driverMetrics].sort((a, b) => b.totalDeliveries - a.totalDeliveries),
    [driverMetrics]
  );

  const totalDeliveries = useMemo(() => 
    driverMetrics.reduce((sum, d) => sum + d.totalDeliveries, 0),
    [driverMetrics]
  );

  const avgConfirmationRate = useMemo(() => {
    if (driverMetrics.length === 0) return 0;
    return Math.round(driverMetrics.reduce((sum, d) => sum + d.confirmationRate, 0) / driverMetrics.length);
  }, [driverMetrics]);

  const avgCollectionTime = useMemo(() => {
    const driversWithData = driverMetrics.filter(d => d.avgCollectionDays > 0);
    if (driversWithData.length === 0) return 0;
    return Math.round(driversWithData.reduce((sum, d) => sum + d.avgCollectionDays, 0) / driversWithData.length * 10) / 10;
  }, [driverMetrics]);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-amber-500 text-white"><Trophy className="w-3 h-3 mr-1" />1º</Badge>;
      case 2:
        return <Badge className="bg-muted-foreground text-white">2º</Badge>;
      case 3:
        return <Badge className="bg-amber-800 text-white">3º</Badge>;
      default:
        return <Badge variant="outline">{rank}º</Badge>;
    }
  };

  const getPerformanceIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="w-4 h-4 text-status-collected" />;
    if (score >= 50) return <Minus className="w-4 h-4 text-status-ready" />;
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (driverMetrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado de entregador disponível para o período selecionado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Entregadores Ativos"
          value={driverMetrics.length}
          icon={<Users className="w-5 h-5" />}
        />
        <KPICard
          title="Total Entregas"
          value={totalDeliveries}
          icon={<Package className="w-5 h-5" />}
        />
        <KPICard
          title="Taxa Confirmação Média"
          value={`${avgConfirmationRate}%`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <KPICard
          title="Tempo Médio Recolha"
          value={`${avgCollectionTime} dias`}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Deliveries Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Entregas por Entregador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedByDeliveries} layout="vertical">
                <XAxis type="number" />
                <YAxis 
                  dataKey="userName" 
                  type="category" 
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} entregas`, 'Total']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="totalDeliveries" radius={[0, 4, 4, 0]}>
                  {sortedByDeliveries.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Ranking Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Ranking de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedByScore.map((driver, index) => (
              <div
                key={driver.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getRankBadge(index + 1)}
                  <div>
                    <p className="font-medium text-sm">{driver.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver.totalDeliveries} entregas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">Confirmação</p>
                    <p className="font-medium">{driver.confirmationRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">Tempo Médio</p>
                    <p className="font-medium">{driver.avgCollectionDays} dias</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {getPerformanceIcon(driver.score)}
                    <span className="font-bold text-base">{driver.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <p className="font-medium mb-1">Como a pontuação é calculada:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Entregas (40%): Mais entregas = maior pontuação</li>
              <li>Taxa de confirmação (30%): Clientes que confirmam via link</li>
              <li>Tempo de recolha (30%): Menor tempo = maior pontuação</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
