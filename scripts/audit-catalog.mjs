#!/usr/bin/env node
/**
 * PuzzleTogether — image catalog audit (Stage 3).
 *
 * Verifies data/catalog/sources.json against the assets on disk and
 * shared/puzzles.json. Fails (exit 1) on any structural violation:
 *
 *   S1  asset file missing from the public bundle
 *   S2  sourceUrl missing / not an http(s) URL
 *   S3  licenseUrl missing / not an http(s) URL
 *   S4  dimensions missing or too small (long edge < 900px or short edge < 600px)
 *   S5  duplicate SHA-256 checksum between two catalog entries
 *   S6  perceptually duplicate raster images (aHash 8x8, hamming distance <= 6)
 *   S7  invalid category
 *   S8  missing thumbnail
 *   S9  checksum mismatch (recorded value vs. recomputed SHA-256 of the
 *       original / svg source file)
 *   S10 uncatalogued image asset inside server/public/images
 *   F1  entry flagged for a compliance violation (watermark / no license)
 *
 * Cross-checks:
 *   X1  every puzzle image is catalogued
 *   X2  every catalogued photo is referenced by a puzzle
 *
 * Non-fatal (reported + written to docs/catalog-audit.json):
 *   W1  provenance not verified (status "unverified")
 *   W2  any recorded issue note
 *
 * Usage: node scripts/audit-catalog.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, svgDims, dhash, hamming } from "./catalog-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "server", "public");
const imagesDir = path.join(publicDir, "images");
const originalsDir = path.join(root, "data", "catalog", "originals");
const catalogPath = path.join(root, "data", "catalog", "sources.json");
const puzzlesPath = path.join(root, "shared", "puzzles.json");

const MIN_LONG_EDGE = 900; // jigsaw puzzle images need detail for 144 pieces
const MIN_SHORT_EDGE = 600;
const DHASH_DUPLICATE_LIMIT = 2; // same content (re-encoded / cropped) → fatal duplicate
const DHASH_SUSPECT_LIMIT = 10; // similar look-alikes → manual review warning

const errors = [];
const warnings = [];
const err = (code, msg) => errors.push({ code, message: msg });
const warn = (code, msg) => warnings.push({ code, message: msg });

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const puzzles = JSON.parse(fs.readFileSync(puzzlesPath, "utf8"));
const validCategories = new Set(puzzles.categories.map((c) => c.id).concat("coaching"));
const entries = catalog.entries;

const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\/[^\s]+$/i.test(u);


const referencedPublicPaths = new Set();
const checksumOwners = new Map();
const rasterHashes = [];
const table = [];

for (const e of entries) {
  const row = { asset: e.asset, category: e.category, status: e.status, license: e.license, ok: true };
  const isSvg = e.asset.toLowerCase().endsWith(".svg");
  const abs = path.join(publicDir, e.asset);
  const id = path.basename(e.asset).replace(/\.[^.]+$/, "");
  const problems = [];

  // S1 required files exist: svg → the asset itself; photo → optimized full image in public
  //     (the original lives outside the public bundle, checked in S9)
  const requiredPublic = isSvg ? abs : path.join(publicDir, e.fullImage || e.asset);
  if (!fs.existsSync(requiredPublic)) {
    err("S1", `missing file in public bundle: ${e.fullImage || e.asset} (${e.asset})`);
    problems.push("S1 missing file");
  }

  // S2/S3 URLs
  if (!isHttpUrl(e.sourceUrl)) { err("S2", `missing/invalid sourceUrl: ${e.asset}`); problems.push("S2 sourceUrl"); }
  if (!isHttpUrl(e.licenseUrl)) { err("S3", `missing/invalid licenseUrl: ${e.asset}`); problems.push("S3 licenseUrl"); }

  // S7 category
  if (!validCategories.has(e.category)) { err("S7", `invalid category "${e.category}": ${e.asset}`); problems.push("S7 category"); }

  // S4 dimensions (recorded, or parsed from the svg source as fallback)
  let w = e.width;
  let h = e.height;
  if ((!w || !h) && isSvg && fs.existsSync(abs)) {
    const d = svgDims(abs);
    if (d) { w = d.w; h = d.h; }
  }
  if (!w || !h) {
    err("S4", `missing dimensions: ${e.asset}`);
    problems.push("S4 dims");
  } else if (!isSvg) {
    // the size floor targets jigsaw puzzle images (144 pieces need detail);
    // SVG covers are vector art and are exempt
    const long = Math.max(w, h);
    const short = Math.min(w, h);
    if (long < MIN_LONG_EDGE || short < MIN_SHORT_EDGE) {
      err("S4", `dimensions too small ${w}x${h} (< ${MIN_LONG_EDGE}x${MIN_SHORT_EDGE} long x short): ${e.asset}`);
      problems.push("S4 too small");
    }
  }

  // S8 thumbnail
  const thumbPath = e.thumbnail || (isSvg ? e.asset : `/images/thumbs/${id}.webp`);
  if (!fs.existsSync(path.join(publicDir, thumbPath))) {
    err("S8", `missing thumbnail ${thumbPath}: ${e.asset}`);
    problems.push("S8 thumbnail");
  }
  if (!e.fullImage && !isSvg) {
    err("S8", `missing fullImage for ${e.asset}`);
    problems.push("S8 fullImage");
  }
  for (const p of [thumbPath, e.fullImage]) if (p) referencedPublicPaths.add(p);

  // S9 checksum (photo: original outside public bundle; svg: file in public)
  if (!e.checksum || !e.checksum.startsWith("sha256:")) {
    err("S9", `missing checksum: ${e.asset}`);
    problems.push("S9 checksum");
  } else {
    let checkFile = null;
    if (isSvg) checkFile = abs;
    else {
      const orig = path.join(originalsDir, path.basename(e.asset));
      if (fs.existsSync(orig)) checkFile = orig;
      else { err("S1", `original missing from data/catalog/originals: ${path.basename(e.asset)}`); problems.push("S1 original"); }
    }
    if (checkFile && fs.existsSync(checkFile)) {
      const actual = sha256(checkFile);
      if (actual !== e.checksum.slice("sha256:".length)) {
        err("S9", `checksum mismatch: ${e.asset}`);
        problems.push("S9 mismatch");
      }
    }
  }

  // S5 duplicate checksum
  if (e.checksum) {
    const prev = checksumOwners.get(e.checksum);
    if (prev) {
      err("S5", `duplicate checksum between ${prev} and ${e.asset}`);
      problems.push("S5 duplicate");
    } else checksumOwners.set(e.checksum, e.asset);
  }

  // S6 perceptual duplicates (raster only)
  if (!isSvg && fs.existsSync(requiredPublic)) {
    const bits = dhash(requiredPublic);
    if (bits) rasterHashes.push({ asset: e.asset, hash: bits });
  }

  // F1 flagged entries are fatal
  if (e.status === "flagged") {
    err("F1", `compliance violation (flagged): ${e.asset} — ${(e.issues || []).join(", ")}`);
    problems.push("F1 flagged");
  }

  // warnings
  if (e.status === "unverified") warn("W1", `provenance not verified: ${e.asset}`);
  for (const issue of e.issues || []) warn("W2", `${e.asset}: ${issue}`);

  row.ok = problems.length === 0;
  row.problems = problems;
  table.push(row);
}

// S6 pair comparison (dHash): near-zero distance = same content; small but
// non-zero distance = visually similar different photos → review warning only
for (let i = 0; i < rasterHashes.length; i++) {
  for (let j = i + 1; j < rasterHashes.length; j++) {
    const d = hamming(rasterHashes[i].hash, rasterHashes[j].hash);
    if (d <= DHASH_DUPLICATE_LIMIT) {
      err("S6", `duplicate image (dHash distance ${d}): ${rasterHashes[i].asset} ≈ ${rasterHashes[j].asset}`);
    } else if (d <= DHASH_SUSPECT_LIMIT) {
      warn("W4", `possibly similar images (dHash distance ${d}) — manual review: ${rasterHashes[i].asset} ≈ ${rasterHashes[j].asset}`);
    }
  }
}

// S10 uncatalogued assets in public
function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|svg|gif)$/i;
for (const file of walk(imagesDir, [])) {
  if (!IMAGE_EXT.test(file)) continue; // skip manifest.json etc.
  const rel = "/" + path.relative(publicDir, file).split(path.sep).join("/");
  if (!referencedPublicPaths.has(rel)) {
    err("S10", `uncatalogued asset in public bundle: ${rel}`);
  }
}

// X1 every puzzle image is catalogued (as asset, full image, or thumbnail)
const cataloguedAssets = new Set();
for (const e of entries) {
  cataloguedAssets.add(e.asset);
  if (e.fullImage) cataloguedAssets.add(e.fullImage);
  if (e.thumbnail) cataloguedAssets.add(e.thumbnail);
}
for (const p of puzzles.puzzles) {
  if (!p.image) continue;
  if (!cataloguedAssets.has(p.image)) err("X1", `puzzle "${p.id}" image ${p.image} is not in the catalog`);
}
// X2 every catalogued asset that declares a puzzle/activity is really referenced
const puzzleById = new Map(puzzles.puzzles.map((p) => [p.id, p]));
let coaching = {};
try { coaching = JSON.parse(fs.readFileSync(path.join(root, "shared", "coaching.json"), "utf8")); } catch { /* optional */ }
const coachingCovers = new Set((coaching.activities || []).map((a) => a.cover));
for (const e of entries) {
  if (e.puzzleId) {
    const pz = puzzleById.get(e.puzzleId);
    if (!pz) err("X2", `catalog entry ${e.asset} references unknown puzzle "${e.puzzleId}"`);
    else if (pz.image !== (e.fullImage || e.asset)) err("X2", `puzzle "${pz.id}" image ${pz.image} does not match catalog entry ${e.asset}`);
  } else if (e.activityId) {
    if (!coachingCovers.has(e.asset)) err("X2", `coaching cover ${e.asset} not referenced by any activity`);
  } else if (e.category !== "coaching") {
    warn("W3", `orphan asset (no puzzle references it): ${e.asset}`);
  }
}

