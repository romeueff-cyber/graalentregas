export interface DeliveryPoint {
  orderNumber: string;
  clientName: string;
  address: string;
  lat: number;
  lng: number;
  expectedDelivery: string | null; // Time window like "08:00" or null
  estimatedServiceTime: number; // minutes
  priority: number; // Higher = more urgent (based on time window)
}

export interface OptimizedRoute {
  driverId: number;
  driverLabel: string;
  color: string;
  stops: DeliveryStop[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
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

export interface RouteConfig {
  driverCount: number;
  startLocation: google.maps.LatLngLiteral;
  startAddress: string;
  serviceTimeMinutes: number;
  workStartTime: string; // "08:00"
  workEndTime: string; // "18:00"
}

export interface RouteOptimizationResult {
  routes: OptimizedRoute[];
  unassignedOrders: DeliveryPoint[];
  totalDistance: number;
  totalDuration: number;
  warnings: string[];
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
