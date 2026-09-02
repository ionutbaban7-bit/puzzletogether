/* Simulates coaching rooms (ranking + questionnaire). Run: node scripts/coaching-test.mjs */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace("http", "ws") + "/ws";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};

function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const queue = [];
    const matches = [];
    let init = null;
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", roomId, playerId })));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.t === "init") init = msg;
      const mi = matches.findIndex((m) => m.type === msg.t && (!m.predicate || m.predicate(msg)));
      if (mi >= 0) {
        const m = matches.splice(mi, 1)[0];
        clearTimeout(m.timer);
        return m.resolve(msg);
      }
      queue.push(msg);
    });
    ws.on("error", reject);
    ws.waitFor = (type, predicate, timeout = 4000) =>
      new Promise((res, rej) => {
        const idx = queue.findIndex((m) => m.t === type && (!predicate || predicate(m)));
        if (idx >= 0) return res(queue.splice(idx, 1)[0]);
        const timer = setTimeout(() => rej(new Error(`timeout waiting ${type}`)), timeout);
        matches.push({ type, predicate, resolve: res, timer });
      });
    ws.waitInit = () =>
      new Promise((res, rej) => {
        if (init) return res(init);
        const timer = setTimeout(() => rej(new Error("timeout waiting init")), 3000);
        matches.push({ type: "init", predicate: null, resolve: (m) => { clearTimeout(timer); res(m); }, timer });
      });
    resolve(ws);
  });
}

const api = {
  async get(path) {
    const r = await fetch(BASE + path);
    return { status: r.status, data: await r.json().catch(() => ({})) };
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

// 0. catalog includes coaching
const catalog = await api.get("/api/puzzles");
ok("catalog has coaching category", catalog.data.coaching?.category?.id === "coaching");
ok("coaching has 4 activities", catalog.data.coaching?.activities?.length === 4, `${catalog.data.coaching?.activities?.length}`);
ok("all activities bilingual", catalog.data.coaching.activities.every((a) => a.name?.ro && a.name?.en));
const coach = await api.get("/api/coaching");
ok("/api/coaching endpoint works", coach.data.activities?.length === 4);

// 1. ranking room
const rankRoom = await api.post("/api/rooms", { puzzleId: "himalaya-expedition", difficulty: "easy", name: "Ionut" });
ok("create ranking room", rankRoom.status === 200, JSON.stringify(rankRoom.data?.room?.total));
ok("ranking room total = 12 items", rankRoom.data.room?.total === 12);

const a = await connect(rankRoom.data.room.id, rankRoom.data.playerId);
const initA = await a.waitInit();
ok("ranking init has 12 pieces", initA.pieces?.length === 12);
ok("ranking init carries activity content", initA.puzzle?.isCoaching === true && initA.puzzle?.mode === "ranking" && !!initA.puzzle?.activity?.items?.length);
ok("activity items have bilingual labels", initA.puzzle.activity.items.every((i) => i.label?.ro && i.label?.en));
ok("layout slots match piece count", initA.puzzle.activity.items.length === 12);

// 2. join second player + move sync
const join2 = await api.post(`/api/rooms/${rankRoom.data.room.id}/join`, { name: "Maria", code: rankRoom.data.room.code });
const b = await connect(rankRoom.data.room.id, join2.data.playerId);
await b.waitInit();
const piece0 = initA.pieces[0];
a.send(JSON.stringify({ t: "piece", id: 0, x: 500, y: 500, drag: true }));
const moveMsg = await b.waitFor("pieces", (m) => m.list?.some((p) => p.id === 0 && p.x === 500));
ok("ranking item move syncs between clients", !!moveMsg);

// 3. snap/lock an item to its slot
a.send(JSON.stringify({ t: "piece", id: 0, x: piece0.correctX, y: piece0.correctY, drag: false }));
const snap = await b.waitFor("pieces", (m) => m.list?.some((p) => p.id === 0 && p.locked === true));
ok("ranking item snaps & locks", snap.list.find((p) => p.id === 0)?.locked === true);

// 4. lock all → no puzzle-completion broadcast for coaching rooms
let gotCompletion = false;
const completionWatch = b.waitFor("completion", null, 1500).catch(() => null);
for (const p of initA.pieces) {
  if (p.id === 0) continue;
  a.send(JSON.stringify({ t: "piece", id: p.id, x: p.correctX, y: p.correctY, drag: false }));
  await new Promise((r) => setTimeout(r, 12));
}
const comp = await completionWatch;
ok("coaching ranking does NOT fire puzzle completion", !comp);
const roomState = await api.get(`/api/rooms/${rankRoom.data.room.id}`);
ok("GET room shows 12 locked pieces", roomState.data.room?.completed === false);

// 5. questionnaire room
const qRoom = await api.post("/api/rooms", { puzzleId: "team-compass", difficulty: "easy", name: "Alex" });
ok("create questionnaire room", qRoom.status === 200);
const c = await connect(qRoom.data.room.id, qRoom.data.playerId);
const initC = await c.waitInit();
ok("questionnaire init has no pieces", initC.pieces?.length === 0);
ok("questionnaire init has activity", initC.puzzle?.mode === "questionnaire" && initC.puzzle?.activity?.questions?.length === 20);
ok("questionnaire has 4 dimensions", initC.puzzle.activity.dimensions?.length === 4);
ok("questionnaire has 16 types", Object.keys(initC.puzzle.activity.types || {}).length === 16);

// 6. rating flow
const joinQ2 = await api.post(`/api/rooms/${qRoom.data.room.id}/join`, { name: "Dana", code: qRoom.data.room.code });
const d = await connect(qRoom.data.room.id, joinQ2.data.playerId);
await d.waitInit();

const answers = {};
initC.puzzle.activity.questions.forEach((q) => (answers[q.id] = "A"));
c.send(JSON.stringify({ t: "rating", answers: { 0: "A" }, done: false }));
const ratingMsg = await d.waitFor("ratings", (m) => m.list?.some((r) => r.playerId === qRoom.data.playerId));
ok("rating syncs to other players", ratingMsg.list.some((r) => r.playerId === qRoom.data.playerId && r.answers["0"] === "A"));

c.send(JSON.stringify({ t: "rating", answers, done: true }));
const doneMsg = await d.waitFor("ratings", (m) => m.list?.some((r) => r.playerId === qRoom.data.playerId && r.done === true));
ok("questionnaire completion syncs (done=true)", !!doneMsg);

// 7. reset clears ratings
await api.post(`/api/rooms/${qRoom.data.room.id}/reset`, {});
const resetMsg = await c.waitFor("reset");
ok("reset clears ratings", Array.isArray(resetMsg.ratings) && resetMsg.ratings.length === 0);

a.close(); b.close(); c.close(); d.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} coaching checks passed`);
process.exit(failed.length ? 1 : 0);
