import localforage from 'localforage';

export interface GPSPoint {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string; // ISO string
}

const QUEUE_KEY = 'driver_location_queue';

const locationQueue = localforage.createInstance({
  name: 'graal-gps',
  storeName: 'location_queue',
});

export async function enqueueLocation(point: GPSPoint): Promise<void> {
  const queue = await getQueue();
  queue.push(point);
  await locationQueue.setItem(QUEUE_KEY, queue);
}

export async function getQueue(): Promise<GPSPoint[]> {
  return (await locationQueue.getItem<GPSPoint[]>(QUEUE_KEY)) || [];
}

export async function clearQueue(): Promise<void> {
  await locationQueue.setItem(QUEUE_KEY, []);
}

export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Get the latest captured GPS point from the queue (useful for attaching to deliveries)
 */
export async function getLatestGPSPoint(): Promise<GPSPoint | null> {
  const queue = await getQueue();
  if (queue.length === 0) return null;
  return queue[queue.length - 1];
}

/**
 * Capture current GPS position and return it
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
  });
}
