import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div
      className={`gsap-card relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card transition-all duration-200 hover:border-primary/40 hover:shadow-card-hover ${className}`}
    >
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            {title && (
              <h3 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
