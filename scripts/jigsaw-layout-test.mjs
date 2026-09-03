/*
 * Server-authoritative jigsaw layout protocol.
 *
 * Covers the hard default scatter and opt-in ordered help tray with three
 * connected roles. Run against a local server:
 *   node scripts/jigsaw-layout-test.mjs
 */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const checks = [];
const ok = (name, value, extra = "") => {
  checks.push(!!value);
  console.log(`${value ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};

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
    ws.waitFor = (type, predicate = () => true, timeout = 4_000) => new Promise((resolveWait, rejectWait) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return resolveWait(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rejectWait(new Error(`timeout waiting for ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: resolveWait, timer });
    });
    resolve(ws);
  });
}

function positions(list) {
  return Object.fromEntries(list.map((piece) => [piece.id, { x: piece.x, y: piece.y, moved: piece.moved, locked: piece.locked, heldBy: piece.heldBy || null }]));
}

function samePositions(a, b) {
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length && ids.every((id) => {
    const left = a[id];
    const right = b[id];
    return right && left.x === right.x && left.y === right.y && left.moved === right.moved && left.locked === right.locked && left.heldBy === right.heldBy;
  });
}

// A spectator can still be the facilitator, which lets this one room exercise
// both a valid player request and the spectator rejection branch.
const created = await post("/api/rooms", {
  puzzleId: "starry-night",
  difficulty: "easy",
  name: "Facilitator",
  sessionName: "Layout protocol",
  role: "spectator",
});
const roomId = created.data.room?.id;
const hostId = created.data.playerId;
const code = created.data.room?.code;
const joinA = await post(`/api/rooms/${roomId}/join`, { name: "Ana", code });
const joinB = await post(`/api/rooms/${roomId}/join`, { name: "Bogdan", code });
ok("creates a host plus two participants", created.status === 200 && joinA.status === 200 && joinB.status === 200);

const host = await connect(roomId, hostId);
const ana = await connect(roomId, joinA.data.playerId);
const bogdan = await connect(roomId, joinB.data.playerId);
const initHost = await host.waitFor("init");
const initAna = await ana.waitFor("init");
const initBogdan = await bogdan.waitFor("init");
const { puzzle } = initAna;
const initial = positions(initAna.pieces);
const withinScatterBand = (piece) =>
  piece.x >= -320 && piece.x <= puzzle.width + 320 &&
  piece.y >= puzzle.height + 140 && piece.y <= puzzle.height + 820;

ok(
  "both players begin with server-scattered untouched pieces",
  initAna.room.jigsawLayout === "scatter" && initBogdan.room.jigsawLayout === "scatter" &&
    initAna.pieces.every((piece) => !piece.locked && !piece.moved && withinScatterBand(piece)) &&
    samePositions(initial, positions(initBogdan.pieces)),
);

// Layout commands do nothing before play or when sent by a spectator.
ana.send(JSON.stringify({ t: "layout", mode: "tray" }));
const lobbyRejected = await ana.waitFor("error", (message) => message.code === "layout_unavailable");
ok("layout is ignored in lobby", lobbyRejected.code === "layout_unavailable");
host.send(JSON.stringify({ t: "layout", mode: "tray" }));
const spectatorRejected = await host.waitFor("error", (message) => message.code === "layout_unavailable");
ok("layout is ignored for a spectator facilitator", spectatorRejected.code === "layout_unavailable");

host.send(JSON.stringify({ t: "control", action: "start" }));
await ana.waitFor("room", (message) => message.room.stage === "play");
await bogdan.waitFor("room", (message) => message.room.stage === "play");

