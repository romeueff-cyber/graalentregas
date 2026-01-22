/**
 * São Paulo timezone (UTC-3)
 */
export const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

/**
 * Get current date in São Paulo timezone as YYYY-MM-DD
 */
export function getTodaySaoPaulo(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: SAO_PAULO_TIMEZONE });
}

/**
 * Get current datetime in São Paulo timezone
 */
export function getNowSaoPaulo(): Date {
  const now = new Date();
  const saoPauloString = now.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE });
  return new Date(saoPauloString);
}

/**
 * Format a date to São Paulo timezone YYYY-MM-DD
 */
export function toSaoPauloDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: SAO_PAULO_TIMEZONE });
}

/**
 * Calculate the number of days since a given date (using São Paulo timezone)
 */
export function daysSince(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  
  const date = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : dateString);
  const now = getNowSaoPaulo();
  
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
 * Check if a date is today (using São Paulo timezone)
 */
export function isToday(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : dateString);
  const today = getNowSaoPaulo();
  
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is in the past (using São Paulo timezone)
 */
export function isPastDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : dateString);
  const today = getNowSaoPaulo();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
}

/**
 * Format date avoiding timezone issues (uses São Paulo locale)
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : dateString);
  return date.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE });
}

/**
 * Extract time (HH:MM) from a datetime string, converting to São Paulo timezone
 * Handles ISO format: "YYYY-MM-DDTHH:MM:SS.000Z"
 * Returns just "HH:MM" in São Paulo time or null if not found
 */
export function extractTime(dateTimeString: string | null | undefined): string | null {
  if (!dateTimeString) return null;
  
  try {
    // Parse the ISO date string
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return null;
    
    // Format the time in São Paulo timezone
    const timeStr = date.toLocaleTimeString('pt-BR', { 
      timeZone: SAO_PAULO_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return timeStr;
  } catch {
    // Fallback: try to match time pattern after a space or T
    const timeMatch = dateTimeString.match(/[\sT](\d{2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1]}:${timeMatch[2]}`;
    }
    return null;
  }
}

/**
 * Extract just the date part (YYYY-MM-DD) from a Firebird datetime string
 * Handles both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS" formats
 */
export function extractDatePart(dateTimeString: string | null | undefined): string | null {
  if (!dateTimeString) return null;
  
  // Match YYYY-MM-DD pattern at the start
  const dateMatch = dateTimeString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }
  
  return null;
}
