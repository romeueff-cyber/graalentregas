export interface DeliveryPoint {
  orderNumber: string;
  clientName: string;
  address: string;
  lat: number;
  lng: number;
  expectedDelivery: string | null; // Time window like "08:00" or null
  estimatedServiceTime: number; // minutes
  priority: number; // Higher = more urgent (based on time window)
  volumeLiters?: number; // Volume in liters
  equipmentDescription?: string; // Description of equipment for volume extraction
}

export interface OptimizedRoute {
  driverId: number;
  driverLabel: string;
  color: string;
  stops: DeliveryStop[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  totalVolume: number; // liters
  startTime: string;
  endTime: string;
}

export interface DeliveryStop {
  order: number; // Stop sequence
  point: DeliveryPoint;
  arrivalTime: string;
  departureTime: string;
  distanceFromPrevious: number; // meters
  durationFromPrevious: number; // seconds
}

export type RoutePeriod = 'manha' | 'tarde_noite';

export interface RouteConfig {
  driverCount: number;
  startLocation: google.maps.LatLngLiteral;
  startAddress: string;
  serviceTimeMinutes: number;
  workStartTime: string; // "08:00"
  workEndTime: string; // "18:00"
  period: RoutePeriod; // Period filter for deliveries
  vehicleCapacityLiters: number; // Max liters per vehicle (default 400)
}

export interface RouteOptimizationResult {
  routes: OptimizedRoute[];
  unassignedOrders: DeliveryPoint[];
  totalDistance: number;
  totalDuration: number;
  totalVolume: number;
  warnings: string[];
}

// AI suggestion for driver count
export interface DriverSuggestion {
  recommendedDriverCount: number;
  reasoning: string;
  driversNeeded: {
    driverIndex: number;
    estimatedStops: number;
    estimatedVolume: number;
    estimatedEndTime: string;
  }[];
}

// Colors for each driver route
export const DRIVER_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export function getDriverColor(index: number): string {
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

// Extract volume from equipment description
export function extractVolumeLiters(description: string): number {
  // Match patterns like "30L", "30 L", "30 litros", "barril 30", etc.
  const matches = description.match(/(\d+)\s*(?:L|litros?)/gi);
  if (!matches) {
    // Try to find just numbers that look like volumes (20, 30, 50)
    const volumeMatch = description.match(/\b(20|30|50)\b/);
    if (volumeMatch) return parseInt(volumeMatch[1]);
    return 30; // Default to 30L
  }
  
  // Sum all volumes found (for multiple barrels)
  let total = 0;
  for (const match of matches) {
    const num = parseInt(match.match(/\d+/)![0]);
    total += num;
  }
  return total || 30;
}

// Check if time is valid (:00 or :30, but not 00:00)
export function isValidTimeWindow(time: string | null): boolean {
  if (!time) return false;
  const [h, m] = time.split(':').map(Number);
  // Only :00 or :30 minutes, and not midnight (00:00)
  if (h === 0 && m === 0) return false;
  return m === 0 || m === 30;
}

// Calculate service time based on volume
export function calculateServiceTime(volumeLiters: number): number {
  if (volumeLiters <= 30) return 30; // 30 minutes for small deliveries
  if (volumeLiters <= 60) return 40; // 40 minutes for medium
  if (volumeLiters <= 100) return 50; // 50 minutes for large
  return 60; // 60 minutes for very large
}
