/**
 * Calculate the number of days since a given date
 */
export function daysSince(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  
  const date = new Date(dateString);
  const now = new Date();
  
  // Reset time to compare just dates
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Format days into a human-readable string
 */
export function formatDaysWithClient(days: number): string {
  if (days === 0) return 'Hoje';
  if (days === 1) return '1 dia';
  return `${days} dias`;
}

/**
 * Get color based on days with client - returns HSL color values
 */
export function getDaysColor(days: number): { bg: string; text: string } {
  if (days <= 3) return { bg: 'hsl(142 76% 94%)', text: 'hsl(142 71% 35%)' }; // Green
  if (days <= 7) return { bg: 'hsl(48 96% 94%)', text: 'hsl(38 92% 40%)' }; // Amber
  if (days <= 14) return { bg: 'hsl(27 96% 91%)', text: 'hsl(21 90% 48%)' }; // Orange
  return { bg: 'hsl(0 86% 94%)', text: 'hsl(0 72% 51%)' }; // Red - urgent
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : dateString);
  const today = new Date();
  
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
}

/**
 * Format date avoiding timezone issues
 */
export function formatDate(dateString: string): string {
  if (dateString.length === 10) {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR');
  }
  return new Date(dateString).toLocaleDateString('pt-BR');
}
