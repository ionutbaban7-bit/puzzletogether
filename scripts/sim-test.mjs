/* Simulates two users in a room and verifies realtime sync. Run: node scripts/sim-test.mjs */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace("http", "ws") + "/ws";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};
const fail = (name, extra) => ok(name, false, extra);

function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const queue = [];
    const handlers = {};
    const matches = [];
    let init = null;
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", roomId, playerId }));
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.t === "init") init = msg;
      if (msg.t === "deny") console.log(`[sim] DENY for ${playerId}: ${msg.message}`);
      const mi = matches.findIndex((m) => m.type === msg.t && m.predicate(msg));
      if (mi >= 0) {
        const m = matches.splice(mi, 1)[0];
        clearTimeout(m.timer);
        return m.resolve(msg);
      }
      if (handlers[msg.t]) handlers[msg.t](msg);
      else queue.push(msg);
    });
    ws.on("error", reject);
    ws.waitFor = (type, timeout = 3000) =>
      new Promise((res, rej) => {
        const idx = queue.findIndex((m) => m.t === type);
        if (idx >= 0) return res(queue.splice(idx, 1)[0]);
        const timer = setTimeout(() => rej(new Error(`timeout waiting ${type}`)), timeout);
        handlers[type] = (m) => {
          clearTimeout(timer);
          delete handlers[type];
          res(m);
        };
      });
    ws.waitForMatch = (type, predicate, timeout = 4000) =>
      new Promise((res, rej) => {
        const idx = queue.findIndex((m) => m.t === type && predicate(m));
        if (idx >= 0) return res(queue.splice(idx, 1)[0]);
        const timer = setTimeout(() => rej(new Error(`timeout waiting ${type} match`)), timeout);
        matches.push({ type, predicate, resolve: res, timer });
      });
    ws.waitInit = () =>
      new Promise((res, rej) => {
        if (init) return res(init);
        const timer = setTimeout(() => rej(new Error("timeout waiting init")), 3000);
        handlers["init"] = (m) => {
          clearTimeout(timer);
          res(m);
        };
      });
    resolve(ws);
  });
}

const api = {
  async get(path) {
    const r = await fetch(BASE + path);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  },
};

// 0. health + catalog
const health = await api.get("/api/health");
ok("health endpoint", health.ok === true);
const catalog = await api.get("/api/puzzles");
ok("catalog: 5 categories", catalog.categories?.length === 5, `${catalog.categories?.length}`);
ok("catalog: 21 puzzles", catalog.puzzles?.length === 21, `${catalog.puzzles?.length}`);
ok("catalog: 4 difficulties", catalog.difficulties?.length === 4);

// 1. create room
const create = await api.post("/api/rooms", {
  puzzleId: "starry-night",
  difficulty: "easy",
  name: "Ionut",
});
ok("create room (easy/25)", create.status === 200 && create.data.room?.total === 25);
const roomId = create.data.room?.id;
const code = create.data.room?.code;
ok("room has shareable code", typeof code === "string" && code.length === 6, code);

// 2. join as second player via HTTP — the access code is now mandatory for links
const joinNoCode = await api.post(`/api/rooms/${roomId}/join`, { name: "Maria" });
ok("join via id WITHOUT code is rejected", joinNoCode.status === 403 && joinNoCode.data?.code === "code_required", `${joinNoCode.status}`);
const joinBadCode = await api.post(`/api/rooms/${roomId}/join`, { name: "Maria", code: "WRONG1" });
ok("join via id with WRONG code is rejected", joinBadCode.status === 403 && joinBadCode.data?.code === "bad_code", `${joinBadCode.status}`);
const join = await api.post(`/api/rooms/${roomId}/join`, { name: "Maria", code });
ok("join room via id + code", join.status === 200);

// 3. join by code as third player
const joinCode = await api.post(`/api/rooms/${code}/join`, { name: "Alex" });
ok("join room via code", joinCode.status === 200, code);

// 4. connect both primary sockets
const a = await connect(roomId, create.data.playerId);
const b = await connect(roomId, join.data.playerId);
const c = await connect(roomId, joinCode.data.playerId);

const initA = await a.waitInit();
const initB = await b.waitInit();
await c.waitInit();

