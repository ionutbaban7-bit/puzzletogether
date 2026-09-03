/* Protocol simulation for room security, lifecycle and piece claiming. */
import WebSocket from "ws";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const results = [];
function ok(name, condition, extra = "") { results.push(!!condition); console.log(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`); }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(path, body) {
  const response = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function get(path) { const response = await fetch(BASE + path); return { status: response.status, data: await response.json() }; }

function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const queue = [];
    const waiters = [];
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId })));
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      const index = waiters.findIndex((entry) => entry.type === message.t && entry.predicate(message));
      if (index >= 0) { const entry = waiters.splice(index, 1)[0]; clearTimeout(entry.timer); entry.resolve(message); }
      else queue.push(message);
    });
    ws.on("error", reject);
    ws.waitFor = (type, predicate = () => true, timeout = 4000) => new Promise((res, rej) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return res(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rej(new Error(`timeout waiting ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: res, timer });
    });
    resolve(ws);
  });
}

const health = await get("/api/health");
ok("health exposes operations metrics", health.data.ok && health.data.protocolVersion === 2 && typeof health.data.heapUsedMb === "number");
const catalog = await get("/api/puzzles");
ok("catalog keeps six categories", catalog.data.categories.length === 6);
ok("catalog contains only attributed images", catalog.data.puzzles.every((p) => p.credit && p.license && p.source !== "Web"), `${catalog.data.puzzles.length} entries`);
ok("trademarked puzzle id was removed", !catalog.data.puzzles.some((p) => /scrabble/i.test(p.id + p.name)));

const created = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "easy", name: "Ionut", sessionName: "Protocol test" });
const roomId = created.data.room.id;
const hostId = created.data.playerId;
const code = created.data.room.code;
ok("room starts in a locked lobby", created.status === 200 && created.data.room.stage === "lobby" && created.data.room.startedAt === null && created.data.room.boardLocked);
ok("room uses a six-character access code", /^[A-HJ-NP-Z2-9]{6}$/.test(code));

const noCode = await post(`/api/rooms/${roomId}/join`, { name: "Maria" });
const badCode = await post(`/api/rooms/${roomId}/join`, { name: "Maria", code: "WRONGX" });
ok("bare link requires access code", noCode.status === 403 && noCode.data.code === "code_required");
ok("wrong access code is rejected", badCode.status === 403 && badCode.data.code === "bad_code");
const joined = await post(`/api/rooms/${roomId}/join`, { name: "Maria", code });
const third = await post(`/api/rooms/${code}/join`, { name: "Alex" });
ok("link + code and direct code both join", joined.status === 200 && third.status === 200);

const host = await connect(roomId, hostId);
const maria = await connect(roomId, joined.data.playerId);
const alex = await connect(roomId, third.data.playerId);
const initHost = await host.waitFor("init");
await maria.waitFor("init");
await alex.waitFor("init");
ok("init is protocol-versioned", initHost.v === 2 && initHost.protocolVersion === 2);
ok("all pieces are frozen before Start", initHost.pieces.length === 25 && initHost.room.stage === "lobby");

const free = initHost.pieces[0];
host.send(JSON.stringify({ t: "piece", id: free.id, x: 1, y: 2, drag: true }));
const frozen = await host.waitFor("pieces", (m) => m.list?.[0]?.id === free.id);
ok("server rejects lobby movement", frozen.list[0].x === free.x && frozen.list[0].y === free.y);

host.send(JSON.stringify({ t: "control", action: "start" }));
const started = await maria.waitFor("room", (m) => m.room.stage === "play");
ok("host Start synchronizes stage and clock", !!started.room.startedAt && !started.room.boardLocked);

host.send(JSON.stringify({ t: "piece", id: free.id, x: 500, y: 600, drag: true }));
const claimed = await maria.waitFor("pieces", (m) => m.list?.some((p) => p.id === free.id && p.heldBy === hostId));
ok("first drag claims the piece", claimed.list[0].heldBy === hostId);
maria.send(JSON.stringify({ t: "piece", id: free.id, x: 900, y: 900, drag: true }));
const rejected = await maria.waitFor("pieceRejected", (m) => m.piece?.id === free.id);
ok("second player cannot steal a claimed piece", rejected.reason === "held" && rejected.ownerId === hostId);

host.send(JSON.stringify({ t: "piece", id: free.id, x: free.correctX, y: free.correctY, drag: false }));
const snapped = await alex.waitFor("pieces", (m) => m.list?.some((p) => p.id === free.id && p.locked));
ok("drop at home snaps, locks and releases claim", snapped.list[0].heldBy === null && snapped.list[0].x === free.correctX);

const resetByGuest = await post(`/api/rooms/${roomId}/reset`, { pid: joined.data.playerId });
const puzzleByGuest = await post(`/api/rooms/${roomId}/puzzle`, { pid: joined.data.playerId, puzzleId: "mona-lisa", difficulty: "easy" });
ok("non-host cannot reset", resetByGuest.status === 403 && resetByGuest.data.code === "not_host");
ok("non-host cannot change activity", puzzleByGuest.status === 403 && puzzleByGuest.data.code === "not_host");
const reset = await post(`/api/rooms/${roomId}/reset`, { pid: hostId });
ok("host reset returns everyone to lobby", reset.status === 200);
const resetFrame = await maria.waitFor("reset");
ok("reset broadcast clears scores and starts no clock", resetFrame.room.stage === "lobby" && resetFrame.room.startedAt === null && resetFrame.pieces.every((p) => !p.locked));

host.send(JSON.stringify({ t: "control", action: "start" }));
await maria.waitFor("room", (m) => m.room.stage === "play");
for (const piece of resetFrame.pieces) {
  host.send(JSON.stringify({ t: "piece", id: piece.id, x: piece.correctX, y: piece.correctY, drag: false }));
  await wait(8);
}
const completion = await maria.waitFor("completion", () => true, 6000);
ok("completion reports shared active duration", completion.room.completed && completion.room.completedInMs >= 0);
ok("scores account for every piece", completion.scores.reduce((sum, score) => sum + score.placed, 0) === 25);

const publicRoom = await get(`/api/rooms/${roomId}`);
ok("public room view never leaks access code", publicRoom.data.room.code === undefined);
const hostExport = await get(`/api/rooms/${roomId}/export?pid=${hostId}`);
const guestExport = await get(`/api/rooms/${roomId}/export?pid=${joined.data.playerId}`);
ok("host can export structured recap", hostExport.status === 200 && hostExport.data.schemaVersion === 1);
ok("participant cannot export facilitator-private notes", guestExport.status === 403);

host.close(); maria.close(); alex.close();
const failures = results.filter((value) => !value).length;
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
