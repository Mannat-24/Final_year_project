/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf4",
          100: "#d4f5e0",
          500: "#1f9d63",
          700: "#177a4d"
        }
      }
    }
  },
  plugins: []
};
