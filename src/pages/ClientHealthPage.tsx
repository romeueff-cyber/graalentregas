import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { ClientHealthDashboard } from '@/components/analytics/ClientHealthDashboard';
import { OpportunityForecastTab } from '@/components/analytics/OpportunityForecastTab';
import { FinancialHealthDashboard } from '@/components/analytics/FinancialHealthDashboard';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, HeartPulse, RefreshCw, Sparkles, Activity, DollarSign } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { EmpresaSelector } from '@/components/empresa/EmpresaSelector';

export default function ClientHealthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [periodType, setPeriodType] = useState<'90' | '180' | '365'>('90');

  const days = parseInt(periodType);

  const { allEquipments, equipmentHistory, isLoading } = useAnalyticsData(days);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['analytics-all-equipments'] });
    await queryClient.invalidateQueries({ queryKey: ['erp-analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['client-health'] });
    await queryClient.invalidateQueries({ queryKey: ['financial-health-boletos'] });
    setIsRefreshing(false);
  };

  if (authLoading || isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="glass border-b px-4 py-3 safe-area-top sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <HeartPulse className="w-5 h-5 text-primary shrink-0" />
              <h1 className="font-semibold text-foreground truncate">Saúde do Cliente</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <EmpresaSelector />
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as '90' | '180' | '365')}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Últimos 365 dias</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            Base de análise: {days} dias
          </span>
        </div>
      </div>

      <div className="p-4 pb-20">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm">
              <Activity className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="w-4 h-4" />
              Previsão
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1.5 text-xs sm:text-sm">
              <DollarSign className="w-4 h-4" />
              Financeiro
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <ClientHealthDashboard
              days={days}
              localEquipments={allEquipments}
              equipmentHistory={equipmentHistory}
            />
          </TabsContent>
          <TabsContent value="forecast">
            <OpportunityForecastTab days={days} />
          </TabsContent>
          <TabsContent value="financial">
            <FinancialHealthDashboard days={days} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
