import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export interface ERPEquipment {
  type: string;
  description: string | null;
  patrimony: string | null;
  model: string | null;
  quantity: number;
}

type FetchState = {
  equipments: ERPEquipment[];
  isLoading: boolean;
  error: string | null;
  /** True when we had a clientId but the client endpoint returned 0 items (likely proxy/query issue) */
  clientListEmpty: boolean;
};

function dedupeEquipments(items: ERPEquipment[]): ERPEquipment[] {
  const seen = new Set<string>();
  const out: ERPEquipment[] = [];

  for (const eq of items) {
    const key = eq.patrimony
      ? `pat:${eq.patrimony}`
      : `noPat:${eq.type}|${eq.model ?? ""}|${eq.description ?? ""}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(eq);
  }

  return out;
}

export function useClientAllocatedEquipment(params: {
  clientId?: string | number;
  orderNumber?: string;
}) {
  const { clientId, orderNumber } = params;

  const [state, setState] = useState<FetchState>({
    equipments: [],
    isLoading: false,
    error: null,
    clientListEmpty: false,
  });

  const canFetch = useMemo(() => Boolean(clientId || orderNumber), [clientId, orderNumber]);

  const fetchEquipments = useCallback(async () => {
    if (!canFetch) return;

    setState((s) => ({ ...s, isLoading: true, error: null, clientListEmpty: false }));

    try {
      let orderData: any = null;
      let orderEquipments: ERPEquipment[] = [];

      if (orderNumber) {
        const { data, error } = await supabase.functions.invoke("search-erp-order", {
          body: { orderNumber },
        });

        if (error) {
          console.error("[useClientAllocatedEquipment] search-erp-order error:", error);
        } else {
          orderData = data;
          if (data?.equipments?.length > 0) {
            orderEquipments = data.equipments;
          }
        }
      }

      const effectiveClientId = clientId ?? orderData?.client_id;

      let clientEquipments: ERPEquipment[] = [];
      let clientListEmptyOrFailed = false;

      if (effectiveClientId) {
        try {
          const { data, error } = await supabase.functions.invoke("get-client-equipment", {
            body: { clientId: effectiveClientId },
          });

          if (error) {
            console.error("[useClientAllocatedEquipment] get-client-equipment error:", error);
            clientListEmptyOrFailed = true;
          } else {
            clientEquipments = Array.isArray(data?.equipments) ? data.equipments : [];
            clientListEmptyOrFailed = clientEquipments.length === 0;
          }
        } catch (err) {
          console.error("[useClientAllocatedEquipment] get-client-equipment exception:", err);
          clientListEmptyOrFailed = true;
        }
      }

      const merged = dedupeEquipments([...(clientEquipments ?? []), ...(orderEquipments ?? [])]);

      setState({
        equipments: merged,
        isLoading: false,
        error: null,
        clientListEmpty: Boolean(effectiveClientId) && clientListEmptyOrFailed,
      });
    } catch (err) {
      console.error("[useClientAllocatedEquipment] Error:", err);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      }));
    }
  }, [canFetch, clientId, orderNumber]);

  useEffect(() => {
    fetchEquipments();
  }, [fetchEquipments]);

  return {
    ...state,
    refetch: fetchEquipments,
  };
}
