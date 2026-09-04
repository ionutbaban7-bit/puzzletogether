# Catalog retirement record — 2026-09-04

## Decision

The **Abstract Geometry** and **Isometric Worlds** categories have been removed
from the public picker, `/api/puzzles`, public image manifest, and served image
bundle.

This is a quality decision, not a licensing failure. The formerly active files
were internally generated and documented as CC0, but a contact-sheet review
found that each category reused one procedural visual language too closely:

- **Abstract Geometry:** repeated coloured loops, translucent polygons, grid,
  and a central nested-arch composition across all ten nominally different
  titles.
- **Isometric Worlds:** repeated star field, isometric grid, block/triangle
  vocabulary, palette family, and only a small set of central motifs.

They were not distinct or compelling enough to present as a premium puzzle
catalog. Renaming or recolouring them would not fix that defect.

## Provenance retention

The complete former source records, bilingual metadata, CC0 statements,
checksums, source briefs, and public puzzle records are preserved in
[`data/catalog/retired-stage5.json`](../data/catalog/retired-stage5.json).
The archival source derivatives remain in `data/catalog/originals/` for the
historical record; they are intentionally no longer public or eligible for the
active catalog.

`data/catalog/sources.json` records both retired category IDs and this archive.
The catalog audit treats a declared retirement as a requirement that no active
category or source record for that ID remains. The historical Stage 5 seeding
and finalization scripts now fail closed if somebody tries to re-import the old
manifest.

## Replacement gate

A replacement category is not approved until **each candidate** has all of the
following:

1. verified PD, CC0, or explicitly permitted open-license provenance with
   source and license URLs;
2. complete bilingual catalog metadata, source checksum, original archival
   derivative, full image, thumbnail, and passing `npm run catalog:audit`;
3. truthful title/alt text and no watermark, logo, text, or identifiable person
   as the main subject;
4. independent art direction rather than one shared generative recipe;
5. documented human visual review at picker-thumbnail and 25/64/144-piece
   board scale, plus duplicate/similarity screening.

Until then, the categories remain delisted rather than being replaced by
another unreviewed batch.
