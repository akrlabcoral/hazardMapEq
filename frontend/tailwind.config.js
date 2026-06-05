/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          800: '#415a6e',
          900: '#354a5a',
          950: '#2C3D4B',
        },
        background: '#2C3D4B', 
        surface: '#354a5a', 
        primary: '#06b6d4', 
        secondary: '#3b82f6', 
        alert: '#ef4444', 
        warning: '#f59e0b', 
        success: '#10b981', 
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
