/* Browser test for coaching flows. Run: node scripts/coaching-browser-test.mjs */
import { createRequire } from "node:module";
const require = createRequire("/tmp/package.json");
const { chromium } = require("playwright-core");
import { mkdirSync } from "node:fs";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push(!!cond);
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch();
const errors = [];
function watch(page, label) {
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${label}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${label}] pageerror: ${e.message}`));
}

try {
  // ------------------------------------------------------- landing + badge
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  watch(pageA, "A");
  await pageA.goto(BASE);
  await pageA.waitForSelector("text=Solve beautiful puzzles");
  ok("coachinghub badge on landing", await pageA.locator("text=coachinghub").first().isVisible());
  await pageA.screenshot({ path: `${ARTIFACTS}10-landing-coachinghub.png` });

  // ------------------------------------------------------- create ranking room
  await pageA.click("text=Create a Room");
  await pageA.waitForURL("**/create");
  await pageA.fill("#name", "Ionut");
  await pageA.click("text=Continue");
  await pageA.click("text=Team Coaching");
  await pageA.waitForSelector("text=Team coaching exercises");
  ok("coaching activities listed", (await pageA.locator("button", { hasText: "Expediția Himalayană" }).count()) > 0);
  await pageA.screenshot({ path: `${ARTIFACTS}11-create-coaching.png` });
  await pageA.click("text=Expediția Himalayană");
  // difficulty section should be hidden for coaching
  ok("difficulty hidden for coaching", !(await pageA.locator("text=Difficulty").first().isVisible().catch(() => false)));
  await pageA.click("button:has-text('Create Room')");
  await pageA.waitForURL("**/room/**");
  await pageA.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  const st = await pageA.evaluate(() => window.__ptStore.getState());
  ok("ranking room joined with 12 items", st.puzzle?.isCoaching && Object.keys(st.pieces).length === 12);
  ok("ranking board shows scenario panel", await pageA.locator("text=Storm at 4,500 meters").first().isVisible().catch(() => false) || await pageA.locator("text=Furtună la 4.500 de metri").first().isVisible().catch(() => false));
  ok("top bar shows coachinghub", await pageA.locator("text=coachinghub").first().isVisible());
  await pageA.waitForTimeout(1200);
  const cardCount = await pageA.locator("[data-item]").count();
  ok("12 item cards rendered on the board", cardCount === 12, `${cardCount}`);
  await pageA.screenshot({ path: `${ARTIFACTS}12-ranking-board.png` });

  // ------------------------------------------------------- drag an item to its slot (with retries for flakiness)
  let lockedInBrowser = false;
  for (let attempt = 0; attempt < 3 && !lockedInBrowser; attempt++) {
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
        if (sx < 340 && sy < 260) return false; // top-left info panel
        if (sx > vw - 380 && sy < 520) return false; // right side panel
        if (sy < 60 || sy + ph > vh - 80) return false; // top/bottom edges
        return true;
      });
      const p = candidates[0];
      if (!p) return null;
      return { id: p.id, correctX: p.correctX, correctY: p.correctY, x: p.x, y: p.y, pieceW: st.puzzle.pieceW, pieceH: st.puzzle.pieceH };
    });
    if (!drag) break;
    const cam = await pageA.evaluate(() => ({ x: window.__ptCamera?.current.x ?? 0, y: window.__ptCamera?.current.y ?? 0, scale: window.__ptCamera?.current.scale ?? 0.55 }));
    const sx = drag.x * cam.scale + cam.x + (drag.pieceW * cam.scale) / 2;
    const sy = drag.y * cam.scale + cam.y + (drag.pieceH * cam.scale) / 2;
    const tx = drag.correctX * cam.scale + cam.x + (drag.pieceW * cam.scale) / 2;
    const ty = drag.correctY * cam.scale + cam.y + (drag.pieceH * cam.scale) / 2;
    await pageA.mouse.move(sx, sy);
    await pageA.waitForTimeout(80);
    await pageA.mouse.down();
    await pageA.mouse.move(tx, ty, { steps: 12 });
    await pageA.waitForTimeout(80);
    await pageA.mouse.up();
    try {
      await pageA.waitForFunction(() => {
        const st = window.__ptStore.getState();
        return Object.values(st.pieces).some((p) => p.locked);
      }, null, { timeout: 4000 });
      lockedInBrowser = true;
    } catch {
      console.log(`  (retry ${attempt + 1}: item ${drag.id} did not lock)`);
    }
  }
  ok("ranking item snapped & locked in browser", lockedInBrowser);
  if (lockedInBrowser) {
    await pageA.screenshot({ path: `${ARTIFACTS}13-ranking-item-placed.png` });
  }

  // ------------------------------------------------------- place everything → results
  await pageA.evaluate(() => {
    const st = window.__ptStore.getState();
    for (const p of Object.values(st.pieces)) {
      if (!p.locked) window.__ptStore.sendPiece(p.id, p.correctX, p.correctY, false);
    }
  });
  await pageA.waitForSelector("text=Rezultatele echipei", { timeout: 8000 });
  ok("results modal appears when ranking completes (RO)", true);
  ok("expert ranking shown", await pageA.locator("text=Expert").first().isVisible());
  ok("debrief questions shown", await pageA.locator("text=Întrebări de debrief").first().isVisible());
  await pageA.screenshot({ path: `${ARTIFACTS}14-ranking-results.png` });

  // ------------------------------------------------------- language toggle
  await pageA.click("button:has-text('Închide')"); // close RO results modal
  await pageA.click("button:text-is('en')");
  await pageA.waitForTimeout(200);
  await pageA.click("button:has-text('See expert ranking')");
  await pageA.waitForSelector("text=Team results");
  ok("language switch to EN changes results modal", true);
  ok("debrief EN shown", await pageA.locator("text=Debrief questions").first().isVisible());
  await pageA.screenshot({ path: `${ARTIFACTS}15-ranking-results-en.png` });

  // ------------------------------------------------------- questionnaire room
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageB = await ctxB.newPage();
  watch(pageB, "B");
  await pageB.goto(BASE);
  // create via API and join via URL
  const qRoom = await pageB.evaluate(async () => {
    const r = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId: "team-compass", difficulty: "easy", name: "Maria" }),
    });
    return r.json();
  });
  await pageB.goto(`${BASE}/room/${qRoom.room.id}`);
  await pageB.fill("input[placeholder='e.g. Maria']", "Maria");
  await pageB.click("button:has-text('Join the Puzzle')");
  await pageB.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  await pageB.waitForSelector("text=Începe chestionarul");
  ok("questionnaire intro shows (RO default)", await pageB.locator("text=Busola Echipei").first().isVisible());
  await pageB.screenshot({ path: `${ARTIFACTS}16-questionnaire-intro.png` });

  // switch to English
  await pageB.click("button:text-is('en')");
  await pageB.waitForSelector("text=Start the questionnaire");
  ok("language toggle switches intro to EN", true);
  await pageB.click("button:has-text('Start the questionnaire')");
  await pageB.waitForSelector("text=Question 1 / 20");
  ok("first question renders", true);
  // answer all 20 with agree
  for (let i = 0; i < 20; i++) {
    await pageB.click("button:has-text('Agree')");
    await pageB.waitForTimeout(40);
  }
  await pageB.waitForSelector("text=Team summary", { timeout: 8000 });
  ok("questionnaire results appear after 20 answers", true);
  const profileCode = await pageB.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => /^[IPXV][PXV][LE][SF]$/.test(d.textContent.trim()));
    return el ? el.textContent.trim() : null;
  });
  ok("16-type profile code computed", !!profileCode, profileCode);
  ok("strengths shown", await pageB.locator("text=Strengths").first().isVisible());
  ok("watchouts shown", await pageB.locator("text=Watch out").first().isVisible());
  ok("growth zone shown", await pageB.locator("text=Growth zone").first().isVisible());
  await pageB.screenshot({ path: `${ARTIFACTS}17-questionnaire-results.png` });

  // ------------------------------------------------------- restart
  await pageB.click("button:has-text('Restart questionnaire')");
  await pageB.waitForSelector("text=Start the questionnaire");
  ok("questionnaire restart works", true);

  // ------------------------------------------------------- second player sees team summary update
  const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageC = await ctxC.newPage();
  watch(pageC, "C");
  await pageC.goto(`${BASE}/room/${qRoom.room.id}`);
  await pageC.fill("input[placeholder='e.g. Maria']", "Alex");
  await pageC.click("button:has-text('Join the Puzzle')");
  await pageC.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  await pageC.waitForSelector("text=Începe chestionarul");
  ok("second player joins questionnaire room", true);

  await pageB.click("button:has-text('Start the questionnaire')");
  for (let i = 0; i < 20; i++) {
    await pageB.click("button:has-text('Agree')");
    await pageB.waitForTimeout(40);
  }
  await pageB.waitForSelector("text=Team summary", { timeout: 8000 });
  ok("Maria's summary lists Alex as answering", await pageB.locator("text=answering…").first().isVisible());
  await pageB.screenshot({ path: `${ARTIFACTS}18-team-summary.png` });
} catch (e) {
  console.error("TEST ERROR:", e);
  results.push(false);
} finally {
  await browser.close();
}

console.log(`\nconsole/page errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log("  ⚠️", e);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} coaching browser checks passed`);
process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
