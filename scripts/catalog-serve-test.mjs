// Decode images delivered over HTTP, then build every new image at every
// advertised count through the authenticated API and WebSocket protocol.
// Run through v2-run-tests.mjs for a fresh isolated server and DATA_DIR.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadImage } from "@napi-rs/canvas";
import { BASE, post, connect, until, close } from "./realtime-client.mjs";

const catalog = await fetch(BASE + "/api/puzzles").then(r => r.json());
const anchors = JSON.parse(readFileSync("data/catalog/public-domain-anchors.json", "utf8")).entries;
const sources = JSON.parse(readFileSync("data/catalog/sources.json", "utf8")).entries;
const dimensions = new Map();
for (const puzzle of catalog.puzzles) {
  for (const [kind, url] of [["full", puzzle.image], ["thumbnail", puzzle.thumbnail]]) {
    const response = await fetch(BASE + url);
    assert.equal(response.status, 200, `${puzzle.id} ${kind} must be delivered`);
    assert.match(response.headers.get("content-type"), /^image\/webp/);
    const image = await loadImage(Buffer.from(await response.arrayBuffer()));
    assert.ok(image.width > 0 && image.height > 0, `${puzzle.id} ${kind} must decode`);
    if (kind === "full") dimensions.set(puzzle.id, { width: image.width, height: image.height });
    else assert.deepEqual([image.width, image.height], [480, 360], `${puzzle.id} thumbnail size`);
  }
}
console.log(`PASS ${catalog.puzzles.length} full images and ${catalog.puzzles.length} thumbnails fetched and decoded over HTTP`);

const made = await post("/api/rooms", { puzzleId: anchors[0].puzzleId, difficulty: "kids", name: "Catalog host" });
assert.equal(made.status, 200);
const client = await connect(made.data.room.id, made.data);
let combinations = 0;
try {
  for (const anchor of anchors) {
    const record = catalog.puzzles.find(p => p.id === anchor.puzzleId);
    const source = sources.find(e => e.puzzleId === anchor.puzzleId);
    assert.ok(record?.anchor && record.nameRo, `${anchor.puzzleId} must be available in the curated bilingual collection`);
    assert.ok(["pd", "cc0"].includes(source.licenseClass));
    assert.equal(record.sourceUrl, anchor.sourceUrl);
    assert.equal(record.licenseUrl, anchor.licenseUrl);
    for (const difficulty of catalog.difficulties) {
      const changed = await post(`/api/rooms/${made.data.room.id}/puzzle`, {
        puzzleId: anchor.puzzleId, difficulty: difficulty.id,
      }, made.data.credential);
      assert.equal(changed.status, 200);
      await until(client, c => c.room.puzzleId === anchor.puzzleId && c.room.difficulty === difficulty.id && c.pieces.size === difficulty.pieces);
      const payload = client.events.findLast(m => m.t === "puzzle" || m.t === "init");
      const geometry = payload.puzzle;
      assert.deepEqual({ width: geometry.width, height: geometry.height }, dimensions.get(anchor.puzzleId), "Board geometry must match delivered portrait and panoramic images");
      assert.equal(geometry.cols * geometry.rows, difficulty.pieces);
      assert.equal(geometry.nameRo, anchor.nameRo);
      const cells = new Set();
      for (const piece of client.pieces.values()) {
        const col = Math.round(piece.correctX / geometry.pieceW), row = Math.round(piece.correctY / geometry.pieceH);
        assert.ok(col >= 0 && col < geometry.cols && row >= 0 && row < geometry.rows);
        cells.add(`${col}:${row}`);
      }
      assert.equal(cells.size, difficulty.pieces, "Every piece must cover a distinct image cell");
      combinations++;
    }
  }
  console.log(`PASS ${anchors.length} documented public-domain additions across ${combinations} image/difficulty combinations`);
} finally { await close(client); }
