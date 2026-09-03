/*
 * Letter Canvas protocol tests: claims, concurrent edits, duplicate, delete,
 * lock, reconnect, persistence (server restart), undo, completion,
 * wildcards, punctuation and Romanian diacritics (NFC).
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
const results = [];
function ok(name, condition, extra = "") {
  results.push(!!condition);
  console.log(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(base, p, body) {
  const response = await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function get(base, p) {
  const response = await fetch(base + p);
  return { status: response.status, data: await response.json() };
}

function connect(base, roomId, playerId) {
  const wsUrl = base.replace(/^http/, "ws") + "/ws";
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws._pendingSends = [];
    ws.send = new Proxy(ws.send, {
      apply(target, self, args) {
        if (self.readyState === 1) return target.apply(self, args);
        self._pendingSends.push(args[0]);
      },
    });
    ws.on("open", () => {
      for (const data of ws._pendingSends.splice(0)) ws.send(data);
    });
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
    ws.waitFor = (type, predicate = () => true, timeout = 5000) => new Promise((res, rej) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return res(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rej(new Error(`timeout waiting ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: res, timer });
    });
    ws.canvasTiles = () => (ws._lastCanvas ? ws._lastCanvas.tiles : {});
    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.t === "canvas" || message.t === "init") {
          const initial = message.t === "init" ? message.canvas?.tiles : undefined;
          const added = message.t === "init" ? initial : message.list;
          const removed = message.t === "init" ? [] : message.removed || [];
          const hasInventory = message.t === "init" ? message.canvas ? message.canvas.inventory !== undefined : false : message.inventory !== undefined;
          if (Array.isArray(added) || removed.length || hasInventory) {
            const map = ws._lastCanvas ? { ...ws._lastCanvas.tiles } : {};
            for (const tile of Array.isArray(added) ? added : []) map[tile.id] = tile;
            for (const id of removed) delete map[id];
            const inventory = hasInventory ? (message.t === "init" ? message.canvas.inventory : message.inventory) : ws._lastCanvas?.inventory;
            ws._lastCanvas = { tiles: map, inventory };
          }
        }
      } catch { /* ignore */ }
    });
    resolve(ws);
  });
}

function send(ws, msg) { ws.send(JSON.stringify(msg)); }
const canvasOp = (ws, op, data = {}) => send(ws, { t: "canvas", op, ...data });

// ---------------------------------------------------------------- catalogue
const catalog = await get(BASE, "/api/puzzles");
const canvasPuzzles = catalog.data.puzzles.filter((p) => p.category === "letter-canvas");
ok("catalog exposes the letter-canvas category (words removed)", catalog.data.categories.some((c) => c.id === "letter-canvas") && !catalog.data.categories.some((c) => c.id === "words"), `${canvasPuzzles.length} activities`);
ok("catalog exposes the four canvas modes", JSON.stringify((catalog.data.canvasModes || []).map((m) => m.tiles)) === JSON.stringify([96, 180, 260, 0]));
ok("catalog exposes RO + EN letter sets with diacritics", (catalog.data.letterSets?.ro || "").includes("ĂÂÎȘȚ") && (catalog.data.letterSets?.en || "").length === 26);

// ------------------------------------------------------------------ create room
const created = await post(BASE, "/api/rooms", { puzzleId: "agile-words", difficulty: "quick", name: "Ana", sessionName: "Canvas protocol", contentLanguage: "ro" });
const roomId = created.data.room.id;
const hostId = created.data.playerId;
const code = created.data.room.code;
ok("canvas room starts in a locked lobby with the content language", created.status === 200 && created.data.room.stage === "lobby" && created.data.room.contentLanguage === "ro");
ok("canvas room uses the canvas mode total (quick = 96)", created.data.room.total === 96);

const badMode = await post(BASE, "/api/rooms", { puzzleId: "agile-words", difficulty: "easy", name: "Bad", contentLanguage: "ro" });
ok("photo difficulty is rejected for canvas activities", badMode.status === 400);

const joined = await post(BASE, `/api/rooms/${roomId}/join`, { name: "Mihai", code });
const player2 = await post(BASE, `/api/rooms/${code}/join`, { name: "Elena", code });
const p2Id = joined.data.playerId;
const p3Id = player2.data.playerId;

