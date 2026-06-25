// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - injected by Vite define
const APP_BUILD_ID: string = __APP_BUILD_ID__;

export const APP_UPDATE_AVAILABLE_EVENT = 'graal:pwa-update-available';
export const APP_UPDATE_REFRESH_START_EVENT = 'graal:pwa-refresh-start';

const APP_REFRESH_SESSION_KEY = 'graal-pwa-refreshing';
const APP_SW_FILENAMES = ['/sw.js', '/service-worker.js'];

export function getAppVersion() {
  return APP_BUILD_ID;
}

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith('id-preview--') ||
    hostname.startsWith('preview--') ||
    hostname === 'lovableproject.com' ||
    hostname.endsWith('.lovableproject.com') ||
    hostname === 'lovableproject-dev.com' ||
    hostname.endsWith('.lovableproject-dev.com') ||
    hostname === 'beta.lovable.dev' ||
    hostname.endsWith('.beta.lovable.dev')
  );
}

export function canUseAppServiceWorker() {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  if (isPreviewHost(window.location.hostname)) return false;
  if (new URLSearchParams(window.location.search).get('sw') === 'off') return false;
  return true;
}

function workerScriptUrl(registration: ServiceWorkerRegistration) {
  return (
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    registration.active?.scriptURL ||
    ''
  );
}

function isAppServiceWorker(registration: ServiceWorkerRegistration) {
  const scriptUrl = workerScriptUrl(registration);
  return APP_SW_FILENAMES.some((filename) => scriptUrl.endsWith(filename));
}

function shouldDeleteAppShellCache(cacheName: string) {
  const normalized = cacheName.toLowerCase();
  return (
    normalized.includes('precache') ||
    normalized.includes('workbox') ||
    normalized.includes('vite-pwa')
  );
}

export function isAppRefreshInProgress() {
  return window.sessionStorage.getItem(APP_REFRESH_SESSION_KEY) === '1';
}

export function markAppRefreshComplete() {
  window.sessionStorage.removeItem(APP_REFRESH_SESSION_KEY);
}

async function clearAppShellCaches() {
  if (!('caches' in window)) return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(shouldDeleteAppShellCache)
      .map((cacheName) => caches.delete(cacheName)),
  );
}

export async function unregisterAppServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(isAppServiceWorker)
      .map((registration) => registration.unregister()),
  );
}

export async function refreshAppToLatestVersion() {
  window.sessionStorage.setItem(APP_REFRESH_SESSION_KEY, '1');
  window.dispatchEvent(new CustomEvent(APP_UPDATE_REFRESH_START_EVENT));

  await unregisterAppServiceWorkers();
  await clearAppShellCaches();

  window.location.reload();
}

export async function checkForAppUpdate() {
  if (!canUseAppServiceWorker()) return false;

  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return false;
  if (registration.waiting) return true;

  const updateFound = new Promise<boolean>((resolve) => {
    let resolved = false;
    const finish = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      registration.removeEventListener('updatefound', onUpdateFound);
      resolve(value);
    };

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' || worker.state === 'activated') {
          finish(Boolean(navigator.serviceWorker.controller));
        }
        if (worker.state === 'redundant') finish(false);
      });
    };

    const onUpdateFound = () => watchWorker(registration.installing);
    registration.addEventListener('updatefound', onUpdateFound);
    watchWorker(registration.installing);
    window.setTimeout(() => finish(Boolean(registration.waiting)), 8000);
  });

  await registration.update();
  return updateFound;
}

export function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  if (!canUseAppServiceWorker()) {
    void unregisterAppServiceWorkers();
    return;
  }

  const notifyUpdateAvailable = () => {
    if (!isAppRefreshInProgress()) {
      window.dispatchEvent(new CustomEvent(APP_UPDATE_AVAILABLE_EVENT));
    }
  };

  const watchRegistration = (registration: ServiceWorkerRegistration) => {
    if (registration.waiting) notifyUpdateAvailable();

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdateAvailable();
        }
      });
    });
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        watchRegistration(registration);
        return registration.update();
      })
      .catch((error) => {
        console.log('[PWA] Service worker registration failed:', error);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', notifyUpdateAvailable);
}