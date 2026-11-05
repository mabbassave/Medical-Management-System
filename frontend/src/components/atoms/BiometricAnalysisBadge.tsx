import React from 'react';
import './BiometricAnalysisBadge.css';

export interface BiometricAnalysisBadgeProps {
  className?: string;
}

export const BiometricAnalysisBadge: React.FC<BiometricAnalysisBadgeProps> = ({ className = '' }) => {
  return (
    <div
      className={`inline-flex items-center gap-2 bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] rounded-full px-3.5 py-1.5 ${className}`}
      aria-hidden="true"
    >
      <svg className="w-4 h-4 text-[#148F3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
      <span className="text-xs font-semibold text-[#0F172A]">Biometric Analysis</span>
      <span className="h-2 w-2 rounded-full bg-[#148F3A]" />
    </div>
  );
};

export default BiometricAnalysisBadge;

