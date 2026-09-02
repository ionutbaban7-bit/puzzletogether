/* Browser end-to-end test: two pages, one room, realtime piece sync.
   Run: node scripts/browser-test.mjs   (server must be running on :3000) */
import { createRequire } from "node:module";
// playwright lives in a separate scratch dir so it doesn't bloat the app deps
const require = createRequire(process.env.PW_ROOT ? `${process.env.PW_ROOT}/package.json` : "/tmp/package.json");
const { chromium } = require("playwright-core");

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
import { mkdirSync } from "node:fs";
mkdirSync(ARTIFACTS, { recursive: true });

const results = [];
const ok = (name, cond, extra = "") => {
  results.push(!!cond);
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch();
const errors = [];
function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${label}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${label}] pageerror: ${e.message}`));
}

try {
  // ------------------------------------------------------------ landing
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageA = await ctxA.newPage();
  watch(pageA, "A");
  await pageA.goto(BASE);
  await pageA.waitForSelector("text=Solve beautiful puzzles");
  ok("landing page renders", true);
  await pageA.screenshot({ path: `${ARTIFACTS}01-landing.png` });

  // ------------------------------------------------------------ create room
  await pageA.click("text=Create a Room");
  await pageA.waitForURL("**/create");
  await pageA.fill("#name", "Ionut");
  await pageA.click("text=Continue");
  await pageA.click("text=Famous Paintings");
  await pageA.click("text=Starry Night");
  await pageA.click("text=Easy");
  await pageA.screenshot({ path: `${ARTIFACTS}02-create.png` });
  await pageA.click("button:has-text('Create Room')");
  await pageA.waitForURL("**/room/**");
  await pageA.waitForSelector("canvas");
  await pageA.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  const stateA1 = await pageA.evaluate(() => window.__ptStore.getState());
  ok("room created & joined (25 pieces)", stateA1.room?.total === 25 && Object.keys(stateA1.pieces).length === 25);
  ok("creator sees own player entry", stateA1.players?.length === 1 && stateA1.players[0].name === "Ionut");
  ok("creator got a cursor color", /^#/.test(stateA1.players[0].color));
  await pageA.screenshot({ path: `${ARTIFACTS}03-room-host.png` });

  // ------------------------------------------------------------ second player
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageB = await ctxB.newPage();
  watch(pageB, "B");
  await pageB.goto(pageA.url());
  // Access gate: joining via link now requires name + the room's access code
  await pageB.waitForSelector("text=Enter the room");
  ok("access gate shown on shared URL", true);
  await pageB.fill("input[placeholder='e.g. Maria']", "Maria");
  // wrong code must be rejected
  await pageB.fill("input[placeholder='K7F2MX']", "WRONG1");
  await pageB.click("button:has-text('Join the Puzzle')");
  await pageB.waitForSelector("text=Wrong access code");
  ok("wrong access code rejected", true);
  // correct code lets us in
  await pageB.fill("input[placeholder='K7F2MX']", stateA1.room.code);
  await pageB.click("button:has-text('Join the Puzzle')");
  await pageB.waitForSelector("canvas");
  await pageB.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  const stateB1 = await pageB.evaluate(() => window.__ptStore.getState());
  ok("second player joined via shared URL", stateB1.room?.id === stateA1.room?.id);
  ok("second player sees 2 players", stateB1.players?.length === 2);
  await pageA.waitForFunction(() => window.__ptStore?.getState().players.length === 2);
  ok("host sees the new player appear", true);
  await pageB.screenshot({ path: `${ARTIFACTS}04-room-guest.png` });

  // ------------------------------------------------------------ drag piece on A
  const drag = await pageA.evaluate(() => {
    const st = window.__ptStore.getState();
    const cam = window.__ptCamera.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const candidates = Object.values(st.pieces).filter((p) => {
      if (p.locked) return false;
      const sx = p.x * cam.scale + cam.x;
      const sy = p.y * cam.scale + cam.y;
      const pw = st.puzzle.pieceW * cam.scale;
      const ph = st.puzzle.pieceH * cam.scale;
      // Avoid UI overlays: top-left panel, right sidebar, bottom-center button
      if (sy < 230 || sy + ph > vh - 90) return false;
      if (sx < 60 && sy < 240) return false;
      if (sx > vw - 300) return false;
      if (sy > vh - 120 && sx > vw / 2 - 120 && sx < vw / 2 + 120) return false;
      return true;
    });
    const p = candidates[0];
    const sx = p.x * cam.scale + cam.x + 30;
    const sy = p.y * cam.scale + cam.y + 30;
    return { id: p.id, sx, sy, scale: cam.scale, worldX: p.x, worldY: p.y };
  });
  ok("found a grabbable piece for the drag test", !!drag, `piece ${drag?.id}`);

  await pageA.mouse.move(drag.sx, drag.sy);
  await pageA.mouse.down();
  await pageA.mouse.move(drag.sx + 40, drag.sy + 20, { steps: 4 });
  await pageA.mouse.move(drag.sx + 180, drag.sy + 120, { steps: 8 });
  await pageA.mouse.up();

  const expectedX = drag.worldX + 180 / drag.scale;
  const expectedY = drag.worldY + 120 / drag.scale;
  await pageB.waitForFunction(
    ([id, ex, ey]) => {
      const p = window.__ptStore.getState().pieces[id];
      return p && Math.abs(p.x - ex) < 2 && Math.abs(p.y - ey) < 2;
    },
    [drag.id, expectedX, expectedY],
    { timeout: 5000 },
  );
  ok("piece drag synced to second window in realtime", true, `(${expectedX.toFixed(0)}, ${expectedY.toFixed(0)})`);
  const stateB2 = await pageB.evaluate(() => window.__ptStore.getState());
  const pieceB = stateB2.pieces[drag.id];
  ok("piece ended un-dragged & moved", pieceB.drag === false && pieceB.moved === true);

  // cursor sync
  await pageA.mouse.move(600, 400);
  await pageB.waitForFunction(() => Object.keys(window.__ptStore.getState().cursors).length >= 1, null, { timeout: 4000 });
  ok("remote cursor visible in second window", true);

  // ------------------------------------------------------------ completion via API sends
  await pageA.evaluate(() => {
    const st = window.__ptStore.getState();
    for (const p of Object.values(st.pieces)) {
      window.__ptStore.sendPiece(p.id, p.correctX, p.correctY, false);
    }
  });
  await pageB.waitForSelector("text=Puzzle completed!", { timeout: 10000 });
  ok("completion modal appears on second window", true);
  await pageA.waitForSelector("text=Puzzle completed!", { timeout: 5000 });
  await pageA.screenshot({ path: `${ARTIFACTS}05-completion.png` });
  const names = await pageA.evaluate(() =>
    [...document.querySelectorAll("span")].map((s) => s.textContent).filter((t) => t === "Ionut" || t === "Maria"),
  );
  ok("completion credits list players", names.length >= 2, names.join(", "));

  // ------------------------------------------------------------ share modal
  await pageA.click("button:has-text('Share Room')");
  await pageA.waitForSelector("text=Room code");
  const codeText = await pageA.evaluate(() =>
    [...document.querySelectorAll("div")].find((d) => /^[A-Z0-9]{6}$/.test(d.textContent.trim()) && d.textContent.includes("Room code"))?.textContent || document.body.innerText.match(/[A-Z0-9]{6}/)?.[0],
  );
  ok("share modal shows room code", /^[A-Z0-9]{6}$/.test(codeText || ""), codeText);
  await pageA.screenshot({ path: `${ARTIFACTS}06-share.png` });

  // ------------------------------------------------------------ play again (reset)
  await pageA.click("button:has-text('Play Another Puzzle')");
  await pageA.waitForFunction(() => {
    const st = window.__ptStore.getState();
    const pieces = Object.values(st.pieces);
    return pieces.length > 0 && pieces.every((p) => !p.locked);
  }, null, { timeout: 6000 });
  ok("reset scatters all pieces again", true);
  await pageB.waitForFunction(() => {
    const st = window.__ptStore.getState();
    const pieces = Object.values(st.pieces);
    return pieces.length > 0 && pieces.every((p) => !p.locked);
  }, null, { timeout: 6000 });
  ok("reset synced to second window", true);

  // ------------------------------------------------------------ progress HUD check
  const hud = await pageA.evaluate(() => document.body.innerText.includes("Progress") && document.body.innerText.includes("0 / 25 pieces"));
  ok("progress HUD shows 0/25 after reset", hud);

  await pageA.screenshot({ path: `${ARTIFACTS}07-after-reset.png` });
} catch (e) {
  console.error("TEST ERROR:", e);
  results.push(false);
} finally {
  await browser.close();
}

console.log(`\nconsole/page errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log("  ⚠️", e);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} browser checks passed`);
process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
