import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { createCanvas } from "@napi-rs/canvas";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const browser = await chromium.launch(chromiumLaunchOptions());
const errors = [];
mkdirSync("test-artifacts", { recursive: true });
function fixture(color, width, height) {
  const canvas = createCanvas(width, height), ctx = canvas.getContext("2d");
  ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff"; ctx.font = "36px sans-serif"; ctx.fillText("Together", 30, 120);
  return { name: "family.png", mimeType: "image/png", buffer: canvas.toBuffer("image/png") };
}
let host, guest;
async function finish(page) {
  for (let id = 0; id < 12; id++) {
    await page.getByRole("button", { name: `Piece ${id + 1}`, exact: true }).click();
    const dest = await page.evaluate(id => {
      const s = window.__ptStore.getState(), p = s.pieces[id];
      return { r: String(Math.round(p.correctY / s.puzzle.pieceH)), c: String(Math.round(p.correctX / s.puzzle.pieceW)) };
    }, id);
    await page.getByLabel("Row", { exact: true }).selectOption({ value: dest.r });
    await page.getByLabel("Column", { exact: true }).selectOption({ value: dest.c });
    await page.getByRole("button", { name: "Place piece", exact: true }).click();
    await page.waitForFunction(id => window.__ptStore.getState().pieces[id].locked, id);
  }
  await host.getByRole("heading", { name: /We built it together/ }).waitFor();
}
try {
  host = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
  const guestContext = await browser.newContext({ ...devices["Pixel 7"], locale: "en-US" });
  guest = await guestContext.newPage();
  for (const page of [host, guest]) { page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); }
  await host.goto(BASE);
  await host.getByRole("button", { name: "Create a puzzle", exact: true }).click();
  await host.getByLabel("Upload a photo", { exact: true }).setInputFiles(fixture("#059669", 300, 450));
  await host.getByRole("radio", { name: "12 pieces", exact: true }).check();
  await host.getByLabel("3. Your name").fill("Photo host");
  await host.screenshot({ path: "test-artifacts/photo-create.png", fullPage: true });
  await host.getByRole("button", { name: "Create and invite" }).click();
  await host.getByRole("button", { name: "Start game", exact: true }).waitFor();
  const first = await host.evaluate(() => { const s = window.__ptStore.getState(); return { id: s.room.id, url: s.puzzle.image, deadline: s.room.photoExpiresAt, width: s.puzzle.width, height: s.puzzle.height }; });
  assert.equal(first.width, 300); assert.equal(first.height, 450);
  await host.getByRole("button", { name: "Invite a friend", exact: true }).click();
  const link = await host.getByRole("textbox", { name: "Private link" }).inputValue();
  await guest.goto(link);
  await guest.getByRole("textbox", { name: "Your name" }).fill("Photo guest");
  await guest.getByRole("button", { name: "Join game", exact: true }).click();
  await guest.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  await host.getByRole("button", { name: "Start game", exact: true }).click();
  await guest.getByRole("button", { name: "Help", exact: true }).click();
  await guest.getByRole("button", { name: "Play without dragging", exact: true }).click();
  await finish(guest);
  await guest.screenshot({ path: "test-artifacts/photo-phone-finish.png", fullPage: true });
  assert.equal(await guest.evaluate(() => window.__ptStore.getState().puzzle.image), first.url);
  await host.getByLabel("Upload a photo", { exact: true }).setInputFiles(fixture("#1d4ed8", 600, 300));
  await host.getByRole("button", { name: "Choose picture", exact: true }).click();
  await guest.waitForFunction(url => window.__ptStore.getState().puzzle.image !== url, first.url);
  const second = await host.evaluate(() => { const s = window.__ptStore.getState(); return { id: s.room.id, url: s.puzzle.image, deadline: s.room.photoExpiresAt, width: s.puzzle.width, height: s.puzzle.height }; });
  assert.equal(second.id, first.id); assert.equal(second.width, 600); assert.equal(second.height, 300);
  assert.equal((await host.request.get(BASE + first.url)).status(), 404);
  await host.getByRole("button", { name: "Start game", exact: true }).click();
  await finish(guest);
  await host.getByRole("button", { name: "Play again", exact: true }).click();
  await guest.waitForFunction(() => !window.__ptStore.getState().room.completed);
  assert.equal(await guest.evaluate(() => window.__ptStore.getState().room.photoExpiresAt), second.deadline);
  await host.reload();
  await host.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  assert.equal(await host.evaluate(() => window.__ptStore.getState().room.photoExpiresAt), second.deadline);
  await finish(guest);
  await host.getByLabel("Another puzzle", { exact: true }).selectOption("starry-night");
  await host.getByRole("button", { name: "Choose picture", exact: true }).click();
  await guest.waitForFunction(() => window.__ptStore.getState().room.puzzleId === "starry-night");
  assert.equal((await host.request.get(BASE + second.url)).status(), 404);
  assert.equal(await guest.evaluate(() => window.__ptStore.getState().room.photoExpiresAt), null);
  assert.equal(await guest.evaluate(() => window.__ptStore.getState().players.length), 2);
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log("PASS personal portrait upload, private phone guest and full completion");
  console.log("PASS replace with landscape photo in same group; former photo deleted");
  console.log("PASS replay and refresh preserve original deadline; library selection deletes second photo");
} catch (error) {
  for (const [index, page] of [host, guest].entries()) if (page) {
    console.error((await page.locator("body").innerText()).slice(0, 1500));
    await page.screenshot({ path: `test-artifacts/photo-failure-${index}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
