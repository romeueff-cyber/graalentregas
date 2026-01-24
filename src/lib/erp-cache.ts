import localforage from 'localforage';
import type { DailyOrderData } from '@/hooks/useDailyOrders';
import { getTodaySaoPaulo } from '@/lib/date-utils';

// Configure a separate store for ERP data
const erpStore = localforage.createInstance({
  name: 'graal-beer-delivery',
  storeName: 'erp_cache',
  description: 'Offline cache for ERP order data'
});

// Storage keys
const KEYS = {
  ORDERS_PREFIX: 'orders_',
  LAST_SYNC: 'erp_last_sync',
  CACHED_DATE: 'erp_cached_date'
};

export interface ERPCacheStatus {
  lastSync: Date | null;
  cachedDate: string | null;
  isStale: boolean;
  hasCache: boolean;
}

// Orders cache
export const erpOrdersCache = {
  /**
   * Get cached orders for a specific date
   */
  async get(date: string): Promise<DailyOrderData[] | null> {
    const key = `${KEYS.ORDERS_PREFIX}${date}`;
    return await erpStore.getItem<DailyOrderData[]>(key);
  },

  /**
   * Save orders to cache for a specific date
   */
  async save(date: string, orders: DailyOrderData[]): Promise<void> {
    const key = `${KEYS.ORDERS_PREFIX}${date}`;
    await erpStore.setItem(key, orders);
    await this.setLastSync(date);
  },

  /**
   * Get the last sync timestamp for a specific date
   */
  async getLastSync(date?: string): Promise<Date | null> {
    const key = date ? `${KEYS.LAST_SYNC}_${date}` : KEYS.LAST_SYNC;
    const timestamp = await erpStore.getItem<string>(key);
    return timestamp ? new Date(timestamp) : null;
  },

  /**
   * Set the last sync timestamp for a specific date
   */
  async setLastSync(date: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await erpStore.setItem(`${KEYS.LAST_SYNC}_${date}`, timestamp);
    await erpStore.setItem(KEYS.LAST_SYNC, timestamp);
    await erpStore.setItem(KEYS.CACHED_DATE, date);
  },

  /**
   * Get the cached date
   */
  async getCachedDate(): Promise<string | null> {
    return await erpStore.getItem<string>(KEYS.CACHED_DATE);
  },

  /**
   * Get cache status for a specific date including staleness check
   */
  async getStatus(date?: string): Promise<ERPCacheStatus> {
    const targetDate = date || getTodaySaoPaulo();
    const lastSync = await this.getLastSync(targetDate);
    const cachedOrders = await this.get(targetDate);
    
    // Cache is stale if:
    // 1. No cache exists for this date
    // 2. Last sync was more than 4 hours ago
    const isStale = !lastSync || 
      !cachedOrders ||
      (new Date().getTime() - lastSync.getTime()) > 4 * 60 * 60 * 1000;
    
    const hasCache = !!cachedOrders && cachedOrders.length > 0;

    return {
      lastSync,
      cachedDate: targetDate,
      isStale,
      hasCache
    };
  },

  /**
   * Clean up old cache entries (keep only today)
   */
  async cleanup(): Promise<void> {
    const today = getTodaySaoPaulo();
    const keys = await erpStore.keys();
    
    for (const key of keys) {
      if (key.startsWith(KEYS.ORDERS_PREFIX)) {
        const cacheDate = key.replace(KEYS.ORDERS_PREFIX, '');
        if (cacheDate < today) {
          await erpStore.removeItem(key);
        }
      }
    }
  },

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await erpStore.clear();
  }
};

/**
 * Format last sync time for display
 */
export function formatLastSync(date: Date | null): string {
  if (!date) return 'Nunca sincronizado';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins} min atrás`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  
  // Format as date/time
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
