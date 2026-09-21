/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af'
        },
        whatsapp: {
          light: '#25D366',
          DEFAULT: '#128C7E',
          dark: '#075E54'
        }
      }
    },
  },
  plugins: [],
}
