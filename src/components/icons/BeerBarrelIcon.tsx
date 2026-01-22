import { cn } from '@/lib/utils';

interface BeerBarrelIconProps {
  className?: string;
}

export function BeerBarrelIcon({ className }: BeerBarrelIconProps) {
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
      {/* Main barrel body - oval shape */}
      <ellipse cx="12" cy="12" rx="8" ry="10" />
      {/* Top ring */}
      <ellipse cx="12" cy="4" rx="5" ry="2" />
      {/* Bottom ring */}
      <ellipse cx="12" cy="20" rx="5" ry="2" />
      {/* Middle band */}
      <line x1="4" y1="12" x2="20" y2="12" />
      {/* Tap on top */}
      <circle cx="12" cy="4" r="1" fill="currentColor" />
    </svg>
  );
}
