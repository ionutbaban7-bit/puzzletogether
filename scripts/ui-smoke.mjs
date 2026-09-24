// Runs the CARTOGRAF UI smoke test: Vite SSR-loads the TSX entry in Node + jsdom.
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  await vite.ssrLoadModule("/scripts/ui-smoke/entry.tsx");
} finally {
  await vite.close();
}
