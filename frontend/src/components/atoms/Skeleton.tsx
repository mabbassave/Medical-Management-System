import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ANIMATION } from '../../shared/utils/constants';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.to(ref.current, {
        opacity: ANIMATION.SKELETON.OPACITY_MIN,
        duration: ANIMATION.SKELETON.DURATION,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    }, ref);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`bg-textPrimary/10 rounded ${className}`}
      style={{ width, height }}
    />
  );
};
