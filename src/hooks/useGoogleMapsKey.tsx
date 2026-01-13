import { useState } from 'react';

const STORAGE_KEY = 'graal_google_maps_key';

export function useGoogleMapsKey() {
  const [apiKey, setApiKey] = useState<string>(() => {
    // LocalStorage overrides env (even if empty string) so the user can force re-config.
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored;

    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) return envKey;

    return '';
  });

  const saveApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  };

  const clearApiKey = () => {
    // Keep an explicit empty override to avoid falling back to env key.
    localStorage.setItem(STORAGE_KEY, '');
    setApiKey('');
  };

  return {
    apiKey,
    hasApiKey: apiKey.trim().length > 0,
    saveApiKey,
    clearApiKey,
  };
}
