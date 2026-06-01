/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617', // slate-950
        surface: '#0f172a', // slate-900
        primary: '#06b6d4', // cyan-500
        secondary: '#3b82f6', // blue-500
        alert: '#ef4444', // red-500
        warning: '#f59e0b', // amber-500
        success: '#10b981', // emerald-500
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
