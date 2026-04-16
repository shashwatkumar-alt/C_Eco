/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
        },
        success: {
          DEFAULT: '#10B981',
          hover: '#059669',
        },
        error: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
        },
      },
    },
  },
  plugins: [],
}
