import { cn } from '@/lib/utils';

interface BeerTapIconProps {
  className?: string;
}

export function BeerTapIcon({ className }: BeerTapIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-4 h-4", className)}
    >
      {/* Base */}
      <rect x="6" y="20" width="12" height="2" rx="0.5" />
      {/* Machine body */}
      <rect x="8" y="10" width="8" height="10" rx="1" />
      {/* Top tower */}
      <rect x="10" y="4" width="4" height="6" rx="0.5" />
      {/* Tap handle */}
      <path d="M12 4 L12 2" />
      <circle cx="12" cy="2" r="1" fill="currentColor" />
      {/* Spout */}
      <path d="M14 16 L16 18" />
      {/* Logo/display area */}
      <circle cx="12" cy="14" r="2" />
    </svg>
  );
}