const host = await connect(BASE, roomId, hostId);
const p2 = await connect(BASE, roomId, p2Id);
const p3 = await connect(BASE, roomId, p3Id);
const hostInit = await host.waitFor("init");
ok("init delivers the finite inventory", hostInit.canvas && hostInit.canvas.inventory && hostInit.canvas.mode === "quick" && hostInit.canvas.contentLanguage === "ro");
const invTotal = Object.values(hostInit.canvas.inventory).reduce((a, b) => a + b, 0);
ok("finite inventory sums to the mode total", invTotal === 96, `sum=${invTotal}`);
ok("inventory includes wildcards and punctuation", (hostInit.canvas.inventory["?"] || 0) > 0 && (hostInit.canvas.inventory["."] || 0) > 0);
ok("RO inventory includes the diacritics", ["Ă", "Â", "Î", "Ș", "Ț"].every((l) => (hostInit.canvas.inventory[l] || 0) > 0), JSON.stringify(["Ă", "Â", "Î", "Ș", "Ț"].map((l) => hostInit.canvas.inventory[l])));

// locked lobby: canvas ops must be rejected
canvasOp(host, "spawn", { text: "A" });
const lobbyReject = await host.waitFor("error", (m) => m.code === "board_locked");
ok("canvas actions are rejected in the locked lobby", lobbyReject.code === "board_locked");

send(host, { t: "control", action: "start" });
await host.waitFor("room", (m) => m.room.stage === "play");
await p2.waitFor("room", (m) => m.room.stage === "play");

// -------------------------------------------------------------------- spawn
canvasOp(host, "spawn", { text: "A" });
const spawnA = await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "A" && t.kind === "letter"));
const tileA = spawnA.list.find((t) => t.text === "A");
ok("tap-to-spawn creates a claimed tile", !!tileA && tileA.heldBy === hostId && tileA.x >= 0 && tileA.x < 1920 && tileA.y >= 0 && tileA.y < 1200, `id=${tileA?.id}`);
const otherSawA = await p2.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileA.id)).catch(() => null);
ok("spawn is broadcast to every participant", !!otherSawA);

// diacritics
for (const letter of ["Ă", "Â", "Î", "Ș", "Ț"]) {
  canvasOp(host, "spawn", { text: letter });
}
const diacritics = await Promise.all(
  ["Ă", "Â", "Î", "Ș", "Ț"].map((letter) => p3.waitFor("canvas", (m) => m.list?.some((t) => t.text === letter))),
);
ok("RO diacritics spawn (Ă Â Î Ș Ț)", diacritics.length === 5);

// NFC normalization: decomposed Â (A + U+0302) must be stored NFC
canvasOp(host, "spawn", { text: "A\u0302" });
const nfcTile = await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "Â" && t.text.length === 1));
ok("Unicode NFC normalization (A + combining circumflex → Â)", !!nfcTile, JSON.stringify(nfcTile.list[0].text));

// foreign letter rejected for the RO content language
canvasOp(p2, "spawn", { text: "É" });
const foreignReject = await p2.waitFor("error", (m) => m.code === "letter_unavailable");
ok("letters outside the content language are rejected", foreignReject.code === "letter_unavailable");

// EN room: Romanian diacritics must be rejected
const enRoom = await post(BASE, "/api/rooms", { puzzleId: "agile-words", difficulty: "quick", name: "Bob", contentLanguage: "en" });
const enHost = await connect(BASE, enRoom.data.room.id, enRoom.data.playerId);
await enHost.waitFor("init");
send(enHost, { t: "control", action: "start" });
await enHost.waitFor("room", (m) => m.room.stage === "play");
canvasOp(enHost, "spawn", { text: "Ă" });
const enReject = await enHost.waitFor("error", (m) => m.code === "letter_unavailable");
ok("content language is enforced per room (Ă rejected in EN)", enReject.code === "letter_unavailable");

// wildcard + punctuation
canvasOp(host, "spawn", { text: "?" });
const wildcard = await host.waitFor("canvas", (m) => m.list?.some((t) => t.kind === "wildcard"));
canvasOp(host, "spawn", { text: "." });
const punct = await host.waitFor("canvas", (m) => m.list?.some((t) => t.kind === "punctuation"));
ok("wildcard and punctuation tiles spawn", !!wildcard && !!punct);

// -------------------------------------------------------------------- claims
canvasOp(p2, "spawn", { text: "M" });
const tileM = (await p2.waitFor("canvas", (m) => m.list?.some((t) => t.text === "M"))).list.find((t) => t.text === "M");
// p3 tries to drag the tile claimed by p2
canvasOp(p3, "move", { id: tileM.id, x: 300, y: 300, drag: true });
const claimReject = await p3.waitFor("canvasRejected", (m) => m.reason === "held" && m.tile?.id === tileM.id);
ok("server-authoritative claim: a second player cannot drag a held tile", claimReject.ownerId === p2Id);
// claim owner can drag it
canvasOp(p2, "move", { id: tileM.id, x: 300, y: 300, drag: true });
const claimMove = await host.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.x === 300 && t.heldBy === p2Id));
ok("claim owner can move the tile", !!claimMove);

