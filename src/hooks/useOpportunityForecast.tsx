import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClientHealth, type ClientHealthRow } from './useClientHealth';
import { useDailyOrderLocations } from './useDailyOrderLocations';
import { calculateDistanceKm } from '@/lib/geo-utils';

export type OpportunityStatus = 'provavel' | 'atrasado';

export interface OpportunityRow {
  clientId: number | string;
  clientName: string;
  grupoCliente: string;
  daysSinceLast: number;
  avgIntervalDays: number;
  maturity: number; // daysSinceLast / avgIntervalDays
  status: OpportunityStatus;
  lat: number | null;
  lng: number | null;
  nearestDelivery: {
    orderNumber: string;
    clientName: string;
    distanceKm: number;
  } | null;
}

export interface ConfirmedDeliveryPoint {
  orderNumber: string;
  clientName: string;
  lat: number;
  lng: number;
}

const NEAR_RADIUS_KM = 5;
const MIN_ORDERS_FOR_FORECAST = 3;
const MATURITY_MIN = 0.85;
const MATURITY_MAX = 1.5;
const MATURITY_PROVAVEL_MAX = 1.15;

const normalizeName = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

// Palavras genéricas que não devem servir de "match" entre nomes de clientes
const STOP_TOKENS = new Set([
  'RESTAURANTE', 'BAR', 'LANCHONETE', 'LANCHES', 'PIZZARIA', 'PIZZA',
  'CHOPERIA', 'CHOPP', 'CERVEJARIA', 'PUB', 'HOTEL', 'POUSADA',
  'MERCADO', 'MERCEARIA', 'SUPERMERCADO', 'EMPORIO', 'CONVENIENCIA',
  'COMERCIO', 'COMERCIAL', 'INDUSTRIA', 'SERVICOS', 'EVENTOS',
  'LTDA', 'EPP', 'EIRELI', 'CIA', 'DA', 'DE', 'DO', 'DAS', 'DOS',
  'CASA', 'PONTO', 'CANTINHO', 'ESPACO', 'GRUPO', 'CLUBE',
]);

const significantTokens = (s: string): string[] =>
  normalizeName(s)
    .split(' ')
    .filter((t) => t.length >= 4 && !STOP_TOKENS.has(t));

/**
 * Cruza saúde do cliente (frequência) com coordenadas conhecidas das entregas
 * registradas (tabela equipments) e com as entregas confirmadas do dia (ERP)
 * para indicar quais clientes provavelmente devem pedir hoje e se estão
 * próximos de alguma rota já confirmada.
 */
