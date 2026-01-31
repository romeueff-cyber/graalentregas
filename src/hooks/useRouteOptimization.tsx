import { useState, useCallback } from 'react';
import type { 
  DeliveryPoint, 
  RouteConfig, 
  OptimizedRoute, 
  DeliveryStop,
  RouteOptimizationResult 
} from '@/types/routes';
import { getDriverColor } from '@/types/routes';

// Parse time string "HH:MM" to minutes from midnight
function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Format minutes from midnight to "HH:MM"
function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Calculate priority based on time window
function calculatePriority(expectedDelivery: string | null): number {
  if (!expectedDelivery) return 0; // No time = lowest priority
  
  const timeMinutes = parseTime(expectedDelivery);
  // Earlier times get higher priority (inverted)
  return 1440 - timeMinutes; // 1440 = minutes in a day
}

interface DirectionsResult {
  distance: number; // meters
  duration: number; // seconds
  route: google.maps.DirectionsRoute;
}

export function useRouteOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<RouteOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get directions between two points using Google Maps
  const getDirections = useCallback(async (
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
    waypoints?: google.maps.DirectionsWaypoint[]
  ): Promise<DirectionsResult | null> => {
    if (!window.google?.maps?.DirectionsService) {
      console.error('Google Maps Directions Service not available');
      return null;
    }

    const directionsService = new google.maps.DirectionsService();

    try {
      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true, // Let Google optimize the order
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes.length === 0) return null;

      const route = result.routes[0];
      const legs = route.legs;
      
      const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
      const totalDuration = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);

      return {
        distance: totalDistance,
        duration: totalDuration,
        route,
      };
    } catch (err) {
      console.error('Directions error:', err);
      return null;
    }
  }, []);

  // Time-window priority algorithm
  // Assigns deliveries to drivers based on time constraints
  const assignDeliveriesToDrivers = useCallback((
    points: DeliveryPoint[],
    config: RouteConfig
  ): Map<number, DeliveryPoint[]> => {
    const assignments = new Map<number, DeliveryPoint[]>();
    
    // Initialize empty arrays for each driver
    for (let i = 0; i < config.driverCount; i++) {
      assignments.set(i, []);
    }

    // Separate orders with and without time windows
    const withTimeWindow = points
      .filter(p => p.expectedDelivery)
      .sort((a, b) => parseTime(a.expectedDelivery!) - parseTime(b.expectedDelivery!));
    
    const withoutTimeWindow = points.filter(p => !p.expectedDelivery);

    // First pass: assign time-constrained orders
    // Try to balance while respecting time windows
    const driverTimes: number[] = Array(config.driverCount).fill(parseTime(config.workStartTime));
    
    for (const point of withTimeWindow) {
      const targetTime = parseTime(point.expectedDelivery!);
      
      // Find driver who can arrive closest to the target time
      let bestDriver = 0;
      let bestScore = Infinity;
      
      for (let d = 0; d < config.driverCount; d++) {
        const driverOrders = assignments.get(d)!;
        const estimatedArrival = driverTimes[d] + (driverOrders.length * config.serviceTimeMinutes);
        
        // Score based on how close we can get to target time
        // Penalize being late more than being early
        const diff = targetTime - estimatedArrival;
        const score = diff < 0 ? Math.abs(diff) * 2 : diff; // Late = 2x penalty
        
        if (score < bestScore) {
          bestScore = score;
          bestDriver = d;
        }
      }
      
      assignments.get(bestDriver)!.push(point);
      driverTimes[bestDriver] += config.serviceTimeMinutes;
    }

    // Second pass: distribute remaining orders for load balance
    for (const point of withoutTimeWindow) {
      // Assign to driver with fewest orders
      let minDriver = 0;
      let minCount = Infinity;
      
      for (let d = 0; d < config.driverCount; d++) {
        const count = assignments.get(d)!.length;
        if (count < minCount) {
          minCount = count;
          minDriver = d;
        }
      }
      
      assignments.get(minDriver)!.push(point);
    }

    return assignments;
  }, []);

  // Optimize a single driver's route
  const optimizeDriverRoute = useCallback(async (
    driverId: number,
    points: DeliveryPoint[],
    config: RouteConfig
  ): Promise<OptimizedRoute | null> => {
    if (points.length === 0) {
      return {
        driverId,
        driverLabel: `Entregador ${driverId + 1}`,
        color: getDriverColor(driverId),
        stops: [],
        totalDistance: 0,
        totalDuration: 0,
        startTime: config.workStartTime,
        endTime: config.workStartTime,
      };
    }

    // Single point - no optimization needed
    if (points.length === 1) {
      const directions = await getDirections(config.startLocation, { lat: points[0].lat, lng: points[0].lng });
      
      if (!directions) return null;

      const arrivalMinutes = parseTime(config.workStartTime) + Math.ceil(directions.duration / 60);
      const departureMinutes = arrivalMinutes + config.serviceTimeMinutes;

      const stop: DeliveryStop = {
        order: 1,
        point: points[0],
        arrivalTime: formatTime(arrivalMinutes),
        departureTime: formatTime(departureMinutes),
        distanceFromPrevious: directions.distance,
        durationFromPrevious: directions.duration,
      };

      return {
        driverId,
        driverLabel: `Entregador ${driverId + 1}`,
        color: getDriverColor(driverId),
        stops: [stop],
        totalDistance: directions.distance,
        totalDuration: directions.duration + (config.serviceTimeMinutes * 60),
        startTime: config.workStartTime,
        endTime: formatTime(departureMinutes),
      };
    }

    // Multiple points - use Google's waypoint optimization
    const waypoints: google.maps.DirectionsWaypoint[] = points.slice(0, -1).map(p => ({
      location: { lat: p.lat, lng: p.lng },
      stopover: true,
    }));

    const lastPoint = points[points.length - 1];
    
    const directions = await getDirections(
      config.startLocation,
      { lat: lastPoint.lat, lng: lastPoint.lng },
      waypoints
    );

    if (!directions) return null;

    // Build stops based on optimized order
    const optimizedOrder = directions.route.waypoint_order || [];
    const legs = directions.route.legs;
    
    const stops: DeliveryStop[] = [];
    let currentTimeMinutes = parseTime(config.workStartTime);

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const legDurationMinutes = Math.ceil((leg.duration?.value || 0) / 60);
      
      currentTimeMinutes += legDurationMinutes;
      const arrivalTime = formatTime(currentTimeMinutes);
      
      currentTimeMinutes += config.serviceTimeMinutes;
      const departureTime = formatTime(currentTimeMinutes);

      // Map back to original point
      let pointIndex: number;
      if (i < optimizedOrder.length) {
        pointIndex = optimizedOrder[i];
      } else {
        pointIndex = points.length - 1; // Last point (destination)
      }

      stops.push({
        order: i + 1,
        point: i === legs.length - 1 ? lastPoint : points[pointIndex],
        arrivalTime,
        departureTime,
        distanceFromPrevious: leg.distance?.value || 0,
        durationFromPrevious: leg.duration?.value || 0,
      });
    }

    return {
      driverId,
      driverLabel: `Entregador ${driverId + 1}`,
      color: getDriverColor(driverId),
      stops,
      totalDistance: directions.distance,
      totalDuration: directions.duration + (stops.length * config.serviceTimeMinutes * 60),
      startTime: config.workStartTime,
      endTime: formatTime(currentTimeMinutes),
    };
  }, [getDirections]);

  // Main optimization function
  const optimizeRoutes = useCallback(async (
    points: DeliveryPoint[],
    config: RouteConfig
  ): Promise<RouteOptimizationResult> => {
    setIsOptimizing(true);
    setProgress(0);
    setError(null);

    try {
      if (points.length === 0) {
        const emptyResult: RouteOptimizationResult = {
          routes: [],
          unassignedOrders: [],
          totalDistance: 0,
          totalDuration: 0,
          warnings: ['Nenhum pedido para roteirizar'],
        };
        setResult(emptyResult);
        return emptyResult;
      }

      // Step 1: Assign deliveries to drivers
      setProgress(10);
      const assignments = assignDeliveriesToDrivers(points, config);
      
      // Step 2: Optimize each driver's route
      const routes: OptimizedRoute[] = [];
      const unassigned: DeliveryPoint[] = [];
      const warnings: string[] = [];
      
      let completed = 0;
      const total = config.driverCount;

      for (let driverId = 0; driverId < config.driverCount; driverId++) {
        const driverPoints = assignments.get(driverId) || [];
        
        if (driverPoints.length > 0) {
          // Google Directions API has a limit of 25 waypoints
          if (driverPoints.length > 23) {
            warnings.push(`Entregador ${driverId + 1} tem ${driverPoints.length} paradas. Máximo recomendado: 23.`);
            // Split excess into unassigned
            const excess = driverPoints.splice(23);
            unassigned.push(...excess);
          }

          const route = await optimizeDriverRoute(driverId, driverPoints, config);
          
          if (route) {
            routes.push(route);
            
            // Check for late arrivals
            for (const stop of route.stops) {
              if (stop.point.expectedDelivery) {
                const expected = parseTime(stop.point.expectedDelivery);
                const arrival = parseTime(stop.arrivalTime);
                if (arrival > expected + 30) { // 30 min tolerance
                  warnings.push(`Pedido ${stop.point.orderNumber}: previsão ${stop.arrivalTime}, cliente espera até ${stop.point.expectedDelivery}`);
                }
              }
            }
          } else {
            unassigned.push(...driverPoints);
            warnings.push(`Não foi possível calcular rota para Entregador ${driverId + 1}`);
          }
        }

        completed++;
        setProgress(10 + (completed / total) * 80);
      }

      setProgress(100);

      const finalResult: RouteOptimizationResult = {
        routes,
        unassignedOrders: unassigned,
        totalDistance: routes.reduce((sum, r) => sum + r.totalDistance, 0),
        totalDuration: routes.reduce((sum, r) => sum + r.totalDuration, 0),
        warnings,
      };

      setResult(finalResult);
      return finalResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao otimizar rotas';
      setError(errorMessage);
      throw err;
    } finally {
      setIsOptimizing(false);
    }
  }, [assignDeliveriesToDrivers, optimizeDriverRoute]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    optimizeRoutes,
    isOptimizing,
    progress,
    result,
    error,
    clearResult,
  };
}
