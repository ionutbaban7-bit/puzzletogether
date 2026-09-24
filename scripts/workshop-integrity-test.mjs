/* Coaching protocol: free ranking, gated reveal and private questionnaire answers. */
import WebSocket from "ws";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const checks = [];
function ok(name, condition, extra = "") { checks.push(!!condition); console.log(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`); }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(method, path, body) { const response = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json().catch(() => ({})) }; }
const post = (path, body) => request("POST", path, body);
const get = (path) => request("GET", path);
function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL); const queue = []; const waiters = [];
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId })));
    ws.on("message", (raw) => { const message = JSON.parse(raw.toString()); const i = waiters.findIndex((w) => w.type === message.t && w.predicate(message)); if (i >= 0) { const w = waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(message); } else queue.push(message); });
    ws.on("error", reject);
    ws.waitFor = (type, predicate = () => true, timeout = 4000) => new Promise((res, rej) => { const i = queue.findIndex((m) => m.t === type && predicate(m)); if (i >= 0) return res(queue.splice(i, 1)[0]); const timer = setTimeout(() => rej(new Error(`timeout ${type}`)), timeout); waiters.push({ type, predicate, resolve: res, timer }); });
    resolve(ws);
  });
}


const made = await post("/api/rooms", { puzzleId: "team-compass", difficulty: "easy", name: "Coach", role: "spectator" });
const id = made.data.room.id, hostId = made.data.playerId;
const join = await post(`/api/rooms/${id}/join`, { name: "Colleague", code: made.data.room.code });
const host = await connect(id, hostId), colleague = await connect(id, join.data.playerId);
const init = await host.waitFor("init"); await colleague.waitFor("init");
const send = (ws, msg) => ws.send(JSON.stringify(msg));
send(host, { t: "control", action: "start" }); await host.waitFor("room", m => m.room.stage === "brief");
send(host, { t: "control", action: "stage", stage: "play" }); await host.waitFor("room", m => m.room.stage === "play");
send(colleague, { t: "harvest", kind: "insight", key: "observed", value: "too early", previous: "" });
ok("notes are stage-gated", (await colleague.waitFor("error")).code === "harvest_stage");
send(colleague, { t: "pauseRequest" });
const pause = await host.waitFor("room", m => m.room.pauseRequested);
ok("pause signal reaches facilitator without requester identity", pause.room.pauseRequested === true && !JSON.stringify(pause.room).includes('"requestedBy"'));
send(colleague, { t: "control", action: "ackPause" });
ok("only facilitator acknowledges a pause", (await colleague.waitFor("error")).code === "not_host");
send(host, { t: "control", action: "ackPause" }); await colleague.waitFor("room", m => m.room.pauseRequested === false);
const answers = Object.fromEntries(init.puzzle.activity.questions.map(q => [q.id, "A"]));
send(host, { t: "rating", answers, done: true });
send(colleague, { t: "rating", answers, done: true });
const ratings = await host.waitFor("ratings", m => m.list.some(r => r.playerId === join.data.playerId && r.done));
ok("non-playing facilitator cannot submit questionnaire answers", !ratings.list.some(r => r.playerId === hostId && r.done));
send(host, { t: "control", action: "lock", locked: true }); await colleague.waitFor("room", m => m.room.boardLocked && m.room.stage === "play");
send(colleague, { t: "rating", answers: {}, done: false });
send(host, { t: "control", action: "stage", stage: "debrief" }); await host.waitFor("room", m => m.room.stage === "debrief");
send(host, { t: "harvest", kind: "insight", key: "observed", value: "We interrupted less", previous: "" });
await colleague.waitFor("room", m => m.room.insights.observed === "We interrupted less");
send(colleague, { t: "harvest", kind: "insight", key: "learned", value: "Invite quieter voices", previous: "" });
const shared = await host.waitFor("room", m => m.room.insights.learned === "Invite quieter voices");
ok("different-field updates preserve both colleagues' work", shared.room.insights.observed === "We interrupted less");
send(colleague, { t: "harvest", kind: "insight", key: "observed", value: "stale overwrite", previous: "" });
ok("same-field stale edits are rejected", (await colleague.waitFor("error")).code === "harvest_conflict");
send(host, { t: "harvest", kind: "actionAdd" }); const added = await host.waitFor("room", m => m.room.actions.length === 1); const action = added.room.actions[0];
send(host, { t: "harvest", kind: "actionField", id: action.id, key: "text", value: "Round-robin next Monday", previous: "" }); await colleague.waitFor("room", m => m.room.actions[0]?.text === "Round-robin next Monday");
send(colleague, { t: "harvest", kind: "actionField", id: action.id, key: "ownerId", value: join.data.playerId, previous: "" });
const owned = await host.waitFor("room", m => m.room.actions[0]?.ownerId === join.data.playerId);
ok("action edits merge by field", owned.room.actions[0].text === "Round-robin next Monday");
send(host, { t: "harvest", kind: "actionRemove", id: action.id, previous: action });
ok("stale action deletion is rejected", (await host.waitFor("error")).code === "harvest_conflict");
const exported = await get(`/api/rooms/${id}/export?pid=${hostId}`);
ok("export contains persisted reflections and actions", exported.data.insights.learned === "Invite quieter voices" && exported.data.actions[0].text === "Round-robin next Monday");
const metadata = await get(`/api/rooms/${id}`);
ok("public metadata omits workshop content", !["insights", "debriefNotes", "actions", "emotions"].some(k => k in metadata.data.room));
colleague.close(); await delay(60);
const rejoined = await connect(id, join.data.playerId);
const fresh = await rejoined.waitFor("init");
ok("locked questionnaire ignores later changes", fresh.ratings.find(r => r.playerId === join.data.playerId)?.done === true);
rejoined.close();
send(host, { t: "control", action: "stage", stage: "closed" }); await host.waitFor("room", m => m.room.stage === "closed");
send(host, { t: "harvest", kind: "actionAdd" }); ok("closed sessions cannot be edited", (await host.waitFor("error")).code === "harvest_stage");
const em = await post("/api/rooms", { puzzleId: "emotions-camera-mare", difficulty: "easy", name: "Private emotions" });
const emPublic = await get(`/api/rooms/${em.data.room.id}`);
ok("emotion history is absent from unauthenticated metadata", em.data.room.emotions && !("emotions" in emPublic.data.room));
host.close(); colleague.close(); await delay(20);
const failures = checks.filter(v => !v).length;
console.log(`${checks.length - failures}/${checks.length} workshop integrity checks passed`);
process.exit(failures ? 1 : 0);
