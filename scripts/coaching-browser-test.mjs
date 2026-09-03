/* Browser smoke test for the facilitator-controlled ranking flow. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });
const checks = [];
const ok = (name, value) => { checks.push(!!value); console.log(`${value ? "✅" : "❌"} ${name}`); };
const browser = await chromium.launch(chromiumLaunchOptions());
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: "en-US" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE);
  await page.getByRole("button", { name: /Create session|Creează sesiune/i }).click();
  await page.getByRole("button", { name: /Team coaching/i }).click();
  await page.getByRole("button", { name: /The Himalayan Expedition/i }).click();
  ok("coaching picker describes free ranking and gated reveal", await page.getByText(/Free ranking/).isVisible());
  ok("coaching picker hides jigsaw difficulty", await page.getByText("Difficulty", { exact: true }).count() === 0);
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.locator("#session-name").fill("Himalaya alignment");
  await page.locator("#display-name").fill("Ana");
  await page.getByRole("button", { name: /Create lobby/i }).click();
  await page.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  const state = await page.evaluate(() => window.__ptStore.getState());
  ok("coach joins as facilitator host in the lobby", state.players[0].role === "host" && state.room.stage === "lobby");
  ok("Share is available in coaching lobby", await page.getByRole("button", { name: /Invite teammates/i }).isVisible());
  await page.getByRole("button", { name: /Start for everyone/i }).click();
  await page.getByText("Activity brief").waitFor();
  ok("coaching opens a synchronized brief before play", true);
  await page.getByRole("button", { name: /begin activity/i }).click();
  await page.waitForFunction(() => window.__ptStore?.getState().room.stage === "play");
  ok("all 12 draggable cards render", await page.locator("[data-ranking-item]").count() === 12);
  ok("expert answer is absent before reveal", await page.getByText(/See expert ranking/i).count() === 0 && (await page.evaluate(() => window.__ptStore.getState().puzzle.activity.items.every((item) => item.expertRank === undefined))));

  // The test hook talks through the same WebSocket protocol, placing every card
  // on a deliberately non-expert permutation of the free destination slots.
  await page.evaluate(async () => {
    const state = window.__ptStore.getState();
    const ranks = [5, 2, 1, 3, 4, 6, 7, 8, 9, 10, 11, 12];
    for (let id = 0; id < 12; id++) {
      const slot = state.puzzle.rankingSlots.find((entry) => entry.rank === ranks[id]);
      window.__ptStore.sendPiece(id, slot.x, slot.y, false);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  });
  await page.waitForFunction(() => Object.values(window.__ptStore?.getState().pieces || {}).every((piece) => piece.placedOnSlot != null));
  ok("team can choose a non-expert permutation", (await page.evaluate(() => window.__ptStore.getState().pieces[0].placedOnSlot)) === 5);
  await page.getByRole("button", { name: /Facilitate/i }).click();
  await page.getByText("Facilitator mode").waitFor();
  ok("facilitator dashboard exposes lock, timer, people and export", await page.getByText("Timer").isVisible() && await page.getByText("People").isVisible() && await page.getByText("Session recap").isVisible());
  await page.getByRole("button", { name: /Reveal/i }).last().click();
  await page.waitForFunction(() => window.__ptStore?.getState().room.revealed === true);
  await page.getByText("Team results").waitFor();
  ok("expert results appear only after facilitator reveal", await page.getByText("Deviation score").isVisible());
  await page.screenshot({ path: `${ARTIFACTS}10-ranking-results.png` });
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 375, height: 667 }, locale: "en-US" });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE);
  ok("mobile viewport remains user-scalable", await mobilePage.locator('meta[name="viewport"]').getAttribute("content").then((value) => !value.includes("user-scalable=no")));
  await mobilePage.screenshot({ path: `${ARTIFACTS}11-mobile-landing.png` });
  await mobile.close();
} finally { await browser.close(); }
if (errors.length) console.error(errors.join("\n"));
const failed = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failed}/${checks.length} coaching browser checks passed`);
process.exit(failed ? 1 : 0);
