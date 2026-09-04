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

const catalog = await get("/api/puzzles");
ok("catalog has four bilingual coaching activities", catalog.data.coaching.activities.length === 4 && catalog.data.coaching.activities.every((a) => a.name.ro && a.name.en));
const catalogRank = catalog.data.coaching.activities.find((a) => a.mode === "ranking");
ok("public catalog never leaks expert answers", catalogRank.items.every((item) => item.expertRank === undefined && item.rationale === undefined) && catalogRank.debrief === undefined);

const created = await post("/api/rooms", { puzzleId: "himalaya-expedition", difficulty: "easy", name: "Ana", sessionName: "Himalaya workshop", role: "spectator" });
const roomId = created.data.room.id; const hostId = created.data.playerId; const code = created.data.room.code;
const joined = await post(`/api/rooms/${roomId}/join`, { name: "Maria", code });
const host = await connect(roomId, hostId); const participant = await connect(roomId, joined.data.playerId);
const initHost = await host.waitFor("init"); const initParticipant = await participant.waitFor("init");
ok("ranking starts with 12 free cards and 12 destinations", initHost.pieces.length === 12 && initHost.puzzle.rankingSlots.length === 12);
ok("expert rank is hidden from both host and participant", initHost.puzzle.activity.items.every((item) => item.expertRank === undefined) && initParticipant.puzzle.activity.items.every((item) => item.expertRank === undefined));
ok("facilitator can be a non-playing spectator", initHost.players.find((p) => p.id === hostId).role === "spectator");

host.send(JSON.stringify({ t: "control", action: "start" }));
const brief = await participant.waitFor("room", (m) => m.room.stage === "brief");
ok("coaching Start synchronizes a brief stage", brief.room.boardLocked === true && brief.room.startedAt === null);
host.send(JSON.stringify({ t: "control", action: "stage", stage: "play" }));
await participant.waitFor("room", (m) => m.room.stage === "play");

const slot5 = initHost.puzzle.rankingSlots.find((slot) => slot.rank === 5);
participant.send(JSON.stringify({ t: "piece", id: 0, x: slot5.x, y: slot5.y, drag: false }));
const rank5 = await host.waitFor("pieces", (m) => m.list?.some((p) => p.id === 0 && p.placedOnSlot === 5));
ok("item 0 can be ranked freely at slot 5", rank5.list[0].placedOnSlot === 5 && rank5.list[0].locked);

const slot2 = initHost.puzzle.rankingSlots.find((slot) => slot.rank === 2);
participant.send(JSON.stringify({ t: "piece", id: 0, x: slot5.x, y: slot5.y, drag: true }));
await host.waitFor("pieces", (m) => m.list?.some((p) => p.id === 0 && p.placedOnSlot === null));
participant.send(JSON.stringify({ t: "piece", id: 0, x: slot2.x, y: slot2.y, drag: false }));
const reordered = await host.waitFor("pieces", (m) => m.list?.some((p) => p.id === 0 && p.placedOnSlot === 2));
ok("placed ranking cards remain reorderable before facilitator lock", reordered.list[0].placedOnSlot === 2);

participant.send(JSON.stringify({ t: "control", action: "reveal" }));
const deniedReveal = await participant.waitFor("error", (m) => m.code === "not_host");
ok("participants cannot reveal expert answers", deniedReveal.code === "not_host");
host.send(JSON.stringify({ t: "control", action: "reveal" }));
const incomplete = await host.waitFor("error", (m) => m.code === "ranking_incomplete");
ok("facilitator cannot reveal an incomplete ranking", incomplete.code === "ranking_incomplete");

const availableRanks = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
for (let id = 1; id < 12; id++) {
  const slot = initHost.puzzle.rankingSlots.find((candidate) => candidate.rank === availableRanks[id - 1]);
  participant.send(JSON.stringify({ t: "piece", id, x: slot.x, y: slot.y, drag: false }));
  await host.waitFor("pieces", (m) => m.list?.some((p) => p.id === id && p.placedOnSlot === slot.rank));
}
host.send(JSON.stringify({ t: "control", action: "reveal" }));
const revealedPuzzle = await participant.waitFor("puzzleMeta", (m) => m.puzzle.activity.items.every((item) => Number.isInteger(item.expertRank)));
const revealedRoom = await participant.waitFor("room", (m) => m.room.revealed);
ok("expert ranking arrives only after facilitator reveal", revealedPuzzle.puzzle.activity.items[0].rationale && revealedRoom.room.stage === "reveal" && revealedRoom.room.boardLocked);

const exported = await get(`/api/rooms/${roomId}/export?pid=${hostId}`);
ok("export computes team rank from destination slot", exported.data.ranking.find((entry) => entry.teamRank === 2)?.item != null);
ok("export contains insights, actions and no raw questionnaire answers", exported.data.insights && Array.isArray(exported.data.actions) && !JSON.stringify(exported.data).includes('"answers"'));

// Questionnaire privacy.
const qCreated = await post("/api/rooms", { puzzleId: "team-compass", difficulty: "easy", name: "Coach" });
const qJoin = await post(`/api/rooms/${qCreated.data.room.id}/join`, { name: "Dana", code: qCreated.data.room.code });
const coach = await connect(qCreated.data.room.id, qCreated.data.playerId); const dana = await connect(qCreated.data.room.id, qJoin.data.playerId);
const qInit = await coach.waitFor("init"); await dana.waitFor("init");
ok("questionnaire has 20 prompts, 4 dimensions and no board pieces", qInit.pieces.length === 0 && qInit.puzzle.activity.questions.length === 20 && qInit.puzzle.activity.dimensions.length === 4);
coach.send(JSON.stringify({ t: "control", action: "start" })); await dana.waitFor("room", (m) => m.room.stage === "brief"); coach.send(JSON.stringify({ t: "control", action: "stage", stage: "play" })); await dana.waitFor("room", (m) => m.room.stage === "play");
const answers = Object.fromEntries(qInit.puzzle.activity.questions.map((q) => [q.id, "A"]));
dana.send(JSON.stringify({ t: "rating", answers, done: true }));
const publicRating = await coach.waitFor("ratings", (m) => m.list?.some((r) => r.playerId === qJoin.data.playerId && r.done));
const privateRating = await dana.waitFor("ratings", (m) => m.list?.some((r) => r.playerId === qJoin.data.playerId && r.done));
const seenByCoach = publicRating.list.find((r) => r.playerId === qJoin.data.playerId);
const seenByDana = privateRating.list.find((r) => r.playerId === qJoin.data.playerId);
ok("other players receive profile code but never raw answers", seenByCoach.profileCode?.length === 4 && seenByCoach.answers === undefined);
ok("answer owner can recover their own answers", Object.keys(seenByDana.answers || {}).length === 20);
const badReset = await post(`/api/rooms/${qCreated.data.room.id}/reset`, { pid: qJoin.data.playerId });
const goodReset = await post(`/api/rooms/${qCreated.data.room.id}/reset`, { pid: qCreated.data.playerId });
ok("questionnaire reset is synchronized and host-only", badReset.status === 403 && goodReset.status === 200);
await coach.waitFor("reset");

host.close(); participant.close(); coach.close(); dana.close();
await delay(20);
const failures = checks.filter((value) => !value).length;
console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
process.exit(failures ? 1 : 0);
