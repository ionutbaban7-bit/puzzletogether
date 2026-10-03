import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";
import { BASE, post, connect, place, close, until } from "./realtime-client.mjs";

const browser = await chromium.launch(chromiumLaunchOptions());
const peers = [], errors = [];
let host, guest;
mkdirSync("test-artifacts", { recursive: true });
async function placeWithKeyboard(page, id) {
  await page.getByRole("button", { name: `Piece ${id + 1}`, exact: true }).focus();
  await page.keyboard.press("Enter");
  const dest = await page.evaluate(id => {
    const s = window.__ptStore.getState(), p = s.pieces[id];
    return { row: String(Math.round(p.correctY / s.puzzle.pieceH)), col: String(Math.round(p.correctX / s.puzzle.pieceW)) };
  }, id);
  await page.getByLabel("Row", { exact: true }).selectOption({ value: dest.row });
  await page.getByLabel("Column", { exact: true }).selectOption({ value: dest.col });
  await page.getByRole("button", { name: "Place piece", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(id => window.__ptStore.getState().pieces[id].locked, id);
}
try {
  host = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const phone = await browser.newContext({ ...devices["Pixel 7"], locale: "en-US" });
  // The common clock must not depend on the phone's wall-clock setting.
  await phone.addInitScript(() => { const original = Date.now; Date.now = () => original() + 3 * 3600_000; });
  guest = await phone.newPage();
  for (const page of [host, guest]) {
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  }
  await host.goto(BASE + "/create");
  await host.getByRole("radio", { name: "12 pieces", exact: true }).check();
  await host.getByLabel("3. Your name").fill("Facilitator");
  await host.getByRole("checkbox", { name: "Facilitator: observe only", exact: true }).check();
  assert.equal(await host.getByRole("checkbox", { name: "Podium at the end", exact: true }).isChecked(), false);
  await host.getByRole("checkbox", { name: "Podium at the end", exact: true }).check();
  await host.getByRole("button", { name: "Create and invite", exact: true }).click();
  await host.getByRole("button", { name: "Start game", exact: true }).waitFor();
  await host.getByRole("button", { name: "Invite a friend", exact: true }).click();
  const link = await host.getByRole("textbox", { name: "Private link", exact: true }).inputValue();
  await guest.goto(link);
  await guest.getByRole("textbox", { name: "Your name", exact: true }).fill("Ana");
  await guest.getByRole("button", { name: "Join game", exact: true }).click();
  await guest.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  const room = await host.evaluate(() => window.__ptStore.getState().room);
  for (let i = 0; i < 24; i++) {
    const joined = await post(`/api/rooms/${room.id}/join`, { name: i === 0 ? "Bogdan" : i === 23 ? "W".repeat(24) : `Participant ${i + 2}`, code: room.code });
    assert.equal(joined.status, 200);
    peers.push(await connect(room.id, joined.data));
  }
  await host.getByRole("button", { name: /25\/25 · Invite/ }).waitFor();
  assert.equal(await host.getByRole("heading", { name: "Podium", exact: true }).count(), 0);
  await host.screenshot({ path: "test-artifacts/gamification-lobby.png", fullPage: true });
  await host.getByRole("button", { name: "Start game", exact: true }).click();
  await guest.waitForFunction(() => window.__ptStore.getState().room.stage === "play");
  await Promise.all(peers.map(c => until(c, c => c.room.stage === "play")));
  await guest.getByRole("timer", { name: "Team time" }).waitFor();
  await guest.waitForFunction(() => document.querySelector('[role="timer"]').textContent !== "00:00");
  assert.ok(Number((await guest.getByRole("timer").textContent()).split(":")[0]) < 1, "Phone clock skew cannot add three hours to the team timer");
  assert.equal(await guest.getByRole("button", { name: "Pause for everyone", exact: true }).count(), 0);
  await host.getByRole("button", { name: "Pause for everyone", exact: true }).click();
  await guest.getByText("Paused for everyone. The clock is stopped.", { exact: true }).waitFor();
  const paused = await guest.getByRole("timer").textContent();
  await guest.waitForTimeout(1200);
  assert.equal(await guest.getByRole("timer").textContent(), paused);
  assert.equal(await host.getByRole("timer").textContent(), paused);
  await host.getByRole("button", { name: "Resume game", exact: true }).click();
  await guest.waitForFunction(() => !window.__ptStore.getState().room.boardLocked);
  await guest.getByRole("button", { name: "Help", exact: true }).click();
  await guest.getByRole("button", { name: "Play without dragging", exact: true }).click();
  for (let id = 0; id < 6; id++) await placeWithKeyboard(guest, id);
  assert.equal(await guest.getByRole("heading", { name: "Podium", exact: true }).count(), 0);
  for (let id = 6; id < 12; id++) await place(peers[0], peers[0].pieces.get(id));
  await Promise.all([host, guest].map(page => page.getByRole("heading", { name: /We built it together/ }).waitFor()));
  const group = host.getByText("25 players · Show team", { exact: true });
  await group.click();
  assert.ok(await group.locator('..').locator('p').isVisible(), "The full group remains accessible without pushing the podium down on a phone");
  await group.click();
  const table = host.getByRole("table", { name: "Podium: placed pieces", exact: true });
  assert.equal(await table.locator("tbody tr").count(), 2);
  assert.deepEqual(await table.locator("tbody td:first-child").allTextContents(), ["1", "1"]);
  assert.deepEqual(await table.locator("tbody th").allTextContents(), ["Ana", "Bogdan"]);
  assert.deepEqual(await table.locator("tbody td:last-child").allTextContents(), ["6", "6"]);
  assert.equal(await host.getByRole("progressbar", { name: "Shared progress" }).getAttribute("value"), "12");
  await host.getByText("All contributions", { exact: true }).click();
  const contributions = host.getByRole("table", { name: "Everyone’s contributions", exact: true });
  assert.equal(await contributions.locator("tbody tr").count(), 25);
  assert.equal(await contributions.getByText("Facilitator", { exact: true }).count(), 0);
  const finalTime = await guest.getByRole("timer").textContent();
  await guest.waitForTimeout(1100);
  assert.equal(await guest.getByRole("timer").textContent(), finalTime);
  await host.screenshot({ path: "test-artifacts/gamification-desktop.png", fullPage: true });
  await guest.getByRole("button", { name: "Help", exact: true }).click();
  await guest.getByRole("button", { name: "ro", exact: true }).click();
  await guest.getByRole("button", { name: "Ajutor", exact: true }).click();
  await guest.getByRole("table", { name: "Podium: piese plasate", exact: true }).waitFor();
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await guest.setViewportSize(viewport);
    assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest.getByRole("heading", { name: "Podium", exact: true }).scrollIntoViewIfNeeded();
  await guest.screenshot({ path: "test-artifacts/gamification-phone.png", fullPage: true });
  const oldStart = await host.evaluate(() => window.__ptStore.getState().room.startedAt);
  await host.getByRole("button", { name: "Play again", exact: true }).click();
  await guest.waitForFunction(oldStart => {
    const s = window.__ptStore.getState();
    return !s.room.completed && s.room.startedAt !== oldStart && s.scores.every(s => s.placed === 0);
  }, oldStart);
  assert.equal(await guest.getByRole("heading", { name: "Podium", exact: true }).count(), 0);
  assert.equal(await guest.evaluate(() => window.__ptStore.getState().players.length), 26);
  assert.equal(await guest.evaluate(() => window.__ptStore.getState().room.podiumEnabled), true);
  assert.deepEqual(errors, []);
  console.log("PASS facilitator creation, 25 players visible, no live ranking, shared pause/time despite phone clock skew");
  console.log("PASS keyboard completion, tied final podium, all 25 contributions, RO/EN and 320/390/landscape widths");
  console.log("PASS fresh replay retains all 26 people and mode; no browser errors");
} catch (error) {
  for (const [i, page] of [host, guest].entries()) if (page) {
    console.error((await page.locator("body").innerText()).slice(0, 1400));
    await page.screenshot({ path: `test-artifacts/gamification-failure-${i}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await Promise.all(peers.map(close)); await browser.close(); }
