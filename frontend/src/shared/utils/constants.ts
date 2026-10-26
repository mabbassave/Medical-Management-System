/**
 * Shared design tokens — the TypeScript source-of-truth for values that
 * Tailwind classes can't reach (GSAP, inline styles, canvas, etc.).
 *
 * These intentionally mirror the Tailwind config so the two never drift.
 */

/* ── Color tokens ──────────────────────────────────────────────── */

export const COLOR = {
  /** Primary blue scale */
  PRIMARY: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554',
    /** Convenience alias — same as 600 */
    DEFAULT: '#2563EB',
  },

  /** Backgrounds */
  BG:      '#F1F5F9',
  SURFACE: '#FFFFFF',

  /** Borders */
  BORDER: 'rgb(30 41 59 / 0.10)',

  /** Text — navy family */
  TEXT: {
    PRIMARY:   '#0F172A',
    SECONDARY: 'rgb(30 41 59 / 0.60)',
    MUTED:     'rgb(30 41 59 / 0.40)',
  },

  /** Semantic states */
  SUCCESS: '#16A34A',
  WARNING: '#D97706',
  DANGER:  '#DC2626',
  INFO:    '#0284C7',
} as const;

/* ── Radius tokens ─────────────────────────────────────────────── */

export const RADIUS = {
  SM:   '0.5rem',   //  8 px
  MD:   '0.75rem',  // 12 px — default
  LG:   '1rem',     // 16 px
  XL:   '1.25rem',  // 20 px
  XXL:  '1.5rem',   // 24 px
  FULL: '9999px',
} as const;

/* ── Shadow tokens ─────────────────────────────────────────────── */

export const SHADOW = {
  SM:   '0 1px 2px 0 rgb(15 23 42 / 0.04)',
  MD:   '0 4px 6px -1px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
  LG:   '0 10px 15px -3px rgb(15 23 42 / 0.06), 0 4px 6px -4px rgb(15 23 42 / 0.04)',
  CARD: '0 1px 3px 0 rgb(15 23 42 / 0.04), 0 1px 2px -1px rgb(15 23 42 / 0.03)',
  CARD_HOVER: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
} as const;

/* ── Animation tokens (preserved from existing constants) ──────── */

export const ANIMATION = {
  EASING: {
    GSAP: 'power3.out',
    CSS: 'cubic-bezier(0.19, 1, 0.22, 1)',
  },
  FADE_UP: {
    Y_OFFSET: 12,
    DURATION: 0.4,
    STAGGER: 0.05,
  },
  LAYOUT: {
    INITIAL_Y: 8,
    INITIAL_DURATION: 0.4,
    ROUTE_DURATION: 0.3,
  },
  BADGE: {
    DANGER_SCALE: 1.04,
    DANGER_OPACITY: 0.85,
    PULSE_DURATION: 0.8,
  },
  SKELETON: {
    OPACITY_MIN: 0.5,
    OPACITY_MAX: 1,
    DURATION: 0.8,
  },
  SIDEBAR: {
    DURATION: 0.3,
  },
  ACTIVE_BAR: {
    DURATION: 0.3,
  },
} as const;
