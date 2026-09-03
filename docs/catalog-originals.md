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

The 55 Stage 5 images are original prompt-directed visuals created on
2026-09-03 with Arena image generation. No third-party source image was supplied
as an input. PuzzleTogether dedicates any copyright and related rights it may
hold in these generated originals to [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

For each image, `data/catalog/stage5-additions.json` retains the exact generation
brief, bilingual title and alt text. The matching final catalog entry retains the
brief, generation date, raw input checksum and visual-review result. The raw
PNG produced by the generator is deliberately converted to a JPEG quality-95
archival derivative before import, then removed: retaining 55 raw PNGs would
needlessly add roughly 160 MB to the repository. The quality-95 archival
source, checksum, optimized full WebP and thumbnail WebP preserve a reproducible
and auditable chain while keeping the repository practical to clone.

Visual review is required before the import is marked `verified`: reject any
output with visible text, logos, watermarks, identifiable people as the main
subject, or insufficient puzzle detail. The 55 images include Romanian subjects
in the paintings, landscapes, landmarks, nature and cities groups.

## License table

| Group | Count | Source | License | Attribution |
| --- | ---: | --- | --- | --- |
| Existing historical / Wikimedia catalog | Existing records | Source URL in each record | Public domain or stated CC license | Per-record attribution |
| Stage 5 original paintings | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original landscapes | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original landmarks | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original nature | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original cities | 5 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original isometric worlds | 10 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original abstract geometry | 10 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
| Stage 5 original blueprint architecture | 10 | PuzzleTogether original; brief in additions manifest | CC0 1.0 | `PuzzleTogether original — CC0 1.0` |
