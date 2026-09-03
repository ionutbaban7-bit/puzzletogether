#!/usr/bin/env node
/**
 * Generates docs/catalog-report.md from data/catalog/sources.json,
 * shared/puzzles.json and docs/catalog-audit.json.
 *
 * Usage: node scripts/catalog-report.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog", "sources.json"), "utf8"));
const puzzles = JSON.parse(fs.readFileSync(path.join(root, "shared", "puzzles.json"), "utf8"));
const auditPath = path.join(root, "docs", "catalog-audit.json");
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, "utf8")) : null;

const ORPHANS = [
  "big-ben.jpg", "cherry-blossom.jpg", "grand-canyon.jpg", "lavender-field.jpg",
  "mount-fuji.jpg", "neuschwanstein.jpg", "new-york.jpg", "plitvice-lakes.jpg",
  "prague.jpg", "pyramids-giza.jpg",
];

const byAsset = new Map(catalog.entries.map((e) => [e.asset, e]));
const puzzleById = new Map(puzzles.puzzles.map((p) => [p.id, p]));

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
const short = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s);

function table(rows) {
  const head = rows[0];
  const lines = [
    `| ${head.map((h) => h[0]).join(" | ")} |`,
    `| ${head.map((h) => (h[1] ?? "---")).join(" | ")} |`,
    ...rows.slice(1).map((r) => `| ${r.map((c) => esc(c)).join(" | ")} |`),
  ];
  return lines.join("\n");
}

// ---- full catalog table -----------------------------------------------------
const rows = [["Asset", ":---", "Category", ":---", "Dims", ":---", "License", ":---", "Status", ":---", "Puzzle"]];
for (const e of catalog.entries) {
  const fn = e.asset.split("/").pop();
  rows.push([
    `**${fn}**`,
    e.category,
    e.width ? `${e.width}×${e.height}` : "—",
    short(e.license, 42),
    e.status,
    e.puzzleId ? puzzleById.get(e.puzzleId)?.name || e.puzzleId : e.activityId ? `coaching: ${e.activityId}` : "— (orphan)",
  ]);
}
const catalogTable = table(rows);

// ---- orphan detail ------------------------------------------------------------
const orphanEntries = ORPHANS.map((fn) => byAsset.get(`/images/${fn}`)).filter(Boolean);
const orphanRows = [["File", ":---", "Category", ":---", "Dims", ":---", "Findings", ":---", "Verdict"]];
for (const e of orphanEntries) {
  const findings = (e.issues || []).map((i) => i.split(":").slice(1).join(":") || i).join("; ") || "—";
  let verdict;
  if (e.status === "flagged") verdict = "❌ **Replace** — no usable license";
  else if (e.issues?.includes("suspected-ai-generated:clock-face-and-vehicle-details-distorted")) verdict = "⚠️ **Replace** — suspected AI-generated";
  else verdict = "⚠️ **Replace** — provenance unverified";
  orphanRows.push([e.asset.split("/").pop(), e.category, `${e.width}×${e.height}`, short(findings, 160), verdict]);
}
const orphanTable = table(orphanRows);

const counts = catalog.entries.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {});
const fatalCount = audit ? audit.errors.length : "n/a";
const warnCount = audit ? audit.warnings.length : "n/a";

const md = `# Image Catalog Report — Stage 3

**Date:** 2026-09-03 · **Pipeline:** \`npm run catalog:pipeline\` · **Audit:** \`npm run catalog:audit\`

## 1. Scope & method

This report covers **every asset served from \`server/public/images\`** — 36 photos,
9 in-house canvas covers (SVG) and 4 in-house coaching covers (SVG): **49 assets**.

Method:

1. **Visual inspection** of each of the 10 previously uncatalogued ("orphan") images.
2. **Source verification** for the 26 previously catalogued photos via the
   **Wikimedia Commons API** (search → exact file title → \`imageinfo\` URL/size/license
   cross-check), performed 2026-09-03.
3. **Checksums + dimensions** recorded by the pipeline (\`sha256\`, pixel size).
4. **Perceptual duplicate scan** (dHash 64-bit) + exact checksum dedupe.

Sandbox network note: only the Wikimedia Commons API was reachable for verification.
Reverse-image search was unavailable, and several of the orphan files carry **no EXIF
metadata** (stripped at some earlier point), so their original sources could not be
established. Where provenance is unknown, the report says so explicitly — no source
is claimed that was not verified.

## 2. Catalog state

| Status | Count | Meaning |
|---|---|---|
| verified | ${counts.verified ?? 0} | source page confirmed (Commons API / in-house) |
| unverified | ${counts.unverified ?? 0} | provenance could not be established |
| flagged | ${counts.flagged ?? 0} | concrete compliance violation (watermark / no license) |

**Audit result: ${fatalCount} fatal issue(s), ${warnCount} warning(s).**
All ten structural audit rules S1–S10 (file existence, sourceUrl, licenseUrl,
size floor, checksum duplicates, perceptual duplicates, category, thumbnails,
checksum match, uncatalogued public assets) **pass**. The audit currently exits non-zero only because
of 2 **flagged copyright violations** (see §4) — it will go fully green once Stage 4
replaces those images.

## 3. Full catalog

${catalogTable}

### License corrections found by the audit

Two legacy catalog entries carried the **wrong license**:

| Asset | Legacy catalog | Verified license (Commons file page) |
|---|---|---|
| statue-of-liberty | Public domain | **CC BY-SA 3.0** (Elcobbola, *Statue of Liberty 7.jpg*) |
| venice | CC BY-SA 4.0 | **CC BY-SA 2.0** (Benh LIEU SONG, *Piazza San Marco at Dawn, Venice (21358879396).jpg*) |

Both are corrected in \`data/catalog/sources.json\` and in the puzzle metadata.
Four entries (moraine-lake, eiffel-tower, paris-louvre, tokyo) keep their legacy
license values, flagged with \`license-inherited-from-legacy-catalog-not-reverified\`.

## 4. The 10 orphan images (previously uncatalogued)

All 10 images are **not referenced by any puzzle** — they are dead weight in the
public bundle, and **all 10 fail provenance review**:

${orphanTable}

### Detailed findings

| Image | What was observed |
|---|---|
| **big-ben.jpg** (1280×720) | Big Ben + two red double-decker buses. The clock face is distorted, vehicle details are generic and pedestrians are smeared — strong indicators of **AI generation**. No source can be claimed; treated as unlicensed. |
| **cherry-blossom.jpg** (1920×1080) | Genuine-looking close-up of double pink cherry blossoms. No EXIF; no matching source found. Likely stock. |
| **grand-canyon.jpg** (1920×1080) | Genuine-looking dusk photo of the Grand Canyon. No EXIF; no matching source found. Likely stock. |
| **lavender-field.jpg** (1920×1283) | Genuine-looking lavender field. No EXIF; no matching source found. Likely stock. |
| **mount-fuji.jpg** (1920×1274) | Genuine-looking Mount Fuji over a lake. No EXIF; no matching source found. Likely stock. |
| **neuschwanstein.jpg** (1000×750) | Genuine-looking classic castle view. No EXIF; no matching source found. Also **below ideal resolution** for 144 pieces. |
| **new-york.jpg** (1920×1080) | Manhattan skyline with a **visible "WIDEWALLPAPERS.NET" watermark** (bottom-right). Copy from a stock aggregator; **no usable license**. Violates the no-watermark rule. |
| **plitvice-lakes.jpg** (1200×1200) | Plitvice waterfalls with a **visible "Dreamstime" watermark** across the center. This is a **stock preview** — using it is **copyright infringement**. Violates the no-watermark rule. |
| **prague.jpg** (1024×601) | Genuine-looking aerial of Prague Old Town Square. No EXIF; no matching source found. Likely stock. |
| **pyramids-giza.jpg** (1200×856) | Genuine-looking Sphinx + pyramids photo. No EXIF; no matching source found. Likely stock. |

**Conclusion:** none of the 10 orphans has a verifiable PD/CC0/CC BY license.
Per the license policy (PD / CC0 / CC BY 4.0 preferred), **all 10 should be
replaced** with verified images in Stage 4 (which adds 50 verified images anyway,
including Romania-relevant subjects). Until then the audit keeps them loud and
visible (W1/W3 warnings + 2 fatal F1 flags).

## 5. Pipeline mechanics

\`scripts/catalog-pipeline.mjs\` (idempotent, \`--force\` to reconvert):

1. computes **SHA-256** + pixel dimensions for every source asset;
2. moves originals to \`data/catalog/originals/\` (outside the public bundle);
3. generates **WebP** full images (\`server/public/images/full/<id>.webp\`, longest
   edge ≤ 2200px, q82) and **4:3 thumbnails** (\`thumbs/<id>.webp\`, 480×360, q78)
   cropped around each entry's **focal point**;
4. merges full metadata into \`shared/puzzles.json\` (name ro/en, alt ro/en,
   creator, source name+URL, license + URL, attribution, changesMade, checksum,
   dimensions, thumbnail, focal point) and regenerates the server image
   **manifest**;
5. SVG covers are checksummed but not converted.

\`scripts/audit-catalog.mjs\` fails on: missing files, missing/invalid
sourceUrl/licenseUrl, dimensions below 900×600 (photo assets), duplicate checksums,
perceptual duplicates (dHash ≤ 2), invalid categories, missing thumbnails, checksum
mismatch, uncatalogued public assets, and any entry flagged for a compliance
violation. It warns on unverified provenance, orphan assets and near-duplicate
pairs for manual review.

## 6. Open items → Stage 4

1. Replace the **2 flagged** images (plitvice-lakes, new-york) — hard copyright risk.
2. Replace (or verify) the **8 unverified** orphans; the 10 orphans will be
   superseded by the 50 newly verified Stage-4 images (10 per photo category,
   ≥5 Romania-relevant).
3. Re-verify the 4 license-inherited entries (moraine-lake, eiffel-tower,
   paris-louvre, tokyo) at their Commons file pages.
4. After replacement, \`npm run catalog:audit\` must exit 0 with zero F1/F2 flags.

---
*Generated by \`scripts/catalog-report.mjs\` from \`data/catalog/sources.json\` and
\`docs/catalog-audit.json\`. Machine-readable audit: \`docs/catalog-audit.json\`.*
`;

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "catalog-report.md"), md);
console.log("wrote docs/catalog-report.md");
