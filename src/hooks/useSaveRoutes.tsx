import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OptimizedRoute, RoutePeriod } from '@/types/routes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useSaveRoutes() {
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();

  const saveRoutes = useCallback(async (
    routes: OptimizedRoute[],
    date: string,
    period: RoutePeriod
  ): Promise<boolean> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return false;
    }

    setIsSaving(true);

    try {
      // Delete existing routes for this date/period first
      const { error: deleteError } = await supabase
        .from('optimized_routes')
        .delete()
        .eq('route_date', date)
        .eq('period', period);

      if (deleteError) {
        console.error('Error deleting existing routes:', deleteError);
        // Continue anyway - might be no existing routes
      }

      // Save each route with its stops
      for (const route of routes) {
        // Insert route
        const { data: routeData, error: routeError } = await supabase
          .from('optimized_routes')
          .insert({
            created_by_user_id: user.id,
            route_date: date,
            period,
            driver_index: route.driverId,
            driver_label: route.driverLabel,
            color: route.color,
            total_distance: route.totalDistance,
            total_duration: route.totalDuration,
            total_volume_liters: route.totalVolume || 0,
            start_time: route.startTime,
            end_time: route.endTime,
            status: 'pending',
          })
          .select('id')
          .single();

        if (routeError) {
          console.error('Error saving route:', routeError);
          throw new Error(`Erro ao salvar rota: ${routeError.message}`);
        }

        // Insert stops for this route
        if (route.stops.length > 0) {
          const stopsToInsert = route.stops.map(stop => ({
            route_id: routeData.id,
            stop_order: stop.order,
            order_number: stop.point.orderNumber,
            client_name: stop.point.clientName,
            address: stop.point.address,
            latitude: stop.point.lat,
            longitude: stop.point.lng,
            expected_delivery: stop.point.expectedDelivery,
            volume_liters: stop.point.volumeLiters || 0,
            estimated_service_time: stop.point.estimatedServiceTime,
            arrival_time: stop.arrivalTime,
            departure_time: stop.departureTime,
            distance_from_previous: stop.distanceFromPrevious,
            duration_from_previous: stop.durationFromPrevious,
            status: 'pending',
          }));

          const { error: stopsError } = await supabase
            .from('route_stops')
            .insert(stopsToInsert);

          if (stopsError) {
            console.error('Error saving stops:', stopsError);
            throw new Error(`Erro ao salvar paradas: ${stopsError.message}`);
          }
        }
      }

      toast.success(`${routes.length} rotas salvas com sucesso!`);
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar rotas';
      toast.error(errorMessage);
      console.error('Error saving routes:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const loadRoutes = useCallback(async (
    date: string,
    period: RoutePeriod
  ): Promise<OptimizedRoute[] | null> => {
    try {
      const { data: routes, error: routesError } = await supabase
        .from('optimized_routes')
        .select(`
          *,
          route_stops (*)
        `)
        .eq('route_date', date)
        .eq('period', period)
        .order('driver_index');

      if (routesError) {
        console.error('Error loading routes:', routesError);
        return null;
      }

      if (!routes || routes.length === 0) {
        return null;
      }

      // Convert to OptimizedRoute format
      return routes.map(r => ({
        driverId: r.driver_index,
        driverLabel: r.driver_label,
        color: r.color,
        totalDistance: r.total_distance,
        totalDuration: r.total_duration,
        totalVolume: r.total_volume_liters,
        startTime: r.start_time,
        endTime: r.end_time,
        stops: (r.route_stops || [])
          .sort((a: any, b: any) => a.stop_order - b.stop_order)
          .map((s: any) => ({
            order: s.stop_order,
            point: {
              orderNumber: s.order_number,
              clientName: s.client_name,
              address: s.address,
              lat: s.latitude,
              lng: s.longitude,
              expectedDelivery: s.expected_delivery,
              volumeLiters: s.volume_liters,
              estimatedServiceTime: s.estimated_service_time,
              priority: 0,
            },
            arrivalTime: s.arrival_time,
            departureTime: s.departure_time,
            distanceFromPrevious: s.distance_from_previous,
            durationFromPrevious: s.duration_from_previous,
          })),
      }));

    } catch (err) {
      console.error('Error loading routes:', err);
      return null;
    }
  }, []);

  return {
    saveRoutes,
    loadRoutes,
    isSaving,
  };
}