// ---------------------------------------------------------------- concurrent
// p2 still holds tileM (drag true). p3's drop on the same tile must be rejected.
canvasOp(p3, "move", { id: tileM.id, x: 500, y: 500, drag: false });
const concurrentReject = await p3.waitFor("canvasRejected", (m) => m.reason === "held" && m.tile?.id === tileM.id);
ok("concurrent edit: dropping a tile held by someone else is rejected", !!concurrentReject);
// owner drops it — the position wins and the claim is released
canvasOp(p2, "move", { id: tileM.id, x: 320, y: 300, drag: false });
const dropped = await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.x === 320 && !t.heldBy));
ok("owner's drop wins and releases the claim", !!dropped);

// ---------------------------------------------------------------- duplicate
const beforeDup = host._lastCanvas.inventory["M"] ?? 0;
canvasOp(host, "duplicate", { id: tileM.id });
const dup = await p3.waitFor("canvas", (m) => m.list?.some((t) => t.text === "M" && t.id !== tileM.id && t.heldBy === hostId));
ok("duplicate creates a new tile beside the original", !!dup, `newId=${dup.list[0]?.id}`);
ok("duplicate consumes inventory", (host._lastCanvas.inventory["M"] ?? 0) === beforeDup - 1);

// -------------------------------------------------------------------- delete
const beforeDel = host._lastCanvas.inventory["M"] ?? 0;
canvasOp(host, "delete", { id: dup.list[0].id });
const del = await p2.waitFor("canvas", (m) => (m.removed || []).includes(dup.list[0].id));
ok("delete removes the tile", !!del);
ok("delete returns the letter to the inventory", (p2._lastCanvas.inventory["M"] ?? 0) === beforeDel + 1);

// delete a tile actively held by someone else (non-owner) → rejected
canvasOp(p3, "move", { id: tileM.id, x: 330, y: 300, drag: true }); // p3 now holds it (claim is free)
await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.heldBy === p3Id));
canvasOp(host, "delete", { id: tileM.id });
const heldDeleteReject = await host.waitFor("canvasRejected", (m) => m.reason === "held" && m.tile?.id === tileM.id);
ok("a held tile cannot be deleted by another player", !!heldDeleteReject);
canvasOp(p3, "move", { id: tileM.id, x: 330, y: 300, drag: false });
await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && !t.heldBy));

// --------------------------------------------------------------------- undo
canvasOp(host, "spawn", { text: "Z" });
const tileZ = (await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "Z" && t.kind === "letter"))).list.find((t) => t.text === "Z");
const beforeUndo = host._lastCanvas.inventory["Z"] ?? 0;
canvasOp(host, "undo");
const undoMsg = await p2.waitFor("canvas", (m) => (m.removed || []).includes(tileZ.id));
ok("undo reverses the last spawn", !!undoMsg);
ok("undo returns the letter to the inventory", (p2._lastCanvas.inventory["Z"] ?? 0) === beforeUndo + 1);
// undo the move of tileM
canvasOp(p3, "move", { id: tileM.id, x: 400, y: 310, drag: true });
await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.x === 400));
canvasOp(p3, "move", { id: tileM.id, x: 400, y: 310, drag: false });
await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.x === 400 && !t.heldBy));
canvasOp(p3, "undo");
const undoMove = await host.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.x === 330));
ok("undo reverses a drop back to the previous position", !!undoMove);

// -------------------------------------------------------------------- flip
canvasOp(host, "flip", { id: tileM.id });
const flipped = await p2.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.flipped === true));
canvasOp(host, "flip", { id: tileM.id });
const unflipped = await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.flipped === false));
ok("tiles are reversible (flip on/off) until lock", !!flipped && !!unflipped);

// -------------------------------------------------------------- exhaust + sandbox
const sparseLetter = Object.entries(host._lastCanvas.inventory).find(([text, count]) => count === 1 && !/[^\p{L}]/u.test(text) && text !== "?");
if (sparseLetter) {
  const [letter] = sparseLetter;
  for (let i = 0; i < 1; i++) canvasOp(host, "spawn", { text: letter });
  await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === letter));
  canvasOp(host, "spawn", { text: letter });
  const exhausted = await host.waitFor("canvasRejected", (m) => m.reason === "inventory" && m.text === letter);
  ok(`finite inventory exhausts (${letter} ran out)`, !!exhausted);
} else {
  ok("finite inventory exhausts (letter ran out)", false, "no single-count letter found");
}
const sandboxRoom = await post(BASE, "/api/rooms", { puzzleId: "agile-words", difficulty: "sandbox", name: "Sam", contentLanguage: "en" });
const sandboxHost = await connect(BASE, sandboxRoom.data.room.id, sandboxRoom.data.playerId);
const sandboxInit = await sandboxHost.waitFor("init");
ok("sandbox mode has an unlimited (null) inventory", sandboxInit.canvas && sandboxInit.canvas.inventory === null);
send(sandboxHost, { t: "control", action: "start" });
await sandboxHost.waitFor("room", (m) => m.room.stage === "play");
for (let i = 0; i < 8; i++) {
  canvasOp(sandboxHost, "spawn", { text: "W" });
  await sandboxHost.waitFor("canvas", (m) => (m.list || []).length === 1, 4000);
}
ok("sandbox allows unlimited duplicates of the same letter", Object.keys(sandboxHost._lastCanvas.tiles).length === 8);

