/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Clean White & Very Light Gray backgrounds
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        surfaceCard: '#FFFFFF',
        surfaceHover: '#F1F5F9',
        surfaceSunken: '#F8FAFC',

        border: '#E2E8F0',
        borderLight: '#F1F5F9',
        borderMuted: '#CBD5E1',

        // Primary: Soft Green
        primary: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#16A34A',
          DEFAULT: '#16A34A',
          600: '#15803D',
          hover: '#15803D',
          700: '#166534',
          800: '#14532D',
          900: '#052E16',
        },

        // Accent: Soft Yellow
        yellowAccent: {
          50: '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#EAB308',
          DEFAULT: '#EAB308',
          600: '#CA8A04',
          700: '#A16207',
        },

        accent: {
          DEFAULT: '#EAB308',
          green: '#16A34A',
          yellow: '#EAB308',
        },

        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        ink: '#0F172A',
        'ink-muted': '#64748B',
        'ink-faint': '#94A3B8',

        // Status tokens
        success: '#16A34A',
        warning: '#EAB308',
        danger: '#EF4444',
        info: '#0284C7',

        'range-out': '#EF4444',
        'range-outSoft': '#FEF2F2',
        'range-warning': '#EAB308',
        'range-warningSoft': '#FEFCE8',
        'range-normal': '#16A34A',
        'range-normalSoft': '#F0FDF4',
        prescriptionPrimary: '#16A34A',
        prescriptionPrimaryDark: '#15803D',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
        full: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        sm: '0 2px 8px -2px rgba(15, 23, 42, 0.05)',
        DEFAULT: '0 4px 16px -4px rgba(15, 23, 42, 0.06)',
        card: '0 10px 30px -5px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        'card-hover': '0 20px 40px -10px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03)',
        soft: '0 14px 35px -8px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
