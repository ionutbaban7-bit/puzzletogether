#!/usr/bin/env node
/**
 * Stage 5 delivery gate: validate that every catalog image is served and that
 * every Stage 5 jigsaw image can be instantiated at every advertised jigsaw
 * difficulty. Run against a freshly started server so imageDims includes the
 * generated manifest.
 *
 * Usage: BASE=http://127.0.0.1:3000 node scripts/catalog-serve-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/sources.json"), "utf8"));
const additions = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/stage5-additions.json"), "utf8"));
const checks = [];
const ok = (name, pass, note = "") => { checks.push(pass); console.log(`${pass ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`); };

async function request(url, options) {
  try { return await fetch(url, options); } catch (error) { return { ok: false, status: 0, headers: new Headers(), error }; }
}
async function mapLimit(items, limit, fn) {
  const result = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; result[index] = await fn(items[index]); }
  }));
  return result;
}

const health = await request(`${BASE}/api/health`);
ok("server health endpoint", health.ok);
const catalogResponse = await request(`${BASE}/api/puzzles`);
const apiCatalog = catalogResponse.ok ? await catalogResponse.json() : null;
ok("catalog API is available", !!apiCatalog);
if (!apiCatalog) process.exit(1);

const byPuzzleId = new Map(apiCatalog.puzzles.map((puzzle) => [puzzle.id, puzzle]));
const imageUrls = [];
for (const entry of catalog.entries) {
  if (entry.asset.endsWith(".svg")) imageUrls.push({ entry, kind: "SVG cover", url: entry.asset });
  else {
    imageUrls.push({ entry, kind: "full", url: entry.fullImage });
    imageUrls.push({ entry, kind: "thumbnail", url: entry.thumbnail });
  }
}
const served = await mapLimit(imageUrls, 12, async (item) => {
  const response = await request(`${BASE}${item.url}`, { method: "HEAD" });
  return { ...item, status: response.status, type: response.headers.get("content-type") || "" };
});
for (const result of served) {
  ok(`${result.kind}: ${result.url}`, result.status === 200 && /^image\/(webp|jpeg|png|svg\+xml)/i.test(result.type), `${result.status} ${result.type}`);
}

const additionIds = new Set(additions.entries.map((entry) => entry.id));
const stage5Puzzles = catalog.entries.filter((entry) => additionIds.has(entry.puzzleId));
ok("all 55 Stage 5 records are catalogued", stage5Puzzles.length === 55, `${stage5Puzzles.length}/55`);
ok("all 55 Stage 5 puzzles reach the API", stage5Puzzles.every((entry) => byPuzzleId.has(entry.puzzleId)));

const jigsawDifficulties = apiCatalog.difficulties.filter((difficulty) => difficulty.pieces > 0);
const matrix = [];
for (const entry of stage5Puzzles) for (const difficulty of jigsawDifficulties) matrix.push({ entry, difficulty });
const rooms = await mapLimit(matrix, 8, async ({ entry, difficulty }) => {
  const create = await request(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ puzzleId: entry.puzzleId, difficulty: difficulty.id, name: `catalog-${difficulty.id}`, sessionName: "catalog gate" }),
  });
  const body = await create.json().catch(() => ({}));
  if (!create.ok) return { entry, difficulty, status: create.status, body };
  const room = await request(`${BASE}/api/rooms/${body.room.id}`);
  return { entry, difficulty, status: create.status, body, room: room.ok ? await room.json() : null };
});
for (const result of rooms) {
  const puzzle = result.room?.puzzle;
  ok(
    `room matrix: ${result.entry.puzzleId} / ${result.difficulty.id}`,
    result.status === 200 && puzzle?.image === result.entry.fullImage && puzzle.width >= 900 && puzzle.height >= 600 && puzzle.cols > 0 && puzzle.rows > 0,
    result.status === 200 ? `${puzzle?.width}×${puzzle?.height}, ${puzzle?.cols}×${puzzle?.rows}` : String(result.status),
  );
}

const failures = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failures}/${checks.length} catalog serving checks passed`);
process.exit(failures ? 1 : 0);
