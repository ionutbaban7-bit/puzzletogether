#!/usr/bin/env node
/**
 * Generate the human-readable catalog/source-license report from the catalog
 * records and the latest machine-readable audit.
 *
 * Usage: node scripts/catalog-report.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/sources.json"), "utf8"));
const puzzles = JSON.parse(fs.readFileSync(path.join(root, "shared/puzzles.json"), "utf8"));
const auditPath = path.join(root, "docs/catalog-audit.json");
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, "utf8")) : null;
const esc = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const counts = (items, key) => Object.fromEntries([...items.reduce((out, item) => {
  const value = item[key] || "(none)";
  out.set(value, (out.get(value) || 0) + 1);
  return out;
}, new Map())].sort(([a], [b]) => String(a).localeCompare(String(b))));
const markdownTable = (head, rows) => [
  `| ${head.join(" | ")} |`,
  `| ${head.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(esc).join(" | ")} |`),
].join("\n");

const categoryCounts = counts(catalog.entries, "category");
const statusCounts = counts(catalog.entries, "status");
const licenseCounts = counts(catalog.entries, "licenseClass");
const puzzleIds = new Set(puzzles.puzzles.map((puzzle) => puzzle.id));
const orphanEntries = catalog.entries.filter((entry) => !entry.puzzleId && !entry.activityId && entry.category !== "coaching");
const originalEntries = catalog.entries.filter((entry) => entry.generation);
const fatalCount = audit?.errors?.length ?? "not run";
const warningCount = audit?.warnings?.length ?? "not run";
const servedPuzzleCount = catalog.entries.filter((entry) => entry.puzzleId && puzzleIds.has(entry.puzzleId)).length;

const overviewRows = Object.keys(categoryCounts).map((category) => [
  category,
  categoryCounts[category],
  catalog.entries.filter((entry) => entry.category === category && entry.generation).length || "—",
]);
const licenseRows = Object.keys(licenseCounts).map((licenseClass) => [licenseClass, licenseCounts[licenseClass]]);
const assetRows = [...catalog.entries]
  .sort((a, b) => a.category.localeCompare(b.category) || a.asset.localeCompare(b.asset))
  .map((entry) => [
    `\`${entry.asset}\``,
    entry.name?.en || "—",
    entry.category,
    entry.license,
    entry.status,
    entry.puzzleId || entry.activityId || "—",
    entry.sourceName,
    `[source](${entry.sourceUrl})`,
  ]);

const stage5Statement = catalog.stage5ImportedAt
  ? `The Stage 5 import is recorded on **${catalog.stage5ImportedAt}**: ${originalEntries.length} reviewed CC0 originals are linked to their puzzle records.`
  : "The Stage 5 additions manifest is staged but has not yet been imported into the live catalog.";

const report = `# Image Catalog Report

**Generated:** ${new Date().toISOString().slice(0, 10)}

**Pipeline:** \`npm run catalog:pipeline\` · **Audit:** \`npm run catalog:audit\` · **Source policy:** [catalog originals](catalog-originals.md)

## Result

${stage5Statement}

- Catalog entries: **${catalog.entries.length}**
- Entries linked to a served puzzle: **${servedPuzzleCount}**
- Archived prompt-directed originals: **${originalEntries.length}**
- Orphan catalog records: **${orphanEntries.length}**
- Latest audit: **${fatalCount} fatal**, **${warningCount} warning**${audit ? ` (generated ${audit.generatedAt})` : ""}

The audit enforces source and license URLs, bilingual metadata, focal points,
source checksums, source/full/thumbnail files, dimensions, exact and perceptual
duplicates, valid categories, public-bundle coverage, puzzle linkage, flagged
compliance records, and the complete Stage 5 category set after import.

## Catalog coverage

${markdownTable(["Category", "Entries", "Stage 5 CC0 originals"], overviewRows)}

## License classes

${markdownTable(["Class", "Entries"], licenseRows)}

## Source-license table

Each record below links its source documentation and retains bilingual name/alt,
creator, attribution, license URL, source filename, focal point, dimensions and
SHA-256 checksum in \`data/catalog/sources.json\`. For the 55 Stage 5 originals,
the linked source document and generation record state the CC0 dedication,
source brief, raw-input checksum and archival derivative.

${markdownTable(["Asset", "Title", "Category", "License", "Status", "Puzzle/activity", "Source", "Record"], assetRows)}

## Reproducible processing

1. Review each generated/original input for detail and prohibited visible text,
   watermarks, logos and identifiable people as a main subject.
2. Run \`npm run catalog:seed-stage5\` only after all 55 source reviews pass.
   It imports high-quality archival derivatives and delists the prior unverified
   orphan/fatal assets.
3. Run \`npm run catalog:pipeline -- --force\` to archive the source files,
   write optimized full/thumbnail WebP assets, checksum them and update puzzle
   metadata plus the public dimension manifest.
4. Run \`npm run catalog:audit\`, then \`npm run catalog:report\`.
5. After a green audit, run \`npm run catalog:finalize-stage5\` to remove only
   the temporary raw generator imports; the audited archival source remains.

---
Generated from \`data/catalog/sources.json\`, \`shared/puzzles.json\`, and
\`docs/catalog-audit.json\` by \`scripts/catalog-report.mjs\`.
`;
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/catalog-report.md"), report);
console.log("wrote docs/catalog-report.md");