export function useOpportunityForecast(days: number = 180) {
  const { metrics, isLoading: healthLoading } = useClientHealth(days);
  const {
    orders: deliveryOrders,
    locations: deliveryLocations,
    isLoading: deliveryLoading,
    isGoogleReady,
  } = useDailyOrderLocations();

  // Most recent known coordinates per client name (from past deliveries)
  const { data: clientCoords, isLoading: coordsLoading } = useQuery({
    queryKey: ['client-known-coords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipments')
        .select('nome_cliente, latitude, longitude, data_entrega')
        .order('data_entrega', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const map = new Map<string, { lat: number; lng: number }>();
      (data || []).forEach((r) => {
        const key = normalizeName(r.nome_cliente || '');
        if (!key) return;
        if (!map.has(key) && r.latitude && r.longitude) {
          map.set(key, { lat: Number(r.latitude), lng: Number(r.longitude) });
        }
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  const confirmedDeliveries: ConfirmedDeliveryPoint[] = useMemo(
    () =>
      (deliveryLocations || []).map((l) => ({
        orderNumber: l.orderNumber,
        clientName: l.clientName,
        lat: l.lat,
        lng: l.lng,
      })),
    [deliveryLocations]
  );

  // Conjunto de nomes (normalizados) já confirmados hoje — fallback caso o ERP não retorne ID
  const confirmedClientNames = useMemo(() => {
    const set = new Set<string>();
    (deliveryOrders || []).forEach((o) => {
      if (o.client_name) set.add(normalizeName(o.client_name));
    });
    (deliveryLocations || []).forEach((l) => {
      if (l.clientName) set.add(normalizeName(l.clientName));
    });
    return set;
  }, [deliveryOrders, deliveryLocations]);

  // Conjunto de IDs de cliente já confirmados hoje (fonte primária de match)
  const confirmedClientIds = useMemo(() => {
    const set = new Set<string>();
    (deliveryOrders || []).forEach((o) => {
      if (o.client_id !== undefined && o.client_id !== null && o.client_id !== '') {
        set.add(String(o.client_id));
      }
    });
    return set;
  }, [deliveryOrders]);

  // Tokens significativos por cliente confirmado (fallback para diferenças no nome)
  const confirmedTokenSets = useMemo(() => {
    return Array.from(confirmedClientNames).map((n) => new Set(significantTokens(n)));
  }, [confirmedClientNames]);

  const opportunities: OpportunityRow[] = useMemo(() => {
    if (!metrics.rows.length) return [];

    const rows: OpportunityRow[] = [];

    metrics.rows.forEach((r: ClientHealthRow) => {
      if (r.totalOrders < MIN_ORDERS_FOR_FORECAST) return;
      if (r.avgIntervalDays <= 0) return;
      // Ignora grupos cuja descrição contenha "consumidor" (ex.: consumidor final)
      if ((r.grupoCliente || '').toLowerCase().includes('consumidor')) return;
      // Ignora clientes que já têm entrega confirmada hoje.
      // Match primário por ID; fallback por nome quando o ERP não retorna ID.
      const rId = r.clientId !== undefined && r.clientId !== null ? String(r.clientId) : '';
      let alreadyConfirmed = rId !== '' && confirmedClientIds.has(rId);
      if (!alreadyConfirmed) {
        const nName = normalizeName(r.clientName);
        alreadyConfirmed = confirmedClientNames.has(nName);
        if (!alreadyConfirmed) {
          for (const cn of confirmedClientNames) {
            if (!cn || !nName) continue;
            if (cn.includes(nName) || nName.includes(cn)) {
              alreadyConfirmed = true;
              break;
            }
          }
        }
        if (!alreadyConfirmed) {
          const candTokens = significantTokens(r.clientName);
          if (candTokens.length > 0) {
            for (const cset of confirmedTokenSets) {
              if (cset.size === 0) continue;
              let shared = 0;
              for (const t of candTokens) if (cset.has(t)) shared++;
              const need = candTokens.length <= 2 ? 1 : 2;
              if (shared >= need) {
                alreadyConfirmed = true;
                break;
              }
            }
          }
        }
      }
      if (alreadyConfirmed) return;

      const maturity = r.daysSinceLast / r.avgIntervalDays;
      if (maturity < MATURITY_MIN || maturity > MATURITY_MAX) return;

      const status: OpportunityStatus =
        maturity <= MATURITY_PROVAVEL_MAX ? 'provavel' : 'atrasado';

      const coords =
        clientCoords?.get(normalizeName(r.clientName)) ?? null;

      let nearest: OpportunityRow['nearestDelivery'] = null;
      if (coords && confirmedDeliveries.length > 0) {
        for (const d of confirmedDeliveries) {
          const dist = calculateDistanceKm(coords.lat, coords.lng, d.lat, d.lng);
          if (!nearest || dist < nearest.distanceKm) {
            nearest = {
              orderNumber: d.orderNumber,
              clientName: d.clientName,
              distanceKm: dist,
            };
          }
        }
        if (nearest && nearest.distanceKm > NEAR_RADIUS_KM) {
          nearest = null;
        }
      }

      rows.push({
        clientId: r.clientId,
        clientName: r.clientName,
        grupoCliente: r.grupoCliente,
        daysSinceLast: r.daysSinceLast,
        avgIntervalDays: r.avgIntervalDays,
        maturity: Math.round(maturity * 100) / 100,
        status,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        nearestDelivery: nearest,
      });
    });

    // Order: near first, then provavel, then by maturity
    rows.sort((a, b) => {
      if (!!a.nearestDelivery !== !!b.nearestDelivery) {
        return a.nearestDelivery ? -1 : 1;
      }
      if (a.status !== b.status) {
        return a.status === 'provavel' ? -1 : 1;
      }
      return b.maturity - a.maturity;
    });

    return rows;
  }, [metrics.rows, clientCoords, confirmedDeliveries, confirmedClientNames, confirmedTokenSets]);

  const summary = useMemo(() => {
    const provaveis = opportunities.filter((o) => o.status === 'provavel').length;
    const atrasados = opportunities.filter((o) => o.status === 'atrasado').length;
    const proximos = opportunities.filter((o) => o.nearestDelivery).length;
    return {
      total: opportunities.length,
      provaveis,
      atrasados,
      proximos,
      confirmedToday: confirmedDeliveries.length,
    };
  }, [opportunities, confirmedDeliveries.length]);

  return {
    opportunities,
    confirmedDeliveries,
    summary,
    nearRadiusKm: NEAR_RADIUS_KM,
    isLoading: healthLoading || coordsLoading || deliveryLoading,
    isGoogleReady,
    grupos: metrics.grupos,
  };
}
