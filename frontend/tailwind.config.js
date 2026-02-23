/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        iso: 'var(--touch-min)',
        'iso-1': 'var(--space-1)',
        'iso-2': 'var(--space-2)',
        'iso-3': 'var(--space-3)',
        'iso-4': 'var(--space-4)',
        'iso-5': 'var(--space-5)',
        'iso-6': 'var(--space-6)',
      },
      minHeight: {
        touch: 'var(--touch-min)',
      },
      colors: {
        clirdec: {
          bg: 'var(--bg)',
          'bg-elevated': 'var(--bg-elevated)',
          surface: 'var(--surface)',
          border: 'var(--border)',
          accent: 'var(--accent)',
          'accent-muted': 'var(--accent-muted)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        'DEFAULT': 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
