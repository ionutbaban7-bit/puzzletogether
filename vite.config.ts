import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The normal development path mounts Vite inside src/server.js, so client,
// API, images and WebSocket all share one origin. A standalone Vite server is
// supported only when a separate backend is intentionally supplied.
const backendHttp = process.env.VITE_BACKEND_URL?.replace(/\/$/, "");
const backendWs = backendHttp?.replace(/^http/i, "ws");
const standaloneProxy = backendHttp ? {
  "/api": { target: backendHttp, changeOrigin: true },
  "/uploads": { target: backendHttp, changeOrigin: true },
  "/images": { target: backendHttp, changeOrigin: true },
  "/ws": { target: backendWs, ws: true, changeOrigin: true },
} : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    // Requests reach the middleware under the preview host in development.
    allowedHosts: true,
    // Never default this to the same port as Vite: an absent image otherwise
    // turns into a self-proxy loop instead of a quick, observable 404.
    proxy: standaloneProxy,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
