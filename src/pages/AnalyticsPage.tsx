import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { DeliveryDashboard } from '@/components/analytics/DeliveryDashboard';
import { HygieneDashboard } from '@/components/analytics/HygieneDashboard';
import { ExportPDFButton } from '@/components/analytics/ExportPDFButton';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, Package, Droplets, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { deliveryMetrics, hygieneMetrics, isLoading } = useAnalyticsData(7);
  const [activeTab, setActiveTab] = useState<'entregas' | 'higienizacao'>('entregas');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['analytics-equipments'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-all-equipments'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-hygiene-clients'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-hygiene-equipment'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-hygiene-services'] });
    setIsRefreshing(false);
  };

  if (authLoading || isLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Only admins can access analytics
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass border-b px-4 py-3 safe-area-top sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-foreground">Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <ExportPDFButton 
              deliveryMetrics={deliveryMetrics} 
              hygieneMetrics={hygieneMetrics}
              activeTab={activeTab}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'entregas' | 'higienizacao')}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="entregas" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Performance de</span> Entregas
            </TabsTrigger>
            <TabsTrigger value="higienizacao" className="flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              <span className="hidden sm:inline">Ciclos de</span> Higienização
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entregas">
            <DeliveryDashboard metrics={deliveryMetrics} />
          </TabsContent>

          <TabsContent value="higienizacao">
            <HygieneDashboard metrics={hygieneMetrics} />
          </TabsContent>
        </Tabs>

        {/* Period Info */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Dados dos últimos 7 dias
        </div>
      </div>
    </div>
  );
}
