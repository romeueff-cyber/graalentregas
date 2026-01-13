import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import type { EquipmentWithCreator } from '@/types/database';

interface MarkerLabelProps {
  equipment: EquipmentWithCreator;
  onClick: () => void;
}

const statusColors = {
  ENTREGUE: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  LIBERADO_PARA_RECOLHA: { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },
  RECOLHIDO: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
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
  
  const colors = isClienteAvisara 
    ? { bg: '#fef3c7', text: '#d97706', border: '#fbbf24' } // Amber colors
    : (statusColors[equipment.status] || statusColors.RECOLHIDO);

  const hasPhoto = equipment.foto_local_path || equipment.foto_url;

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
            color: '#1f2937',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {equipment.pedido_dia} - {equipment.nome_cliente}
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: '#6b7280',
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
            <span style={{ fontSize: '10px' }}>
              {periodLabels[equipment.periodo_recolha] || equipment.periodo_recolha}
            </span>
          </div>
        </div>
      </div>
    </OverlayViewF>
  );
}
