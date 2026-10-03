import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { chromiumLaunchOptions } from "./playwright-runtime.mjs";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const browser = await chromium.launch(chromiumLaunchOptions());
const errors = [];
mkdirSync("test-artifacts", { recursive: true });
async function watch(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}
try {
  const hostContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const guestContext = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "en-US",
  });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  await watch(host);
  await watch(guest);
  await host.goto(BASE);
  assert.equal(
    await host
      .getByRole("button", { name: "Create a puzzle", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await host.getByText(/CARTOGRAF|Clarity Express|CoachingHub/).count(),
    0,
  );
  await host
    .getByRole("button", { name: "Create a puzzle", exact: true })
    .click();
  await host.locator('input[name="picture"][value="mona-lisa"]').check();
  await host.getByRole("radio", { name: "12 pieces", exact: true }).check();
  await host.getByLabel("3. Your name").fill("Host");
  await host.getByRole("button", { name: "Create and invite" }).click();
  await host.getByRole("button", { name: "Start game", exact: true }).waitFor();
  await host.getByRole("button", { name: /Invite a friend/ }).click();
  const invitation = await host
    .getByRole("textbox", { name: "Private link" })
    .inputValue();
  assert.match(invitation, /#invite=[\w-]{43}$/);
  await guest.goto(invitation);
  const name = guest.getByRole("textbox", { name: "Your name" });
  await name.fill("Guest");
  assert.equal(
    await guest.getByRole("textbox", { name: "Game code" }).count(),
    0,
  );
  await guest.getByRole("button", { name: "Join game", exact: true }).click();
  await guest.waitForFunction(
    () => window.__ptStore?.getState().status === "joined",
  );
  assert.equal(new URL(guest.url()).hash, "");
  await host.getByRole("button", { name: "Start game", exact: true }).click();
  await guest.waitForFunction(
    () => window.__ptStore?.getState().room.stage === "play",
  );
  await guest.getByRole("button", { name: "Help", exact: true }).click();
  await guest
    .getByRole("button", { name: "Play without dragging", exact: true })
    .click();
  await guest.getByRole("button", { name: "Piece 1", exact: true }).focus();
  await guest.keyboard.press("Enter");
  await guest.getByLabel("Row", { exact: true }).selectOption("0");
  await guest.getByLabel("Column", { exact: true }).selectOption("0");
  await guest.getByRole("button", { name: "Place piece", exact: true }).focus();
  await guest.keyboard.press("Enter");
  await guest.waitForFunction(
    () => window.__ptStore.getState().pieces[0].locked,
  );
  await host.waitForFunction(
    () => window.__ptStore.getState().pieces[0].locked,
  );
  console.log(
    "PASS create, private one-link join, 12-piece portrait, keyboard placement synchronized",
  );
  const before = await guest.evaluate(() => ({
    pid: localStorage.getItem("pt.pid"),
    room: window.__ptStore.getState().room.id,
  }));
  await guest.reload();
  await guest.waitForFunction(
    () => window.__ptStore?.getState().pieces[0]?.locked,
  );
  assert.equal(
    await guest.evaluate(() => localStorage.getItem("pt.pid")),
    before.pid,
  );
  console.log("PASS refreshed browser resumes authenticated progress");
  // Exercise real touch selection and native destination controls at phone scale.
  await guest.getByRole("button", { name: "Help", exact: true }).tap();
  await guest
    .getByRole("button", { name: "Play without dragging", exact: true })
    .tap();
  await guest.getByRole("button", { name: "Piece 2", exact: true }).tap();
  const dest = await guest.evaluate(() => {
    const s = window.__ptStore.getState();
    const p = s.pieces[1];
    return {
      row: String(Math.round(p.correctY / s.puzzle.pieceH)),
      col: String(Math.round(p.correctX / s.puzzle.pieceW)),
    };
  });
  await guest.getByLabel("Row", { exact: true }).selectOption({ value: dest.row });
  await guest.getByLabel("Column", { exact: true }).selectOption({ value: dest.col });
  assert.equal(await guest.getByLabel("Column", {exact:true}).inputValue(), dest.col);
  await guest.getByRole("button", { name: "Place piece", exact: true }).tap();
  await host.waitForFunction(
    () => window.__ptStore.getState().pieces[1].locked,
  );
  assert.ok(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await guest.screenshot({
    path: "test-artifacts/v2-phone.png",
    fullPage: true,
  });
  await host.getByRole("button", { name: /Invite/ }).click();
  await host.screenshot({
    path: "test-artifacts/v2-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS phone tap placement, no horizontal overflow, desktop/mobile screenshots",
  );
  // Complete the remaining puzzle through the same keyboard controls (no store mutation).
  for (const id of await guest.evaluate(() =>
    Object.values(window.__ptStore.getState().pieces)
      .filter((p) => !p.locked)
      .map((p) => p.id),
  )) {
    await guest
      .getByRole("button", { name: `Piece ${id + 1}`, exact: true })
      .focus();
    await guest.keyboard.press("Enter");
    const d = await guest.evaluate((id) => {
      const s = window.__ptStore.getState(),
        p = s.pieces[id];
      return {
        r: String(Math.round(p.correctY / s.puzzle.pieceH)),
        c: String(Math.round(p.correctX / s.puzzle.pieceW)),
      };
    }, id);
    await guest.getByLabel("Row", { exact: true }).selectOption({ value: d.r });
    await guest.getByLabel("Column", { exact: true }).selectOption({ value: d.c });
    await guest
      .getByRole("button", { name: "Place piece", exact: true })
      .focus();
    await guest.keyboard.press("Enter");
    await guest.waitForFunction(
      (id) => window.__ptStore.getState().pieces[id].locked,
      id,
    );
  }
  await host.getByRole("heading", { name: /We built it together/ }).waitFor();
  await guest.getByRole("heading", { name: /We built it together/ }).waitFor();
  assert.equal(await host.getByText(/podium|leaderboard/i).count(), 0);
  await host.getByRole("button", { name: "Play again" }).click();
  await guest.waitForFunction(
    () =>
      !window.__ptStore.getState().room.completed &&
      Object.values(window.__ptStore.getState().pieces).every((p) => !p.locked),
  );
  assert.equal(
    await guest.evaluate(() => window.__ptStore.getState().room.id),
    before.room,
  );
  console.log(
    "PASS complete puzzle using keyboard controls, shared finish and replay preserve group",
  );
  // Mobile widths, including landscape, keep controls reachable and board nonzero.
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await guest.setViewportSize(viewport);
    assert.ok(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const bounds = await guest.locator("canvas").boundingBox();
    assert.ok(bounds.width > 0 && bounds.height >= 250);
  }
  assert.deepEqual(errors, []);
  console.log("PASS viewport checks and no browser errors");
} catch (error) {
  for (const context of browser.contexts())
    for (const [index, page] of context.pages().entries()) {
      console.error(
        "PAGE",
        new URL(page.url()).pathname,
        (await page.locator("body").innerText()).slice(0, 1800),
      );
      await page
        .screenshot({
          path: `test-artifacts/failure-${browser.contexts().indexOf(context)}-${index}.png`,
          fullPage: true,
        })
        .catch(() => {});
    }
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
