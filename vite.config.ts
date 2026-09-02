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
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
