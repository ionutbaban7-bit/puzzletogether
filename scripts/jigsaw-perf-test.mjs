/**
 * Jigsaw performance test (Chromium, desktop viewport).
 *
 * Requirements:
 *   - A running server:  npm start  (or: node src/server.js)
 *   - Chromium:          npx playwright install chromium
 *
 * Verifies the dirty-rendering budget for classic jigsaw:
 *   1. Idle: the canvas does NOT redraw at 60fps — the draw counter
 *      (window.__ptDraws) stays flat while nothing happens.
 *   2. Pan: panning the camera at 144 and 192 pieces holds a usable
 *      frame rate (target ≥ 30 fps on a mid-range machine).
 *   3. Memory: JS heap after joining and playing a 144-piece room and a
 *      192-piece room stays below the 500 MB budget.
 *
 * Usage: node scripts/jigsaw-perf-test.mjs   (BASE=http://127.0.0.1:3000)
 */
import { chromium } from "playwright";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";
import { mkdirSync } from "node:fs";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });

const checks = [];
const ok = (name, value, extra = "") => {
  checks.push(!!value);
  console.log(`${value ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch(chromiumLaunchOptions());
const errors = [];

async function openPlayRoom(difficultyLabel, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`[${difficultyLabel}] ${e.message}`));
  await page.goto(BASE);
  await page.getByRole("heading", { name: /Play\. Talk\. Decide\.|Jucați\. Vorbiți\. Decideți\./i }).waitFor();
  await page.getByRole("button", { name: /Create session|Creează sesiune/i }).click();
  await page.getByRole("button", { name: /Paintings/i }).click();
  await page.getByRole("button", { name: /Starry Night/i }).click();
  await page.getByRole("button", { name: new RegExp(`^${difficultyLabel}`) }).click();
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.locator("#session-name").fill(`Perf ${difficultyLabel}`);
  await page.locator("#display-name").fill("PerfBot");
  await page.getByRole("button", { name: /Create lobby/i }).click();
  await page.waitForURL("**/room/**");
  await page.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  await page.getByRole("button", { name: /Start for everyone/i }).click();
  await page.waitForFunction(() => window.__ptStore?.getState().room.stage === "play");
  // Let the initial fit + first draws settle before measuring idle.
  await sleep(1800);
  return { context, page };
}

async function measureIdle(page, difficultyLabel) {
  const before = await page.evaluate(() => window.__ptDraws.count);
  await sleep(2500);
  const after = await page.evaluate(() => window.__ptDraws.count);
  const delta = after - before;
  ok(`idle: no continuous redraw at ${difficultyLabel}`, delta <= 2, `${delta} draws in 2.5s (budget ≤ 2)`);
  return delta;
}

async function measurePanFps(page, difficultyLabel) {
  const fps = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    // Empty area: left edge of the board, away from the centered puzzle
    // and the right-side tray.
    const cx = rect.left + 30;
    const cy = rect.top + rect.height / 2;
    let frames = 0;
    const t0 = performance.now();
    const tick = () => {
      frames += 1;
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    canvas.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, isPrimary: true, pointerType: "mouse", clientX: cx, clientY: cy, bubbles: true }));
    for (let i = 1; i <= 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      canvas.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, isPrimary: true, pointerType: "mouse", clientX: cx + Math.sin(i * 0.9) * 240, clientY: cy + Math.cos(i * 0.7) * 140, bubbles: true }));
    }
    canvas.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, isPrimary: true, pointerType: "mouse", clientX: cx, clientY: cy, bubbles: true }));
    await new Promise((r) => setTimeout(r, 2100));
    return frames / 2.1;
  });
  ok(`pan: frame rate at ${difficultyLabel}`, fps >= 30, `${fps.toFixed(1)} fps while panning (target ≥ 30)`);
  return fps;
}

async function measureHeap(page, difficultyLabel) {
  const heapMb = await page.evaluate(() => {
    const memory = performance.memory;
    return memory ? memory.usedJSHeapSize / 1024 / 1024 : -1;
  });
  if (heapMb > 0) {
    ok(`memory: JS heap at ${difficultyLabel}`, heapMb < 500, `${heapMb.toFixed(0)} MB (budget < 500 MB)`);
  } else {
    console.log(`ℹ️  heap not available in this build for ${difficultyLabel}`);
  }
  return heapMb;
}

try {
  const report = {};
  for (const [label, difficulty] of [["Expert (144)", "Expert"], ["Master (192)", "Master"]]) {
    const { context, page } = await openPlayRoom(difficulty, report);
    const total = await page.evaluate(() => window.__ptStore.getState().room.total);
    report[label] = { total };
    const idle = await measureIdle(page, label);
    const fps = await measurePanFps(page, label);
    const heap = await measureHeap(page, label);
    report[label].idleDraws = idle;
    report[label].panFps = Number(fps.toFixed(1));
    report[label].heapMb = heap > 0 ? Number(heap.toFixed(0)) : null;
    await page.screenshot({ path: `${ARTIFACTS}perf-${difficulty.toLowerCase()}.png` });
    await context.close();
  }
  ok("no uncaught browser errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  writeFileSync(`${ARTIFACTS}perf-report.json`, JSON.stringify(report, null, 2));
  console.log(`\n📊 ${checks.filter(Boolean).length}/${checks.length} performance checks passed`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
process.exit(checks.every(Boolean) ? 0 : 1);
