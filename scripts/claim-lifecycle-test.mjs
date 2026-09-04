/*
 * Regression coverage for interruption-safe piece claims.
 *
 * Requires a running server (same convention as the other protocol scripts):
 *   BASE=http://127.0.0.1:3000 node scripts/claim-lifecycle-test.mjs
 *
 * It proves that an explicit browser cancellation is not scored/snapped as a
 * normal drop, and that a lost client claim expires close to CLAIM_TTL_MS
 * rather than waiting for the 30-second WebSocket heartbeat.
 */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const results = [];
const ok = (name, condition, extra = "") => {
  results.push(!!condition);
  console.log(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(path, body) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const queue = [];
    const waiters = [];
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId })));
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      const index = waiters.findIndex((entry) => entry.type === message.t && entry.predicate(message));
      if (index >= 0) {
        const entry = waiters.splice(index, 1)[0];
        clearTimeout(entry.timer);
        entry.resolve(message);
      } else {
        queue.push(message);
      }
    });
    ws.on("error", reject);
    ws.waitFor = (type, predicate = () => true, timeout = 14_000) => new Promise((resolveWait, rejectWait) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return resolveWait(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rejectWait(new Error(`timeout waiting for ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: resolveWait, timer });
    });
    resolve(ws);
  });
}

const created = await post("/api/rooms", {
  puzzleId: "starry-night",
  difficulty: "easy",
  name: "Claim host",
  sessionName: "Claim lifecycle protocol",
});
ok("creates a jigsaw room", created.status === 200 && !!created.data.room?.id);
if (created.status !== 200) process.exit(1);

const roomId = created.data.room.id;
const hostId = created.data.playerId;
const guestJoin = await post(`/api/rooms/${roomId}/join`, { name: "Claim guest", code: created.data.room.code });
ok("joins a second participant", guestJoin.status === 200 && !!guestJoin.data.playerId);
if (guestJoin.status !== 200) process.exit(1);

const host = await connect(roomId, hostId);
const guest = await connect(roomId, guestJoin.data.playerId);
const init = await host.waitFor("init");
await guest.waitFor("init");
host.send(JSON.stringify({ t: "control", action: "start" }));
await guest.waitFor("room", (message) => message.room?.stage === "play");

const first = init.pieces[0];
// Claim near the piece's home. A cancellation must release this exact
// position without locking/scoring it merely because a terminal event happened.
host.send(JSON.stringify({ t: "piece", id: first.id, x: first.correctX, y: first.correctY, drag: true }));
const claimed = await guest.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === first.id && piece.heldBy === hostId));
ok("drag frame creates an owned claim", claimed.list.some((piece) => piece.id === first.id && piece.heldBy === hostId));

host.send(JSON.stringify({ t: "piece", id: first.id, x: first.correctX, y: first.correctY, drag: false, cancel: true, cancelReason: "lostcapture" }));
const cancelled = await guest.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === first.id && piece.heldBy === null));
const cancelledPiece = cancelled.list.find((piece) => piece.id === first.id);
ok("cancel releases the claim immediately", cancelledPiece?.heldBy === null && cancelledPiece?.drag === false);
ok("cancel never turns into a snap/score drop", cancelledPiece?.locked === false && cancelledPiece?.moved === true);

const second = init.pieces[1];
host.send(JSON.stringify({ t: "piece", id: second.id, x: second.x + 120, y: second.y + 90, drag: true }));
await guest.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === second.id && piece.heldBy === hostId));
const expiresAt = Date.now();
const expired = await guest.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === second.id && piece.heldBy === null), 13_000);
const elapsed = Date.now() - expiresAt;
const expiredPiece = expired.list.find((piece) => piece.id === second.id);
ok("orphaned claim is released without a 30s heartbeat wait", expiredPiece?.heldBy === null && expiredPiece?.drag === false, `${elapsed}ms`);
ok("orphaned claim expires within the mobile recovery budget", elapsed < 10_500, `${elapsed}ms`);

// The released item is immediately available to another participant.
guest.send(JSON.stringify({ t: "piece", id: second.id, x: second.x + 160, y: second.y + 120, drag: true }));
const reclaimed = await host.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === second.id && piece.heldBy === guestJoin.data.playerId));
ok("another participant can reclaim after expiry", reclaimed.list.some((piece) => piece.id === second.id && piece.heldBy === guestJoin.data.playerId));

guest.send(JSON.stringify({ t: "piece", id: second.id, x: second.x + 160, y: second.y + 120, drag: false, cancel: true }));
await wait(20);
host.close();
guest.close();
const failures = results.filter((value) => !value).length;
console.log(`\n${results.length - failures}/${results.length} claim lifecycle checks passed`);
process.exit(failures ? 1 : 0);
