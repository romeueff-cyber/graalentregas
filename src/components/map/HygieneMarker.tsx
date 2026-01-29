import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import { SprayCanIcon } from '@/components/icons';
import type { HygieneMapLocation } from '@/types/hygiene';
import { getUrgencyColor } from '@/types/hygiene';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HygieneMarkerProps {
  location: HygieneMapLocation;
  onClick: () => void;
}

export function HygieneMarker({ location, onClick }: HygieneMarkerProps) {
  const color = getUrgencyColor(location.urgencyLevel);

  const getDaysLabel = () => {
    if (location.daysUntilCleaning === null) return 'Sem data';
    if (location.daysUntilCleaning < 0) return `${Math.abs(location.daysUntilCleaning)}d atrasado`;
    if (location.daysUntilCleaning === 0) return 'Hoje';
    return `${location.daysUntilCleaning}d`;
  };

  return (
    <OverlayViewF
      position={{ lat: location.lat, lng: location.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -width / 2,
        y: -height / 2,
      })}
    >
      <div
        onClick={onClick}
        className="cursor-pointer transition-transform hover:scale-110"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {/* Marker icon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            border: '2px solid white',
          }}
        >
          <SprayCanIcon size={18} className="text-white" />
        </div>

        {/* Label */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '6px',
            padding: '4px 8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            borderLeft: `3px solid ${color}`,
            maxWidth: '140px',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#1f2937',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {location.clientName}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '2px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                color: color,
              }}
            >
              {getDaysLabel()}
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
              • {location.equipmentCount} equip.
            </span>
          </div>
        </div>
      </div>
    </OverlayViewF>
  );
}
