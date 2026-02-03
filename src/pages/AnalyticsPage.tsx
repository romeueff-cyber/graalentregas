import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { DeliveryDashboard } from '@/components/analytics/DeliveryDashboard';
import { HygieneDashboard } from '@/components/analytics/HygieneDashboard';
import { DriverPerformanceDashboard } from '@/components/analytics/DriverPerformanceDashboard';
import { ExportPDFButton } from '@/components/analytics/ExportPDFButton';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, BarChart3, Package, Droplets, RefreshCw, CalendarIcon, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format, subDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'entregas' | 'higienizacao' | 'entregadores'>('entregas');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [periodType, setPeriodType] = useState<'7' | '15' | '30' | 'custom'>('7');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const days = periodType === 'custom' && dateRange?.from && dateRange?.to
    ? differenceInDays(dateRange.to, dateRange.from) + 1
    : parseInt(periodType);

  const { deliveryMetrics, hygieneMetrics, driverMetrics, isLoading } = useAnalyticsData(days);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['analytics-equipments'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-all-equipments'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-hygiene-clients'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-hygiene-equipment'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-hygiene-services'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-profiles'] });
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

        {/* Period Selector */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as '7' | '15' | '30' | 'custom')}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {periodType === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 justify-start text-left font-normal text-sm",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                        {format(dateRange.to, "dd/MM", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    <span>Selecionar datas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {periodType === 'custom' && dateRange?.from && dateRange?.to
              ? `${days} dias selecionados`
              : `Últimos ${days} dias`}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'entregas' | 'higienizacao' | 'entregadores')}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="entregas" className="flex items-center gap-1 text-xs sm:text-sm">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Performance de</span> Entregas
            </TabsTrigger>
            <TabsTrigger value="entregadores" className="flex items-center gap-1 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              Entregadores
            </TabsTrigger>
            <TabsTrigger value="higienizacao" className="flex items-center gap-1 text-xs sm:text-sm">
              <Droplets className="w-4 h-4" />
              <span className="hidden sm:inline">Ciclos de</span> Higienização
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entregas">
            <DeliveryDashboard metrics={deliveryMetrics} />
          </TabsContent>

          <TabsContent value="entregadores">
            <DriverPerformanceDashboard driverMetrics={driverMetrics} />
          </TabsContent>

          <TabsContent value="higienizacao">
            <HygieneDashboard metrics={hygieneMetrics} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
