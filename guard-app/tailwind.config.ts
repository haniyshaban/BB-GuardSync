/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 900: '#0a0a0a', 800: '#1a1a1a', 700: '#303030' },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
