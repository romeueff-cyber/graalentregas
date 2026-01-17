import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import type { EquipmentWithCreator } from '@/types/database';
import { daysSince, formatDaysWithClient, getDaysColor } from '@/lib/date-utils';

interface MarkerLabelProps {
  equipment: EquipmentWithCreator;
  onClick: () => void;
}

const statusColors = {
  ENTREGUE: { bg: 'hsl(0 86% 94%)', text: 'hsl(0 72% 51%)', border: 'hsl(0 72% 70%)' },
  LIBERADO_PARA_RECOLHA: { bg: 'hsl(142 76% 94%)', text: 'hsl(142 71% 35%)', border: 'hsl(142 71% 65%)' },
  RECOLHIDO: { bg: 'hsl(220 14% 96%)', text: 'hsl(220 10% 45%)', border: 'hsl(220 10% 80%)' },
};

const periodLabels: Record<string, string> = {
  DIA_TODO: 'Dia Todo',
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  CLIENTE_IRA_AVISAR: 'Cliente Avisará',
};

export function MarkerLabel({ equipment, onClick }: MarkerLabelProps) {
  // Use amber/orange color for "Cliente irá avisar" status
  const isClienteAvisara = equipment.cliente_ira_avisar || equipment.periodo_recolha === 'CLIENTE_IRA_AVISAR';
  const isCollected = equipment.status === 'RECOLHIDO';
  
  const colors = isClienteAvisara 
    ? { bg: 'hsl(48 96% 89%)', text: 'hsl(38 92% 40%)', border: 'hsl(45 93% 47%)' } // Amber colors
    : (statusColors[equipment.status] || statusColors.RECOLHIDO);

  const hasPhoto = equipment.foto_local_path || equipment.foto_url;
  
  // Calculate days with client (only if not collected)
  const daysWithClient = !isCollected ? daysSince(equipment.data_entrega) : 0;
  const daysColors = getDaysColor(daysWithClient);

  return (
    <OverlayViewF
      position={{ lat: equipment.latitude, lng: equipment.longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: 20,
        y: -height / 2,
      })}
    >
      <div
        onClick={onClick}
        style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: hasPhoto ? '6px' : '8px 12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
          borderLeft: `4px solid ${colors.border}`,
          minWidth: '120px',
          maxWidth: hasPhoto ? '200px' : '180px',
          overflow: 'hidden',
        }}
      >
        {/* Photo thumbnail */}
        {hasPhoto && (
          <div style={{
            width: '100%',
            height: '60px',
            marginBottom: '6px',
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            <img
              src={equipment.foto_url || equipment.foto_local_path || ''}
              alt="Local"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}
        
        <div style={{ padding: hasPhoto ? '0 6px 6px' : 0 }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '13px', 
            color: 'hsl(220 14% 15%)',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {equipment.pedido_dia} - {equipment.nome_cliente}
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: 'hsl(220 10% 45%)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <span style={{
              backgroundColor: colors.bg,
              color: colors.text,
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500
            }}>
              {isClienteAvisara 
                ? 'Aguardando'
                : equipment.status === 'ENTREGUE' 
                  ? 'Entregue' 
                  : equipment.status === 'LIBERADO_PARA_RECOLHA'
                    ? 'Liberado'
                    : 'Recolhido'}
            </span>
            {/* Days counter - only show if not collected */}
            {!isCollected && daysWithClient > 0 && (
              <span style={{
                backgroundColor: daysColors.bg,
                color: daysColors.text,
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600
              }}>
                {formatDaysWithClient(daysWithClient)}
              </span>
            )}
            <span style={{ fontSize: '10px' }}>
              {periodLabels[equipment.periodo_recolha] || equipment.periodo_recolha}
            </span>
          </div>
        </div>
      </div>
    </OverlayViewF>
  );
}
