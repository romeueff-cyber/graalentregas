import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useBoletos } from '@/hooks/useBoletos';
import { 
  ArrowLeft, 
  FileText, 
  Search, 
  ExternalLink, 
  Copy, 
  RefreshCw,
  Calendar,
  Filter,
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function FinanceiroPage() {
  const navigate = useNavigate();
  const { boletos, isLoading, refetch, formatCurrency, getStatusColor, translateStatus } = useBoletos();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredBoletos = boletos?.filter(boleto => {
    const matchesSearch = 
      boleto.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      boleto.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      boleto.customer_document.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || boleto.status.toUpperCase() === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

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

  const isOverdue = (dueDate: string, status: string) => {
    if (status.toUpperCase() === 'PAID' || status.toUpperCase() === 'PAGO') return false;
    return isBefore(parseISO(dueDate), startOfDay(new Date()));
  };

  // Summary stats
  const stats = {
    total: boletos?.length || 0,
    pending: boletos?.filter(b => b.status.toUpperCase() === 'PENDING' || b.status.toUpperCase() === 'REGISTERED').length || 0,
    paid: boletos?.filter(b => b.status.toUpperCase() === 'PAID').length || 0,
    overdue: boletos?.filter(b => isOverdue(b.due_date, b.status)).length || 0,
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, cliente ou documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="REGISTERED">Registrado</SelectItem>
              <SelectItem value="PAID">Pago</SelectItem>
              <SelectItem value="OVERDUE">Vencido</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
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
                  {filteredBoletos.map((boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell>
                        <span className="font-mono font-semibold">#{boleto.order_number}</span>
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
                            isOverdue(boleto.due_date, boleto.status) && "text-destructive font-semibold"
                          )}>
                            {format(parseISO(boleto.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", getStatusColor(
                          isOverdue(boleto.due_date, boleto.status) ? 'OVERDUE' : boleto.status
                        ))}>
                          {isOverdue(boleto.due_date, boleto.status) ? 'Vencido' : translateStatus(boleto.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
