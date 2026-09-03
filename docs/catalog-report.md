# Image Catalog Report — Stage 3

**Date:** 2026-09-03 · **Pipeline:** `npm run catalog:pipeline` · **Audit:** `npm run catalog:audit`

## 1. Scope & method

This report covers **every asset served from `server/public/images`** — 36 photos,
9 in-house canvas covers (SVG) and 4 in-house coaching covers (SVG): **49 assets**.

Method:

1. **Visual inspection** of each of the 10 previously uncatalogued ("orphan") images.
2. **Source verification** for the 26 previously catalogued photos via the
   **Wikimedia Commons API** (search → exact file title → `imageinfo` URL/size/license
   cross-check), performed 2026-09-03.
3. **Checksums + dimensions** recorded by the pipeline (`sha256`, pixel size).
4. **Perceptual duplicate scan** (dHash 64-bit) + exact checksum dedupe.

Sandbox network note: only the Wikimedia Commons API was reachable for verification.
Reverse-image search was unavailable, and several of the orphan files carry **no EXIF
metadata** (stripped at some earlier point), so their original sources could not be
established. Where provenance is unknown, the report says so explicitly — no source
is claimed that was not verified.

## 2. Catalog state

| Status | Count | Meaning |
|---|---|---|
| verified | 39 | source page confirmed (Commons API / in-house) |
| unverified | 8 | provenance could not be established |
| flagged | 2 | concrete compliance violation (watermark / no license) |

**Audit result: 2 fatal issue(s), 56 warning(s).**
All ten structural audit rules S1–S10 (file existence, sourceUrl, licenseUrl,
size floor, checksum duplicates, perceptual duplicates, category, thumbnails,
checksum match, uncatalogued public assets) **pass**. The audit currently exits non-zero only because
of 2 **flagged copyright violations** (see §4) — it will go fully green once Stage 4
replaces those images.

## 3. Full catalog

