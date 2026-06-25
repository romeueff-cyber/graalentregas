import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import { supabase } from '@/integrations/supabase/client';

export interface ERPProduct {
  id: number | string;
  description: string;
}
export interface ERPEquipmentType {
  id: number | string;
  description: string;
}

export interface ERPClientDetails {
  id?: number | string;
  name?: string;
  nickname?: string;
  document?: string;
  [key: string]: unknown;
}

export interface ERPClientAddressParts {
  endereco?: string;
  bairro?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

const catalogStore = localforage.createInstance({
  name: 'graal-beer-delivery',
  storeName: 'erp_catalog',
});

async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const result = await fetcher();
    if (result && (!Array.isArray(result) || result.length > 0)) {
      await catalogStore.setItem(key, result);
    }
    return result;
  } catch (err) {
    const cached = await catalogStore.getItem<T>(key);
    if (cached) return cached;
    throw err;
  }
}

const getERPField = (client: object | null | undefined, ...keys: string[]) => {
  if (!client) return undefined;
  const rootEntries = Object.entries(client);
  const nestedAddress = rootEntries.find(([entryKey, value]) =>
    entryKey.toLowerCase() === 'address' && value && typeof value === 'object' && !Array.isArray(value),
  )?.[1] as object | undefined;
  const entries = nestedAddress
    ? [...rootEntries, ...Object.entries(nestedAddress)]
    : rootEntries;
  for (const key of keys) {
    const found = entries.find(([entryKey, value]) =>
      entryKey.toLowerCase() === key.toLowerCase() && value != null && String(value).trim() !== '',
    );
    if (found) return found[1];
  }
  return undefined;
};

const toText = (value: unknown) => {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

export function getERPClientAddressParts(client: object | null | undefined): ERPClientAddressParts {
  return {
    endereco: toText(getERPField(client, 'address', 'street', 'endereco', 'logradouro', 'rua')),
    bairro: toText(getERPField(client, 'neighborhood', 'district', 'bairro', 'sublocality')),
    numero: toText(getERPField(client, 'number', 'numero', 'street_number')),
    cidade: toText(getERPField(client, 'city', 'cidade', 'municipio')),
    uf: toText(getERPField(client, 'state', 'uf', 'estado')),
    cep: toText(getERPField(client, 'postal_code', 'zip', 'cep')),
    lat: toNumber(getERPField(client, 'latitude', 'lat')),
    lng: toNumber(getERPField(client, 'longitude', 'lng', 'lon')),
  };
}

export async function fetchERPClientDetails(clientId: string): Promise<ERPClientDetails | null> {
  const { data: sess } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-erp-clients?client_id=${encodeURIComponent(clientId)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as { error?: unknown; data?: unknown; clients?: unknown }
    : null;

  if (!response.ok) throw new Error(String(payloadRecord?.error || text || `HTTP ${response.status}`));

  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payloadRecord?.data)
      ? payloadRecord.data
      : Array.isArray(payloadRecord?.clients)
        ? payloadRecord.clients
        : payloadRecord
          ? [payloadRecord]
          : [];

  return (list[0] as ERPClientDetails | undefined) ?? null;
}

export function useERPProducts() {
  return useQuery({
    queryKey: ['erp-products'],
    staleTime: 1000 * 60 * 60,
    retry: 1,
    queryFn: async (): Promise<ERPProduct[]> => {
      return cachedFetch('products', async () => {
        const { data, error } = await supabase.functions.invoke('list-erp-products', {
          body: { limit: 2000 },
        });
        if (error) throw error;
        return (data as ERPProduct[]) || [];
      });
    },
  });
}

export function useERPEquipmentTypes() {
  return useQuery({
    queryKey: ['erp-equipment-types'],
    staleTime: 1000 * 60 * 60,
    retry: 1,
    queryFn: async (): Promise<ERPEquipmentType[]> => {
      return cachedFetch('equipment-types', async () => {
        const { data, error } = await supabase.functions.invoke('list-erp-equipment-types', {});
        if (error) throw error;
        return (data as ERPEquipmentType[]) || [];
      });
    },
  });
}

export interface ERPLastOrderItem { product: string; quantity: number }
export interface ERPLastOrderEquipment { type: string; quantity: number }
export interface ERPLastOrderAddressDetails {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}
export interface ERPLastOrder {
  order_number: string;
  delivery_date: string | null;
  items: ERPLastOrderItem[];
  equipments: ERPLastOrderEquipment[];
  address?: string | null;
  address_details?: ERPLastOrderAddressDetails | null;
}

export function lastOrderToAddressParts(order: ERPLastOrder | null | undefined): ERPClientAddressParts {
  const d = order?.address_details;
  if (!d) return {};
  return {
    endereco: toText(d.street),
    numero: toText(d.number),
    bairro: toText(d.neighborhood),
    cidade: toText(d.city),
    uf: toText(d.state),
  };
}

export async function fetchERPClientLastOrder(clientId: string): Promise<ERPLastOrder | null> {
  const { data, error } = await supabase.functions.invoke('get-erp-client-last-order', {
    body: { clientId },
  });
  if (error) throw error;
  return (data as ERPLastOrder) || null;
}

export interface ERPProductPrice {
  valor: number | null;
  fonte: 'cliente' | 'tabela' | null;
}

export async function fetchERPProductPrice(
  productId: string,
  clientId?: string | null,
): Promise<ERPProductPrice> {
  const { data, error } = await supabase.functions.invoke('get-erp-product-price', {
    body: { productId, clientId: clientId || null },
  });
  if (error) throw error;
  const d = (data || {}) as Partial<ERPProductPrice>;
  return {
    valor: d.valor != null ? Number(d.valor) : null,
    fonte: (d.fonte as ERPProductPrice['fonte']) || null,
  };
}
