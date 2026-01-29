import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHygieneClients } from '@/hooks/useHygieneClients';
import { getUrgencyLevel, getDaysUntilNextCleaning } from '@/types/hygiene';
import { ChoperaIcon, KegotaterIcon, SprayCanIcon } from '@/components/icons';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin,
  Plus,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HygieneClientWithEquipments, HygieneEquipmentWithServices } from '@/types/hygiene';

interface HygieneSidebarProps {
  onClientSelect?: (client: HygieneClientWithEquipments) => void;
  selectedClientId?: string | null;
  onRegisterService?: (equipment: HygieneEquipmentWithServices, clientName: string) => void;
}

type UrgencyFilter = 'all' | 'red' | 'orange' | 'yellow' | 'green';

export function HygieneSidebar({ 
  onClientSelect, 
  selectedClientId,
  onRegisterService,
}: HygieneSidebarProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  
  const { clients, summary, isLoading } = useHygieneClients();

  // Get most urgent equipment for a client
  const getMostUrgentEquipment = (client: HygieneClientWithEquipments) => {
    if (!client.equipments?.length) return null;
    
    const activeEquipments = client.equipments.filter(eq => eq.ativo);
    if (!activeEquipments.length) return null;
    
    return activeEquipments.reduce((mostUrgent, current) => {
      const currentDays = getDaysUntilNextCleaning(current.proxima_limpeza);
      const mostUrgentDays = getDaysUntilNextCleaning(mostUrgent.proxima_limpeza);
      
      if (currentDays === null) return mostUrgent;
      if (mostUrgentDays === null) return current;
      return currentDays < mostUrgentDays ? current : mostUrgent;
    });
  };

  // Get urgency level for a client based on most urgent equipment
  const getClientUrgency = (client: HygieneClientWithEquipments) => {
    const mostUrgent = getMostUrgentEquipment(client);
    if (!mostUrgent) return 'green';
    return getUrgencyLevel(getDaysUntilNextCleaning(mostUrgent.proxima_limpeza));
  };

  // Filter clients by urgency
  const filteredClients = useMemo(() => {
    if (urgencyFilter === 'all') return clients;
    return clients.filter(c => getClientUrgency(c) === urgencyFilter);
  }, [clients, urgencyFilter]);

  // Count clients by urgency
  const urgencyCounts = useMemo(() => {
    const counts = { all: 0, red: 0, orange: 0, yellow: 0, green: 0 };
    clients.forEach(client => {
      counts.all++;
      const urgency = getClientUrgency(client);
      counts[urgency]++;
    });
    return counts;
  }, [clients]);

  const toggleExpand = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  const handleOpenFullPage = () => {
    navigate('/higienizacao');
  };

  const getUrgencyColor = (urgency: 'green' | 'yellow' | 'orange' | 'red') => {
    switch (urgency) {
      case 'red': return 'bg-hygiene-red text-white';
      case 'orange': return 'bg-hygiene-orange text-white';
      case 'yellow': return 'bg-hygiene-yellow text-black';
      case 'green': return 'bg-hygiene-green text-white';
    }
  };

  const getUrgencyBorderColor = (urgency: 'green' | 'yellow' | 'orange' | 'red') => {
    switch (urgency) {
      case 'red': return 'border-hygiene-red/50';
      case 'orange': return 'border-hygiene-orange/50';
      case 'yellow': return 'border-hygiene-yellow/50';
      case 'green': return 'border-hygiene-green/50';
    }
  };

  // Compact collapsed state
  if (!isExpanded) {
    return (
      <div 
        className="absolute left-2 top-2 z-10 cursor-pointer"
        onClick={() => setIsExpanded(true)}
      >
        <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg p-2 flex items-center gap-2 hover:bg-muted/50 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <SprayCanIcon className="w-4 h-4 text-primary" />
          <Badge variant="secondary" className="text-xs font-semibold">
            {summary.totalClients} clientes
          </Badge>
          {summary.overdue > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              {summary.overdue}!
            </Badge>
          )}
        </div>
      </div>
    );
  }

  // Expanded state - full sidebar
  return (
    <div className="absolute left-2 top-2 bottom-20 w-80 bg-card/95 backdrop-blur-sm border rounded-lg shadow-xl z-10 flex flex-col animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <SprayCanIcon className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-xs">Higienização</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {filteredClients.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleOpenFullPage}
            title="Abrir página completa"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-2 py-1.5 border-b bg-muted/30 flex gap-1.5 overflow-x-auto">
        {summary.overdue > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] whitespace-nowrap">
            <AlertTriangle className="w-3 h-3" />
            <span className="font-medium">{summary.overdue} atrasadas</span>
          </div>
        )}
        {summary.next7Days > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-waiting/10 text-status-waiting text-[10px] whitespace-nowrap">
            <CalendarClock className="w-3 h-3" />
            <span className="font-medium">{summary.next7Days} em 7 dias</span>
          </div>
        )}
      </div>

      {/* Urgency Filter */}
      <div className="flex gap-1 p-2 border-b overflow-x-auto items-center">
        <button
          onClick={() => setUrgencyFilter('all')}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors",
            urgencyFilter === 'all'
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          Todos ({urgencyCounts.all})
        </button>
        <button
          onClick={() => setUrgencyFilter('red')}
          className={cn(
            "w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-colors",
            urgencyFilter === 'red' 
              ? "bg-hygiene-red text-white ring-2 ring-hygiene-red/50" 
              : "bg-hygiene-red/20 text-hygiene-red hover:bg-hygiene-red/40"
          )}
        >
          {urgencyCounts.red}
        </button>
        <button
          onClick={() => setUrgencyFilter('orange')}
          className={cn(
            "w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-colors",
            urgencyFilter === 'orange' 
              ? "bg-hygiene-orange text-white ring-2 ring-hygiene-orange/50" 
              : "bg-hygiene-orange/20 text-hygiene-orange hover:bg-hygiene-orange/40"
          )}
        >
          {urgencyCounts.orange}
        </button>
        <button
          onClick={() => setUrgencyFilter('yellow')}
          className={cn(
            "w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-colors",
            urgencyFilter === 'yellow' 
              ? "bg-hygiene-yellow text-black ring-2 ring-hygiene-yellow/50" 
              : "bg-hygiene-yellow/20 text-hygiene-yellow hover:bg-hygiene-yellow/40"
          )}
        >
          {urgencyCounts.yellow}
        </button>
        <button
          onClick={() => setUrgencyFilter('green')}
          className={cn(
            "w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-colors",
            urgencyFilter === 'green' 
              ? "bg-hygiene-green text-white ring-2 ring-hygiene-green/50" 
              : "bg-hygiene-green/20 text-hygiene-green hover:bg-hygiene-green/40"
          )}
        >
          {urgencyCounts.green}
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground text-xs">
            {urgencyFilter === 'all' 
              ? 'Nenhum cliente cadastrado'
              : 'Nenhum cliente nesta categoria'
            }
          </div>
        ) : (
          <div className="p-1.5 space-y-1">
            {filteredClients.map((client) => {
              const isClientExpanded = expandedClient === client.id;
              const isSelected = selectedClientId === client.id;
              const urgency = getClientUrgency(client);
              const mostUrgent = getMostUrgentEquipment(client);
              const daysUntil = mostUrgent ? getDaysUntilNextCleaning(mostUrgent.proxima_limpeza) : null;
              const activeEquipments = client.equipments?.filter(eq => eq.ativo) || [];

              return (
                <div
                  key={client.id}
                  className={cn(
                    "rounded-md border transition-all",
                    isSelected 
                      ? `bg-primary/10 ${getUrgencyBorderColor(urgency)}` 
                      : "bg-background hover:bg-muted/50"
                  )}
                >
                  {/* Client Row */}
                  <div
                    className="flex items-center gap-1.5 p-1.5 cursor-pointer"
                    onClick={() => onClientSelect?.(client)}
                  >
                    {/* Urgency Indicator */}
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      getUrgencyColor(urgency)
                    )} />

                    {/* Client Name and Status */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="font-medium text-xs truncate max-w-[100px]" title={client.nome_cliente}>
                        {client.nome_cliente.substring(0, 12)}
                        {client.nome_cliente.length > 12 && '...'}
                      </span>
                      {daysUntil !== null && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[9px] px-1 py-0",
                            urgency === 'red' && "border-hygiene-red text-hygiene-red",
                            urgency === 'orange' && "border-hygiene-orange text-hygiene-orange",
                            urgency === 'yellow' && "border-hygiene-yellow text-hygiene-yellow",
                            urgency === 'green' && "border-hygiene-green text-hygiene-green"
                          )}
                        >
                          {daysUntil <= 0 ? 'Atrasado' : `${daysUntil}d`}
                        </Badge>
                      )}
                    </div>

                    {/* Equipment Icons */}
                    <div className="flex items-center gap-1 ml-auto">
                      {activeEquipments.some(eq => eq.tipo_equipamento === 'chopeira') && (
                        <ChoperaIcon className="w-3.5 h-3.5 text-primary" />
                      )}
                      {activeEquipments.some(eq => eq.tipo_equipamento === 'kegotater') && (
                        <KegotaterIcon className="w-3.5 h-3.5 text-primary" />
                      )}
                      <span className="text-[9px] text-muted-foreground">
                        {activeEquipments.length}x
                      </span>
                    </div>

                    {/* Expand Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(client.id);
                      }}
                    >
                      {isClientExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  {isClientExpanded && (
                    <div className="border-t bg-muted/20 p-2 space-y-2 text-[10px]">
                      {/* Address */}
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{client.endereco}</span>
                      </div>

                      {/* Phone */}
                      {client.telefone_cliente && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <a href={`tel:${client.telefone_cliente}`} className="hover:underline">
                            {client.telefone_cliente}
                          </a>
                        </div>
                      )}

                      {/* Equipments List */}
                      <div className="space-y-1 pt-1">
                        {activeEquipments.map((eq) => {
                          const eqDays = getDaysUntilNextCleaning(eq.proxima_limpeza);
                          const eqUrgency = getUrgencyLevel(eqDays);
                          
                          return (
                            <div 
                              key={eq.id}
                              className="flex items-center justify-between py-1 px-1.5 rounded bg-background"
                            >
                              <div className="flex items-center gap-1.5">
                                {eq.tipo_equipamento === 'chopeira' ? (
                                  <ChoperaIcon className="w-3 h-3" />
                                ) : (
                                  <KegotaterIcon className="w-3 h-3" />
                                )}
                                <span className="font-mono text-[9px]">{eq.numero_serie}</span>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[8px] px-1 py-0",
                                  eqUrgency === 'red' && "border-hygiene-red text-hygiene-red",
                                  eqUrgency === 'orange' && "border-hygiene-orange text-hygiene-orange",
                                  eqUrgency === 'yellow' && "border-hygiene-yellow text-hygiene-yellow",
                                  eqUrgency === 'green' && "border-hygiene-green text-hygiene-green"
                                )}
                              >
                                {eqDays === null ? 'N/A' : eqDays <= 0 ? 'Atrasado' : `${eqDays}d`}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFullPage();
                          }}
                        >
                          Ver Detalhes
                        </Button>
                        {mostUrgent && onRegisterService && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-6 text-[10px] flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRegisterService(mostUrgent, client.nome_cliente);
                            }}
                          >
                            Registrar Limpeza
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export type { HygieneClientWithEquipments, HygieneEquipmentWithServices };
