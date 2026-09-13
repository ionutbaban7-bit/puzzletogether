/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Modern, readable identity: Manrope for display, Inter for body,
        // with a strong system fallback so workshops stay reliable behind
        // strict corporate CSPs (no webfont dependency).
        sans: [
          '"Inter"',
          '"Manrope"',
          '"Geist"',
          "-apple-system",
          '"SF Pro Text"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          "ui-sans-serif",
          "system-ui",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: [
          '"Manrope"',
          '"Inter"',
          '"Geist"',
          "-apple-system",
          '"SF Pro Display"',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        // Google-style light surfaces (learning.google aesthetic): white space,
        // near-black ink, quiet gray lines, one confident blue.
        g: {
          blue: "#1a73e8",
          "blue-dark": "#1765cc",
          "blue-tint": "#e8f0fe",
          green: "#188038",
          "green-tint": "#e6f4ea",
          red: "#d93025",
          "red-tint": "#fce8e6",
          yellow: "#f9ab00",
          "yellow-tint": "#fef7e0",
          ink: "#202124",
          sub: "#5f6368",
          // darkened from #9aa0a6 (2.5:1, failed WCAG AA) to #70757a (4.6:1)
          faint: "#70757a",
          line: "#dadce0",
          soft: "#f8f9fa",
        },
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
        // Brand blue — the single primary, remapped from the old azure/cyan
        // scale onto the blue→indigo identity. 300+ doubles as the dark-stage
        // accent (readable on navy); 600 is the light-surface primary.
        brand: {
          50: "#eef4ff",
          100: "#dbe7fe",
          200: "#b8cdfd",
          300: "#8ab4f8",
          400: "#669df6",
          500: "#4285f4",
          600: "#1a73e8",
          700: "#1765cc",
          800: "#1356b0",
          900: "#0f4590",
        },
        cp: {
          azure: { 50: "#eef4ff", 100: "#dbe7fe", 300: "#8ab4f8", 600: "#1a73e8", 700: "#1765cc" },
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