// ---------------------------------------------------------------------- lock
send(host, { t: "control", action: "lock", locked: true });
await p2.waitFor("room", (m) => m.room.boardLocked === true);
canvasOp(p2, "spawn", { text: "B" });
const lockReject = await p2.waitFor("error", (m) => m.code === "board_locked");
ok("facilitator lock freezes the canvas", !!lockReject);
send(host, { t: "control", action: "lock", locked: false });
await p2.waitFor("room", (m) => m.room.boardLocked === false);
canvasOp(p2, "spawn", { text: "B" });
const unlocked = await p2.waitFor("canvas", (m) => m.list?.some((t) => t.text === "B" && t.kind === "letter"));
ok("unlock reopens the canvas", !!unlocked);

// ----------------------------------------------------------------- reconnect
// p3 claims a tile, drops the connection → claim is released for everyone
canvasOp(p3, "move", { id: tileM.id, x: 500, y: 400, drag: true });
await p3.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.heldBy === p3Id));
p3.close();
await wait(300);
const released = await p2.waitFor("canvas", (m) => m.list?.some((t) => t.id === tileM.id && t.heldBy === null), 6000);
ok("disconnect releases the tile claim", !!released);
// p3 reconnects and gets the full canvas state
const p3Again = await connect(BASE, roomId, p3Id);
const reinit = await p3Again.waitFor("init");
const expectedTiles = Object.keys(host._lastCanvas.tiles).length;
ok("reconnect resyncs the full canvas (tiles + inventory)", reinit.canvas && reinit.canvas.tiles.length >= expectedTiles && !!reinit.canvas.inventory, `tiles=${reinit.canvas?.tiles.length}`);

// --------------------------------------------------------------- persistence
// let the debounced snapshot land, then boot a SECOND server on the same data dir
await wait(900);
ok("room snapshot file exists", existsSync(path.join(ROOT, ".data", "rooms.json")));
const secondBase = "http://127.0.0.1:3100";
const child = spawn(process.execPath, [path.join(ROOT, "src", "server.js")], {
  env: { ...process.env, PORT: "3100" },
  stdio: ["ignore", "pipe", "pipe"],
});
let secondLog = "";
child.stdout.on("data", (d) => { secondLog += d.toString(); });
child.stderr.on("data", (d) => { secondLog += d.toString(); });
await new Promise((resolve, reject) => {
  const poll = setInterval(async () => {
    try {
      const h = await get(secondBase, "/api/health");
      if (h.status === 200) { clearInterval(poll); resolve(); }
    } catch { /* not up yet */ }
  }, 250);
  setTimeout(() => { clearInterval(poll); reject(new Error("second server did not start: " + secondLog.slice(-400))); }, 12000);
});
try {
  const restoredHost = await connect(secondBase, roomId, hostId);
  const restoredInit = await restoredHost.waitFor("init");
  const beforeCount = Object.keys(host._lastCanvas.tiles).length;
  ok("persistence: tiles survive a server restart", restoredInit.canvas.tiles.length === beforeCount, `${restoredInit.canvas.tiles.length}/${beforeCount}`);
  ok("persistence: inventory survives a server restart", JSON.stringify(restoredInit.canvas.inventory) === JSON.stringify(host._lastCanvas.inventory));
  restoredHost.close();
} finally {
  child.kill("SIGTERM");
  await wait(300);
}

// ----------------------------------------------------------------- completion
const textBefore = (Object.values(host._lastCanvas.tiles)).length;
send(host, { t: "control", action: "complete" });
const completion = await p2.waitFor("completion", (m) => m.room.completed === true);
ok("completion is triggered by the facilitator (not by placement)", !!completion && typeof completion.canvasText === "string");
ok("completion carries the reconstructed composition text", (completion.canvasText || "").length > 0, JSON.stringify((completion.canvasText || "").slice(0, 60)));
canvasOp(p2, "spawn", { text: "C" });
const frozenReject = await p2.waitFor("error", (m) => m.code === "room_completed");
ok("the canvas is frozen after completion", !!frozenReject);
void textBefore;

host.close(); p2.close(); p3Again.close(); enHost.close(); sandboxHost.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? "🎉" : "⚠️"} letter-canvas protocol: ${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
