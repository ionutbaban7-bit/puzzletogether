/*
 * Catalog retirement compatibility: a short-lived room saved before a category
 * was delisted still restores and displays its archival image, while the item
 * remains absent from the new-room catalog.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3112;
const BASE = `http://127.0.0.1:${PORT}`;
const dataRelative = ".data/retired-catalog-compat-test";
const dataDir = path.join(ROOT, dataRelative);
const now = Date.now();
const roomId = "legacy-retired-catalog-room";
const hostId = "legacy-retired-host";
const checks = [];
const ok = (name, value, detail = "") => { checks.push(!!value); console.log(`${value ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
const cols = 5, rows = 5, pieceW = 360, pieceH = 240;
const pieces = Array.from({ length: 25 }, (_, id) => ({
  id, x: (id % cols) * 14, y: Math.floor(id / cols) * 14,
  correctX: (id % cols) * pieceW, correctY: Math.floor(id / cols) * pieceH,
  drag: false, moved: false, locked: false, heldBy: null, placedOnSlot: null,
}));
writeFileSync(path.join(dataDir, "rooms.json"), JSON.stringify([{
  id: roomId, code: "LEGACY", sessionName: "Legacy active room", hostId,
  config: { puzzleId: "abstract-azure-arches", difficulty: "easy", total: 25, contentLanguage: null },
  pieces, canvas: null, ratings: [], scores: [],
  knownPlayers: [[hostId, { name: "Ana", color: "#6366f1", role: "host", teamId: null }]],
  createdAt: now - 5000, startedAt: now - 3000, pausedAt: null, pausedDurationMs: 0,
  timerEndsAt: null, timerDurationMs: null, lastActivityAt: now, stage: "play", boardLocked: false,
  jigsawLayout: "scatter", revealed: false, celebrationMode: "team", facilitatorNotes: "",
  insights: { observed: "", learned: "", tryNext: "" }, debriefNotes: [], actions: [], chat: [],
  completed: false, completedAt: null, completedInMs: null, completionPlayers: [], teamMode: "shared", teams: [],
}]), "utf8");

const child = spawn(process.execPath, [path.join(ROOT, "src", "server.js")], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataRelative, NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (data) => { log += data.toString(); });
child.stderr.on("data", (data) => { log += data.toString(); });
try {
  let ready = false;
  for (let count = 0; count < 40 && !ready; count++) {
    await wait(150);
    try { ready = (await fetch(`${BASE}/api/health`)).ok; } catch { /* starting */ }
  }
  if (!ready) throw new Error(`test server did not start: ${log.slice(-800)}`);
  const catalog = await fetch(`${BASE}/api/puzzles`).then((response) => response.json());
  ok("retired categories are absent from new-room catalog", !catalog.categories.some((item) => ["abstract-geometry", "isometric-worlds"].includes(item.id)) && !catalog.puzzles.some((item) => item.id === "abstract-azure-arches"));
  const room = await fetch(`${BASE}/api/rooms/${roomId}`).then((response) => response.json());
  ok("legacy room restores instead of being dropped", room.room?.id === roomId && room.room?.retiredCatalog === true && room.playerCount === 0, JSON.stringify(room).slice(0, 260));
  const legacyImage = room.puzzle?.image || "";
  ok("legacy room exposes a room-scoped archival-only image route", /^\/api\/retired-images\/abstract-azure-arches\?room=legacy-retired-catalog-room$/.test(legacyImage), legacyImage || JSON.stringify(room));
  const image = await fetch(`${BASE}${legacyImage}`);
  ok("archival image remains available for its active legacy room", image.status === 200 && /image\/jpeg/.test(image.headers.get("content-type") || ""));
  const unscopedImage = await fetch(`${BASE}/api/retired-images/abstract-azure-arches`);
  ok("retired archive is not exposed as a general public image route", unscopedImage.status === 404);
  const switched = await fetch(`${BASE}/api/rooms/${roomId}/puzzle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ puzzleId: "mona-lisa", difficulty: "easy", pid: hostId }) });
  const switchedData = await switched.json();
  ok("facilitator can move a legacy room back onto the reviewed catalog", switched.status === 200 && switchedData.room?.puzzleId === "mona-lisa" && !switchedData.room?.retiredCatalog);
} finally {
  child.kill("SIGTERM");
  await wait(200);
  rmSync(dataDir, { recursive: true, force: true });
}
const failed = checks.filter((value) => !value).length;
console.log(`\n${failed ? "⚠️" : "🎉"} retired-catalog compatibility: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
