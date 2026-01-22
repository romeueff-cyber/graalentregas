import { useMemo, useEffect, useState } from 'react';
import { Marker } from '@react-google-maps/api';
import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';

interface DailyOrderMarkerProps {
  position: { lat: number; lng: number };
  orderNumber: string;
  clientName: string;
  expectedDelivery?: string | null;
  isSelected?: boolean;
  isDelivered?: boolean;
  onClick?: () => void;
}

export function DailyOrderMarker({
  position,
  orderNumber,
  clientName,
  expectedDelivery,
  isSelected = false,
  isDelivered = false,
  onClick,
}: DailyOrderMarkerProps) {
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  useEffect(() => {
    // Check if Google Maps is ready
    if (typeof google !== 'undefined' && google.maps) {
      setIsGoogleReady(true);
    }
  }, []);

  const markerIcon = useMemo((): google.maps.Symbol | undefined => {
    if (!isGoogleReady) return undefined;

    // Green for delivered, amber/primary for pending
    const fillColor = isDelivered ? 'hsl(142, 71%, 45%)' : 'hsl(38, 92%, 50%)';

    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: isSelected ? 14 : 10,
      fillColor,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    };
  }, [isSelected, isGoogleReady, isDelivered]);

  if (!isGoogleReady) return null;

  return (
    <>
      <Marker
        position={position}
        icon={markerIcon}
        onClick={onClick}
        title={`#${orderNumber} - ${clientName}`}
        zIndex={isSelected ? 999 : 500}
      />

      {/* Pulsing Label overlay */}
      <OverlayViewF
        position={position}
        mapPaneName={OVERLAY_MOUSE_TARGET}
        getPixelPositionOffset={(width, height) => ({
          x: 15,
          y: -height / 2,
        })}
      >
        <div
          className={`daily-order-label cursor-pointer whitespace-nowrap ${isDelivered ? '' : 'animate-pulse-glow'}`}
          onClick={onClick}
          style={{
            background: isDelivered ? 'hsl(142, 71%, 45%)' : 'hsl(var(--primary))',
            color: isDelivered ? '#ffffff' : 'hsl(var(--primary-foreground))',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>#{orderNumber}</span>
          {expectedDelivery && (
            <span style={{ opacity: 0.85, fontSize: '10px' }}>{expectedDelivery}</span>
          )}
          {isDelivered && <span>✓</span>}
        </div>
      </OverlayViewF>
    </>
  );
}
