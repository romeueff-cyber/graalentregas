import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy,
  ExternalLink,
  CheckCircle2,
  RefreshCcw,
  AlertCircle,
  Clock,
  Ban,
  FileCheck,
} from 'lucide-react';

interface FinanceiroLegendProps {
  isExpanded?: boolean;
}

export function FinanceiroLegend({ isExpanded: initialExpanded = false }: FinanceiroLegendProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  return (
    <div className="fixed bottom-20 left-3 z-10">
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
            {/* Status dos Boletos */}
            <div className="pt-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Status dos Boletos
              </p>
              <div className="space-y-1.5">
                <LegendItem 
                  color="bg-status-waiting" 
                  label="Pendente" 
                  description="Aguardando pagamento"
                />
                <LegendItem 
                  color="bg-primary" 
                  label="Registrado" 
                  description="Registrado no banco"
                />
                <LegendItem 
                  color="bg-status-ready" 
                  label="Pago" 
                  description="Pagamento confirmado"
                />
                <LegendItem 
                  color="bg-destructive" 
                  label="Vencido" 
                  description="Passou da data de vencimento"
                />
                <LegendItem 
                  color="bg-muted" 
                  label="Cancelado" 
                  description="Boleto foi cancelado"
                />
              </div>
            </div>

            {/* Ações */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Botões de Ação
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-status-waiting/20 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-status-waiting" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium">Conciliar</span>
                    <p className="text-[9px] text-muted-foreground">Marca como baixado no ERP</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium">Copiar Código</span>
                    <p className="text-[9px] text-muted-foreground">Copia a linha digitável</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium">Abrir PDF</span>
                    <p className="text-[9px] text-muted-foreground">Visualiza o boleto</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicadores */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Indicadores
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-status-waiting/20 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 text-status-waiting" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium">A Conciliar</span>
                    <p className="text-[9px] text-muted-foreground">Pago mas não baixado no ERP</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-ready" />
                  <div>
                    <span className="text-[11px] font-medium">Conciliado</span>
                    <p className="text-[9px] text-muted-foreground">Baixa confirmada no ERP</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-status-waiting rounded-full animate-pulse" />
                  <div>
                    <span className="text-[11px] font-medium">Indicador Pulsante</span>
                    <p className="text-[9px] text-muted-foreground">Ação pendente necessária</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sincronização */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Sincronização
              </p>
              <div className="flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-primary" />
                <div>
                  <span className="text-[11px] font-medium">Sincronizar</span>
                  <p className="text-[9px] text-muted-foreground">Atualiza status com a Cora</p>
                </div>
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
