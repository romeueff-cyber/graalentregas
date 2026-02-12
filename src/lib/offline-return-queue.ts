import localforage from 'localforage';

export interface PendingReturn {
  id: string;
  patrimony: string;
  clientName: string;
  clientId?: string;
  orderNumber?: string;
  userId: string;
  userName: string;
  timestamp: string;
  type: 'standalone' | 'delivery' | 'collection';
}

const PENDING_RETURNS_KEY = 'pending_equipment_returns';

export const offlineReturnQueue = {
  async getAll(): Promise<PendingReturn[]> {
    const data = await localforage.getItem<PendingReturn[]>(PENDING_RETURNS_KEY);
    return data || [];
  },

  async add(item: PendingReturn): Promise<void> {
    const pending = await this.getAll();
    pending.push(item);
    await localforage.setItem(PENDING_RETURNS_KEY, pending);
  },

  async remove(id: string): Promise<void> {
    const pending = await this.getAll();
    const filtered = pending.filter(p => p.id !== id);
    await localforage.setItem(PENDING_RETURNS_KEY, filtered);
  },

  async clear(): Promise<void> {
    await localforage.setItem(PENDING_RETURNS_KEY, []);
  },

  async count(): Promise<number> {
    const data = await this.getAll();
    return data.length;
  }
};
