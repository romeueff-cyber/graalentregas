// Google Maps API Key - Configured for all users
const GOOGLE_MAPS_API_KEY = 'AIzaSyB2D24kWFQ-4uN8kg6h2bwAWXRAYBsVorc';

export function useGoogleMapsKey() {
  return {
    apiKey: GOOGLE_MAPS_API_KEY,
    hasApiKey: true,
    saveApiKey: () => {}, // No-op - key is fixed
    clearApiKey: () => {}, // No-op - key is fixed
  };
}
