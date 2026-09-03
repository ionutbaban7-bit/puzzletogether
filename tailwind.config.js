/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Poppins"',
          '"Inter"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: [
          '"Poppins"',
          '"Inter"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          950: "#0b0e1a",
          900: "#10141f",
          800: "#171c2b",
          700: "#232a3d",
          600: "#333c54",
          500: "#4a5470",
          400: "#6b7592",
          300: "#97a0ba",
          200: "#c2c9dd",
          100: "#e4e8f3",
          50: "#f3f5fb",
        },
        // Coaching Partners: azure is the dependable primary, hot pink is
        // reserved for calls to action, and purple marks secondary choices.
        brand: {
          50: "#edf8fd",
          100: "#d9f0fa",
          200: "#b7e2f4",
          300: "#7bc9e8",
          400: "#37a4d1",
          500: "#1689c9",
          600: "#0e77b7",
          700: "#085d92",
          800: "#064a75",
          900: "#083b5c",
        },
        cp: {
          azure: { 50: "#edf8fd", 100: "#d9f0fa", 300: "#7bc9e8", 600: "#0e77b7", 700: "#085d92" },
          pink: { 50: "#fff0f7", 100: "#ffd9ec", 300: "#f98bc4", 500: "#f23b9d", 600: "#d72c88", 700: "#c61e78" },
          purple: { 50: "#f5f0fa", 100: "#e9ddf5", 300: "#bd99df", 500: "#8a58c0", 700: "#69419a" },
          slate: "#94a3b8",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,20,31,0.04), 0 8px 24px -8px rgba(16,20,31,0.12)",
        pop: "0 2px 4px rgba(16,20,31,0.06), 0 16px 40px -12px rgba(16,20,31,0.25)",
        chip: "0 0 0 1px rgba(16,20,31,0.06), 0 2px 8px -2px rgba(16,20,31,0.15)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.94) translateY(8px)" },
          "60%": { opacity: "1", transform: "scale(1.01) translateY(0)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.3s ease both",
        "pop-in": "pop-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
