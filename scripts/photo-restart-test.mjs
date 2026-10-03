import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import WebSocket from "ws";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-photo-restart-"));
const clock = path.join(dir, "clock"); fs.writeFileSync(clock, "0");
const preload = path.join(dir, "clock.mjs");
fs.writeFileSync(preload, `import fs from 'node:fs'; const realNow = Date.now; Date.now = () => realNow() + Number(fs.readFileSync(process.env.PHOTO_TEST_CLOCK_FILE, 'utf8'));`);
// Delay the actual processor, then prove API/WS traffic remains responsive.
const shimDir = path.join(dir, "processor"); fs.mkdirSync(shimDir);
const slowFlag = path.join(dir, "slow"), processingMarker = path.join(dir, "processing-started");
const realIdentify = process.env.PATH.split(path.delimiter).map(p => path.join(p, "identify")).find(p => fs.existsSync(p));
assert.ok(realIdentify, "ImageMagick identify must be installed");
const shim = `#!/usr/bin/env node
const fs = require('node:fs'), { spawn } = require('node:child_process');
const slow = fs.existsSync(${JSON.stringify(slowFlag)});
if (slow) fs.writeFileSync(${JSON.stringify(processingMarker)}, 'started');
setTimeout(() => { const child = spawn(${JSON.stringify(realIdentify)}, process.argv.slice(2), { stdio: 'inherit' }); child.on('error', () => process.exit(1)); child.on('exit', code => process.exit(code ?? 1)); }, slow ? 2000 : 0);
`;
fs.writeFileSync(path.join(shimDir, "identify"), shim, { mode: 0o700 });
const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const BASE = `http://127.0.0.1:${port}`;
let child, logs = "";
const sockets = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function start() {
  logs = "";
  child = spawn(process.execPath, ["--import", pathToFileURL(preload).href, "src/server.js"], { env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dir, PHOTO_TEST_CLOCK_FILE: clock, PATH: shimDir + path.delimiter + process.env.PATH }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", x => logs += x); child.stderr.on("data", x => logs += x);
  for (let i = 0; i < 80; i++) { if (child.exitCode != null) throw new Error(logs); try { if ((await fetch(BASE + "/api/health")).ok) return; } catch {} await wait(100); }
  throw new Error(logs);
}
async function stop() {
  for (const ws of sockets.splice(0)) ws.terminate();
  if (!child || child.exitCode != null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Stop timed out")); }, 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); }); child.kill("SIGTERM");
  });
  child = null;
}
async function post(route, body, credential) {
  const res = await fetch(BASE + route, { method: "POST", headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
  assert.equal(res.status, 200, await res.clone().text()); return res.json();
}
async function hello(created) {
  const ws = new WebSocket(BASE.replace("http", "ws") + "/ws"); sockets.push(ws);
  const init = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WS timeout")), 3000);
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", roomId: created.room.id, playerId: created.playerId, credential: created.credential })));
    ws.on("message", raw => { const m = JSON.parse(String(raw)); if (["init", "deny"].includes(m.t)) { clearTimeout(timeout); resolve(m); } });
  });
  assert.equal(init.t, "init", JSON.stringify(init));
  return { ws, init };
}
const canvas = createCanvas(300, 450); canvas.getContext("2d").fillRect(0, 0, 300, 450);
const png = canvas.toBuffer("image/png");
async function createPhoto(name) {
  const res = await fetch(BASE + "/api/uploads", { method: "POST", headers: { "Content-Type": "image/png" }, body: png });
  assert.equal(res.status, 200); const upload = await res.json();
  const created = await post("/api/rooms", { puzzleId: "custom-upload", difficulty: "mini", name, customImage: upload });
  return { upload, created };
}
try {
  await start();
  fs.writeFileSync(slowFlag, "1");
  const firstUpload = createPhoto("Host A");
  for (let i = 0; i < 100 && !fs.existsSync(processingMarker); i++) await wait(10);
  assert.ok(fs.existsSync(processingMarker), "Photo processing has started");
  const healthStart = Date.now();
  assert.equal((await fetch(BASE + "/api/health")).status, 200);
  assert.ok(Date.now() - healthStart < 1000, "A slow image decoder must not block the server");
  fs.unlinkSync(slowFlag);
  const a = await firstUpload;
  assert.equal(fs.readdirSync(path.join(dir, "uploads")).some(p => p.startsWith("processing-") || p.endsWith(".in")), false);
  console.log("PASS slow image processing leaves API responsive and removes original/cache files");
  const guest = await post(`/api/rooms/${a.created.room.id}/join`, { name: "Guest A", invite: a.created.room.inviteToken });
  const original = await hello(a.created);
  const imageUrl = original.init.puzzle.image;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "uploads", a.upload.file + ".json")));
  assert.equal(meta.expiresAt, a.upload.expiresAt);
  assert.equal(JSON.stringify(meta).includes(a.upload.token), false, "Only attachment verifier is persisted");
  await stop(); await start();
  const restored = await hello(a.created);
  assert.equal(restored.init.puzzle.image, imageUrl);
  assert.equal(restored.init.room.photoExpiresAt, a.upload.expiresAt);
  assert.equal((await fetch(BASE + imageUrl)).status, 200);
  await hello(guest);
  console.log("PASS private photo and original 1h deadline survive actual process restart");
  const b = await createPhoto("Host B");
  const fallbackMessage = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Expiry broadcast timed out")), 3000);
    restored.ws.on("message", raw => { const m = JSON.parse(String(raw)); if (m.t === "puzzle") { clearTimeout(timeout); resolve(m); } });
  });
  fs.writeFileSync(clock, String(3600001));
  assert.equal((await fetch(BASE + imageUrl)).status, 404);
  const expired = await fallbackMessage;
  assert.equal(expired.room.id, a.created.room.id);
  assert.equal(expired.room.stage, "lobby");
  assert.equal(expired.room.photoExpiresAt, null);
  assert.ok(expired.room.photoExpiredAt);
  assert.equal(expired.pieces.every(p => !p.locked), true);
  assert.equal(fs.existsSync(path.join(dir, "uploads", a.upload.file)), false);
  assert.equal(fs.existsSync(path.join(dir, "uploads", a.upload.file + ".json")), false);
  const returning = await post(`/api/rooms/${a.created.room.id}/join`, { name: "Guest A", pid: guest.playerId }, guest.credential);
  assert.equal(returning.returning, true);
  console.log("PASS expiry removes bytes and metadata; live group receives a playable library puzzle");
  await stop(); await start();
  const expiredAfterRestart = await hello(b.created);
  assert.equal(expiredAfterRestart.init.room.photoExpiresAt, null);
  assert.equal(expiredAfterRestart.init.room.stage, "lobby");
  assert.ok(expiredAfterRestart.init.room.photoExpiredAt);
  assert.notEqual(expiredAfterRestart.init.puzzle.category, "custom");
  assert.equal(fs.existsSync(path.join(dir, "uploads", b.upload.file)), false);
  console.log("PASS expired-during-downtime photo is deleted on startup; room and host remain usable");
  const c = await createPhoto("Host C");
  const closing = await hello(c.created);
  const closed = new Promise(resolve => closing.ws.on("message", raw => { const m = JSON.parse(String(raw)); if (m.t === "room" && m.room.stage === "closed") resolve(); }));
  closing.ws.send(JSON.stringify({ t: "control", action: "close" })); await closed;
  assert.equal((await fetch(BASE + closing.init.puzzle.image)).status, 404);
  assert.equal(fs.existsSync(path.join(dir, "uploads", c.upload.file)), false);
  assert.equal(fs.existsSync(path.join(dir, "uploads", c.upload.file + ".json")), false);
  console.log("PASS closing the room deletes its photo immediately");
} catch (error) { console.error(logs.slice(-3000)); throw error; }
finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
