import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  isLoading?: boolean;
  children: React.ReactNode;
}

const ButtonSpinner: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    className={`h-4 w-4 shrink-0 animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3.5"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-primary hover:bg-primary-hover text-white font-semibold shadow-xs hover:shadow-sm active:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    secondary:
      'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold shadow-xs hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
    danger:
      'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 font-semibold shadow-xs active:bg-rose-200 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2',
    outline:
      'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold shadow-xs hover:text-slate-900 active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-700 font-semibold hover:text-slate-900 active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium tracking-tight transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading && <ButtonSpinner className="mr-2" />}
      {children}
    </button>
  );
};