| A | : | C | : | D | : | L | : | S | : | P |
| s | - | a | - | i | - | i | - | t | - | u |
| **mona-lisa.jpg** | paintings | 1920×2861 | Public domain | verified | Mona Lisa |
| **starry-night.jpg** | paintings | 1920×1520 | Public domain | verified | Starry Night |
| **great-wave.jpg** | paintings | 1920×1324 | Public domain | verified | The Great Wave off Kanagawa |
| **girl-pearl-earring.jpg** | paintings | 1920×2248 | Public domain | verified | Girl with a Pearl Earring |
| **sunrise.jpg** | paintings | 1600×1245 | Public domain | verified | Impression, Sunrise |
| **the-kiss.jpg** | paintings | 1400×1403 | Public domain | verified | The Kiss |
| **the-scream.jpg** | paintings | 1400×1739 | Public domain | verified | The Scream |
| **water-lilies.jpg** | paintings | 1500×1168 | Public domain | verified | Water Lilies |
| **cafe-terrace.jpg** | paintings | 1558×1920 | Public domain | verified | Café Terrace at Night |
| **the-milkmaid.jpg** | paintings | 1100×1217 | Public domain | verified | The Milkmaid |
| **matterhorn.jpg** | landscapes | 1610×1073 | CC BY-SA 3.0 | verified | The Matterhorn |
| **moraine-lake.jpg** | landscapes | 1920×1440 | Public domain | verified | Moraine Lake |
| **santorini.jpg** | landscapes | 1920×1444 | CC BY-SA 3.0 | verified | Oia, Santorini |
| **eiffel-tower.jpg** | landmarks | 1920×3553 | Public domain | verified | Eiffel Tower |
| **machu-picchu.jpg** | landmarks | 1920×1874 | CC BY-SA 3.0 | verified | Machu Picchu |
| **taj-mahal.jpg** | landmarks | 1920×1262 | CC BY-SA 4.0 | verified | Taj Mahal |
| **colosseum.jpg** | landmarks | 1920×1345 | CC BY-SA 4.0 | verified | The Colosseum |
| **statue-of-liberty.jpg** | landmarks | 1464×2022 | CC BY-SA 3.0 | verified | Statue of Liberty |
| **vatican.jpg** | landmarks | 1920×1078 | CC BY-SA 3.0 | verified | St. Peter's Square |
| **aurora.jpg** | nature | 1920×1251 | Public domain (U.S. federal government wo… | verified | Aurora Borealis |
| **flower.jpg** | nature | 1920×1920 | CC BY-SA 3.0 | verified | Tulip in Bloom |
| **waterfall.jpg** | nature | 1920×1280 | CC BY-SA 4.0 | verified | Beauchamp Falls |
| **golden-gate.jpg** | cities | 1920×1200 | CC BY-SA 4.0 | verified | Golden Gate Bridge |
| **paris-louvre.jpg** | cities | 1920×807 | CC BY-SA 3.0 | verified | The Louvre, Paris |
| **venice.jpg** | cities | 1920×2880 | CC BY-SA 2.0 | verified | Venice at Dawn |
| **tokyo.jpg** | cities | 1920×1023 | CC BY-SA 3.0 | verified | Tokyo Skyscrapers |
| **big-ben.jpg** | landmarks | 1280×720 | Neverificată | unverified | — (orphan) |
| **cherry-blossom.jpg** | nature | 1920×1080 | Neverificată | unverified | — (orphan) |
| **grand-canyon.jpg** | landscapes | 1920×1080 | Neverificată | unverified | — (orphan) |
| **lavender-field.jpg** | landscapes | 1920×1283 | Neverificată | unverified | — (orphan) |
| **mount-fuji.jpg** | landscapes | 1920×1274 | Neverificată | unverified | — (orphan) |
| **neuschwanstein.jpg** | landmarks | 1000×750 | Neverificată | unverified | — (orphan) |
| **new-york.jpg** | cities | 1920×1080 | Fără licență pentru acest proiect — marca… | flagged | — (orphan) |
| **plitvice-lakes.jpg** | landscapes | 1200×1200 | Fără licență — fișier este o previzualiza… | flagged | — (orphan) |
| **prague.jpg** | cities | 1024×601 | Neverificată | unverified | — (orphan) |
| **pyramids-giza.jpg** | landmarks | 1200×856 | Neverificată | unverified | — (orphan) |
| **words-agile.svg** | letter-canvas | 1200×800 | All rights reserved — in-house work | verified | Agile Values Letter Canvas |
| **words-innovation.svg** | letter-canvas | 1200×800 | All rights reserved — in-house work | verified | Innovation Letter Canvas |
| **words-scrabble.svg** | letter-canvas | 1200×800 | All rights reserved — in-house work | verified | Multicolor Letter Canvas |
| **words-motto.svg** | letter-canvas | 1200×800 | All rights reserved — in-house work | verified | Team Values Letter Canvas |
| **sentence-funny-story.svg** | sentence-canvas | 800×600 | All rights reserved — in-house work | verified | Funny Story Canvas |
| **sentence-travel.svg** | sentence-canvas | 800×600 | All rights reserved — in-house work | verified | Travel Canvas |
| **sentence-nature.svg** | sentence-canvas | 800×600 | All rights reserved — in-house work | verified | Nature Canvas |
| **sentence-future.svg** | sentence-canvas | 800×600 | All rights reserved — in-house work | verified | Future Canvas |
| **sentence-positive-message.svg** | sentence-canvas | 800×600 | All rights reserved — in-house work | verified | Positive Message Canvas |
| **himalaya.svg** | coaching | 800×600 | All rights reserved — in-house work | verified | coaching: himalaya-expedition |
| **ocean.svg** | coaching | 800×600 | All rights reserved — in-house work | verified | coaching: ocean-survival |
| **moon.svg** | coaching | 800×600 | All rights reserved — in-house work | verified | coaching: moon-mission |
| **compass.svg** | coaching | 800×600 | All rights reserved — in-house work | verified | coaching: team-compass |

### License corrections found by the audit

Two legacy catalog entries carried the **wrong license**:

| Asset | Legacy catalog | Verified license (Commons file page) |
|---|---|---|
| statue-of-liberty | Public domain | **CC BY-SA 3.0** (Elcobbola, *Statue of Liberty 7.jpg*) |
| venice | CC BY-SA 4.0 | **CC BY-SA 2.0** (Benh LIEU SONG, *Piazza San Marco at Dawn, Venice (21358879396).jpg*) |

Both are corrected in `data/catalog/sources.json` and in the puzzle metadata.
Four entries (moraine-lake, eiffel-tower, paris-louvre, tokyo) keep their legacy
license values, flagged with `license-inherited-from-legacy-catalog-not-reverified`.

## 4. The 10 orphan images (previously uncatalogued)

All 10 images are **not referenced by any puzzle** — they are dead weight in the
public bundle, and **all 10 fail provenance review**:

| F | : | C | : | D | : | F | : | V |
| i | - | a | - | i | - | i | - | e |
| big-ben.jpg | landmarks | 1280×720 | clock-face-and-vehicle-details-distorted; provenance-not-verified; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — suspected AI-generated |
| cherry-blossom.jpg | nature | 1920×1080 | provenance-not-verified; no-exif-metadata; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |
| grand-canyon.jpg | landscapes | 1920×1080 | provenance-not-verified; no-exif-metadata; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |
| lavender-field.jpg | landscapes | 1920×1283 | provenance-not-verified; no-exif-metadata; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |
| mount-fuji.jpg | landscapes | 1920×1274 | provenance-not-verified; no-exif-metadata; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |
| neuschwanstein.jpg | landmarks | 1000×750 | provenance-not-verified; no-exif-metadata; low-resolution-1000x750; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |
| new-york.jpg | cities | 1920×1080 | WIDEWALLPAPERS.NET; no-usable-license; stage-4-rule-no-watermark-violated | ❌ **Replace** — no usable license |
| plitvice-lakes.jpg | landscapes | 1200×1200 | Dreamstime; no-usable-license; copyright-infringement-risk; stage-4-rule-no-watermark-violated | ❌ **Replace** — no usable license |
| prague.jpg | cities | 1024×601 | provenance-not-verified; no-exif-metadata; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |
| pyramids-giza.jpg | landmarks | 1200×856 | provenance-not-verified; no-exif-metadata; source-url-is-repo-placeholder-not-a-claim-of-origin | ⚠️ **Replace** — provenance unverified |

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

`scripts/catalog-pipeline.mjs` (idempotent, `--force` to reconvert):

1. computes **SHA-256** + pixel dimensions for every source asset;
2. moves originals to `data/catalog/originals/` (outside the public bundle);
3. generates **WebP** full images (`server/public/images/full/<id>.webp`, longest
   edge ≤ 2200px, q82) and **4:3 thumbnails** (`thumbs/<id>.webp`, 480×360, q78)
   cropped around each entry's **focal point**;
4. merges full metadata into `shared/puzzles.json` (name ro/en, alt ro/en,
   creator, source name+URL, license + URL, attribution, changesMade, checksum,
   dimensions, thumbnail, focal point) and regenerates the server image
   **manifest**;
5. SVG covers are checksummed but not converted.

`scripts/audit-catalog.mjs` fails on: missing files, missing/invalid
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
4. After replacement, `npm run catalog:audit` must exit 0 with zero F1/F2 flags.

---
*Generated by `scripts/catalog-report.mjs` from `data/catalog/sources.json` and
`docs/catalog-audit.json`. Machine-readable audit: `docs/catalog-audit.json`.*
