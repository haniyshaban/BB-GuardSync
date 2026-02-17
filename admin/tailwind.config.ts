/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f5f5',
          100: '#e5e5e5',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#303030',
          800: '#1a1a1a',
          900: '#0a0a0a',
          950: '#000000',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
