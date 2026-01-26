import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Circle, 
  MapPin,
  CalendarCheck,
  AlertTriangle,
  Package
} from 'lucide-react';

interface MapLegendProps {
  isExpanded?: boolean;
}

export function MapLegend({ isExpanded: initialExpanded = false }: MapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  return (
    <div className="absolute bottom-20 left-3 z-10">
      <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border overflow-hidden max-w-[280px]">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <span className="text-xs font-medium text-foreground">Legenda</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Content - expandable */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t">
            {/* Status dos Equipamentos */}
            <div className="pt-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Status das Entregas
              </p>
              <div className="space-y-1.5">
                <LegendItem 
                  color="bg-destructive" 
                  label="Entregue" 
                  description="Equipamento com o cliente"
                />
                <LegendItem 
                  color="bg-status-ready" 
                  label="Liberado" 
                  description="Pronto para recolha"
                />
                <LegendItem 
                  color="bg-status-collected" 
                  label="Recolhido" 
                  description="Já foi buscado"
                />
                <LegendItem 
                  color="bg-status-waiting" 
                  label="Aguardando" 
                  description="Cliente irá avisar"
                />
              </div>
            </div>

            {/* Marcadores Especiais */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Marcadores Especiais
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Package className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium">Pedido do ERP</span>
                    <p className="text-[9px] text-muted-foreground">Entrega do dia (pulsante)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium">Sua localização</span>
                    <p className="text-[9px] text-muted-foreground">Posição atual do motorista</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicadores do Header */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Indicadores
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-[11px] font-medium">X para hoje</span>
                    <p className="text-[9px] text-muted-foreground">Recolhas agendadas para hoje</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <div>
                    <span className="text-[11px] font-medium">X atrasadas</span>
                    <p className="text-[9px] text-muted-foreground">Passaram da data prevista</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dias com cliente */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Dias com Cliente
              </p>
              <div className="flex flex-wrap gap-1">
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-status-ready/20 text-status-ready">≤3 dias</span>
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-status-waiting/20 text-status-waiting">4-7 dias</span>
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-destructive/20 text-destructive">8-14 dias</span>
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-destructive/30 text-destructive font-medium">&gt;14 dias</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface LegendItemProps {
  color: string;
  label: string;
  description: string;
}

function LegendItem({ color, label, description }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div>
        <span className="text-[11px] font-medium">{label}</span>
        <span className="text-[9px] text-muted-foreground ml-1">- {description}</span>
      </div>
    </div>
  );
}