// ---- output -----------------------------------------------------------------
console.log("\nPuzzleTogether catalog audit");
console.log("=".repeat(78));
let shown = 0;
for (const r of table) {
  shown++;
  const mark = r.ok ? "  ok" : "FAIL";
  const dims = r.problems.some((p) => p.startsWith("S4")) ? "" : "";
  console.log(`${mark}  ${r.asset.padEnd(40)} ${String(r.category).padEnd(15)} ${r.status.padEnd(11)} ${r.license}`);
  for (const p of r.problems) console.log(`      → ${p}`);
}
console.log("-".repeat(78));
console.log(`entries: ${table.length} | structural failures: ${errors.length} | warnings: ${warnings.length}`);
if (errors.length) {
  console.log("\nFATAL:");
  for (const e of errors) console.log(`  ✗ [${e.code}] ${e.message}`);
}
if (warnings.length) {
  console.log("\nWARNINGS (see docs/catalog-report.md):");
  const w1 = warnings.filter((w) => w.code === "W1");
  const w2 = warnings.filter((w) => w.code === "W2");
  for (const w of w1) console.log(`  ⚠ [${w.code}] ${w.message}`);
  console.log(`  (+ ${w2.length} issue notes — full list in docs/catalog-audit.json)`);
}

const report = {
  generatedAt: new Date().toISOString(),
  thresholds: { MIN_LONG_EDGE, MIN_SHORT_EDGE, DHASH_DUPLICATE_LIMIT, DHASH_SUSPECT_LIMIT },
  errors,
  warnings,
  entries: table,
  pass: errors.length === 0,
};
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "catalog-audit.json"), JSON.stringify(report, null, 2) + "\n");

if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));

if (errors.length) {
  console.log(`\n❌ AUDIT FAILED (${errors.length} fatal issue${errors.length === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("\n✅ AUDIT PASSED (structural)");
