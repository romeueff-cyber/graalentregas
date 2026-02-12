import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner, FullPageLoader } from '@/components/ui/loading-spinner';
import { 
  ArrowLeft, 
  Package, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  User,
  Building,
  Phone,
  History,
  Clock,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipmentHistory } from '@/hooks/useEquipmentHistory';
import { EquipmentHistoryFilters } from '@/components/alocacoes/EquipmentHistoryFilters';
import { EquipmentHistoryList } from '@/components/alocacoes/EquipmentHistoryList';
import { usePendingReturns } from '@/hooks/usePendingReturns';
import { offlineReturnQueue } from '@/lib/offline-return-queue';

interface ERPEquipment {
  type: string;
  description: string | null;
  patrimony: string | null;
  model: string | null;
  quantity: number;
  status?: string;
  client_name?: string;
}

interface ClientInfo {
  id: string | number;
  name: string;
  phone?: string;
}

export default function AlocacoesPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  // ERP Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [equipments, setEquipments] = useState<ERPEquipment[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // History filters state
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate] = useState(() => new Date());
  const [patrimonyFilter, setPatrimonyFilter] = useState('');
  const [clientNameFilter, setClientNameFilter] = useState('');

  // Pending offline returns
  const { pending: pendingReturns, count: pendingCount, refresh: refreshPending } = usePendingReturns();

  // History hook with debounced filters
  const { history, isLoading: historyLoading, error: historyError, refetch } = useEquipmentHistory({
    startDate,
    endDate,
    patrimony: patrimonyFilter,
    clientName: clientNameFilter,
  });

  if (authLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Digite o número do pedido ou ID do cliente');
      return;
    }

    setIsSearching(true);
    setError(null);
    setEquipments([]);
    setClientInfo(null);
    setHasSearched(true);

    try {
      // First try to get order data to find client ID
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'search-erp-order',
        { body: { orderNumber: searchQuery.trim() } }
      );

      let clientId: string | number | null = null;
      
      if (!orderError && orderData) {
        clientId = orderData.client_id;
        setClientInfo({
          id: orderData.client_id,
          name: orderData.customer_name || 'Cliente',
          phone: orderData.phone,
        });
      }

      if (clientId) {
        // Fetch all client equipment
        const { data: equipmentData, error: equipError } = await supabase.functions.invoke(
          'get-client-equipment',
          { body: { clientId } }
        );

        if (equipError) {
          console.error('[AlocacoesPage] Error fetching equipment:', equipError);
          setError('Erro ao buscar equipamentos');
        } else if (equipmentData?.equipments) {
          setEquipments(equipmentData.equipments);
          console.log(`[AlocacoesPage] Found ${equipmentData.equipments.length} equipment(s)`);
        } else {
          setEquipments([]);
        }
      } else {
        // Try searching directly with the query as client ID
        const { data: equipmentData, error: equipError } = await supabase.functions.invoke(
          'get-client-equipment',
          { body: { clientId: searchQuery.trim() } }
        );

        if (equipError) {
          setError('Pedido ou cliente não encontrado');
        } else if (equipmentData?.equipments) {
          setEquipments(equipmentData.equipments);
        } else {
          setEquipments([]);
        }
      }

    } catch (err) {
      console.error('[AlocacoesPage] Search error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearFilters = () => {
    setPatrimonyFilter('');
    setClientNameFilter('');
  };

  const equipmentsWithPatrimony = equipments.filter(eq => eq.patrimony);
  const equipmentsWithoutPatrimony = equipments.filter(eq => !eq.patrimony);

  return (
    <div className="min-h-screen bg-background pb-safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Equipamentos Alocados</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="historico" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="historico" className="flex-1 gap-1">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="flex-1 gap-1 relative">
              <Clock className="w-4 h-4" />
              Pendências
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="busca" className="flex-1 gap-1">
              <Search className="w-4 h-4" />
              Buscar ERP
            </TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="historico" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Registro de Movimentações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EquipmentHistoryFilters
                  startDate={startDate}
                  endDate={endDate}
                  patrimony={patrimonyFilter}
                  clientName={clientNameFilter}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onPatrimonyChange={setPatrimonyFilter}
                  onClientNameChange={setClientNameFilter}
                  onClearFilters={handleClearFilters}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {history.length} registro(s) encontrado(s)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={refetch}
                disabled={historyLoading}
                className="text-xs gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            <EquipmentHistoryList
              history={history}
              isLoading={historyLoading}
              error={historyError}
            />
          </TabsContent>

          {/* Pending Offline Returns Tab */}
          <TabsContent value="pendentes" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <WifiOff className="w-4 h-4" />
                    Devoluções Pendentes de Sincronização
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshPending}
                    className="text-xs gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pendingCount === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <CheckCircle2 className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Todas as devoluções foram sincronizadas com o ERP
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">
                      {pendingCount} devolução(ões) aguardando conexão para sincronizar com o ERP
                    </p>
                    {pendingReturns.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="p-2 rounded-full bg-destructive/10">
                          <Clock className="w-4 h-4 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm font-mono">
                              {item.patrimony}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/30">
                              Pendente
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.clientName}
                            {item.orderNumber && ` • Pedido ${item.orderNumber}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(item.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {' • '}{item.type === 'standalone' ? 'Avulsa' : item.type === 'delivery' ? 'Pós-entrega' : 'Recolha'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ERP Search Tab */}
          <TabsContent value="busca" className="space-y-4 mt-0">
            {/* Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Buscar Cliente no ERP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Número do pedido ou ID do cliente"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 h-11"
                  />
                  <Button 
                    onClick={handleSearch} 
                    disabled={isSearching}
                    className="h-11 px-4"
                  >
                    {isSearching ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o número de um pedido para ver todos os equipamentos alocados ao cliente
                </p>
              </CardContent>
            </Card>

            {/* Alert about BeerSales */}
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Lembrete:</strong> Equipamentos com produto alocado devem ser retornados 
                diretamente no <strong>BeerSales</strong>, não por este app.
              </AlertDescription>
            </Alert>

            {/* Client Info */}
            {clientInfo && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{clientInfo.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          ID: {clientInfo.id}
                        </span>
                        {clientInfo.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {clientInfo.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-muted-foreground">Buscando equipamentos...</p>
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="w-10 h-10 text-destructive" />
                    <p className="text-sm text-destructive text-center">{error}</p>
                    <Button variant="outline" size="sm" onClick={handleSearch} className="gap-2">
                      <RefreshCw className="w-3 h-3" />
                      Tentar novamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : hasSearched && equipments.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Package className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhum equipamento alocado encontrado
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : equipments.length > 0 ? (
              <div className="space-y-4">
                {/* Equipments with patrimony */}
                {equipmentsWithPatrimony.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        Equipamentos com Patrimônio
                        <Badge variant="outline" className="ml-auto">
                          {equipmentsWithPatrimony.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {equipmentsWithPatrimony.map((eq, idx) => (
                        <div
                          key={eq.patrimony || idx}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {eq.quantity}x {eq.type}
                              </span>
                              <Badge variant="outline" className="font-mono text-xs">
                                Pat: {eq.patrimony}
                              </Badge>
                              {eq.status && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                >
                                  {eq.status}
                                </Badge>
                              )}
                            </div>
                            {eq.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {eq.description}
                                {eq.model && ` - ${eq.model}`}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Equipments without patrimony */}
                {equipmentsWithoutPatrimony.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                        <Package className="w-4 h-4" />
                        Outros Equipamentos
                        <Badge variant="secondary" className="ml-auto">
                          {equipmentsWithoutPatrimony.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {equipmentsWithoutPatrimony.map((eq, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm"
                        >
                          <Badge variant="secondary" className="text-xs">
                            {eq.quantity}x {eq.type}
                          </Badge>
                          {eq.description && (
                            <span className="text-xs text-muted-foreground">
                              {eq.description}
                            </span>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground italic pt-1">
                        Equipamentos sem patrimônio não requerem liberação individual
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
