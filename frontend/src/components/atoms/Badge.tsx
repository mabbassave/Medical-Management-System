import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Check, Diamond } from 'lucide-react';
import gsap from 'gsap';
import { ANIMATION } from '../../shared/utils/constants';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'success',
  children,
  className = '',
}) => {
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (variant !== 'danger' || !badgeRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.to(badgeRef.current, {
        scale: ANIMATION.BADGE.DANGER_SCALE,
        opacity: ANIMATION.BADGE.DANGER_OPACITY,
        duration: ANIMATION.BADGE.PULSE_DURATION,
        repeat: -1,
        yoyo: true,
        ease: ANIMATION.EASING.GSAP,
      });
    }, badgeRef);

    return () => {
      ctx.revert();
    };
  }, [variant]);

  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80 font-medium',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200/80 font-medium',
  };

  return (
    <span
      ref={badgeRef}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-tight transition-all ${variantStyles[variant]} ${className}`}
    >
      {variant === 'success' && (
        <span className="mr-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-700 text-white">
          <Check className="h-2 w-2 stroke-[3.5]" aria-hidden="true" />
        </span>
      )}
      {variant === 'warning' && (
        <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
      )}
      {variant === 'danger' && (
        <Diamond className="mr-1 h-3 w-3 shrink-0 fill-current text-rose-700" aria-hidden="true" />
      )}
      {children}
    </span>
  );
};