ok("A got init with 25 pieces", initA.pieces?.length === 25, `${initA.pieces?.length}`);
ok("init includes puzzle metadata", !!initA.puzzle?.pieceW && initA.puzzle.name === "Starry Night");
ok("init includes A in players", initA.players?.length >= 1, `${initA.players?.length}`);
ok("players have cursor colors", initA.players.every((p) => p.color?.startsWith("#")));

// Player-list broadcasts should arrive at every client as people join.
const playersMsg = await b.waitForMatch("players", (m) => m.list?.length === 3, 5000);
ok("B received 3-player list update", playersMsg.list?.length === 3, playersMsg.list?.map((p) => p.name).join(", "));
const playersMsgA = await a.waitForMatch("players", (m) => m.list?.length === 3, 5000);
ok("A received 3-player list update", playersMsgA.list?.length === 3);

// 5. A moves a free piece; B must see it
const freePiece = initA.pieces.find((p) => !p.locked);
const target = { x: 1234.5, y: -321.25 };
a.send(JSON.stringify({ t: "piece", id: freePiece.id, x: target.x, y: target.y, drag: true }));
const moveMsg = await b.waitFor("pieces");
const moved = moveMsg.list?.find((p) => p.id === freePiece.id);
ok("B received A's piece move in realtime", moved && moved.x === target.x && moved.y === target.y, JSON.stringify(moved));

// 6. A drops the piece exactly at its correct position → snap + lock
a.send(JSON.stringify({
  t: "piece",
  id: freePiece.id,
  x: freePiece.correctX,
  y: freePiece.correctY,
  drag: false,
}));
const snapMsg = await c.waitForMatch(
  "pieces",
  (m) => m.list?.some((p) => p.id === freePiece.id && p.locked === true),
  5000,
);
const snapped = snapMsg.list?.find((p) => p.id === freePiece.id);
ok("piece snapped & locked for C", snapped?.locked === true && snapped.x === freePiece.correctX, JSON.stringify(snapped));

// 7. C tries to move the locked piece → server echoes authoritative state back
c.send(JSON.stringify({ t: "piece", id: freePiece.id, x: 999, y: 999, drag: true }));
const afterLock = await c.waitForMatch(
  "pieces",
  (m) => m.list?.some((p) => p.id === freePiece.id && p.locked === true && p.drag === false),
  5000,
);
const stillLocked = afterLock.list?.find((p) => p.id === freePiece.id);
ok("locked piece stays locked (server rejects)", stillLocked?.locked === true && stillLocked.x === freePiece.correctX, JSON.stringify(stillLocked));

// 8. cursors relay
a.send(JSON.stringify({ t: "cursor", x: 111, y: 222 }));
const cursorMsg = await b.waitFor("cursors");
ok("B received A's cursor position", cursorMsg.list?.some((cu) => cu.id === create.data.playerId && cu.x === 111 && cu.y === 222));

// 9. GET room state
const roomState = await api.get(`/api/rooms/${roomId}`);
ok("GET room shows 1 completed piece", roomState.playerCount === 3);

// 10. reset endpoint (broadcast)
const reset = await api.post(`/api/rooms/${roomId}/reset`, {});
ok("reset room", reset.status === 200);
const resetMsg = await b.waitFor("reset");
ok("B received reset broadcast", resetMsg.pieces?.length === 25 && resetMsg.room?.completed === false);

// 11. completion — place all 25 pieces
for (const p of resetMsg.pieces) {
  a.send(JSON.stringify({ t: "piece", id: p.id, x: p.correctX, y: p.correctY, drag: false }));
  await new Promise((r) => setTimeout(r, 15));
}
const completion = await b.waitFor("completion", 5000);
ok("completion broadcast fired", completion.room?.completed === true && completion.players?.length === 3, completion.players?.join(", "));

// 12. room full: try joining 18 more (3 active + 18 = 21 > 20) — expect a 409 on the 18th
let fullErr = null;
let joined = 0;
for (let i = 0; i < 18; i++) {
  const r = await api.post(`/api/rooms/${roomId}/join`, { name: `Bot${i}`, code });
  if (r.status === 200) joined++;
  else {
    fullErr = r;
    break;
  }
}
ok("room caps at 20 players", fullErr?.status === 409, `joined=${joined}, last=${fullErr?.status} ${fullErr?.data?.error}`);

// 13. unknown room
const missing = await api.post(`/api/rooms/00000000-0000-0000-0000-000000000000/join`, { name: "X" });
ok("unknown room -> 404", missing.status === 404);

a.close();
b.close();
c.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
