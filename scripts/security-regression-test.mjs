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

await check("Create and join issue independent high-entropy private credentials", async () => {
  assert.match(created.body.credential || "", /^[A-Za-z0-9_-]{43}$/);
  assert.match(joined.body.credential || "", /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(created.body.credential, joined.body.credential);
  assert.equal(JSON.stringify(created.body.room).includes(created.body.credential), false);
  assert.equal(JSON.stringify(joined.body.room).includes(joined.body.credential), false);
});
await check("Valid host credential alone permits host reset", async () => {
  const { status, body } = await post(`/api/rooms/${id}/reset`, {},
    { Authorization: `Bearer ${created.body.credential}` });
  assert.equal(status, 200, JSON.stringify(body));
});
await check("Guest credential can never authorize host export, even with host UUID", async () => {
  const { status } = await get(`/api/rooms/${id}/export?pid=${encodeURIComponent(hostId)}`,
    { Authorization: `Bearer ${joined.body.credential}` });
  assert.equal(status, 403);
});
await check("Legitimate host can request private export without supplying their UUID", async () => {
  const { status, body } = await get(`/api/rooms/${id}/export`,
    { Authorization: `Bearer ${created.body.credential}` });
  assert.equal(status, 200);
  assert.equal(body.schemaVersion, 1);
});
await check("Legitimate guest can reconnect without repeating a room code", async () => {
  const { status, body } = await post(`/api/rooms/${id}/join`,
    { name: "SecurityGuest", pid: guestId },
    { Authorization: `Bearer ${joined.body.credential}` });
  assert.equal(status, 200);
  assert.equal(body.returning, true);
  assert.equal(body.playerId, guestId);
});
await check("Invalid returning identity cannot claim an existing guest", async () => {
  const { status } = await post(`/api/rooms/${id}/join`,
    { name: "SecurityGuest", pid: guestId, code },
    { Authorization: `Bearer ${created.body.credential}` });
  assert.equal(status, 403);
});
await check("Correctly authenticated host and guest can both open a WS room", async () => {
  const [host, guest] = await Promise.all([
    hello(id, hostId, created.body.credential),
    hello(id, guestId, joined.body.credential),
  ]);
  assert.equal(host.t, "init", JSON.stringify(host));
  assert.equal(guest.t, "init", JSON.stringify(guest));
  assert.equal(host.you, hostId);
  assert.equal(guest.you, guestId);
});
await check("An authenticated guest cannot impersonate the host over WS", async () => {
  const message = await hello(id, hostId, joined.body.credential);
  assert.notEqual(message.t, "init");
});

const failures = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failures.length}/${checks.length} security checks passed`);
if (failures.length) process.exitCode = 1;
