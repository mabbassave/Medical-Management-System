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
        // Unified charcoal clinical workspace
        background: '#252728',
        surface: '#2B2D2D',
        surfaceElevated: '#333636',
        surfaceCard: '#2B2D2D',
        surfaceHover: '#393C3C',
        surfaceSunken: '#1F2122',

        border: 'rgba(226, 222, 204, 0.16)',
        borderLight: 'rgba(226, 222, 204, 0.1)',
        borderMuted: 'rgba(226, 222, 204, 0.24)',

        // Teal-green brand accents
        primary: {
          50: '#E5F7F0',
          100: '#C7EBDD',
          200: '#9DDBC2',
          300: '#70CAA7',
          400: '#42B88E',
          500: '#18A77B',
          DEFAULT: '#18A77B',
          600: '#128B67',
          hover: '#42B88E',
          700: '#0F7055',
          800: '#0C5542',
          900: '#252728',
          950: '#1D1D18',
        },
        accent: {
          DEFAULT: '#18A77B',
          glow: 'rgba(24, 167, 123, 0.25)',
        },

        darkBrand: '#252728',
        darkSecond: '#252728',
        mintGreen: '#18A77B',
        logoGreen: '#42B88E',
        greenAccent: '#18A77B',
        textGreen: '#70CAA7',

        textPrimary: '#F0EEE6',
        textSecondary: '#C0BEB5',
        textMuted: '#96968F',
        ink: '#F0EEE6',
        'ink-muted': '#C0BEB5',
        'ink-faint': '#96968F',

        // Clinical KPI and status tokens
        kpi: {
          patients: '#18A77B',
          appointments: '#2563EB',
          doctors: '#7C3AED',
          alerts: '#DC2626',
        },
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#2563EB',

        // Clinical range helpers
        'range-out': '#DC2626',
        'range-outSoft': '#FEF2F2',
        'range-warning': '#D97706',
        'range-warningSoft': '#FFFBEB',
        'range-normal': '#059669',
        'range-normalSoft': '#ECFDF5',
        'paper-light': '#2D2B1D',
        prescriptionPrimary: '#18A77B',
        prescriptionPrimaryDark: '#128B67',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        sm: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        DEFAULT: '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        glow: '0 0 20px rgba(24, 167, 123, 0.2)',
        'glow-lg': '0 0 35px rgba(24, 167, 123, 0.25)',
      },
    },
  },
  plugins: [],
}
