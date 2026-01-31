import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DeliveryPoint, RouteConfig, DriverSuggestion } from '@/types/routes';
import { extractVolumeLiters } from '@/types/routes';

interface AIOptimizationResult {
  driverSuggestion: DriverSuggestion;
  assignments: {
    driverIndex: number;
    orders: {
      orderNumber: string;
      sequence: number;
      estimatedArrival: string;
      estimatedServiceTime: number;
      volumeLiters: number;
    }[];
    totalVolume: number;
    estimatedEndTime: string;
  }[];
  warnings: string[];
  unassignedOrders: string[];
  processedDeliveries: {
    orderNumber: string;
    volumeLiters: number;
    estimatedServiceTime: number;
    hasValidTimeWindow: boolean;
  }[];
}

export function useAIRouteOptimization() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<DriverSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeDeliveries = useCallback(async (
    deliveries: DeliveryPoint[],
    config: Omit<RouteConfig, 'driverCount' | 'startLocation' | 'startAddress'>
  ): Promise<DriverSuggestion | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Prepare deliveries with volume info
      const preparedDeliveries = deliveries.map(d => ({
        orderNumber: d.orderNumber,
        clientName: d.clientName,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        expectedDelivery: d.expectedDelivery,
        volumeLiters: d.volumeLiters || extractVolumeLiters(d.equipmentDescription || ''),
        equipmentDescription: d.equipmentDescription || '',
      }));

      const { data, error: fnError } = await supabase.functions.invoke('optimize-routes-ai', {
        body: {
          deliveries: preparedDeliveries,
          config: {
            workStartTime: config.workStartTime,
            workEndTime: config.workEndTime,
            period: config.period,
            vehicleCapacityLiters: config.vehicleCapacityLiters || 400,
            baseServiceTimeMinutes: config.serviceTimeMinutes,
          },
          action: 'suggest_drivers',
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao analisar entregas');
      }

      const result = data as AIOptimizationResult;
      setSuggestion(result.driverSuggestion);
      return result.driverSuggestion;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Error analyzing deliveries:', err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const optimizeWithAI = useCallback(async (
    deliveries: DeliveryPoint[],
    config: RouteConfig
  ): Promise<AIOptimizationResult | null> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Prepare deliveries with volume info
      const preparedDeliveries = deliveries.map(d => ({
        orderNumber: d.orderNumber,
        clientName: d.clientName,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        expectedDelivery: d.expectedDelivery,
        volumeLiters: d.volumeLiters || extractVolumeLiters(d.equipmentDescription || ''),
        equipmentDescription: d.equipmentDescription || '',
      }));

      const { data, error: fnError } = await supabase.functions.invoke('optimize-routes-ai', {
        body: {
          deliveries: preparedDeliveries,
          config: {
            driverCount: config.driverCount,
            workStartTime: config.workStartTime,
            workEndTime: config.workEndTime,
            period: config.period,
            vehicleCapacityLiters: config.vehicleCapacityLiters || 400,
            baseServiceTimeMinutes: config.serviceTimeMinutes,
          },
          action: 'optimize_full',
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao otimizar rotas');
      }

      return data as AIOptimizationResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Error optimizing with AI:', err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  return {
    analyzeDeliveries,
    optimizeWithAI,
    isAnalyzing,
    suggestion,
    error,
    clearSuggestion,
  };
}
