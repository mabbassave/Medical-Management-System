import React from 'react';

interface MediCureLogoProps {
  className?: string;
  showText?: boolean;
}


export const MediCureLogo: React.FC<MediCureLogoProps> = ({ className = 'h-8 w-8' }) => (
  <svg
    className={className}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Soft green rounded container */}
    <rect x="2" y="2" width="32" height="32" rx="10" fill="#16A34A" />

    {/* Medical Cross in crisp white */}
    <rect x="15" y="9" width="6" height="18" rx="3" fill="#FFFFFF" />
    <rect x="9" y="15" width="18" height="6" rx="3" fill="#FFFFFF" />

    {/* Soft Yellow Accent Vitality Dot */}
    <circle cx="26" cy="10" r="3.5" fill="#EAB308" stroke="#16A34A" strokeWidth="1.5" />
  </svg>
);

// Backward compatibility with existing imports
export const AivoraLogo = MediCureLogo;
