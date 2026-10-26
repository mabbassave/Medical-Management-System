import React from 'react';

interface AivoraLogoProps {
  className?: string;
}

export const AivoraLogo: React.FC<AivoraLogoProps> = ({ className = 'h-8 w-8' }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M16 28S3 20 3 10.5C3 6.358 6.358 3 10.5 3C13.08 3 15.358 4.305 16.5 6.305C17.642 4.305 19.92 3 22.5 3C26.642 3 30 6.358 30 10.5C30 20 17 28 16 28Z"
      fill="#0D9488"
    />
    <path
      d="M6.5 15.5H10.5L12.5 10L16.5 21L18.5 13.5L20.5 17.5L22 15.5H26.5"
      stroke="#FFFFFF"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
