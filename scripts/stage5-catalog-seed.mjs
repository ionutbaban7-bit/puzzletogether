#!/usr/bin/env node
/**
 * Import the reviewed Stage 5 original sources into the normal catalog pipeline.
 *
 * It intentionally accepts no partial catalog: all 55 generated source PNGs
 * must be present and have `generation.visualReview` marked passed. Each raw
 * PNG is converted to a compact quality-95 archival JPEG in the temporary
 * public import location. `catalog-pipeline` then moves that JPEG to
 * data/catalog/originals and creates the public WebP derivatives.
 *
 * Usage: node scripts/stage5-catalog-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const additionsPath = path.join(root, "data/catalog/stage5-additions.json");
const catalogPath = path.join(root, "data/catalog/sources.json");
const puzzlesPath = path.join(root, "shared/puzzles.json");
const incomingDir = path.join(root, "data/catalog/incoming");
const publicImagesDir = path.join(root, "server/public/images");

const categories = {
  "isometric-worlds": { name: "Isometric Worlds", icon: "isometric-worlds" },
  "abstract-geometry": { name: "Abstract Geometry", icon: "abstract-geometry" },
  "blueprint-architecture": { name: "Blueprint Architecture", icon: "blueprint-architecture" },
};
const expectedCounts = {
  paintings: 5, landscapes: 5, landmarks: 5, nature: 5, cities: 5,
  "isometric-worlds": 10, "abstract-geometry": 10, "blueprint-architecture": 10,
};
const rawHash = (file) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
const sourceFileFor = (entry) => {
  const png = path.join(incomingDir, `${entry.id}.png`);
  const jpg = path.join(incomingDir, `${entry.id}.jpg`);
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(jpg)) return jpg;
  return null;
};
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };

const additions = json(additionsPath);
const listedCounts = Object.fromEntries(Object.keys(expectedCounts).map((category) => [
  category,
  additions.entries.filter((entry) => entry.category === category).length,
]));
for (const [category, expected] of Object.entries(expectedCounts)) {
  if (listedCounts[category] !== expected) fail(`expected ${expected} ${category} additions; found ${listedCounts[category] || 0}`);
}
if (additions.entries.length !== 55) fail(`expected 55 additions; found ${additions.entries.length}`);

for (const entry of additions.entries) {
  const raw = sourceFileFor(entry);
  if (!raw) fail(`missing generated source: data/catalog/incoming/${entry.id}.{png,jpg}`);
  if (!entry.generation?.visualReview?.startsWith("passed")) {
    fail(`${entry.id} has not passed visual review (set generation.visualReview after inspection)`);
  }
}

const catalog = json(catalogPath);
const puzzles = json(puzzlesPath);
const legacyOrphans = new Set([
  "big-ben", "cherry-blossom", "grand-canyon", "lavender-field", "mount-fuji",
  "neuschwanstein", "new-york", "plitvice-lakes", "prague", "pyramids-giza",
]);
// These ten files are neither in the activity library nor eligible catalog
// sources. Remove their records before the normal pipeline regenerates its
// public manifest, so the two previously flagged files cannot reappear.
for (const puzzle of puzzles.puzzles) {
  if (legacyOrphans.has(puzzle.id)) fail(`legacy orphan unexpectedly referenced by puzzle ${puzzle.id}`);
}
const removedLegacy = catalog.entries.filter((entry) => legacyOrphans.has(path.basename(entry.asset, path.extname(entry.asset))));
catalog.entries = catalog.entries.filter((entry) => !legacyOrphans.has(path.basename(entry.asset, path.extname(entry.asset))));
for (const entry of removedLegacy) {
  const id = path.basename(entry.asset, path.extname(entry.asset));
  for (const file of [
    path.join(root, "data/catalog/originals", path.basename(entry.asset)),
    path.join(publicImagesDir, path.basename(entry.asset)),
    path.join(publicImagesDir, "full", `${id}.webp`),
    path.join(publicImagesDir, "thumbs", `${id}.webp`),
  ]) fs.rmSync(file, { force: true });
}
const knownCatalogAssets = new Set(catalog.entries.map((entry) => entry.asset));
const knownPuzzleIds = new Set(puzzles.puzzles.map((puzzle) => puzzle.id));
fs.mkdirSync(publicImagesDir, { recursive: true });

for (const [id, category] of Object.entries(categories)) {
  if (!puzzles.categories.some((item) => item.id === id)) puzzles.categories.push({ id, ...category });
}

for (const addition of additions.entries) {
  const raw = sourceFileFor(addition);
  if (!raw) fail(`missing generated source: ${addition.id}`);
  const asset = `/images/${addition.id}.jpg`;
  const importFile = path.join(publicImagesDir, `${addition.id}.jpg`);
  const rawInputChecksum = rawHash(raw);
  const rawExtension = path.extname(raw).toLowerCase();
  const rawFilename = path.basename(raw);

  // JPEG is only an archival format conversion of our own generated source;
  // it is intentionally high quality, and the source checksum remains recorded.
  if (rawExtension === ".jpg" || rawExtension === ".jpeg") fs.copyFileSync(raw, importFile);
  else execFileSync("convert", [raw, "-auto-orient", "-strip", "-quality", "95", importFile], { stdio: "pipe" });
  if (!fs.existsSync(importFile) || fs.statSync(importFile).size === 0) fail(`could not import ${addition.id}`);

  if (!knownCatalogAssets.has(asset)) {
    catalog.entries.push({
      asset,
      category: addition.category,
      activityId: null,
      puzzleId: addition.id,
      name: addition.name,
      alt: addition.alt,
      creator: "PuzzleTogether original",
      sourceName: "PuzzleTogether original catalog",
      sourceUrl: "https://github.com/ionutbaban7-bit/puzzletogether/blob/arena/01a06746-puzzletogether/docs/catalog-originals.md#stage-5-originals",
      license: "CC0 1.0 Universal",
      licenseClass: "cc0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      attribution: "PuzzleTogether original — CC0 1.0",
      changesMade: "Original source imported as a quality-95 archival JPEG, then optimized to WebP full image and thumbnail.",
      downloadedAt: "2026-09-03",
      originalFilename: `${rawFilename} (original source; archived as ${addition.id}.jpg)`,
      focalPoint: addition.focalPoint,
      status: "verified",
      issues: [],
      generation: {
        ...addition.generation,
        prompt: addition.prompt,
        rawInputChecksum,
        archive: `data/catalog/originals/${addition.id}.jpg (quality-95 archival derivative)`,
      },
    });
    knownCatalogAssets.add(asset);
  }

  if (!knownPuzzleIds.has(addition.id)) {
    puzzles.puzzles.push({
      id: addition.id,
      category: addition.category,
      name: addition.name.en,
      nameRo: addition.name.ro,
      image: asset,
      credit: "PuzzleTogether original — CC0 1.0",
      license: "CC0 1.0",
      source: "PuzzleTogether original",
      attribution: "PuzzleTogether original — CC0 1.0",
      sourceName: "PuzzleTogether original catalog",
      sourceUrl: "https://github.com/ionutbaban7-bit/puzzletogether/blob/arena/01a06746-puzzletogether/docs/catalog-originals.md#stage-5-originals",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      changesMade: "Original artwork archived and optimized by the catalog pipeline.",
      originalFilename: rawFilename,
      focalPoint: addition.focalPoint,
    });
    knownPuzzleIds.add(addition.id);
  }
}

catalog.stage5ImportedAt = "2026-09-03";
write(catalogPath, catalog);
write(puzzlesPath, puzzles);
console.log(`✓ Seeded ${additions.entries.length} reviewed originals; delisted ${removedLegacy.length} legacy orphan assets. Next run: npm run catalog:pipeline -- --force`);
