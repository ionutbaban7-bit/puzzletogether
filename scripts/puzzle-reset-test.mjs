/* Puzzle-only in-play reset protocol: keeps the clock/workshop, resets jigsaw. */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const checks = [];
const ok = (name, value, extra = "") => {
  checks.push(!!value);
  console.log(`${value ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      } else queue.push(message);
    });
    ws.on("error", reject);
    ws.waitFor = (type, predicate = () => true, timeout = 4_000) => new Promise((resolveWait, rejectWait) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return resolveWait(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rejectWait(new Error(`timeout waiting for ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: resolveWait, timer });
    });
    resolve(ws);
  });
}

function inDefaultBand(piece, puzzle) {
  return piece.x >= -320 && piece.x <= puzzle.width + 320 &&
    piece.y >= puzzle.height + 140 && piece.y <= puzzle.height + 820;
}

const created = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "easy", name: "Host", sessionName: "Puzzle reset" });
const roomId = created.data.room.id;
const hostId = created.data.playerId;
const guestJoin = await post(`/api/rooms/${roomId}/join`, { name: "Guest", code: created.data.room.code });
const host = await connect(roomId, hostId);
const guest = await connect(roomId, guestJoin.data.playerId);
const initHost = await host.waitFor("init");
await guest.waitFor("init");

const guestStarted = guest.waitFor("room", (message) => message.room.stage === "play");
host.send(JSON.stringify({ t: "control", action: "start" }));
const started = await host.waitFor("room", (message) => message.room.stage === "play");
await guestStarted;
host.send(JSON.stringify({ t: "control", action: "timer", seconds: 300 }));
const timed = await host.waitFor("room", (message) => message.room.timerEndsAt != null);
const clockBefore = { startedAt: timed.room.startedAt, timerEndsAt: timed.room.timerEndsAt, timerDurationMs: timed.room.timerDurationMs };

// Make the board meaningfully mid-game.
const first = initHost.pieces[0];
host.send(JSON.stringify({ t: "piece", id: first.id, x: first.correctX, y: first.correctY, drag: false }));
await guest.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === first.id && piece.locked));

const nonHost = await post(`/api/rooms/${roomId}/puzzle-reset`, { pid: guestJoin.data.playerId });
ok("non-host puzzle reset is denied", nonHost.status === 403 && nonHost.data.code === "not_host");
const reset = await post(`/api/rooms/${roomId}/puzzle-reset`, { pid: hostId });
const resetHost = await host.waitFor("puzzleReset");
const resetGuest = await guest.waitFor("puzzleReset");
const resetState = resetHost;
ok(
  "in-play reset stays in play with the honest running clock",
  reset.status === 200 && resetState.room.stage === "play" && !resetState.room.boardLocked &&
    resetState.room.startedAt === clockBefore.startedAt && resetState.room.timerEndsAt === clockBefore.timerEndsAt &&
    resetState.room.timerDurationMs === clockBefore.timerDurationMs && resetState.room.timerEndsAt > Date.now(),
);
ok(
  "both clients receive every piece unlocked and scattered",
  resetState.pieces.every((piece) => !piece.locked && !piece.moved && inDefaultBand(piece, initHost.puzzle)) &&
    JSON.stringify(resetState.pieces) === JSON.stringify(resetGuest.pieces),
);
ok(
  "in-play reset clears completion and current-board scores without changing players",
  !resetState.room.completed && resetState.room.completedAt == null && resetState.room.completedInMs == null &&
    Array.isArray(resetState.room.completionPlayers) && resetState.room.completionPlayers.length === 0 &&
    resetState.scores.length === 0,
);

// Finish the easy board, then reset once more. This proves completion data is
// cleared even if a facilitator invokes the control after a just-finished play stage.
for (const piece of resetState.pieces) {
  host.send(JSON.stringify({ t: "piece", id: piece.id, x: piece.correctX, y: piece.correctY, drag: false }));
  await sleep(4);
}
const completed = await guest.waitFor("completion", (message) => message.room.completed, 6_000);
ok("test board can complete before a second in-play reset", completed.room.completed && completed.room.stage === "play");
const completionReset = await post(`/api/rooms/${roomId}/puzzle-reset`, { pid: hostId });
const afterCompleteReset = await guest.waitFor("puzzleReset");
ok(
  "puzzle reset clears a completed board but preserves play stage and timer fields",
  completionReset.status === 200 && !afterCompleteReset.room.completed && afterCompleteReset.room.stage === "play" &&
    afterCompleteReset.room.startedAt === clockBefore.startedAt && afterCompleteReset.room.timerEndsAt === clockBefore.timerEndsAt,
);

// The established workshop reset is still the only reset for coaching rooms.
const coaching = await post("/api/rooms", { puzzleId: "team-compass", difficulty: "easy", name: "Coach", sessionName: "Coaching reset" });
const coachingPuzzleReset = await post(`/api/rooms/${coaching.data.room.id}/puzzle-reset`, { pid: coaching.data.playerId });
const coachingReset = await post(`/api/rooms/${coaching.data.room.id}/reset`, { pid: coaching.data.playerId });
ok(
  "coaching keeps its established lobby reset and rejects puzzle-only reset",
  coachingPuzzleReset.status === 400 && coachingPuzzleReset.data.code === "not_jigsaw" && coachingReset.status === 200,
);

host.close();
guest.close();
const failures = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failures}/${checks.length} puzzle-reset protocol checks passed`);
process.exit(failures ? 1 : 0);
