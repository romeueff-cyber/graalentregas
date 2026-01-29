import React from 'react';

interface KegotaterIconProps {
  className?: string;
  size?: number;
}

export const KegotaterIcon: React.FC<KegotaterIconProps> = ({ className, size = 24 }) => {
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
      {/* Fridge body */}
      <rect x="4" y="2" width="16" height="20" rx="2" />
      
      {/* Divider line */}
      <path d="M4 14h16" />
      
      {/* Top door handle */}
      <path d="M18 6v4" />
      
      {/* Bottom door handle */}
      <path d="M18 17v2" />
      
      {/* Temperature display */}
      <rect x="7" y="5" width="6" height="3" rx="0.5" />
      
      {/* Bottom compartment shelves */}
      <path d="M6 17h8" />
      <path d="M6 19h8" />
    </svg>
  );
};
