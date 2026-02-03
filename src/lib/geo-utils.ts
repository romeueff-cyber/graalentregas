/**
 * Calculate the distance between two geographic coordinates using the Haversine formula.
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is within a given radius from a center point.
 */
export function isWithinRadius(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number
): boolean {
  const distance = calculateDistanceKm(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusKm;
}

/**
 * Filter an array of items with coordinates by radius from a center point.
 */
export function filterByRadius<T extends { latitude: number; longitude: number }>(
  items: T[],
  centerLat: number,
  centerLon: number,
  radiusKm: number
): T[] {
  return items.filter(item => 
    isWithinRadius(item.latitude, item.longitude, centerLat, centerLon, radiusKm)
  );
}
