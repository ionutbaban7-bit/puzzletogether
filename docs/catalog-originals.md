# PuzzleTogether catalog originals

## Source and license policy

Every catalog record is stored in `data/catalog/sources.json`, validated against
`data/catalog/sources.schema.json`, and processed by `npm run catalog:pipeline`.
The pipeline keeps an archival source derivative in `data/catalog/originals/`,
creates the public full and thumbnail WebP files, records a SHA-256 checksum,
and updates `shared/puzzles.json` plus the public image manifest.

The catalog distinguishes public-domain and Creative Commons material from the
Stage 5 originals below. A `verified` record has a usable source/license link;
a `flagged` or `unverified` record is not eligible for the final catalog.

## Stage 5 originals

The active Stage 5 catalog contains 35 reviewed original visuals created on
2026-09-03. Nineteen paintings, landscapes, landmarks and nature scenes use
prompt-directed Arena image generation. The remaining 16 city, ice-cave and
blueprint images are produced by original deterministic artwork in
`scripts/generate-stage5-procedural-originals.mjs`. No third-party source image
was supplied as an input. PuzzleTogether dedicates any copyright and related
rights it may hold in these generated originals to
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

For each image, `data/catalog/stage5-additions.json` retains the source brief,
bilingual title and alt text. The matching final catalog entry retains the brief,
generation date, raw input checksum and visual-review result. Generator PNGs and
procedural source derivatives are deliberately converted to quality-95 archival
JPEGs before import, then removed: retaining all raw PNGs would needlessly make
the repository expensive to clone. The source code (for procedural artwork),
quality-95 archival source, checksum, optimized full WebP and thumbnail WebP
preserve a reproducible and auditable chain while keeping the repository practical.

Visual review is required before the import is marked `verified`: reject any
output with visible text, logos, watermarks, identifiable people as the main
subject, insufficient puzzle detail, **or visually repetitive art direction**.
The active set includes Romanian subjects in the paintings, landscapes,
landmarks, nature and cities groups.

Twenty former Stage 5 entries — ten Isometric Worlds and ten Abstract Geometry
images — were **retired from the active catalog on 2026-09-04** after failing a
contact-sheet differentiation review. Their archival source records and CC0
provenance are retained in
[`data/catalog/retired-stage5.json`](../data/catalog/retired-stage5.json); their
public derivatives are intentionally removed. See the
[catalog retirement record](catalog-retirement-2026-09-04.md).

## License table

| Group | Count | Source | License | Attribution |
| --- | ---: | --- | --- | --- |
| Existing historical / Wikimedia catalog | Existing records | Source URL in each record | Public domain or stated CC license | Per-record attribution |
| Stage 5 original paintings | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original landscapes | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original landmarks | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original nature | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original cities | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Retired Stage 5 isometric worlds | 10 | Archived only; see retirement record | CC0 1.0 | Not publicly served |
| Retired Stage 5 abstract geometry | 10 | Archived only; see retirement record | CC0 1.0 | Not publicly served |
| Stage 5 original blueprint architecture | 10 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
