import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { ClientHealthDashboard } from '@/components/analytics/ClientHealthDashboard';
import { OpportunityForecastTab } from '@/components/analytics/OpportunityForecastTab';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, HeartPulse, RefreshCw, Sparkles, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

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
    setIsRefreshing(false);
  };

  if (authLoading || isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="glass border-b px-4 py-3 safe-area-top sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-foreground">Saúde do Cliente</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
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
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Previsão Hoje
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
        </Tabs>
      </div>
    </div>
  );
}
