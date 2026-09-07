/**
 * Mobile jigsaw gameplay gate (2026-09-07 remediation).
 *
 * Verifies, on phone-sized touch viewports, that:
 *   1. the initial camera frames the target board legibly (the old fit clamped
 *      to an unreadable minimum zoom with the board off-screen);
 *   2. a real touch drag grabs, carries and drops a server-authoritative piece
 *      (claim, moved flag, released claim);
 *   3. holding a dragged piece against a screen edge auto-pans the camera so a
 *      phone user can carry it from the scatter band to the board in ONE
 *      gesture;
 *   4. double-tap on empty canvas toggles between the readable mobile zoom and
 *      the framed board view;
 *   5. the landing showcase thumbnails decode on the phone viewport and the
 *      Clarity Express CTA stays in the same tab.
 *
 * Requirements: a running server (npm run dev / npm start) and a Chromium
 * runtime (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for a supplied binary).
 *
 * Usage: node scripts/mobile-gameplay-test.mjs   (BASE=http://127.0.0.1:3000)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checks = [];
const ok = (name, value, extra = "") => {
  checks.push(!!value);
  console.log(`${value ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const camera = (page) => page.evaluate(() => ({ ...window.__ptCamera.current }));
const piecePoint = (page, id) =>
  page.evaluate((pieceId) => {
    const { pieces } = window.__ptStore.getState();
    const piece = pieces[pieceId];
    const cam = window.__ptCamera.current;
    const rect = document.querySelector("canvas").getBoundingClientRect();
    return {
      x: rect.left + (piece.x + 20) * cam.scale + cam.x,
      y: rect.top + (piece.y + 20) * cam.scale + cam.y,
    };
  }, id);

async function createRoomViaUi(page, { difficulty = "Medium" } = {}) {
  await page.goto(BASE);
  await page.getByRole("heading", { name: /Play\. Talk\. (Decide|Choose)\.|Jucați\. Vorbiți\. (Decideți|Alegeți)\./i }).waitFor();
  await page.getByRole("button", { name: /Create session/i }).click();
  await page.getByRole("button", { name: /Paintings/i }).click();
  await page.getByRole("button", { name: /Starry Night/i }).click();
  await page.getByRole("button", { name: new RegExp(`^${difficulty}`) }).click();
  await page.getByRole("button", { name: /Continue|Continuă/i }).click();
  await page.locator("#session-name").fill("Mobile QA");
  await page.locator("#display-name").fill("MobileBot");
  await page.getByRole("button", { name: /Create lobby|Creează lobby/i }).click();
  await page.waitForURL("**/room/**");
  await page.waitForFunction(() => window.__ptStore?.getState().status === "joined");
}

/** Real touch events via CDP so pointerType is "touch" end to end. */
function touchHelper(page) {
  return {
    async tap(x, y) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    },
    async drag(from, to, { steps = 12, holdAtEndMs = 0, onHold } = {}) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
      await sleep(40);
      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
        await sleep(24);
      }
      if (holdAtEndMs > 0 && onHold) {
        await sleep(120); // let the autopan loop spin up
        await onHold();
        await sleep(holdAtEndMs);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    },
  };
}

const errors = [];
const watch = (page, label) => {
  page.on("pageerror", (error) => errors.push(`[${label}] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${label}] ${message.text()}`);
  });
};

