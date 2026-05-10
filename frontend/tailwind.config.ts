import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#3D81E3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'JetBrains Mono',
          'monospace',
        ],
      },
      animation: {
        shiny: 'shiny 6s linear infinite',
        'aura-fade-up': 'auraFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        'aura-fade-down': 'auraFadeDown 0.6s ease-out forwards',
        'aura-rise': 'auraRise 0.9s cubic-bezier(0.22,1,0.36,1) forwards',
        'aura-h1': 'auraFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
        'aura-caret': 'auraCaret 1s steps(2) infinite',
      },
      keyframes: {
        shiny: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        auraFadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        auraFadeDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        auraRise: {
          from: { opacity: '0', transform: 'translateY(40px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        auraCaret: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
