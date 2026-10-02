/* Phase-0 security regression tests.
 * Run against a locally started, disposable PuzzleTogether instance:
 *   npm run dev  # separate terminal
 *   node scripts/security-regression-test.mjs
 *
 * Expected status on initial V2 branch: FAIL. Do not merge/ship until these
 * tests pass with real credential-bound HTTP + WebSocket auth.
 * Never point this script at production: it creates rooms.
 */
import WebSocket from "ws";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const checks = [];
const check = async (name, fn) => {
  try { await fn(); checks.push({ name, pass: true }); console.log("PASS", name); }
  catch (err) { checks.push({ name, pass: false }); console.error("FAIL", name, err.message); }
};
async function post(path, body, headers = {}) {
  const response = await fetch(BASE + path, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
async function get(path, headers = {}) {
  const response = await fetch(BASE + path, { headers });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
// Opens a new, independent client with ONLY values passed here. This models
// a different browser, not the legitimate player's existing WS connection.
function hello(roomId, playerId, credential) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let finished = false;
    const timer = setTimeout(() => finish(new Error("Timed out")), 2500);
    function finish(err, message) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ws.close();
      err ? reject(err) : resolve(message);
    }
    ws.on("open", () => ws.send(JSON.stringify({
      t: "hello", v: 2, roomId, playerId,
      ...(credential ? { credential } : {}),
    })));
    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch (err) { return finish(err); }
      if (["init", "deny"].includes(m.t)) finish(null, m);
    });
    ws.on("error", (err) => finish(err));
    ws.on("close", () => finish(null, { t: "closed" }));
  });
}

const created = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "easy", name: "SecurityHost", sessionName: "Disposable security QA" });
assert.equal(created.status, 200, "Room creation is a fixture prerequisite");
const id = created.body.room.id;
const hostId = created.body.playerId;
const code = created.body.room.code;
const joined = await post(`/api/rooms/${id}/join`, { name: "SecurityGuest", code });
assert.equal(joined.status, 200, "Guest joining is a fixture prerequisite");
const guestId = joined.body.playerId;

await check("Anonymous metadata never reveals host ID or room access code", async () => {
  const { status, body } = await get(`/api/rooms/${id}`);
  assert.equal(status, 200);
  assert.equal(body.room?.hostId, undefined);
  assert.equal(body.room?.code, undefined);
});

await check("Public host ID without authenticated host session cannot reset room", async () => {
  const { status } = await post(`/api/rooms/${id}/reset`, { pid: hostId });
  assert.equal(status, 403, "A disclosed UUID must never authorize a privileged POST");
});
await check("Public host ID cannot access private export", async () => {
  const { status } = await get(`/api/rooms/${id}/export?pid=${encodeURIComponent(hostId)}`);
  assert.equal(status, 403, "A disclosed UUID must never authorize a privileged GET");
});
await check("Public host ID cannot change the puzzle", async () => {
  const { status } = await post(`/api/rooms/${id}/puzzle`, { pid: hostId, puzzleId: "mona-lisa", difficulty: "easy" });
  assert.equal(status, 403);
});
await check("Public host ID cannot claim the room by an unauthenticated WS hello", async () => {
  const msg = await hello(id, hostId);
  assert.notEqual(msg.t, "init", "A known UUID alone must not authenticate a host socket");
});
await check("Other participant ID cannot be used for an unauthenticated WS hello", async () => {
  const msg = await hello(id, guestId);
  assert.notEqual(msg.t, "init", "A known UUID alone must not authenticate another participant");
});
await check("Unauthenticated ID cannot seize room when original host is offline", async () => {
  // Only use an existing, known, real guest ID, as if observed elsewhere.
  const { status } = await post(`/api/rooms/${id}/takeover`, { pid: guestId });
  assert.equal(status, 403, "A known participant UUID is not proof of participation");
});
const failures = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failures.length}/${checks.length} security checks passed`);
if (failures.length) process.exitCode = 1;