const browser = await chromium.launch(chromiumLaunchOptions());
try {
  // ------------------------------------------------------------ landing (mobile)
  const landingCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    locale: "en-US",
  });
  const landing = await landingCtx.newPage();
  watch(landing, "landing");
  await landing.goto(BASE, { waitUntil: "networkidle" });
  await landing.waitForTimeout(600);
  const showcase = await landing.evaluate(() =>
    Array.from(document.querySelectorAll("img[src*='/images/thumbs/']")).map((img) => ({
      src: img.getAttribute("src"),
      loaded: img.complete && img.naturalWidth > 0,
      lazy: img.getAttribute("loading") === "lazy",
    })),
  );
  ok(
    `landing: all ${showcase.length} showcase thumbnails decode on phone viewport`,
    showcase.length >= 5 && showcase.every((s) => s.loaded && !s.lazy),
  );
  const clarityTarget = await landing.locator("a[href*='coaching-hub']").first().getAttribute("target");
  ok("landing: Clarity Express CTA keeps the same tab", clarityTarget === null);
  await landing.screenshot({ path: `${ARTIFACTS}mobile-01-landing.png`, fullPage: true });
  await landingCtx.close();

  // ------------------------------------------------------------ gameplay (mobile)
  for (const [deviceName, viewport] of [["iphone", { width: 390, height: 844 }], ["android", { width: 360, height: 800 }]]) {
    const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, locale: "en-US" });
    const page = await ctx.newPage();
    watch(page, deviceName);
    const touch = touchHelper(page);
    await createRoomViaUi(page);
    await page.getByRole("button", { name: /Start for everyone|Start pentru toți/i }).click();
    await page.waitForFunction(() => window.__ptStore?.getState().room.stage === "play");
    await sleep(900);

    // 1. Initial camera: the target board must be framed legibly.
    const { puzzle } = await page.evaluate(() => window.__ptStore.getState());
    let cam = await camera(page);
    const vw = viewport.width;
    const vh = viewport.height;
    const boardLeft = cam.x;
    const boardTop = cam.y;
    const boardRight = cam.x + puzzle.width * cam.scale;
    const boardBottom = cam.y + puzzle.height * cam.scale;
    const framedHorizontally = boardLeft >= -4 && boardRight <= vw + 4;
    const visibleBoardHeight = Math.min(boardBottom, vh) - Math.max(boardTop, 0);
    ok(
      `${deviceName}: initial camera frames the target board (scale ${cam.scale.toFixed(2)})`,
      framedHorizontally && visibleBoardHeight >= 0.5 * Math.min(puzzle.height * cam.scale, vh) && cam.scale >= 0.15,
    );

    // 2. Real touch drag on a scattered piece: claim → carry → drop → release.
    // Scattered pieces overlap and the top-most overlap wins the grab, so the
    // test observes the live server claim mid-drag instead of guessing ids.
    await page.getByRole("button", { name: /Aduce piesele neplasate|Bring unplaced/i }).click();
    await sleep(500);
    // Pick a touch point in the "safe" band: clear of the filter bar, the
    // bottom control strip, the minimap and the auto-pan edge zones.
    const start = await page.evaluate(() => {
      const s = window.__ptStore.getState();
      const cam = window.__ptCamera.current;
      const rect = document.querySelector("canvas").getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const candidates = Object.values(s.pieces).filter((p) => !p.locked && !p.moved);
      for (const p of candidates) {
        const x = rect.left + (p.x + 20) * cam.scale + cam.x;
        const y = rect.top + (p.y + 20) * cam.scale + cam.y;
        if (x > 60 && x < vw - 60 && y > 170 && y < vh - 150) return { x, y };
      }
      return null;
    });
    if (!start) {
      ok(`${deviceName}: touch drag carries and drops a piece`, false, "no safe touch point found");
    } else {
      const dropAt = { x: Math.min(vw - 90, start.x + 110), y: Math.max(180, start.y - 130) };
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y }] });
      await sleep(60);
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const x = start.x + ((dropAt.x - start.x) * i) / steps;
        const y = start.y + ((dropAt.y - start.y) * i) / steps;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
        await sleep(36);
      }
      // Mid-drag: the server claim must be visible on the dragged piece.
      const heldIds = await page.evaluate(() =>
        Object.values(window.__ptStore.getState().pieces).filter((p) => p.heldBy).map((p) => p.id),
      );
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      await sleep(700);
      const dropWorld = await page.evaluate((pt) => {
        const cam = window.__ptCamera.current;
        return { x: (pt.x - cam.x) / cam.scale, y: (pt.y - cam.y) / cam.scale };
      }, dropAt);
      const dragResult = await page.evaluate(
        ({ world, heldIds }) => {
          const { pieces, puzzle } = window.__ptStore.getState();
          const moved = Object.values(pieces).filter((p) => p.moved).map((p) => p.id);
          const dragged = heldIds.map((id) => pieces[id]).filter(Boolean).map((p) => ({
            id: p.id,
            heldBy: p.heldBy,
            distance: Math.hypot(p.x - world.x, p.y - world.y),
          }));
          return { moved, dragged, pieceW: puzzle.pieceW };
        },
        { world: dropWorld, heldIds },
      );
      const dragged = dragResult.dragged[0];
      ok(
        `${deviceName}: touch drag claims, carries and drops a piece (held mid-drag=${JSON.stringify(heldIds)}, released=${dragged?.heldBy === null})`,
        heldIds.length === 1 &&
          !!dragged &&
          dragged.heldBy === null &&
          dragResult.moved.includes(dragged.id) &&
          dragged.distance < dragResult.pieceW * 2.2,
        dragged ? `distance ${Math.round(dragged.distance)}px` : "",
      );

      // 3. Edge auto-pan: hold the dragged piece against the right edge.
      const grabPoint = await page.evaluate(
        (id) => {
          const p = window.__ptStore.getState().pieces[id];
          const cam = window.__ptCamera.current;
          const rect = document.querySelector("canvas").getBoundingClientRect();
          return { x: rect.left + (p.x + 20) * cam.scale + cam.x, y: rect.top + (p.y + 20) * cam.scale + cam.y };
        },
        dragged.id,
      );
      cam = await camera(page);
      const camBefore = cam.x;
      await touch.drag(grabPoint, { x: vw - 12, y: vh / 2 }, {
        steps: 14,
        holdAtEndMs: 700,
        onHold: async () => {},
      });
      await sleep(150);
      const camAfter = (await camera(page)).x;
      ok(
        `${deviceName}: edge auto-pan pans while a piece is held at the screen edge (Δx=${(camAfter - camBefore).toFixed(1)}px)`,
        camAfter < camBefore - 40,
      );
    }

    // 4. Double-tap on empty canvas toggles zoom, then returns to the framed view.
    cam = await camera(page);
    const scaleBefore = cam.scale;
    // Middle of the screen: clear of the filter bar (top) and control buttons (bottom).
    const empty = { x: vw * 0.5, y: vh * 0.45 };
    await touch.tap(empty.x, empty.y);
    await sleep(80);
    await touch.tap(empty.x, empty.y);
    await sleep(400);
    const zoomedScale = (await camera(page)).scale;
    ok(
      `${deviceName}: double-tap zooms in (${scaleBefore.toFixed(2)} → ${zoomedScale.toFixed(2)})`,
      zoomedScale > scaleBefore + 0.12,
    );
    await touch.tap(empty.x, empty.y);
    await sleep(80);
    await touch.tap(empty.x, empty.y);
    await sleep(400);
    const finalScale = (await camera(page)).scale;
    ok(
      `${deviceName}: second double-tap returns to the framed view (${finalScale.toFixed(2)})`,
      Math.abs(finalScale - zoomedScale) > 0.12 && finalScale < zoomedScale,
    );

    await page.screenshot({ path: `${ARTIFACTS}mobile-02-gameplay-${deviceName}.png` });
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (errors.length) console.error(errors.join("\n"));
const failed = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failed}/${checks.length} mobile gameplay checks passed`);
process.exit(failed || errors.length ? 1 : 0);
