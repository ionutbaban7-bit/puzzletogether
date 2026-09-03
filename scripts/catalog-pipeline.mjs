#!/usr/bin/env node
/**
 * PuzzleTogether — image catalog pipeline (Stage 3).
 *
 * For every asset listed in data/catalog/sources.json:
 *   1. compute the SHA-256 checksum + pixel dimensions of the source file
 *   2. move the original out of the public bundle (data/catalog/originals/)
 *   3. generate optimized WebP full images (server/public/images/full/)
 *      and 480x360 WebP thumbnails (server/public/images/thumbs/),
 *      cropping thumbnails around the entry's focal point
 *   4. merge full catalog metadata into shared/puzzles.json
 *      (name.ro/en, alt, creator, source, license, attribution,
 *       changesMade, checksum, width, height, thumbnail, focalPoint)
 *   5. regenerate server/public/images/manifest.json (server imageDims fallback)
 *
 * SVG covers (canvas + coaching) are catalogued with their checksum but
 * are NOT converted.
 *
 * Usage: node scripts/catalog-pipeline.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sha256, identifyRaster, svgDims } from "./catalog-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "server", "public");
const imagesDir = path.join(publicDir, "images");
const originalsDir = path.join(root, "data", "catalog", "originals");
const fullDir = path.join(imagesDir, "full");
const thumbsDir = path.join(imagesDir, "thumbs");
const catalogPath = path.join(root, "data", "catalog", "sources.json");
const puzzlesPath = path.join(root, "shared", "puzzles.json");

const force = process.argv.includes("--force");
const FULL_MAX_EDGE = 2200; // longest edge of the optimized full image
const FULL_Q = 82;
const THUMB_W = 480;
const THUMB_H = 360;
const THUMB_Q = 78;

const log = (m) => console.log(m);
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };


function convert(args, out) {
  execFileSync("convert", args, { stdio: "pipe" });
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`convert failed: ${out}`);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const puzzles = JSON.parse(fs.readFileSync(puzzlesPath, "utf8"));
const validCategories = new Set(puzzles.categories.map((c) => c.id).concat("coaching"));

for (const dir of [originalsDir, fullDir, thumbsDir]) fs.mkdirSync(dir, { recursive: true });

const manifest = {};
const summary = { converted: 0, untouched: 0, skipped: 0, failed: 0 };

// index entries by asset basename so puzzles can be matched by filename
const byAsset = new Map();
for (const e of catalog.entries) byAsset.set(e.asset, e);

for (const e of catalog.entries) {
  const isSvg = e.asset.toLowerCase().endsWith(".svg");
  const abs = path.join(publicDir, e.asset);
  if (isSvg && !fs.existsSync(abs)) {
    console.log(`  ✗ missing source asset: ${e.asset}`);
    summary.failed++;
    continue;
  }
  if (!validCategories.has(e.category)) {
    console.log(`  ✗ invalid category "${e.category}" for ${e.asset}`);
    summary.failed++;
    continue;
  }
  const id = path.basename(e.asset).replace(/\.[^.]+$/, "");
  // dimensions: live file, else the archived original (processed photos)
  const originalsDirProbe = path.join(originalsDir, path.basename(e.asset));
  const dimFile = fs.existsSync(abs) ? abs : fs.existsSync(originalsDirProbe) ? originalsDirProbe : null;
  const dims = isSvg ? svgDims(abs) : dimFile ? identifyRaster(dimFile) : null;
  if (dims) { e.width = dims.w; e.height = dims.h; }

  if (isSvg) {
    const recorded = (e.checksum || "").replace(/^sha256:/, "");
    const hash = sha256(abs);
    if (recorded && recorded !== hash) {
      console.log(`  ⚠ checksum changed for ${e.asset} (re-recording)`);
    }
    e.checksum = `sha256:${hash}`;
    e.thumbnail = e.asset;
    e.fullImage = e.asset;
    manifest[path.basename(e.asset)] = dims || { w: 0, h: 0 };
    summary.skipped++;
    log(`  • svg   ${e.asset}  ${dims ? dims.w + "x" + dims.h : "?"}  ${hash.slice(0, 12)}…`);
    continue;
  }

  const originalName = path.basename(e.asset);
  const originalDest = path.join(originalsDir, originalName);
  const fullDest = path.join(fullDir, `${id}.webp`);
  const thumbDest = path.join(thumbsDir, `${id}.webp`);

  // source file: the public asset (not yet processed) or the archived original
  const sourceFile = fs.existsSync(abs) ? abs : fs.existsSync(originalDest) ? originalDest : null;
  if (!sourceFile) {
    console.log(`  ✗ missing source asset: ${e.asset} (and no archived original)`);
    summary.failed++;
    continue;
  }
  const hash = sha256(sourceFile);
  const recorded = e.checksum || "";

  const upToDate =
    !force &&
    recorded === `sha256:${hash}` &&
    fs.existsSync(fullDest) &&
    fs.existsSync(thumbDest) &&
    fs.existsSync(originalDest);

  if (upToDate) {
    summary.untouched++;
    log(`  = ok    ${e.asset} (already processed)`);
  } else {
    try {
      // 1) keep the original outside the public bundle
      if (!fs.existsSync(originalDest) || force) fs.copyFileSync(sourceFile, originalDest);
      // 2) optimized full image (aspect-preserving)
      convert([
        sourceFile,
        "-resize", `${FULL_MAX_EDGE}x${FULL_MAX_EDGE}>`,
        "-quality", String(FULL_Q),
        fullDest,
      ], fullDest);
      // 3) thumbnail: crop a 4:3 window around the focal point, then downscale
      const [fx, fy] = Array.isArray(e.focalPoint) ? e.focalPoint : [0.5, 0.5];
      const imgW = dims.w;
      const imgH = dims.h;
      const targetAspect = THUMB_W / THUMB_H;
      let cw, ch;
      if (imgW / imgH > targetAspect) { ch = imgH; cw = Math.min(imgW, Math.round(imgH * targetAspect)); }
      else { cw = imgW; ch = Math.min(imgH, Math.round(imgW / targetAspect)); }
      const x0 = Math.max(0, Math.min(imgW - cw, Math.round(imgW * fx - cw / 2)));
      const y0 = Math.max(0, Math.min(imgH - ch, Math.round(imgH * fy - ch / 2)));
      convert([
        sourceFile,
        "-crop", `${cw}x${ch}+${x0}+${y0}`,
        "+repage",
        "-resize", `${THUMB_W}x${THUMB_H}>`,
        "-quality", String(THUMB_Q),
        thumbDest,
      ], thumbDest);
      // 4) remove the source from the public bundle
      if (fs.existsSync(abs)) fs.rmSync(abs);
      e.checksum = `sha256:${hash}`;
      e.fullImage = `/images/full/${id}.webp`;
      e.thumbnail = `/images/thumbs/${id}.webp`;
      summary.converted++;
      log(`  ✓ conv  ${e.asset} → full/${id}.webp + thumbs/${id}.webp  ${dims ? dims.w + "x" + dims.h : "?"}  ${hash.slice(0, 12)}…`);
    } catch (err) {
      console.log(`  ✗ convert failed for ${e.asset}: ${err.message}`);
      summary.failed++;
    }
  }

  if (e.fullImage && e.width && e.height) manifest[path.basename(e.fullImage)] = { w: e.width, h: e.height };
}

// ---- merge metadata into shared/puzzles.json -------------------------------
const entriesByFilename = new Map();
for (const e of catalog.entries) entriesByFilename.set(path.basename(e.asset), e);

let touched = 0;
for (const p of puzzles.puzzles) {
  if (!p.image) continue;
  const fn = path.basename(p.image);
  const e = entriesByFilename.get(fn);
  if (!e) continue;
  if (e.fullImage) p.image = e.fullImage;
  p.nameRo = e.name.ro;
  p.alt = e.alt;
  p.attribution = e.attribution;
  p.sourceName = e.sourceName;
  p.sourceUrl = e.sourceUrl;
  p.licenseUrl = e.licenseUrl;
  p.changesMade = e.changesMade;
  p.originalFilename = e.originalFilename;
  p.checksum = e.checksum || null;
  p.focalPoint = e.focalPoint;
  // legacy fields (still used by CreateRoom card + jigsaw attribution line)
  p.credit = e.attribution;
  p.license = e.license;
  p.source = e.sourceName;
  touched++;
}

// coaching activities get the same metadata (covers only)
fs.writeFileSync(puzzlesPath, JSON.stringify(puzzles, null, 2) + "\n");
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
fs.writeFileSync(path.join(imagesDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

log(`\nPipeline done: ${summary.converted} converted, ${summary.untouched} up-to-date, ${summary.skipped} svg untouched, ${summary.failed} failed.`);
log(`Puzzles updated: ${touched}. Manifest entries: ${Object.keys(manifest).length}.`);
if (summary.failed > 0) process.exit(1);
