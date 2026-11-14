/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0e0e0e',
        levitation: '#191919',
        menu: '#1e1e1e',
        pill: '#252525',
        pillHover: '#2e2e2e',
        pillActive: '#303030',
        dreamCyan: '#20D5EC',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        levitation: '0 16px 40px rgba(0, 0, 0, 0.68)',
        'node-selected':
          '0 0 0 2px rgba(255, 255, 255, 0.12), 0 20px 50px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
};
