/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
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
          '"Sora"',
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
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
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
