import { cn } from '@/lib/utils';

interface BeerBottleIconProps {
  className?: string;
}

export function BeerBottleIcon({ className }: BeerBottleIconProps) {
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
      {/* Bottle cap */}
      <rect x="9" y="2" width="6" height="3" rx="0.5" />
      {/* Bottle neck */}
      <path d="M10 5 L10 8 L8 10 L8 22 L16 22 L16 10 L14 8 L14 5" />
      {/* Label area */}
      <rect x="9" y="14" width="6" height="5" rx="0.5" />
    </svg>
  );
}
