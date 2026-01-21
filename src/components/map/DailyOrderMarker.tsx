import { useMemo, useEffect, useState } from 'react';
import { Marker } from '@react-google-maps/api';
import { OverlayViewF, OVERLAY_MOUSE_TARGET } from '@react-google-maps/api';

interface DailyOrderMarkerProps {
  position: { lat: number; lng: number };
  orderNumber: string;
  clientName: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function DailyOrderMarker({
  position,
  orderNumber,
  clientName,
  isSelected = false,
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

    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: isSelected ? 14 : 10,
      fillColor: 'hsl(38, 92%, 50%)', // Primary/amber color
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    };
  }, [isSelected, isGoogleReady]);

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
          className="daily-order-label cursor-pointer whitespace-nowrap animate-pulse-glow"
          onClick={onClick}
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          #{orderNumber}
        </div>
      </OverlayViewF>
    </>
  );
}
