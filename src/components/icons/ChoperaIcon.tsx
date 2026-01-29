import React from 'react';

interface ChoperaIconProps {
  className?: string;
  size?: number;
}

export const ChoperaIcon: React.FC<ChoperaIconProps> = ({ className, size = 24 }) => {
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
      {/* Tap handle */}
      <path d="M12 2v4" />
      <path d="M10 2h4" />
      
      {/* Main body */}
      <rect x="6" y="6" width="12" height="14" rx="2" />
      
      {/* Tap spout */}
      <path d="M9 20v2" />
      <path d="M15 20v2" />
      
      {/* Front display/gauge */}
      <circle cx="12" cy="13" r="3" />
      
      {/* Control knob */}
      <circle cx="17" cy="10" r="1" fill="currentColor" />
    </svg>
  );
};
