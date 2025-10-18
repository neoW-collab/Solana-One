/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
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