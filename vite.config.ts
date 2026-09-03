import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client is served by the Node backend (same origin, same port).
// In development the backend mounts Vite as middleware; in production it
// serves the static build from dist/. Everything (HTTP + WebSocket) lives
// on one origin so no proxy/CORS configuration is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    // The backend mounts Vite as middleware; requests arrive under whatever
    // host the platform previews the app on, so allow any host in dev.
    allowedHosts: true,
    // This also lets the browser harness run Vite on a separate port while
    // preserving the browser-facing relative API and WebSocket URLs.
    proxy: {
      "/api": { target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:3000", changeOrigin: true },
      "/uploads": { target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:3000", changeOrigin: true },
      "/images": { target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:3000", changeOrigin: true },
      "/ws": { target: process.env.VITE_BACKEND_URL || "ws://127.0.0.1:3000", ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
