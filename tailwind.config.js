/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx,html}",
      "./popup.html"
    ],
    theme: {
      extend: {},
    },
    darkMode: 'class', // <-- This allows using `dark:` variants
    plugins: [],
};
  