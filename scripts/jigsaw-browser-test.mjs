/**
 * Jigsaw cross-browser test (Stage 5/6): tray, filters, minimap, camera,
 * RO/EN controls, keyboard access, mystery mode, custom upload, and
 * iPhone/Android viewports — in Chromium, Firefox and WebKit.
 *
 * Requirements:
 *   - A running server:  npm start  (or: node src/server.js)
 *   - Browsers:          npx playwright install chromium firefox webkit
 *
 * Usage: node scripts/jigsaw-browser-test.mjs   (BASE=http://127.0.0.1:3000)
 */
import { chromium, firefox, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
// Optional executable support makes the focused viewport gate usable in
// constrained CI images. Normal runs still use Playwright's installed browser.
const launchChromium = () => chromium.launch(chromiumLaunchOptions());
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 400x300 gradient PNG used for the custom-upload flow.
const UPLOAD_PNG_B64 =
  "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";
const UPLOAD_FILE = `${ARTIFACTS}upload-test.png`;
writeFileSync(UPLOAD_FILE, Buffer.from(UPLOAD_PNG_B64, "base64"));

const checks = [];
const ok = (name, value, extra = "") => {
  checks.push(!!value);
  console.log(`${value ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};

/** Convert the server-authoritative x/y of a piece to page coordinates. */
function piecePoint(page, id) {
  return page.evaluate(
    (pieceId) => {
      const { pieces } = window.__ptStore.getState();
      const piece = pieces[pieceId];
      const cam = window.__ptCamera.current;
      const rect = document.querySelector("canvas").getBoundingClientRect();
      return { x: rect.left + piece.x * cam.scale + cam.x, y: rect.top + piece.y * cam.scale + cam.y };
    },
    id,
  );
}

const FAMILY_FLOW = {
  jigsaw: {
    category: /Paintings/i,
    puzzle: /Starry Night/i,
    difficulty: "Medium",
    expectedStage: "play",
  },
  "letter-canvas": {
    category: /Letter Canvas/i,
    puzzle: /Agile Values Letter Canvas/i,
    difficulty: "Quick",
    expectedStage: "play",
  },
  "sentence-canvas": {
    category: /Sentence Canvas/i,
    puzzle: /Funny Story Canvas/i,
    difficulty: "Quick",
    expectedStage: "play",
  },
  coaching: {
    category: /Team coaching/i,
    puzzle: /The Himalayan Expedition/i,
    expectedStage: "brief",
  },
};

async function createRoomViaUi(page, { difficulty = "Medium", mystery = false, upload = false, family = "jigsaw" } = {}) {
  const flow = FAMILY_FLOW[family];
  await page.goto(BASE);
    await page.getByRole("heading", { name: /Play\. Talk\. Decide\.|Jucați\. Vorbiți\. Decideți\./i }).waitFor();
  await page.getByRole("button", { name: /Create session/i }).click();
  await page.getByRole("button", { name: flow.category }).click();
  if (upload) {
    if (family !== "jigsaw") throw new Error("Only jigsaw rooms support custom image uploads.");
    await page.locator('input[type="file"]').setInputFiles(UPLOAD_FILE);
    ok(`upload: privacy notice shown`, await page.getByText(/Confidențialitate|Privacy/i).isVisible());
  } else {
    await page.getByRole("button", { name: flow.puzzle }).click();
  }
  if (family !== "coaching") {
    await page.getByRole("button", { name: new RegExp(`^${difficulty || flow.difficulty}`) }).click();
  }
  if (mystery) await page.getByLabel(/Mod mister|Mystery mode/i).check();
  await page.getByRole("button", { name: /Continue|Continuă/i }).click();
  await page.locator("#session-name").fill("Browser test");
  await page.locator("#display-name").fill("BrowserBot");
  await page.getByRole("button", { name: /Create lobby|Creează lobby/i }).click();
  await page.waitForURL("**/room/**");
  await page.waitForFunction(() => window.__ptStore?.getState().status === "joined");
}

async function startPlay(page) {
  await page.getByRole("button", { name: /Start for everyone|Start pentru toți/i }).click();
  await page.waitForFunction(() => window.__ptStore?.getState().room.stage === "play");
  await sleep(900);
}

const ENGINES = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];


// Stage 0 regression gate: a facilitator must be able to reach Start without
// scrolling the page, including the taller Canvas lobby cards. Each check
// combines viewport visibility and the server-synchronised stage transition.
const LOBBY_VIEWPORTS = [
  [360, 800],
  [390, 844],
  [1280, 650],
  [1440, 900],
];

async function startButtonIsInViewport(page) {
  return page.getByRole("button", { name: /Start for everyone|Start pentru toți/i }).evaluate((button) => {
    const r = button.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
  });
}

async function runLobbyViewportGate() {
  const browser = await launchChromium();
  const errors = [];
  try {
    for (const [family, flow] of Object.entries(FAMILY_FLOW)) {
      for (const [width, height] of LOBBY_VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width, height }, locale: "en-US", hasTouch: width < 640, isMobile: width < 640 });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${family} ${width}x${height}: ${error.message}`));
        try {
          await createRoomViaUi(page, { family, difficulty: flow.difficulty });
          const visible = await startButtonIsInViewport(page);
          if (visible) {
            await page.getByRole("button", { name: /Start for everyone|Start pentru toți/i }).click();
          }
          const advanced = visible && await page.waitForFunction(
            (stage) => window.__ptStore?.getState().room?.stage === stage,
            flow.expectedStage,
            { timeout: 4_000 },
          ).then(() => true).catch(() => false);
          // Exactly one check per activity/viewport pair: 4 × 4 = 16.
          ok(`lobby ${family} ${width}x${height}: create → lobby → Start → ${flow.expectedStage}`, advanced);
        } catch (error) {
          ok(`lobby ${family} ${width}x${height}: create → lobby → Start → ${flow.expectedStage}`, false, error instanceof Error ? error.message : String(error));
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (errors.length) console.error(`❌ lobby viewport gate: ${errors.length} uncaught page error(s): ${errors.slice(0, 3).join(" | ")}`);
  return errors;
}

const lobbyPageErrors = await runLobbyViewportGate();
if (process.env.LOBBY_ONLY === "1") {
  const passed = checks.filter(Boolean).length;
  const total = LOBBY_VIEWPORTS.length * Object.keys(FAMILY_FLOW).length;
  console.log(`\n📊 ${passed}/${total} Stage 0 lobby viewport checks passed`);
  process.exit(passed === total && lobbyPageErrors.length === 0 ? 0 : 1);
}


for (const [engineName, engine] of ENGINES) {
  console.log(`\n━━━ ${engineName} ━━━`);
  const browser = engineName === "chromium" ? await launchChromium() : await engine.launch();
  const errors = [];

  try {
    // ------------------------------------------------ desktop 1440x900
    let context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
    let page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`[desktop] ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`[desktop] ${m.text()}`); });
    await createRoomViaUi(page, { difficulty: "Medium" });
    ok(`${engineName} desktop: lobby shows attribution`, await page.getByText(/Atribuire imagine|Image attribution/i).isVisible());
    await startPlay(page);

    // Filters (RO is the default UI language)
    const filterNames = ["Toate", "Margine", "Interior", "Neplasate"];
    for (const label of filterNames) {
      const btn = page.getByRole("button", { name: label, exact: true });
      if (!(await btn.isVisible())) { ok(`${engineName} desktop: filter "${label}" visible`, false); continue; }
      await btn.click();
      const pressed = await btn.getAttribute("aria-pressed");
      ok(`${engineName} desktop: filter "${label}" toggles`, pressed === "true");
    }
    await page.getByRole("button", { name: "Toate", exact: true }).click();

    ok(
      `${engineName} desktop: bring-unplaced button`,
      await page.getByRole("button", { name: /Aduce piesele neplasate|Bring unplaced/i }).isVisible(),
    );

    // Zoom + reset (DOM buttons, keyboard-accessible)
    await page.getByRole("button", { name: /Mărește|Zoom in/i }).click();
    await page.getByRole("button", { name: /Mărește|Zoom in/i }).click();
    await page.getByRole("button", { name: /Resetează vederea|Reset view/i }).click();
    ok(`${engineName} desktop: zoom and reset work`, true);

    // Keyboard: focus a filter and press Enter
    await page.getByRole("button", { name: "Neplasate", exact: true }).focus();
    await page.keyboard.press("Enter");
    ok(
      `${engineName} desktop: keyboard activates filter`,
      (await page.getByRole("button", { name: "Neplasate", exact: true }).getAttribute("aria-pressed")) === "true",
    );
    await page.getByRole("button", { name: "Toate", exact: true }).focus();
    await page.keyboard.press("Enter");

    // RO/EN: switch to English and verify control labels
    await page.getByRole("button", { name: "en", exact: true }).click();
    await sleep(300);
    ok(
      `${engineName} desktop: EN control labels`,
      (await page.getByRole("button", { name: "Unplaced", exact: true }).isVisible()) &&
        (await page.getByRole("button", { name: /Zoom in/i }).isVisible()) &&
        (await page.getByRole("button", { name: /Reference/i }).isVisible()) &&
        (await page.getByRole("button", { name: /Bring unplaced pieces into view/i }).isVisible()),
    );
    await page.getByRole("button", { name: "ro", exact: true }).click();
    await sleep(300);

    // Opt into the ordered help tray, then tap a real server-positioned piece.
    await page.getByRole("button", { name: /Ajutor \(casetă\)|Help \(tray\)/i }).click();
    await page.waitForFunction(() => window.__ptStore.getState().room.jigsawLayout === "tray");
    await page.getByRole("button", { name: /Aduce piesele neplasate|Bring unplaced/i }).click();
    let point = await piecePoint(page, 3);
    await page.mouse.click(point.x, point.y);
    await sleep(1000);
    const moved3 = await page.evaluate(() => window.__ptStore.getState().pieces[3]?.moved === true);
    ok(`${engineName} desktop: tap a tray piece moves it`, moved3);

    // Pan with a drag on an empty area
    const canvasBox = await page.locator("canvas").boundingBox();
    await page.mouse.move(canvasBox.x + 30, canvasBox.y + canvasBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 230, canvasBox.y + canvasBox.height / 2 + 80, { steps: 8 });
    await page.mouse.up();
    ok(`${engineName} desktop: pan drag runs`, true);
    await page.screenshot({ path: `${ARTIFACTS}browser-${engineName}-desktop.png` });
    await context.close();

    // ------------------------------------------------ mystery mode
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`[mystery] ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`[mystery] ${m.text()}`); });
    await createRoomViaUi(page, { difficulty: "Medium", mystery: true });
    await startPlay(page);
    ok(`${engineName} mystery: flag reaches the client`, await page.evaluate(() => window.__ptStore.getState().puzzle.mystery === true));
    ok(`${engineName} mystery: reference toggle disabled`, await page.getByRole("button", { name: /Referință|Reference/i }).isDisabled());
    await page.screenshot({ path: `${ARTIFACTS}browser-${engineName}-mystery.png` });
    await context.close();

    // ------------------------------------------------ mobile viewports
    for (const [deviceName, viewport] of [["iphone", { width: 390, height: 844 }], ["android", { width: 360, height: 800 }]]) {
      context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: "en-US" });
      page = await context.newPage();
      page.on("pageerror", (e) => errors.push(`[${deviceName}] ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") errors.push(`[${deviceName}] ${m.text()}`); });
      await createRoomViaUi(page, { difficulty: "Medium" });
      await startPlay(page);

      // Opt into the help tray, fit it, then tap a real server-positioned piece.
      await page.getByRole("button", { name: /Ajutor \(casetă\)|Help \(tray\)/i }).click();
      await page.waitForFunction(() => window.__ptStore.getState().room.jigsawLayout === "tray");
      await page.getByRole("button", { name: /Aduce piesele neplasate|Bring unplaced/i }).click();
      await sleep(500);
      const pieceId = deviceName === "iphone" ? 5 : 7;
      const tap = await piecePoint(page, pieceId);
      await page.touchscreen.tap(tap.x, tap.y);
      await sleep(1100);
      const moved = await page.evaluate((id) => window.__ptStore.getState().pieces[id]?.moved === true, pieceId);
      ok(`${engineName} ${deviceName}: touch-tap places a tray piece`, moved);

      // Pan with a touch drag on an empty area (left edge).
      const box = await page.locator("canvas").boundingBox();
      await page.mouse.move(box.x + 15, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + box.height / 2 + 60, { steps: 6 });
      await page.mouse.up();

      // Mobile filters + zoom still reachable
      await page.getByRole("button", { name: "Neplasate", exact: true }).click();
      ok(
        `${engineName} ${deviceName}: mobile filter works`,
        (await page.getByRole("button", { name: "Neplasate", exact: true }).getAttribute("aria-pressed")) === "true",
      );
      await page.getByRole("button", { name: "Toate", exact: true }).click();
      await page.screenshot({ path: `${ARTIFACTS}browser-${engineName}-${deviceName}.png` });
      await context.close();
    }

    ok(`${engineName}: no uncaught browser errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }
}

console.log(`\n📊 ${checks.filter(Boolean).length}/${checks.length} cross-browser checks passed`);
process.exit(checks.every(Boolean) && lobbyPageErrors.length === 0 ? 0 : 1);
