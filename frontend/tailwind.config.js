/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Agent colors matching the agents-plan.png
        marketing: { DEFAULT: '#06b6d4', light: '#cffafe' },  // Cyan
        sales: { DEFAULT: '#3b82f6', light: '#dbeafe' },       // Blue
        legal: { DEFAULT: '#8b5cf6', light: '#ede9fe' },       // Purple
        accounting: { DEFAULT: '#ef4444', light: '#fee2e2' },   // Red
        email: { DEFAULT: '#f97316', light: '#ffedd5' },        // Orange
      },
    },
  },
  plugins: [],
}
