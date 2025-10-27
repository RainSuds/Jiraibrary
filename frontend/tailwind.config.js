/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'jirai': {
          pink: '#FFB7D5',
          black: '#1a1a1a',
          white: '#FFFFFF',
          purple: '#C8A2C8',
          gray: '#4a4a4a',
        }
      }
    },
  },
  plugins: [],
}
