/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#07080C',
          900: '#0C0E14',
          850: '#11141D',
          800: '#171B26',
          700: '#23293A',
        },
        cyanflow: {
          400: '#38BDF8',
          500: '#0EA5E9',
        },
        dream: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'glow-dream': '0 0 24px -4px rgba(139, 92, 246, 0.45)',
        'glow-cyan': '0 0 24px -4px rgba(56, 189, 248, 0.4)',
      },
    },
  },
  plugins: [],
};
