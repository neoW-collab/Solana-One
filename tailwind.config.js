/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        solanaPurple: {
          DEFAULT: "#9945FF",
        },
        solanaBlue: {
          DEFAULT: "#14F195",
        }
      }
    },
  },
  plugins: [],
}