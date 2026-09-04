/*
 * Browser tests for Letter Canvas + Sentence Canvas.
 *
 * Desktop (1280x820): lower letter rack, semantic lane placement, drag, double-click flip,
 * duplicate / delete / undo via the selection bar, PNG + text + JSON export.
 * Mobile (iPhone 390x844, touch): bottom sheet rack, tap-to-place, pan,
 * zoom, custom word (sentence canvas).
 *
 * Requires Playwright browsers: `npx playwright install chromium`
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });
const checks = [];
const ok = (name, value) => { checks.push(!!value); console.log(`${value ? "✅" : "❌"} ${name}`); };

const errors = [];
const watch = (page, label) => {
  page.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${label}] ${m.text()}`); });
};

const store = (page) => page.evaluate(() => window.__ptStore.getState());
const camera = (page) => page.evaluate(() => {
  const c = window.__ptCanvasCamera?.current;
  return c ? { x: c.x, y: c.y, scale: c.scale } : null;
});
const screenPos = async (page, tile) => {
  const c = await camera(page);
  return { x: tile.x * c.scale + c.x, y: tile.y * c.scale + c.y };
};

// ------------------------------------------------------------------ helpers
async function createLobby(page, { categoryLabel, puzzleLabel, modeLabel, sessionName, name, contentLanguage = "ro", ro = false }) {
  await page.goto(BASE);
  await page.getByRole("button", { name: ro ? /Creează sesiune|Create session/i : /Create session/i }).click();
  await page.getByRole("button", { name: categoryLabel }).click();
  await page.getByRole("button", { name: puzzleLabel }).click();
  await page.getByRole("button", { name: new RegExp(`^${modeLabel}`) }).click();
  if (contentLanguage) await page.getByRole("button", { name: new RegExp(contentLanguage === "ro" ? "RO · Română" : "EN · English") }).click();
  await page.getByRole("button", { name: /Continue|Continuă/i }).click();
  await page.locator("#session-name").fill(sessionName);
  await page.locator("#display-name").fill(name);
  await page.getByRole("button", { name: /Create lobby|Creează lobby/i }).click();
  await page.waitForURL("**/room/**");
  await page.waitForFunction(() => window.__ptStore?.getState().status === "joined");
}

async function startAndWait(page) {
  await page.getByRole("button", { name: /Start for everyone|Start pentru toți/i }).click();
  await page.waitForFunction(() => window.__ptStore.getState().room.stage === "play");
}

// ================================================================ DESKTOP
const browser = await chromium.launch(chromiumLaunchOptions());
const desktop = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: "en-US" });
const page = await desktop.newPage();
watch(page, "desktop");

await createLobby(page, { categoryLabel: "Letter Canvas", puzzleLabel: "Agile Values Letter Canvas", modeLabel: "Quick", sessionName: "Canvas browser test", name: "Ionut" });
const state0 = await store(page);
ok("desktop: lobby boots the letter canvas (blank sheet, RO content)", state0.room.stage === "lobby" && state0.room.contentLanguage === "ro" && state0.puzzle.isCanvas === true && Object.keys(state0.canvasTiles).length === 0);
ok("desktop: lobby explains the collaborative lane workflow", await page.getByText("Choose composition lanes, build together, then the facilitator completes it.").isVisible().catch(() => false));
await page.screenshot({ path: `${ARTIFACTS}canvas-01-lobby.png` });

await startAndWait(page);
ok("desktop: lower letter rack renders on desktop", await page.getByText("Letter rack").isVisible());
ok("desktop: tray lists RO diacritics + wildcards + punctuation", (await page.getByRole("button", { name: /^Ă \(/ }).count()) > 0 && (await page.getByRole("button", { name: /^\? \(/ }).count()) > 0);

// tap-to-place from the lower rack
await page.getByRole("button", { name: /^A \(/ }).click();
await page.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 1);
let tiles = (await store(page)).canvasTiles;
let tile = Object.values(tiles)[0];
ok("desktop: tap-to-spawn creates a tile on the sheet", tile.text === "A" && tile.kind === "letter" && tile.w === 100);
await page.screenshot({ path: `${ARTIFACTS}canvas-02-spawned.png` });

// drag the tile
const start = { x: tile.x, y: tile.y };
const before = await screenPos(page, tile);
await page.mouse.move(before.x + tile.w / 2, before.y + tile.h / 2);
await page.mouse.down();
await page.mouse.move(before.x + tile.w / 2 + 160, before.y + tile.h / 2 + 90, { steps: 8 });
await page.mouse.up();
await page.waitForFunction(({ id, sx }) => {
  const t = window.__ptStore.getState().canvasTiles[id];
  // A v2 lane drop may reorder into a deterministic slot instead of preserving
  // raw x/y; free-canvas movement remains valid for a drop outside a lane.
  return t && !t.heldBy && (t.laneId || Math.abs(t.x - sx) > 40);
}, { id: tile.id, sx: start.x });
tiles = (await store(page)).canvasTiles;
tile = tiles[tile.id];
ok("desktop: drag commits a server-confirmed move or semantic lane placement", (!!tile.laneId || Math.abs(tile.x - start.x) > 40) && !tile.heldBy, tile.laneId || `dx=${Math.round(tile.x - start.x)}`);

// double-click flip
const tPos = await screenPos(page, tile);
await page.mouse.dblclick(tPos.x + tile.w / 2, tPos.y + tile.h / 2);
await page.waitForFunction((id) => window.__ptStore.getState().canvasTiles[id]?.flipped === true, tile.id, { timeout: 4000 }).catch(() => {});
ok("desktop: double-click flips the tile", (await store(page)).canvasTiles[tile.id]?.flipped === true);
await page.mouse.dblclick(tPos.x + tile.w / 2, tPos.y + tile.h / 2);
await page.waitForFunction((id) => window.__ptStore.getState().canvasTiles[id]?.flipped === false, tile.id, { timeout: 4000 }).catch(() => {});

// selection bar: duplicate + delete + undo
const pos2 = await screenPos(page, tile);
await page.mouse.click(pos2.x + tile.w / 2, pos2.y + tile.h / 2);
await page.waitForTimeout(150);
ok("desktop: selection bar appears", await page.getByRole("button", { name: "Duplicate tile" }).isVisible());
await page.getByRole("button", { name: "Duplicate tile" }).click();
await page.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 2);
ok("desktop: duplicate adds a tile (server-authoritative)", Object.keys((await store(page)).canvasTiles).length === 2);
await page.getByRole("button", { name: "Delete tile" }).click();
await page.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 1);
ok("desktop: delete removes the tile", Object.keys((await store(page)).canvasTiles).length === 1);
await page.getByRole("button", { name: "Undo" }).click();
await page.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 2, { timeout: 4000 });
ok("desktop: undo restores the deleted tile", Object.keys((await store(page)).canvasTiles).length === 2);
await page.screenshot({ path: `${ARTIFACTS}canvas-03-interactions.png` });

// exports
let download;
page.once("download", (d) => { download = d; });
await page.getByRole("button", { name: "Export text" }).click();
await page.waitForTimeout(1200);
ok("desktop: text export downloads a UTF-8 file", !!download && download.suggestedFilename().endsWith("-text.txt"));
download = null;
page.once("download", (d) => { download = d; });
await page.getByRole("button", { name: "Export PNG" }).click();
await page.waitForTimeout(2500);
ok("desktop: PNG export downloads a composition image", !!download && download.suggestedFilename().endsWith(".png"));
download = null;
page.once("download", (d) => { download = d; });
await page.getByRole("button", { name: "Export JSON" }).click();
await page.waitForTimeout(1200);
ok("desktop: JSON export downloads the composition", !!download && download.suggestedFilename().endsWith(".json"));

// collaborator sees the same tiles
const guest = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: "ro-RO" });
const gPage = await guest.newPage();
watch(gPage, "guest");
const code = (await store(page)).room.code;
await gPage.goto(`${BASE}/join?c=${code}`);
await gPage.locator("#joinname").fill("Maria");
await gPage.getByRole("button", { name: /Join lobby|Intră în lobby/i }).click();
await gPage.waitForFunction(() => window.__ptStore.getState().status === "joined");
await page.waitForTimeout(400);
const guestTiles = await gPage.evaluate(() => Object.keys(window.__ptStore.getState().canvasTiles).length);
const hostTiles = (await store(page)).canvasTiles;
ok("desktop: a second participant receives the full tile state", guestTiles === Object.keys(hostTiles).length, `${guestTiles}/${Object.keys(hostTiles).length}`);
await gPage.screenshot({ path: `${ARTIFACTS}canvas-04-guest.png` });
await guest.close();

// ---------------------------------------------------------------- MOBILE
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  locale: "en-US",
});
const mPage = await phone.newPage();
watch(mPage, "mobile");
await createLobby(mPage, { categoryLabel: "Letter Canvas", puzzleLabel: "Team Values Letter Canvas", modeLabel: "Quick", sessionName: "Mobile canvas", name: "Ana" });
await startAndWait(mPage);
ok("mobile: bottom sheet tray renders (collapsed)", await mPage.getByRole("button", { name: /Open rack/i }).isVisible());

// expand the sheet
await mPage.getByRole("button", { name: /Open rack/i }).click();
await mPage.waitForTimeout(300);
ok("mobile: tray expands on tap", await mPage.getByRole("button", { name: /Collapse rack/i }).isVisible());
await mPage.screenshot({ path: `${ARTIFACTS}canvas-05-mobile-tray.png` });

// tap-to-place from the tray
await mPage.getByRole("button", { name: /^E \(/ }).click();
await mPage.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 1);
const mTile = Object.values((await mPage.evaluate(() => window.__ptStore.getState().canvasTiles)))[0];
ok("mobile: tap-to-place spawns a tile", mTile.text === "E");

// touch pan gesture (synthesized pointer events, pointerType=touch)
const camBefore = await camera(mPage);
await mPage.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const rect = canvas.getBoundingClientRect();
  const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "touch", clientX: rect.left + x, clientY: rect.top + y, bubbles: true, isPrimary: true }));
  fire("pointerdown", 200, 400);
  fire("pointermove", 240, 430);
  fire("pointermove", 280, 460);
  fire("pointerup", 280, 460);
});
await mPage.waitForTimeout(200);
const camAfter = await camera(mPage);
ok("mobile: touch pan moves the camera", Math.abs(camAfter.x - camBefore.x) > 30, `dx=${Math.round(camAfter.x - camBefore.x)}`);

// zoom via control
await mPage.getByRole("button", { name: "Zoom in" }).click();
await mPage.waitForTimeout(150);
const camZoomed = await camera(mPage);
ok("mobile: zoom control increases scale", camZoomed.scale > camAfter.scale * 1.1);
await mPage.screenshot({ path: `${ARTIFACTS}canvas-06-mobile-board.png` });
await phone.close();

// ------------------------------------------- MOBILE SENTENCE CANVAS
const phone2 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  locale: "ro-RO",
});
const sPage = await phone2.newPage();
watch(sPage, "sentence-mobile");
await createLobby(sPage, { categoryLabel: "Foaie de propoziții", puzzleLabel: "Funny Story Canvas", modeLabel: "Quick", sessionName: "Mobile sentence", name: "Mihai", ro: true });
await startAndWait(sPage);
await sPage.getByRole("button", { name: /Deschide rastelul/i }).click();
await sPage.waitForTimeout(300);
ok("sentence mobile: bottom sheet shows word categories + custom word", (await sPage.getByText("Punctuație", { exact: true }).count()) > 0 && (await sPage.getByLabel("Cuvânt personal").count()) === 1);
// spawn a pack word by tapping it
await sPage.getByRole("button", { name: /^poveste \(/ }).click();
await sPage.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 1);
let sTiles = (await sPage.evaluate(() => window.__ptStore.getState().canvasTiles));
const sWord = Object.values(sTiles)[0];
ok("sentence mobile: tapping a word tile places it (width from text)", sWord.text === "poveste" && sWord.w === 40 + 7 * 19);
// custom word with diacritics
await sPage.getByLabel("Cuvânt personal").fill("București");
await sPage.getByRole("button", { name: "+", exact: true }).click();
await sPage.waitForFunction(() => Object.keys(window.__ptStore.getState().canvasTiles).length === 2);
sTiles = (await sPage.evaluate(() => window.__ptStore.getState().canvasTiles));
const sCustom = Object.values(sTiles).find((t) => t.custom);
ok("sentence mobile: custom word tile with diacritics", sCustom?.text === "București" && sCustom.kind === "custom");
await sPage.screenshot({ path: `${ARTIFACTS}canvas-07-sentence-mobile.png` });
await phone2.close();

await desktop.close();
await browser.close();

const failed = checks.filter((c) => !c).length;
console.log(`\nconsole/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  ⚠️", e));
ok("no page or console errors across the flow", errors.length === 0);
console.log(`\n${failed === 0 ? "🎉" : "⚠️"} canvas browser suite: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
