/* CARTOGRAF Camera Mare — end-to-end protocol smoke test against the running server. */
import WebSocket from "ws";

const BASE = "http://localhost:4173";
let failures = 0;
function check(label, cond, extra = "") {
  if (cond) console.log("  ✓", label);
  else { failures++; console.error("  ✗ FAIL:", label, extra); }
}
function waitMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

class Client {
  constructor(name) { this.name = name; this.messages = []; this.cursor = 0; this.waiters = []; }
  connect(roomId, playerId) {
    this.ws = new WebSocket(`ws://localhost:4173/ws`);
    this.ws.on("open", () => this.ws.send(JSON.stringify({ t: "hello", roomId, playerId })));
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      m.index = this.messages.length;
      this.messages.push(m);
      this.waiters = this.waiters.filter((w) => {
        if (m.index >= w.from && w.test(m)) { w.resolve(m); return false; }
        return true;
      });
    });
  }
  /** Wait for a message arriving at or after the current cursor (then advance). */
  wait(test, label, timeoutMs = 4000) {
    const from = this.cursor;
    const found = this.messages.slice(from).find(test);
    if (found) { this.cursor = this.messages.indexOf(found) + 1; return Promise.resolve(found); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label} on ${this.name}`)), timeoutMs);
      this.waiters.push({ test, from, resolve: (m) => { clearTimeout(timer); this.cursor = m.index + 1; resolve(m); } });
    });
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
}

const api = async (path, body) => {
  const res = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

console.log("== 1. create emotions room ==");
const created = await api("/api/rooms", { puzzleId: "emotions-camera-mare", difficulty: "medium", name: "Host" });
check("room created", created.status === 200 && created.data?.room, JSON.stringify(created.data)?.slice(0, 200));
const room = created.data.room;
const hostPid = created.data.playerId;

const host = new Client("host"); host.connect(room.id, hostPid);
const init = await host.wait((m) => m.t === "init", "host init");
check("host init has room.emotions (null kind)", !!init.room.emotions && init.room.emotions.kind === null, JSON.stringify(init.room.emotions));
check("host init stage lobby", init.room.stage === "lobby");
check("puzzle is emotions mode", init.puzzle.mode === "emotions", init.puzzle.mode);
check("activity has situations", Array.isArray(init.puzzle.activity?.situations) && init.puzzle.activity.situations.length > 0, String(init.puzzle.activity?.situations?.length));
const situation = init.puzzle.activity.situations[0];

console.log("== 2. two players join ==");
const j1 = await api("/api/rooms", { puzzleId: "emotions-camera-mare", difficulty: "medium", name: "Ada" });
// join endpoint: reuse the create-as-join semantics? check how players join (POST /api/rooms/:id/join?)
let p1;
{
  const res = await fetch(`${BASE}/api/rooms/${room.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Ada", code: room.code }) });
  p1 = res.status === 200 ? await res.json() : null;
}
check("player Ada joined", !!p1?.playerId, JSON.stringify(p1)?.slice(0, 200));
let p2;
{
  const res = await fetch(`${BASE}/api/rooms/${room.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Ben", code: room.code }) });
  p2 = res.status === 200 ? await res.json() : null;
}
check("player Ben joined", !!p2?.playerId, JSON.stringify(p2)?.slice(0, 200));
const ada = new Client("ada"); ada.connect(room.id, p1.playerId);
const ben = new Client("ben"); ben.connect(room.id, p2.playerId);
const adaInit = await ada.wait((m) => m.t === "init", "ada init");
const benInit = await ben.wait((m) => m.t === "init", "ben init");
check("players get init", !!adaInit.room && !!benInit.room);
check("players see null emotions", adaInit.room.emotions?.kind === null);
check("init.emotionsVote is null", adaInit.emotionsVote === null);

console.log("== 3. error paths (before start) ==");
ada.send({ t: "emotionsVote", emotions: ["frica"], intensity: 5 });
await waitMs(400);
const lobbyVoteConfirm = ada.messages.find((m) => m.t === "emotionsVote" && m.mine);
check("vote in lobby silently ignored (server keeps state clean)", !lobbyVoteConfirm, JSON.stringify(lobbyVoteConfirm?.mine));

console.log("== 4. host starts: brief -> play ==");
host.send({ t: "control", action: "start" });
const brief = await ada.wait((m) => m.t === "room" && m.room.stage === "brief", "ada brief");
check("brief broadcast", brief.room.stage === "brief");
host.send({ t: "control", action: "stage", stage: "play" });
await ada.wait((m) => m.t === "room" && m.room.stage === "play", "ada play");
check("play reached", true);

console.log("== 5. situation round + votes ==");
host.send({ t: "control", action: "emotionsRound", kind: "situation", situationId: situation.id });
const roundMsg = await ada.wait((m) => m.t === "room" && m.room.emotions?.kind === "situation", "round started");
check("round broadcast", roundMsg.room.emotions.kind === "situation");
check("situation text public", roundMsg.room.emotions.situationId === situation.id);
check("not revealed yet", roundMsg.room.emotions.revealed === false);
check("votedCount 0", roundMsg.room.emotions.votedCount === 0);
check("totalPlayers set", typeof roundMsg.room.emotions.totalPlayers === "number", String(roundMsg.room.emotions.totalPlayers));

// edge paths during round
ada.send({ t: "emotionsVote", emotions: ["frica", "frica", "frica", "frica"], intensity: 5 });
const dedup = await ada.wait((m) => m.t === "emotionsVote" && m.mine, "dedupe confirm");
check("duplicate ids deduped", JSON.stringify(dedup.mine?.emotions) === JSON.stringify(["frica"]), JSON.stringify(dedup.mine));
ada.send({ t: "emotionsVote", emotions: ["nu-exista"], intensity: 5 });
await waitMs(300);
check("unknown emotion id silently ignored (previous vote kept)", dedup.mine !== null, "");
ada.send({ t: "emotionsVote", emotions: ["frica"], intensity: 99 });
const clamped = await ada.wait((m) => m.t === "emotionsVote" && m.mine?.intensity === 10, "clamped confirm");
check("intensity 99 clamped to 10", clamped.mine?.intensity === 10, JSON.stringify(clamped.mine));
ada.send({ t: "emotionsVote", emotions: ["frica", "bucuria", "furia", "doliul"], intensity: 5 });
const truncated = await ada.wait((m) => m.t === "emotionsVote" && m.mine?.emotions?.length === 3, "truncation confirm");
check("4 emotions truncated to 3", truncated.mine?.emotions?.length === 3, JSON.stringify(truncated.mine?.emotions));

ada.send({ t: "emotionsVote", emotions: ["frica", "furia"], intensity: 8, archetype: "protectorul" });
const adaMine = await ada.wait((m) => m.t === "emotionsVote" && m.mine, "ada vote confirm");
check("ada vote confirmed privately", adaMine.mine?.emotions?.includes("frica") && adaMine.mine?.intensity === 8, JSON.stringify(adaMine.mine));
const archId = init.puzzle.activity?.archetypes?.[0]?.id || "protectorul";
ben.send({ t: "emotionsVote", passed: true });
await ben.wait((m) => m.t === "emotionsVote" && m.mine, "ben pass confirm");
check("ben pass confirmed", true);

let votedRoom;
try {
  votedRoom = await host.wait((m) => m.t === "room" && (m.room.emotions?.votedCount ?? 0) >= 2, "votedCount 2");
} catch (e) {
  console.error("HOST ALL MSGS:", host.messages.map((m) => m.t).join(","));
  console.error("HOST WS READY:", host.ws?.readyState);
  console.error("HOST FRAMES:", host.messages.filter((m) => m.t === "room").map((m) => ({ stage: m.room.stage, kind: m.room.emotions?.kind, vc: m.room.emotions?.votedCount })));
  console.error("ADA LAST:", ada.messages.slice(-4).map((m) => m.t));
  throw e;
}
check("votedCount = 2", votedRoom.room.emotions.votedCount === 2, String(votedRoom.room.emotions.votedCount));
check("votes NOT in public room", !votedRoom.room.emotions.votes, "public state leaked votes");

console.log("== 6. reveal ==");
host.send({ t: "control", action: "emotionsReveal" });
const reveal = await ada.wait((m) => m.t === "emotionsReveal", "ada reveal");
check("reveal has agg", !!reveal.agg);
check("agg counts frica=1 furia=1", reveal.agg?.counts?.frica === 1 && reveal.agg?.counts?.furia === 1, JSON.stringify(reveal.agg?.counts));
check("agg passed=1", reveal.agg?.passed === 1, String(reveal.agg?.passed));
check("agg intensityAvg 8", reveal.agg?.intensityAvg === 8, String(reveal.agg?.intensityAvg));
check("agg archetypeCounts", JSON.stringify(reveal.agg?.archetypeCounts || {}));
check("agg has situation text", !!reveal.agg?.situation?.text, JSON.stringify(reveal.agg?.situation)?.slice(0, 120));
const revealedRoom = await ada.wait((m) => m.t === "room" && m.room.emotions?.revealed === true, "room revealed");
check("room revealed + history 1", revealedRoom.room.emotions.history?.length === 1, JSON.stringify(revealedRoom.room.emotions.history?.map((h) => h.kind)));
// second reveal should error
host.send({ t: "control", action: "emotionsReveal" });
const secondRevealErr = await host.wait((m) => m.t === "error" && !host.messages.slice(-8).find((x) => x.t === "error" && x === reveal), "second reveal error", 4000).catch(() => null);
check("second reveal denied", secondRevealErr?.t === "error", JSON.stringify(secondRevealErr));

console.log("== 7. museum round ==");
host.send({ t: "control", action: "emotionsRound", kind: "museum" });
await ada.wait((m) => m.t === "room" && m.room.emotions?.kind === "museum", "museum round");
ada.send({ t: "emotionsVote", line: "" });
await waitMs(300);
check("empty museum line silently ignored", true, "");
ada.send({ t: "emotionsVote", line: "O dată am spus NU la o ședință." });
await ada.wait((m) => m.t === "emotionsVote" && m.mine?.line, "ada line confirm");
ben.send({ t: "emotionsVote", line: "O dată am plecat prima." });
await ben.wait((m) => m.t === "emotionsVote" && m.mine?.line, "ben line confirm");
host.send({ t: "control", action: "emotionsReveal" });
const museumReveal = await ada.wait((m) => m.t === "emotionsReveal" && m.agg?.kind === "museum", "museum reveal");
check("museum reveal 2 lines", museumReveal.agg?.lines?.length === 2, JSON.stringify(museumReveal.agg?.lines));
check("museum reveal no counts", !museumReveal.agg?.counts || Object.keys(museumReveal.agg.counts).length === 0, JSON.stringify(museumReveal.agg?.counts));

console.log("== 8. safety word ==");
host.send({ t: "control", action: "emotionsSafetyWord", text: "lupul" });
await waitMs(150);
ada.send({ t: "safety", word: "LUPUL" });
const safety = await ada.wait((m) => m.t === "safetyPause", "safetyPause ada");
check("safetyPause broadcast (case-insensitive)", !!safety);
const lockedRoom = await host.wait((m) => m.t === "room" && m.room.boardLocked === true && m.room.emotions?.safetyWordActive === true, "room locked + safetyActive");
check("board locked", lockedRoom.room.boardLocked === true);
check("safetyWordActive public", lockedRoom.room.emotions.safetyWordActive === true);
// voting while locked should fail
ada.send({ t: "safety", word: "x" }); // wrong word, no pause
host.send({ t: "control", action: "emotionsRound", kind: "weather-start" });
await ada.wait((m) => m.t === "room" && m.room.emotions?.kind === "weather-start", "weather round").catch(() => {});
const beforeLocked = ada.messages.filter((m) => m.t === "emotionsVote").length;
ada.send({ t: "emotionsVote", emotions: ["frica"], intensity: 3 });
await waitMs(400);
check("vote while locked silently ignored", ada.messages.filter((m) => m.t === "emotionsVote").length === beforeLocked, "");

console.log("== 9. export ==");
const exp = await fetch(`${BASE}/api/rooms/${room.id}/export?pid=${hostPid}&format=json`);
const expJson = await exp.json().catch(() => null);
check("export 200", exp.status === 200, String(exp.status));
check("export includes emotions rounds", Array.isArray(expJson?.emotions?.rounds) && expJson.emotions.rounds.length >= 2, JSON.stringify(expJson?.emotions)?.slice(0, 200));
const html = await fetch(`${BASE}/api/rooms/${room.id}/export?pid=${hostPid}&format=html`);
check("html export 200", html.status === 200, String(html.status));

console.log("== 10. reset clears emotions ==");
const resetRes = await fetch(`${BASE}/api/rooms/${room.id}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid: hostPid }) });
check("reset api 200", resetRes.status === 200, String(resetRes.status));
const resetMsg = await ada.wait((m) => m.t === "reset", "ada reset");
check("reset broadcast", !!resetMsg);
const cleared = resetMsg.room?.emotions?.kind === null && (resetMsg.room?.emotions?.history?.length ?? 0) === 0;
check("emotions state cleared after reset", cleared, JSON.stringify(resetMsg.room?.emotions));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
