import React from 'react';

interface SprayCanIconProps {
  className?: string;
  size?: number;
}

export const SprayCanIcon: React.FC<SprayCanIconProps> = ({ className, size = 24 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Spray nozzle */}
      <path d="M8 2v4" />
      <path d="M10 2v2" />
      <path d="M6 2v2" />
      
      {/* Spray dots */}
      <circle cx="4" cy="4" r="0.5" fill="currentColor" />
      <circle cx="3" cy="6" r="0.5" fill="currentColor" />
      <circle cx="2" cy="5" r="0.5" fill="currentColor" />
      
      {/* Can body */}
      <rect x="5" y="6" width="6" height="16" rx="1" />
      
      {/* Can cap */}
      <path d="M5 6h6v2H5z" />
      
      {/* Can highlight */}
      <path d="M7 10v8" />
    </svg>
  );
};
