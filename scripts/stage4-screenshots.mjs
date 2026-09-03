#!/usr/bin/env node
/**
 * Reproducible Stage 4 visual captures.
 *
 * Start the backend and a Vite client first, then run:
 *   BASE=http://127.0.0.1:5174 node scripts/stage4-screenshots.mjs
 *
 * In constrained CI, the same PLAYWRIGHT_CHROMIUM_* environment variables as
 * scripts/jigsaw-browser-test.mjs can point at a compatible Chromium binary.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const args = (process.env.PLAYWRIGHT_CHROMIUM_ARGS || "").split(",").map((value) => value.trim()).filter(Boolean);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), ...(args.length ? { args } : {}) });
try {
  let context = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: "en-US" });
  let page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Play\. Talk\. Decide\./i }).waitFor();
  await page.screenshot({ path: `${OUT}landing-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: /Create session/i }).click();
  await page.getByRole("heading", { name: /Choose activity/i }).waitFor();
  await page.screenshot({ path: `${OUT}create-desktop.png`, fullPage: true });
  await context.close();

  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "en-US" });
  page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}landing-mobile.png`, fullPage: true });
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: "en-US" });
  page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Create session/i }).click();
  await page.getByRole("button", { name: /Paintings/i }).click();
  await page.getByRole("button", { name: /Starry Night/i }).click();
  await page.getByRole("button", { name: /^Medium/ }).click();
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.locator("#session-name").fill("Coaching Partners demo");
  await page.locator("#display-name").fill("Facilitator");
  await page.getByRole("button", { name: /Create lobby/i }).click();
  await page.waitForURL("**/room/**");
  await page.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  await page.getByRole("button", { name: /Start for everyone/i }).click();
  await page.waitForFunction(() => window.__ptStore?.getState().room?.stage === "play");
  // The server deliberately starts hard mode scattered; opt into its
  // deterministic help tray so the capture shows pieces as well as dark HUD.
  await page.getByRole("button", { name: /Help \(tray\)/i }).click();
  await page.waitForFunction(() => window.__ptStore?.getState().room?.jigsawLayout === "tray");
  await page.getByRole("button", { name: /Bring unplaced/i }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}jigsaw-play-desktop.png`, fullPage: false });
  await context.close();
} finally {
  await browser.close();
}

console.log(`Stage 4 screenshots written to ${OUT}`);
