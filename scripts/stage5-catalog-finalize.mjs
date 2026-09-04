#!/usr/bin/env node
/** Remove raw import PNGs only after a complete Stage 5 pipeline import. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const additions = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/stage5-additions.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/sources.json"), "utf8"));
const puzzles = JSON.parse(fs.readFileSync(path.join(root, "shared/puzzles.json"), "utf8"));
const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };

if (additions.entries.some((entry) => ["isometric-worlds", "abstract-geometry"].includes(entry.category))) {
  fail("this historical Stage 5 manifest contains retired repetitive categories. Do not finalize/re-import it.");
}

for (const addition of additions.entries) {
  const entry = catalog.entries.find((item) => item.puzzleId === addition.id);
  const puzzle = puzzles.puzzles.find((item) => item.id === addition.id);
  if (!entry || entry.status !== "verified" || entry.licenseClass !== "cc0") fail(`catalog record is incomplete: ${addition.id}`);
  if (!entry.checksum || !entry.fullImage || !entry.thumbnail) fail(`pipeline did not finish: ${addition.id}`);
  if (!fs.existsSync(path.join(root, "server/public", entry.fullImage))) fail(`missing full image: ${addition.id}`);
  if (!fs.existsSync(path.join(root, "server/public", entry.thumbnail))) fail(`missing thumbnail: ${addition.id}`);
  if (!puzzle || puzzle.image !== entry.fullImage) fail(`puzzle linkage is incomplete: ${addition.id}`);
}
for (const addition of additions.entries) {
  fs.rmSync(path.join(root, "data/catalog/incoming", `${addition.id}.png`), { force: true });
  fs.rmSync(path.join(root, "data/catalog/incoming", `${addition.id}.jpg`), { force: true });
}
console.log(`✓ Finalized ${additions.entries.length} Stage 5 sources; temporary raw imports removed after verified archival import.`);
