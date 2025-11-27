/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Simmonds Language Services Brand Colors
        simmonds: {
          // Primary - Dark Teal/Green
          primary: '#003F37',
          'primary-light': '#005249',
          'primary-dark': '#002D28',

          // Secondary - Olive Green
          olive: '#4F5338',
          'olive-light': '#626748',
          'olive-dark': '#3C3F2A',

          // Accent - Yellow-Green
          lime: '#9F9D38',
          'lime-light': '#B2B04A',
          'lime-dark': '#8A882E',

          // Accent - Orange/Rust
          terracotta: '#B25627',
          'terracotta-light': '#C46A3A',
          'terracotta-dark': '#8F451F',

          // Backgrounds - Light Beige
          cream: '#E3C6AB',
          'cream-light': '#FFE8CD',
          'cream-lighter': '#FFF5E8',
          'cream-dark': '#D4B89A',

          // Neutrals
          charcoal: '#2D2D2D',
          stone: '#5A5A5A',
        }
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
}
