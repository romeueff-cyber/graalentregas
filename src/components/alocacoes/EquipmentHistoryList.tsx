import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Package, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  CheckCircle, 
  ClipboardCheck,
  User,
  Clock,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EquipmentHistoryEntry, HISTORY_ACTIONS } from '@/hooks/useEquipmentHistory';

interface EquipmentHistoryListProps {
  history: EquipmentHistoryEntry[];
  isLoading: boolean;
  error: string | null;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Package; color: string }> = {
  [HISTORY_ACTIONS.ENTREGA]: {
    label: 'Entrega',
    icon: ArrowDownToLine,
    color: 'bg-green-500/10 text-green-600 border-green-500/30',
  },
  [HISTORY_ACTIONS.DEVOLUCAO]: {
    label: 'Devolução',
    icon: ArrowUpFromLine,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  [HISTORY_ACTIONS.LIBERACAO]: {
    label: 'Liberação',
    icon: CheckCircle,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  [HISTORY_ACTIONS.CONFERENCIA]: {
    label: 'Conferência',
    icon: ClipboardCheck,
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  },
};

export function EquipmentHistoryList({ history, isLoading, error }: EquipmentHistoryListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground">Carregando histórico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-2">
            <Package className="w-10 h-10 text-destructive" />
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-2">
            <Package className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Nenhum registro encontrado no período
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by date
  const groupedByDate = history.reduce((acc, entry) => {
    const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, EquipmentHistoryEntry[]>);

  return (
    <div className="space-y-4">
      {Object.entries(groupedByDate).map(([dateKey, entries]) => (
        <div key={dateKey} className="space-y-2">
          <div className="sticky top-0 z-10 py-1 px-2 bg-background/95 backdrop-blur">
            <p className="text-xs font-medium text-muted-foreground">
              {format(new Date(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>

          <div className="space-y-2">
            {entries.map((entry) => {
              const config = ACTION_CONFIG[entry.action_type] || {
                label: entry.action_type,
                icon: Package,
                color: 'bg-muted text-muted-foreground border-muted',
              };
              const Icon = config.icon;

              return (
                <Card key={entry.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg border ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs">
                            {entry.patrimony}
                          </Badge>
                          <Badge className={`text-xs ${config.color}`}>
                            {config.label}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium truncate">
                          {entry.client_name}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(entry.created_at), 'HH:mm')}
                          </span>
                          {entry.order_number && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              #{entry.order_number}
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
