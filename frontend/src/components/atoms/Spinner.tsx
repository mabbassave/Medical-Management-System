import React from 'react';
import { AivoraLogo } from './AivoraLogo';
import './Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', showLabel = false }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <span className={`medivanta-loading-indicator ${className}`}>
      <span className="medivanta-loading-mark">
        <span className="medivanta-loading-glow" aria-hidden="true" />
        <AivoraLogo className={`medivanta-loading-logo ${sizeClasses[size]}`} />
      </span>
      {showLabel && <span className="medivanta-loading-name">Medivanta</span>}
    </span>
  );
};

