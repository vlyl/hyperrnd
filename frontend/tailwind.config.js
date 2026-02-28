/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        casino: {
          green: "#0d5c2e",
          gold: "#c9a227",
          red: "#c0392b",
          dark: "#0a0a0f",
          card: "#12121a",
          border: "#2a2a3a",
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "pulse-gold": "pulse 2s ease-in-out infinite",
        "bounce-dice": "bounce 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
};
