import localforage from 'localforage';
import type { Equipment, Settings } from '@/types/database';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole, Profile } from '@/types/database';

// Configure localforage
localforage.config({
  name: 'graal-beer-delivery',
  storeName: 'equipment_data',
  description: 'Offline storage for Graal Beer delivery system'
});

// Storage keys
const KEYS = {
  EQUIPMENTS: 'equipments',
  PENDING_EQUIPMENTS: 'pending_equipments',
  SETTINGS: 'settings',
  LAST_SYNC: 'last_sync',
  DRIVER_LOCATION: 'driver_location',
  AUTH_SESSION: 'auth_session',
  AUTH_USER: 'auth_user',
  AUTH_PROFILE: 'auth_profile',
  AUTH_ROLE: 'auth_role'
};

// Equipment storage
export const equipmentStorage = {
  async getAll(): Promise<Equipment[]> {
    const data = await localforage.getItem<Equipment[]>(KEYS.EQUIPMENTS);
    return data || [];
  },

  async save(equipments: Equipment[]): Promise<void> {
    await localforage.setItem(KEYS.EQUIPMENTS, equipments);
  },

  async addPending(equipment: Equipment): Promise<void> {
    const pending = await this.getPending();
    pending.push(equipment);
    await localforage.setItem(KEYS.PENDING_EQUIPMENTS, pending);
  },

  async getPending(): Promise<Equipment[]> {
    const data = await localforage.getItem<Equipment[]>(KEYS.PENDING_EQUIPMENTS);
    return data || [];
  },

  async clearPending(): Promise<void> {
    await localforage.setItem(KEYS.PENDING_EQUIPMENTS, []);
  },

  async removePending(id: string): Promise<void> {
    const pending = await this.getPending();
    const filtered = pending.filter(e => e.id !== id);
    await localforage.setItem(KEYS.PENDING_EQUIPMENTS, filtered);
  },

  async updateLocal(equipment: Equipment): Promise<void> {
    const equipments = await this.getAll();
    const index = equipments.findIndex(e => e.id === equipment.id);
    if (index !== -1) {
      equipments[index] = equipment;
    } else {
      equipments.push(equipment);
    }
    await this.save(equipments);
  }
};

// Settings storage
export const settingsStorage = {
  async get(): Promise<Settings | null> {
    return await localforage.getItem<Settings>(KEYS.SETTINGS);
  },

  async save(settings: Settings): Promise<void> {
    await localforage.setItem(KEYS.SETTINGS, settings);
  }
};

// Sync status
export const syncStorage = {
  async getLastSync(): Promise<string | null> {
    return await localforage.getItem<string>(KEYS.LAST_SYNC);
  },

  async setLastSync(date: string): Promise<void> {
    await localforage.setItem(KEYS.LAST_SYNC, date);
  }
};

// Driver location
export interface DriverLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export const locationStorage = {
  async get(): Promise<DriverLocation | null> {
    return await localforage.getItem<DriverLocation>(KEYS.DRIVER_LOCATION);
  },

  async save(location: DriverLocation): Promise<void> {
    await localforage.setItem(KEYS.DRIVER_LOCATION, location);
  }
};

// Check if online
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Auth session storage for offline access
export interface CachedAuthData {
  user: User;
  session: Session;
  profile: Profile | null;
  role: AppRole | null;
  cachedAt: string;
}

export const authStorage = {
  async save(data: CachedAuthData): Promise<void> {
    await localforage.setItem(KEYS.AUTH_SESSION, data);
  },

  async get(): Promise<CachedAuthData | null> {
    return await localforage.getItem<CachedAuthData>(KEYS.AUTH_SESSION);
  },

  async clear(): Promise<void> {
    await localforage.removeItem(KEYS.AUTH_SESSION);
  },

  async isValid(): Promise<boolean> {
    const data = await this.get();
    if (!data) return false;
    
    // Check if session hasn't expired (allow up to 7 days offline)
    const cachedTime = new Date(data.cachedAt).getTime();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    return (now - cachedTime) < sevenDays;
  }
};

// Clear all data
export const clearAllData = async (): Promise<void> => {
  await localforage.clear();
};
