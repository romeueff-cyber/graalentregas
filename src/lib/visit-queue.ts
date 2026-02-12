import localforage from 'localforage';
import { supabase } from '@/integrations/supabase/client';

export type VisitType = 'ENTREGA' | 'DEVOLUCAO';

export interface VisitAttempt {
  id: string;
  userId: string;
  userName: string;
  clientName: string;
  orderNumber?: string;
  visitType: VisitType;
  reason: string;
  notes?: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

const visitQueue = localforage.createInstance({
  name: 'graal-visits',
  storeName: 'visit_queue',
});

const QUEUE_KEY = 'pending_visits';

export async function enqueueVisit(visit: VisitAttempt): Promise<void> {
  const queue = await getPendingVisits();
  queue.push(visit);
  await visitQueue.setItem(QUEUE_KEY, queue);
}

export async function getPendingVisits(): Promise<VisitAttempt[]> {
  return (await visitQueue.getItem<VisitAttempt[]>(QUEUE_KEY)) || [];
}

export async function clearVisitQueue(): Promise<void> {
  await visitQueue.setItem(QUEUE_KEY, []);
}

export async function syncVisits(): Promise<number> {
  if (!navigator.onLine) return 0;

  const queue = await getPendingVisits();
  if (queue.length === 0) return 0;

  const rows = queue.map((v) => ({
    id: v.id,
    user_id: v.userId,
    user_name: v.userName,
    client_name: v.clientName,
    order_number: v.orderNumber || null,
    visit_type: v.visitType,
    reason: v.reason,
    notes: v.notes || null,
    latitude: v.latitude,
    longitude: v.longitude,
    accuracy: v.accuracy,
    captured_at: v.capturedAt,
  }));

  const { error } = await supabase.from('visit_attempts').insert(rows);

  if (error) {
    console.error('[VisitSync] Failed:', error.message);
    return 0;
  }

  await clearVisitQueue();
  console.debug(`[VisitSync] Synced ${queue.length} visits`);
  return queue.length;
}
