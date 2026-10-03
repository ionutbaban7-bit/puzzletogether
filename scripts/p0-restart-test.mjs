/* P0 persistence: an isolated server must preserve credential verifiers,
 * room progress and host authorization across a real process restart.
 * This is NOT a substitute for validating the Render persistent volume.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";

const port = Number(process.env.RESTART_TEST_PORT || 3197);
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pt-p0-restore-"));
let child = null;
let output = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function spawnServer() {
  output = "";
  child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { output += String(chunk); });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode != null) throw new Error(`Server exited early: ${output}`);
    try { const health = await fetch(`${base}/api/health`); if (health.ok) return; } catch { /* server is starting */ }
    await sleep(100);
  }
  throw new Error(`Server did not start: ${output}`);
}
async function stopServer() {
  if (!child || child.exitCode != null) return;
  const closing = child;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { closing.kill("SIGKILL"); reject(new Error("Server did not exit after SIGTERM")); }, 5000);
    closing.once("exit", () => { clearTimeout(timer); resolve(); });
    closing.kill("SIGTERM");
  });
  child = null;
}
async function post(route, json, bearer) {
  const response = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(json),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
function websocketHello(roomId, playerId, credential) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error("WS init timeout")); }, 3000);
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId, credential })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (!["init", "deny"].includes(msg.t)) return;
      clearTimeout(timer);
      ws.close();
      resolve(msg);
    });
  });
}
async function placeBeforeRestart(roomId, playerId, credential) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.terminate(); reject(new Error("Progress setup timed out")); }, 3000);
    let piece;
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", roomId, playerId, credential })));
    ws.on("message", raw => {
      const msg = JSON.parse(String(raw));
      if (msg.t === "init") { piece = msg.pieces[0]; ws.send(JSON.stringify({ t: "control", action: "start" })); }
      if (msg.t === "room" && msg.room.stage === "play") ws.send(JSON.stringify({ t: "piece", id: piece.id, x: piece.correctX, y: piece.correctY, drag: false }));
      if (msg.t === "pieces" && msg.list.some(p => p.id === piece.id && p.locked)) { clearTimeout(timer); ws.close(); resolve(); }
    });
  });
}
try {
  await spawnServer();
  const created = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "easy", name: "RestoreHost", podiumEnabled: true });
  assert.equal(created.status, 200);
  assert.match(created.body.credential || "", /^[A-Za-z0-9_-]{43}$/);
  const roomId = created.body.room.id;
  const playerId = created.body.playerId;
  const credential = created.body.credential;
  const joined = await post(`/api/rooms/${roomId}/join`, { name: "RestoreGuest", code: created.body.room.code });
  assert.equal(joined.status, 200);
  await placeBeforeRestart(roomId, playerId, credential);
  await stopServer();

  const snapshot = fs.readFileSync(path.join(dataDir, "rooms.json"), "utf8");
  assert.equal(snapshot.includes(credential), false, "Never persist plaintext credentials");
  assert.equal(snapshot.includes(joined.body.credential), false, "Never persist guest credentials");
  const raw = JSON.parse(snapshot)[0];
  assert.equal(raw.id, roomId);
  assert.equal(raw.knownPlayers.length, 2);
  assert.equal(raw.podiumEnabled, true);
  assert.deepEqual(raw.roundPlayers.map(([pid, p]) => [pid, p.name]), [[playerId, "RestoreHost"]]);
  assert.ok(raw.knownPlayers.every(([pid, p]) => /^[a-f0-9]{64}$/.test(p.authHash)));

  await spawnServer();
  const visible = await fetch(`${base}/api/rooms/${roomId}`);
  assert.equal(visible.status, 200, "Room survived a process restart");
  const room = (await visible.json()).room;
  assert.equal(room.hostId, undefined);

  const restored = await websocketHello(roomId, playerId, credential);
  assert.equal(restored.pieces[0].locked, true, "Placed piece survives restart");
  assert.equal(restored.room.podiumEnabled, true, "Chosen mode survives restart");
  assert.deepEqual(restored.scores.map(s => [s.playerId, s.placed, s.rank]), [[playerId, 1, 1]], "Contribution and rank survive restart");
  assert.equal(restored.room.inviteToken, created.body.room.inviteToken, "Invitation survives restart");
  const withoutAuth = await post(`/api/rooms/${roomId}/reset`, { pid: playerId });
  assert.equal(withoutAuth.status, 403);
  const withAuth = await post(`/api/rooms/${roomId}/reset`, {}, credential);
  assert.equal(withAuth.status, 200, JSON.stringify(withAuth.body));
  const returning = await post(`/api/rooms/${roomId}/join`, { name: "RestoreGuest", pid: joined.body.playerId }, joined.body.credential);
  assert.equal(returning.status, 200);
  assert.equal(returning.body.returning, true);
  const connected = await websocketHello(roomId, playerId, credential);
  assert.equal(connected.t, "init");
  assert.equal(connected.you, playerId);
  console.log("PASS: snapshot contains verifier hashes but no plaintext player secrets");
  console.log("PASS: placed piece, invitation, host authorization, guest return and WS reconnect survive real restart");
} finally {
  try { await stopServer(); } catch (error) { console.error(error.message); }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