ana.send(JSON.stringify({ t: "layout", mode: "tray" }));
const trayAna = await ana.waitFor("pieces", (message) => message.list?.length === 25);
const trayBogdan = await bogdan.waitFor("pieces", (message) => message.list?.length === 25);
await ana.waitFor("room", (message) => message.room.jigsawLayout === "tray");
const trayPositions = positions(trayAna.list);
const trayCols = Math.max(1, Math.floor(puzzle.width / (puzzle.pieceW + 24)));
const trayMatches = trayAna.list.every((piece, index) =>
  piece.x === (index % trayCols) * (puzzle.pieceW + 24) &&
  piece.y === puzzle.height + 80 + Math.floor(index / trayCols) * (puzzle.pieceH + 24) &&
  !piece.moved && !piece.locked,
);
ok(
  "layout:tray gives both clients the identical non-overlapping grid below target",
  trayMatches && samePositions(trayPositions, positions(trayBogdan.list)),
);
ok(
  "unplaced filter source remains the full untouched set after tray",
  trayAna.list.filter((piece) => !piece.locked && !piece.moved).length === 25,
);

// Lock one piece and have the other participant hold another. Neither can move
// during Mix. The held piece is already moved by normal drag semantics.
const locked = trayAna.list[1];
ana.send(JSON.stringify({ t: "piece", id: locked.id, x: locked.correctX, y: locked.correctY, drag: false }));
const lockedFrame = await ana.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === locked.id && piece.locked));
const held = trayAna.list[2];
bogdan.send(JSON.stringify({ t: "piece", id: held.id, x: held.x + 10, y: held.y + 10, drag: true }));
const heldFrame = await ana.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === held.id && piece.heldBy === joinB.data.playerId));
const lockedBefore = lockedFrame.list.find((piece) => piece.id === locked.id);
const heldBefore = heldFrame.list.find((piece) => piece.id === held.id);

ana.send(JSON.stringify({ t: "layout", mode: "scatter" }));
const scatterAna = await ana.waitFor("pieces", (message) => message.list?.length === 23);
const scatterBogdan = await bogdan.waitFor("pieces", (message) => message.list?.length === 23);
const scatterById = positions(scatterAna.list);
ok(
  "layout:scatter re-randomizes only untouched pieces in the band and keeps moved=false",
  scatterAna.list.every((piece) => !piece.moved && !piece.locked && withinScatterBand(piece)) && samePositions(scatterById, positions(scatterBogdan.list)),
);
ok(
  "locked and held pieces are untouched by layout requests",
  !scatterById[locked.id] && !scatterById[held.id] && lockedBefore.locked && heldBefore.heldBy === joinB.data.playerId,
);

// Locking the board makes the operation unavailable; release the held piece
// first so a reconnect can assert the final plain server positions.
bogdan.send(JSON.stringify({ t: "piece", id: held.id, x: heldBefore.x, y: heldBefore.y, drag: false }));
await ana.waitFor("pieces", (message) => message.list?.some((piece) => piece.id === held.id && !piece.heldBy));
host.send(JSON.stringify({ t: "control", action: "lock", locked: true }));
await ana.waitFor("room", (message) => message.room.boardLocked);
ana.send(JSON.stringify({ t: "layout", mode: "tray" }));
const lockedBoardRejected = await ana.waitFor("error", (message) => message.code === "layout_unavailable");
ok("layout is ignored while the board is locked", lockedBoardRejected.code === "layout_unavailable");

// Reconnect must receive the real positions, not a client-computed tray.
ana.close();
const anaReconnected = await connect(roomId, joinA.data.playerId);
const reconnectInit = await anaReconnected.waitFor("init");
const reconnectMap = positions(reconnectInit.pieces);
ok(
  "reconnect resyncs plain scattered/tray positions and layout mode",
  reconnectInit.room.jigsawLayout === "scatter" &&
    reconnectInit.pieces.filter((piece) => !piece.locked && !piece.moved).every(withinScatterBand) &&
    reconnectMap[locked.id].locked && reconnectMap[held.id].moved,
);

host.close();
bogdan.close();
anaReconnected.close();

const failures = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failures}/${checks.length} layout protocol checks passed`);
process.exit(failures ? 1 : 0);
