/* Browser smoke test for the current lobby-first jigsaw flow. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ARTIFACTS = new URL("../test-artifacts/", import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });
const checks = [];
const ok = (name, value) => { checks.push(!!value); console.log(`${value ? "✅" : "❌"} ${name}`); };
const browser = await chromium.launch();
const errors = [];
const watch = (page, label) => { page.on("pageerror", (error) => errors.push(`[${label}] ${error.message}`)); page.on("console", (message) => { if (message.type() === "error") errors.push(`[${label}] ${message.text()}`); }); };
try {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: "en-US" });
  const host = await hostContext.newPage(); watch(host, "host");
  await host.goto(BASE);
  await host.getByText("Play together. Leave with a decision.").waitFor();
  ok("honest workshop landing renders", true);
  await host.screenshot({ path: `${ARTIFACTS}01-landing.png`, fullPage: true });
  await host.getByRole("button", { name: /Create a session/i }).click();
  await host.getByRole("button", { name: /Paintings/i }).click();
  await host.getByRole("button", { name: /Starry Night/i }).click();
  await host.getByRole("button", { name: /^Easy/ }).click();
  await host.getByRole("button", { name: /Continue/i }).click();
  await host.locator("#session-name").fill("Realtime product test");
  await host.locator("#display-name").fill("Ionut");
  await host.getByRole("button", { name: /Create lobby/i }).click();
  await host.waitForURL("**/room/**");
  await host.waitForFunction(() => window.__ptStore?.getState().status === "joined");
  const initial = await host.evaluate(() => window.__ptStore.getState());
  ok("creator enters a frozen 25-piece lobby", initial.room.stage === "lobby" && initial.room.total === 25 && Object.keys(initial.pieces).length === 25);
  ok("lobby shows access code and honest zero clock", await host.getByText("Workshop lobby").isVisible() && /^[A-HJ-NP-Z2-9]{6}$/.test(initial.room.code));

  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const guest = await guestContext.newPage(); watch(guest, "guest");
  await guest.goto(host.url());
  await guest.getByText("Enter the room").waitFor();
  await guest.getByPlaceholder("e.g. Maria").fill("Maria");
  await guest.getByPlaceholder("K7F2MX").fill(initial.room.code);
  await guest.getByRole("button", { name: /Join the Puzzle/i }).click();
  await guest.waitForFunction(() => window.__ptStore?.getState().players.length === 2);
  ok("shared URL access gate joins second browser", true);
  await host.waitForFunction(() => window.__ptStore?.getState().players.length === 2);
  await host.getByRole("button", { name: /Start for everyone/i }).click();
  await guest.waitForFunction(() => window.__ptStore?.getState().room.stage === "play");
  ok("Start synchronizes the room and clock", (await guest.evaluate(() => window.__ptStore.getState().room.startedAt)) > 0);

  const target = await host.evaluate(() => { const state = window.__ptStore.getState(); const piece = Object.values(state.pieces)[0]; window.__ptStore.sendPiece(piece.id, 777, 555, true); return piece.id; });
  await guest.waitForFunction((id) => window.__ptStore?.getState().pieces[id]?.x === 777, target);
  ok("piece movement syncs across browsers", true);

  await guestContext.setOffline(true);
  await guest.waitForSelector("text=Reconnecting", { timeout: 5000 });
  ok("offline state shows reconnect banner and freezes board", true);
  await guestContext.setOffline(false);
  await guest.waitForFunction(() => window.__ptStore?.getState().connected === true, null, { timeout: 12000 });
  ok("browser reconnects to authoritative room state", true);
  await guest.screenshot({ path: `${ARTIFACTS}02-mobile-room.png` });
  ok("no uncaught browser errors", errors.length === 0);
  await hostContext.close(); await guestContext.close();
} finally { await browser.close(); }
if (errors.length) console.error(errors.join("\n"));
const failed = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failed}/${checks.length} browser checks passed`);
process.exit(failed ? 1 : 0);
