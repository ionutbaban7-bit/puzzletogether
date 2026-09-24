import { createServer } from "vite";
const vite = await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"error"});
try { await vite.ssrLoadModule('/scripts/ui-smoke/workshop-entry.tsx'); } finally { await vite.close(); }
