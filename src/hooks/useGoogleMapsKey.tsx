import { useState, useEffect } from 'react';

const STORAGE_KEY = 'graal_google_maps_key';

export function useGoogleMapsKey() {
  const [apiKey, setApiKey] = useState<string>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    
    // Check env variable
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) return envKey;
    
    return '';
  });

  const saveApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  };

  const clearApiKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
  };

  return {
    apiKey,
    hasApiKey: !!apiKey,
    saveApiKey,
    clearApiKey
  };
}
