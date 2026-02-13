import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FinanceiroLegend } from '@/components/financeiro/FinanceiroLegend';
import { ManualBoletoDialog } from '@/components/financeiro/ManualBoletoDialog';
import { useBoletos } from '@/hooks/useBoletos';
import { useBoleto } from '@/hooks/useBoleto';
import { useAuth } from '@/hooks/useAuth';
import { 
  ArrowLeft, 
  FileText, 
  Search, 
  ExternalLink, 
  Copy, 
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Clock,
  Ban,
  FileCheck,
  Plus,
} from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function FinanceiroPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    boletos, 
    isLoading, 
    refetch, 
    formatCurrency, 
    getStatusColor, 
    translateStatus,
    markAsReconciled,
    syncWithCora,
    isSyncing,
    getUnreconciledPaidCount,
  } = useBoletos();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']));
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [selectedBoletoId, setSelectedBoletoId] = useState<string | null>(null);
  const [manualBoletoDialogOpen, setManualBoletoDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderNumber, setCancelOrderNumber] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const { cancelBoleto } = useBoleto();

  // Helper function for overdue check
  const isOverdueCheck = (dueDate: string, status: string) => {
    const upper = status.toUpperCase();
    if (upper === 'PAID' || upper === 'PAGO' || upper === 'CANCELLED' || upper === 'CANCELADO') return false;
    return isBefore(parseISO(dueDate), startOfDay(new Date()));
  };

  // Status counts for filter chips
  const statusCounts = useMemo(() => {
    if (!boletos) return { pending: 0, registered: 0, paid: 0, overdue: 0, cancelled: 0, unreconciled: 0 };
    
    return {
      pending: boletos.filter(b => ['PENDING', 'OPEN'].includes(b.status.toUpperCase())).length,
      registered: boletos.filter(b => b.status.toUpperCase() === 'REGISTERED').length,
      paid: boletos.filter(b => b.status.toUpperCase() === 'PAID').length,
      overdue: boletos.filter(b => isOverdueCheck(b.due_date, b.status)).length,
      cancelled: boletos.filter(b => b.status.toUpperCase() === 'CANCELLED').length,
      unreconciled: boletos.filter(b => b.status.toUpperCase() === 'PAID' && !b.reconciled).length,
    };
  }, [boletos]);

  // Toggle filter function for chip selection
  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      
      // If clicking 'all', clear everything and set only 'all'
      if (filter === 'all') {
        return new Set(['all']);
      }
      
      // Remove 'all' when selecting specific filters
      next.delete('all');
      
      if (next.has(filter)) {
        next.delete(filter);
        // If no filters left, default back to 'all'
        if (next.size === 0) {
          return new Set(['all']);
        }
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const filteredBoletos = useMemo(() => {
    if (!boletos) return [];
    
    return boletos.filter(boleto => {
      const matchesSearch = 
        boleto.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        boleto.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        boleto.customer_document.includes(searchTerm);
      
      // If 'all' is selected, show everything
      if (activeFilters.has('all')) {
        return matchesSearch;
      }
      
      // Check if boleto matches any of the active filters
      const status = boleto.status.toUpperCase();
      const overdueCheck = isOverdueCheck(boleto.due_date, boleto.status);
      
      const matchesStatus = 
        (activeFilters.has('pending') && (status === 'PENDING' || status === 'OPEN')) ||
        (activeFilters.has('registered') && status === 'REGISTERED') ||
        (activeFilters.has('paid') && status === 'PAID') ||
        (activeFilters.has('overdue') && overdueCheck) ||
        (activeFilters.has('cancelled') && status === 'CANCELLED') ||
        (activeFilters.has('unreconciled') && status === 'PAID' && !boleto.reconciled);
      
      return matchesSearch && matchesStatus;
    });
  }, [boletos, searchTerm, activeFilters]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copiado!`);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const openPdf = (url: string) => {
    window.open(url, '_blank');
  };


  const handleSync = async () => {
    try {
      const result = await syncWithCora();
      
      if (result.newlyPaid.length > 0) {
        toast.success(
          `Sincronização concluída! ${result.newlyPaid.length} novo(s) pagamento(s) detectado(s)`,
          { duration: 5000 }
        );
      } else if (result.updated > 0) {
        toast.success(`Sincronização concluída! ${result.updated} boleto(s) atualizado(s)`);
      } else {
        toast.info('Sincronização concluída. Nenhuma alteração detectada.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar com a Cora');
    }
  };

  const handleCancelClick = (orderNumber: string) => {
    setCancelOrderNumber(orderNumber);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelOrderNumber) return;
    setIsCancelling(true);
    try {
      const success = await cancelBoleto(cancelOrderNumber);
      if (success) {
        refetch();
      }
    } finally {
      setIsCancelling(false);
      setCancelDialogOpen(false);
      setCancelOrderNumber(null);
    }
  };

  const handleReconcileClick = (boletoId: string) => {
    setSelectedBoletoId(boletoId);
    setReconcileDialogOpen(true);
  };

  const handleConfirmReconcile = async () => {
    if (!selectedBoletoId) return;
    
    try {
      await markAsReconciled.mutateAsync({ 
        id: selectedBoletoId, 
        userId: user?.id 
      });
      toast.success('Boleto marcado como conciliado!');
    } catch (error) {
      console.error('Reconcile error:', error);
      toast.error('Erro ao marcar como conciliado');
    } finally {
      setReconcileDialogOpen(false);
      setSelectedBoletoId(null);
    }
  };

  // Summary stats
  const unreconciledCount = getUnreconciledPaidCount();
  const stats = {
    total: boletos?.length || 0,
    pending: boletos?.filter(b => ['PENDING', 'REGISTERED', 'OPEN'].includes(b.status.toUpperCase())).length || 0,
    paid: boletos?.filter(b => b.status.toUpperCase() === 'PAID').length || 0,
    overdue: boletos?.filter(b => isOverdueCheck(b.due_date, b.status)).length || 0,
    unreconciled: unreconciledCount,
    totalAmount: boletos?.reduce((sum, b) => sum + b.total_amount, 0) || 0,
    paidAmount: boletos?.filter(b => b.status.toUpperCase() === 'PAID').reduce((sum, b) => sum + b.total_amount, 0) || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-lg">Financeiro</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setManualBoletoDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Emitir</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
            {isSyncing ? (
              <LoadingSpinner className="w-4 h-4" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-4 space-y-4">
        {/* Alert for unreconciled payments */}
        {unreconciledCount > 0 && (
          <div className="bg-status-waiting/10 border border-status-waiting/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-waiting flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-status-waiting">
                {unreconciledCount} boleto(s) pago(s) aguardando conciliação
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Esses pagamentos foram confirmados pela Cora e precisam ser baixados no ERP.
              </p>
              <Button
                variant="link"
                size="sm"
                className="px-0 text-status-waiting"
                onClick={() => {
                  setActiveFilters(new Set(['unreconciled']));
                }}
              >
                Ver pagamentos pendentes →
              </Button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-card border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total de Boletos</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-card border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-status-waiting">{stats.pending}</p>
          </div>
          <div className="bg-card border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Pagos</p>
            <p className="text-2xl font-bold text-status-ready">{stats.paid}</p>
          </div>
          <div className="bg-card border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Vencidos</p>
            <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
          </div>
          <div className="bg-card border rounded-lg p-3 relative">
            <p className="text-xs text-muted-foreground">A Conciliar</p>
            <p className="text-2xl font-bold text-status-waiting">{stats.unreconciled}</p>
            {stats.unreconciled > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-status-waiting rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Valor Total Emitido</p>
              <p className="text-xl font-bold">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valor Recebido</p>
              <p className="text-xl font-bold text-status-ready">{formatCurrency(stats.paidAmount)}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pedido, cliente ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filters - Chip Style */}
        <div className="flex flex-col gap-1.5">
          {/* Row 1: All & Unreconciled */}
          <div className="flex gap-1.5">
            <button
              onClick={() => toggleFilter('all')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilters.has('all')
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Todos ({boletos?.length || 0})</span>
            </button>

            <button
              onClick={() => toggleFilter('unreconciled')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                activeFilters.has('unreconciled')
                  ? 'bg-status-waiting text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>A Conciliar ({statusCounts.unreconciled})</span>
              {statusCounts.unreconciled > 0 && !activeFilters.has('unreconciled') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-status-waiting rounded-full animate-pulse" />
              )}
            </button>
          </div>

          {/* Row 2: Status filters */}
          <div className="flex gap-1">
            <button
              onClick={() => toggleFilter('pending')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('pending')
                  ? 'bg-status-waiting text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <Clock className={`w-3 h-3 ${activeFilters.has('pending') ? 'text-white' : 'text-status-waiting'}`} />
              <span>{statusCounts.pending}</span>
            </button>

            <button
              onClick={() => toggleFilter('registered')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('registered')
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <FileCheck className={`w-3 h-3 ${activeFilters.has('registered') ? 'text-primary-foreground' : 'text-primary'}`} />
              <span>{statusCounts.registered}</span>
            </button>

            <button
              onClick={() => toggleFilter('paid')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('paid')
                  ? 'bg-status-ready text-white shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <CheckCircle2 className={`w-3 h-3 ${activeFilters.has('paid') ? 'text-white' : 'text-status-ready'}`} />
              <span>{statusCounts.paid}</span>
            </button>

            <button
              onClick={() => toggleFilter('overdue')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('overdue')
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <AlertCircle className={`w-3 h-3 ${activeFilters.has('overdue') ? 'text-destructive-foreground' : 'text-destructive'}`} />
              <span>{statusCounts.overdue}</span>
            </button>

            <button
              onClick={() => toggleFilter('cancelled')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeFilters.has('cancelled')
                  ? 'bg-muted-foreground text-background shadow-sm'
                  : 'bg-secondary/60 text-foreground hover:bg-secondary'
              }`}
            >
              <Ban className={`w-3 h-3 ${activeFilters.has('cancelled') ? 'text-background' : 'text-muted-foreground'}`} />
              <span>{statusCounts.cancelled}</span>
            </button>
          </div>
        </div>

        {/* Boletos Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filteredBoletos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum boleto encontrado</p>
            {searchTerm && <p className="text-sm mt-1">Tente buscar com outros termos</p>}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBoletos.map((boleto) => {
                    const isPaidNotReconciled = boleto.status.toUpperCase() === 'PAID' && !boleto.reconciled;
                    
                    return (
                      <TableRow 
                        key={boleto.id}
                        className={cn(
                          isPaidNotReconciled && "bg-status-waiting/5"
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">#{boleto.order_number}</span>
                            {isPaidNotReconciled && (
                              <span className="w-2 h-2 bg-status-waiting rounded-full animate-pulse" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[150px]">{boleto.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{boleto.customer_document}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(boleto.total_amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className={cn(
                              "text-sm",
                              isOverdueCheck(boleto.due_date, boleto.status) && "text-destructive font-semibold"
                            )}>
                              {format(parseISO(boleto.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-xs", getStatusColor(
                              isOverdueCheck(boleto.due_date, boleto.status) ? 'OVERDUE' : boleto.status
                            ))}>
                              {isOverdueCheck(boleto.due_date, boleto.status) ? 'Vencido' : translateStatus(boleto.status)}
                            </Badge>
                            {boleto.reconciled && (
                              <span title="Conciliado">
                                <CheckCircle2 className="w-4 h-4 text-status-ready" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {isPaidNotReconciled && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-status-waiting border-status-waiting/30 hover:bg-status-waiting/10"
                                onClick={() => handleReconcileClick(boleto.id)}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Conciliar</span>
                              </Button>
                            )}
                            {boleto.status.toUpperCase() !== 'PAID' && boleto.status.toUpperCase() !== 'CANCELLED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleCancelClick(boleto.order_number)}
                                title="Cancelar boleto"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            {boleto.digitable_line && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyToClipboard(boleto.digitable_line!, 'Código de barras')}
                                title="Copiar linha digitável"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            {boleto.pdf_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openPdf(boleto.pdf_url!)}
                                title="Abrir PDF"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
      {/* Financeiro Legend */}
      <FinanceiroLegend />

      {/* Reconcile Confirmation Dialog */}
      <AlertDialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Conciliação</AlertDialogTitle>
            <AlertDialogDescription>
              Ao marcar este boleto como conciliado, você confirma que a baixa foi realizada no sistema ERP.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmReconcile}
              className="bg-status-ready hover:bg-status-ready/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmar Conciliação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Boleto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o(s) boleto(s) do pedido <strong>#{cancelOrderNumber}</strong>?
              O boleto será cancelado na Cora e o status será atualizado para "Cancelado". 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelling ? (
                <LoadingSpinner className="w-4 h-4 mr-2" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Boleto Dialog */}
      <ManualBoletoDialog
        open={manualBoletoDialogOpen}
        onOpenChange={setManualBoletoDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
