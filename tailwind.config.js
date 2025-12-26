/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}", // include all .tsx/.ts files (components, hooks, etc.)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
