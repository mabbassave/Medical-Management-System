import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ANIMATION } from '../utils/constants';

export const useFadeUp = <T extends HTMLElement = HTMLElement>(
  containerRef: RefObject<T | null>,
  deps: unknown[] = []
) => {
  useEffect(() => {
    if (!containerRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const cards = containerRef.current?.querySelectorAll('.gsap-card');
      if (cards && cards.length > 0) {
        gsap.from(cards, {
          opacity: 0,
          y: ANIMATION.FADE_UP.Y_OFFSET,
          duration: ANIMATION.FADE_UP.DURATION,
          stagger: ANIMATION.FADE_UP.STAGGER,
          ease: ANIMATION.EASING.GSAP,
        });
      }
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [containerRef, ...deps]);
};
