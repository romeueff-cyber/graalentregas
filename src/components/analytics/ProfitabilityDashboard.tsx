import { useProfitabilityData } from '@/hooks/useProfitabilityData';
import { KPICard } from './KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function MarginBadge({ margin }: { margin: number }) {
  if (margin >= 60) return <Badge className="bg-status-collected/20 text-status-collected border-status-collected/30">{margin}%</Badge>;
  if (margin >= 30) return <Badge className="bg-chart-3/20 text-chart-3 border-chart-3/30">{margin}%</Badge>;
  if (margin >= 0) return <Badge className="bg-primary/20 text-primary border-primary/30">{margin}%</Badge>;
  return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{margin}%</Badge>;
}

export function ProfitabilityDashboard() {
  const { profitabilityData, driverDayCosts, summary, isLoading } = useProfitabilityData();
  const [subTab, setSubTab] = useState<'clientes' | 'motoristas'>('clientes');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (profitabilityData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Sem dados de rentabilidade disponíveis.</p>
          <p className="text-xs text-muted-foreground mt-1">
            É necessário ter boletos emitidos e entregas registradas com coordenadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Chart data - top 10 by profit
  const chartData = profitabilityData.slice(0, 10).map(c => ({
    name: c.clientName.length > 15 ? c.clientName.slice(0, 15) + '…' : c.clientName,
    lucro: c.profit,
    fullName: c.clientName,
  }));

  // Unprofitable clients
  const unprofitableClients = profitabilityData.filter(c => c.profit < 0);

  // Driver summary from day costs
  const driverSummary = driverDayCosts.reduce((acc, dc) => {
    if (!acc.has(dc.driverId)) {
      acc.set(dc.driverId, {
        name: dc.driverName,
        totalDays: 0,
        totalMovements: 0,
        totalDistanceKm: 0,
        totalCost: 0,
      });
    }
    const d = acc.get(dc.driverId)!;
    d.totalDays++;
    d.totalMovements += dc.movements;
    d.totalDistanceKm += dc.totalDistanceKm;
    d.totalCost += dc.totalCost;
    return acc;
  }, new Map<string, { name: string; totalDays: number; totalMovements: number; totalDistanceKm: number; totalCost: number }>());

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          title="Receita Total"
          value={formatCurrency(summary.totalRevenue)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KPICard
          title="Custo Estimado"
          value={formatCurrency(summary.totalCost)}
          icon={<TrendingDown className="w-4 h-4" />}
        />
        <KPICard
          title="Lucro Estimado"
          value={formatCurrency(summary.totalProfit)}
          icon={<TrendingUp className="w-4 h-4" />}
          variant={summary.totalProfit >= 0 ? 'success' : 'danger'}
        />
        <KPICard
          title="Margem Média"
          value={`${summary.avgMargin}%`}
          icon={<Users className="w-4 h-4" />}
          subtitle={`${summary.totalClients} clientes · ${summary.totalMovements} movimentos`}
        />
      </div>

      {/* Chart - Top 10 by Profit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 10 Clientes por Lucro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} fontSize={11} />
                <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Lucro']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                />
                <Bar dataKey="lucro" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.lucro >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Unprofitable Warning */}
      {unprofitableClients.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Clientes com Prejuízo ({unprofitableClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unprofitableClients.map((c) => (
                <div key={c.clientName} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-2">{c.clientName}</span>
                  <span className="text-destructive font-medium whitespace-nowrap">
                    {formatCurrency(c.profit)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sub-tabs: Clients vs Drivers */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'clientes' | 'motoristas')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="clientes" className="text-xs sm:text-sm">
            <Users className="w-4 h-4 mr-1" />
            Por Cliente
          </TabsTrigger>
          <TabsTrigger value="motoristas" className="text-xs sm:text-sm">
            <Truck className="w-4 h-4 mr-1" />
            Por Motorista
          </TabsTrigger>
        </TabsList>

        {/* Client Table */}
        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rentabilidade por Cliente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Cliente</th>
                      <th className="text-right p-3 font-medium">Receita</th>
                      <th className="text-right p-3 font-medium">Custo</th>
                      <th className="text-right p-3 font-medium">Lucro</th>
                      <th className="text-center p-3 font-medium">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.map((c) => (
                      <tr key={c.clientName} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <div className="truncate max-w-[150px] sm:max-w-[250px]">{c.clientName}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.deliveryCount} entrega(s)
                            {c.collectionCount > 0 && ` · ${c.collectionCount} recolha(s)`}
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">{formatCurrency(c.totalRevenue)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatCurrency(c.totalCost)}</td>
                        <td className={`p-3 text-right font-medium whitespace-nowrap ${c.profit < 0 ? 'text-destructive' : 'text-status-collected'}`}>
                          {formatCurrency(c.profit)}
                        </td>
                        <td className="p-3 text-center">
                          <MarginBadge margin={c.margin} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Driver Table */}
        <TabsContent value="motoristas">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Custo Operacional por Motorista</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Motorista</th>
                      <th className="text-right p-3 font-medium">Dias</th>
                      <th className="text-right p-3 font-medium">Movimentos</th>
                      <th className="text-right p-3 font-medium">Km Total</th>
                      <th className="text-right p-3 font-medium">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(driverSummary.entries()).map(([id, d]) => (
                      <tr key={id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{d.name}</td>
                        <td className="p-3 text-right">{d.totalDays}</td>
                        <td className="p-3 text-right">{d.totalMovements}</td>
                        <td className="p-3 text-right">{d.totalDistanceKm.toFixed(1)} km</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(d.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
