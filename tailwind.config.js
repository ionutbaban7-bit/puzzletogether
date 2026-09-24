/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
      colors: {
        // CoachingHub shared identity: warm surfaces,
        // forest ink and restrained brass accents.
        g: {
          blue: "#1f4c3e",
          "blue-dark": "#16382f",
          "blue-tint": "#e9e1d5",
          green: "#356443",
          "green-tint": "#e8eee2",
          red: "#8a4938",
          "red-tint": "#f5e6df",
          yellow: "#896a41",
          "yellow-tint": "#f1e7d3",
          ink: "#26372f",
          sub: "#506057",
          // darkened from #9aa0a6 (2.5:1, failed WCAG AA) to #756f64 (4.6:1)
          faint: "#756f64",
          line: "#d7cebe",
          soft: "#f3eee4",
        },
        ink: {
          950: "#14261f",
          900: "#1b3027",
          800: "#21392f",
          700: "#2c473b",
          600: "#3b5548",
          500: "#687264",
          400: "#8c9485",
          300: "#b6aa96",
          200: "#d6cebf",
          100: "#e6dfd1",
          50: "#f3eee4",
        },
        // Brand blue — the single primary, remapped from the old azure/cyan
        // scale onto the blue→indigo identity. 300+ doubles as the dark-stage
        // accent (readable on navy); 600 is the light-surface primary.
        brand: {
          50: "#f3eee4",
          100: "#e9e1d5",
          200: "#d7c7ab",
          300: "#d0b27a",
          400: "#b29b72",
          500: "#356653",
          600: "#1f4c3e",
          700: "#16382f",
          800: "#16382f",
          900: "#14261f",
        },
        cp: {
          azure: { 50: "#f3eee4", 100: "#e9e1d5", 300: "#d0b27a", 600: "#1f4c3e", 700: "#16382f" },
          pink: { 50: "#fff0f7", 100: "#ffd9ec", 300: "#f98bc4", 500: "#f23b9d", 600: "#d72c88", 700: "#c61e78" },
          // Violet secondary, aligned with the landing gradient; full scale
          // (the old one was missing 200/400/600 that the UI referenced).
          purple: {
            50: "#f5f0fd",
            100: "#e8dcfb",
            200: "#d4bcf6",
            300: "#b993f0",
            400: "#a172e8",
            500: "#8b5cf6",
            600: "#7c3aed",
            700: "#6d2fd4",
          },
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
