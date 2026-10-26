import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={`h-11 w-full rounded-xl border px-3.5 text-sm bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
              : 'border-slate-300 hover:border-slate-400 focus:border-primary focus:ring-primary/15'
          } disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
