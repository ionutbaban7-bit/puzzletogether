#!/usr/bin/env node
/**
 * Lightweight source-level regression gate for the jigsaw renderer.
 *
 * Canvas frame timing is browser-specific, so this deliberately tests the
 * structural guarantees that make the renderer idle when unchanged and avoid
 * per-frame free-piece shadow filtering. Runtime interaction remains covered
 * by the browser/performance suite when a Chromium binary is available.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const board = readFileSync(resolve("src/puzzle/Board.tsx"), "utf8");
let passed = 0;

function expect(name, condition) {
  if (!condition) {
    console.error(`❌ ${name}`);
    process.exitCode = 1;
    return;
  }
  passed += 1;
  console.log(`✅ ${name}`);
}

expect("renderer documents and uses a dirty, single-rAF scheduler",
  board.includes("dirty rendering (no 60fps loop)") &&
  /if \(raf\.current\) return;[\s\S]*requestAnimationFrame/.test(board) &&
  /if \(dirty\.current\) drawRef\.current\(\);/.test(board));

expect("StrictMode cleanup cancels and clears a pending draw frame",
  /cancelAnimationFrame\(raf\.current\);[\s\S]*raf\.current = 0;/.test(board));

expect("free-piece shadow constants reserve a baked sprite margin",
  board.includes("BAKED_SHADOW_MARGIN") &&
  /const pad = pathPad \+ BAKED_SHADOW_MARGIN;/.test(board) &&
  /ctx\.shadowBlur = BAKED_SHADOW_BLUR;/.test(board));

expect("cached sprites are keyed and reused before rasterization",
  /const cached = spriteCache\.current\.get\(key\);[\s\S]*if \(cached\) return cached;/.test(board) &&
  /spriteCache\.current\.set\(key, spr\);/.test(board));

expect("regular free pieces draw cached sprites without a live shadow",
  /if \(isGrabbed\) \{[\s\S]*ctx\.shadowColor = "rgba\(0,0,0,0\.42\)"[\s\S]*\} else \{\s*ctx\.drawImage\(spr, dx, dy, sw, sh\);\s*\}/.test(board));

expect("dot grid doubles spacing below the low-zoom threshold",
  /while \(effectiveDotSpace < 16 && dotDoublings < 4\)[\s\S]*dotSpace \*= 2;/.test(board) &&
  /if \(effectiveDotSpace >= 16\)/.test(board));

expect("draw telemetry remains available to the browser performance suite",
  board.includes("__ptDraws") && board.includes("scripts/jigsaw-perf-test.mjs"));

if (process.exitCode) {
  console.error(`\n${passed}/7 renderer contract checks passed.`);
} else {
  console.log(`\n${passed}/7 renderer contract checks passed.`);
}
