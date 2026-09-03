/*
 * Sentence Canvas protocol tests: whole-word tiles, RO/EN vocabulary packs,
 * grammatical categories, row alignment + discrete word snap, narrow
 * punctuation, custom words (spawn/edit/duplicate/delete), Romanian
 * diacritics, text reconstruction and simultaneous collaboration.
 */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const results = [];
function ok(name, condition, extra = "") {
  results.push(!!condition);
  console.log(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(p, body) {
  const response = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function get(p) {
  const response = await fetch(BASE + p);
  return { status: response.status, data: await response.json() };
}

function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws");
    ws._pendingSends = [];
    ws.send = new Proxy(ws.send, {
      apply(target, self, args) {
        if (self.readyState === 1) return target.apply(self, args);
        self._pendingSends.push(args[0]);
      },
    });
    const queue = [];
    const waiters = [];
    ws.on("open", () => {
      for (const data of ws._pendingSends.splice(0)) ws.send(data);
      ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId }));
    });
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      const index = waiters.findIndex((entry) => entry.type === message.t && entry.predicate(message));
      if (index >= 0) { const entry = waiters.splice(index, 1)[0]; clearTimeout(entry.timer); entry.resolve(message); }
      else queue.push(message);
      try {
        if (message.t === "canvas" || message.t === "init") {
          const initial = message.t === "init" ? message.canvas?.tiles : undefined;
          const added = message.t === "init" ? initial : message.list;
          const removed = message.t === "init" ? [] : message.removed || [];
          const hasInventory = message.t === "init" ? !!message.canvas && message.canvas.inventory !== undefined : message.inventory !== undefined;
          if (Array.isArray(added) || removed.length || hasInventory) {
            const map = ws._state ? { ...ws._state.tiles } : {};
            for (const tile of Array.isArray(added) ? added : []) map[tile.id] = tile;
            for (const id of removed) delete map[id];
            const inventory = hasInventory ? (message.t === "init" ? message.canvas.inventory : message.inventory) : ws._state?.inventory;
            ws._state = { tiles: map, inventory };
          }
        }
      } catch { /* ignore */ }
    });
    ws.on("error", reject);
    ws.waitFor = (type, predicate = () => true, timeout = 5000) => new Promise((res, rej) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return res(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rej(new Error(`timeout waiting ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: res, timer });
    });
    resolve(ws);
  });
}
const send = (ws, msg) => ws.send(JSON.stringify(msg));
const op = (ws, data) => send(ws, { t: "canvas", ...data });
const tilesOf = (ws) => Object.values(ws._state?.tiles || {});

// ------------------------------------------------------------- vocabulary
const catalog = await get("/api/puzzles");
const packs = catalog.data.sentencePacks;
const allCats = ["articles", "pronouns", "nouns", "verbs", "adjectives", "adverbs", "prepositions", "conjunctions", "punctuation"];
for (const lang of ["ro", "en"]) {
  const entries = packs[lang];
  const total = entries.reduce((sum, e) => sum + e.n, 0);
  const cats = new Set(entries.map((e) => e.c));
  ok(`${lang.toUpperCase()} pack has at least 120 word tiles`, total >= 120, `${total} tiles, ${new Set(entries.map((e) => e.w)).size} unique`);
  ok(`${lang.toUpperCase()} pack covers all 9 grammatical categories`, allCats.every((c) => cats.has(c)));
}
const enDup = ["the", "and", "a", "is", "in", "to"].every((w) => (packs.en.find((e) => e.w === w)?.n || 0) > 1);
const roDup = ["de", "cu", "și", "este", "pe"].every((w) => (packs.ro.find((e) => e.w === w)?.n || 0) > 1);
ok("function words carry duplicates (EN)", enDup);
ok("function words carry duplicates (RO: de, cu, și, este, pe)", roDup);
ok("packs are separate per language", packs.ro.some((e) => e.w === "poveste") && !packs.en.some((e) => e.w === "poveste") && packs.en.some((e) => e.w === "story") && !packs.ro.some((e) => e.w === "story"));

// ------------------------------------------------------------------ RO room
const created = await post("/api/rooms", { puzzleId: "sentence-funny-story", difficulty: "quick", name: "Ana", contentLanguage: "ro", sessionName: "Sentence protocol" });
const { room, playerId: hostId } = created.data;
ok("sentence room boots with the finite word inventory", created.status === 200 && room.total === 96 && room.contentLanguage === "ro");
const joined = await post(`/api/rooms/${room.id}/join`, { name: "Mihai", code: room.code });
const p2Id = joined.data.playerId;

const host = await connect(room.id, hostId);
const p2 = await connect(room.id, p2Id);
const init = await host.waitFor("init");
ok("init includes the sentence pack + geometry", init.canvas && init.canvas.wordGap === 36 && init.puzzle?.sentencePack?.length > 0);
ok("puzzle exposes the scenario brief", init.puzzle?.scenario?.title?.ro?.length > 0);

send(host, { t: "control", action: "start" });
await p2.waitFor("room", (m) => m.room.stage === "play");

// a bare single letter is NOT a word tile
op(host, { op: "spawn", text: "A" });
const notAWord = await host.waitFor("error", (m) => m.code === "word_unavailable");
ok("single letters are rejected on the sentence canvas", !!notAWord);

// ------------------------------------------------------- word + snap + rows
op(host, { op: "spawn", text: "poveste", x: 100, y: 100 });
const t1 = (await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "poveste"))).list.find((t) => t.text === "poveste");
ok("word tile spawns with deterministic width", t1.kind === "word" && t1.w === 40 + 7 * 19, `w=${t1.w}`);
op(host, { op: "move", id: t1.id, x: 100, y: 100, drag: false });
await host.waitFor("canvas", (m) => m.list?.some((t) => t.id === t1.id && t.x === 100 && t.y === 100));

// second word dropped near the first → row aligns + discrete gap
op(p2, { op: "spawn", text: "este", x: 100 + t1.w + 36 + 22, y: 108 });
const t2spawn = (await p2.waitFor("canvas", (m) => m.list?.some((t) => t.text === "este"))).list.find((t) => t.text === "este");
op(p2, { op: "move", id: t2spawn.id, x: 100 + t1.w + 36 + 22, y: 108, drag: false });
const t2 = (await host.waitFor("canvas", (m) => m.list?.some((t) => t.id === t2spawn.id && !t.heldBy))).list.find((t) => t.id === t2spawn.id);
ok("automatic row alignment (y snaps to the row)", t2.y === 100, `y=${t2.y}`);
ok("discrete snap between words (x = prev.x + prev.w + gap)", t2.x === 100 + t1.w + 36, `x=${t2.x} expected=${100 + t1.w + 36}`);

// punctuation: narrow width + attaches in the text
op(p2, { op: "spawn", text: ".", x: t2.x + t2.w + 36 + 10, y: 100 });
const t3s = (await p2.waitFor("canvas", (m) => m.list?.some((t) => t.text === "." && t.kind === "punctuation"))).list.find((t) => t.text === ".");
op(p2, { op: "move", id: t3s.id, x: t2.x + t2.w + 36 + 10, y: 100, drag: false });
const t3 = (await host.waitFor("canvas", (m) => m.list?.some((t) => t.id === t3s.id && !t.heldBy))).list.find((t) => t.id === t3s.id);
ok("punctuation tiles have a reduced width", t3.w === 64 && t3.w < t1.w, `w=${t3.w}`);

// a word dropped on a second row keeps its own line
op(host, { op: "spawn", text: "viitor", x: 120, y: 260 });
const t4s = (await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "viitor"))).list.find((t) => t.text === "viitor");
op(host, { op: "move", id: t4s.id, x: 120, y: 260, drag: false });
const t4 = (await p2.waitFor("canvas", (m) => m.list?.some((t) => t.id === t4s.id && !t.heldBy))).list.find((t) => t.id === t4s.id);
ok("second row stays a separate line (no snap across rows)", t4.y === 260 && t4.x === 120, `x=${t4.x} y=${t4.y}`);

// --------------------------------------------------------- custom words
op(host, { op: "spawn", text: "București", x: 400, y: 400, custom: true });
const c1 = (await p2.waitFor("canvas", (m) => m.list?.some((t) => t.text === "București"))).list.find((t) => t.text === "București");
ok("custom word tiles spawn (with diacritics)", c1.kind === "custom");
op(host, { op: "edit", id: c1.id, text: "Cluj-Napoca" });
const c1ed = (await p2.waitFor("canvas", (m) => m.list?.some((t) => t.id === c1.id && t.text === "Cluj-Napoca"))).list.find((t) => t.id === c1.id);
ok("custom word tiles can be edited (width follows the text)", c1ed.text === "Cluj-Napoca" && c1ed.w === 40 + 11 * 19, `w=${c1ed.w}`);
op(host, { op: "duplicate", id: c1.id });
const c2 = (await host.waitFor("canvas", (m) => m.list?.some((t) => t.id !== c1.id && t.text === "Cluj-Napoca" && t.custom))).list.find((t) => t.id !== c1.id);
ok("custom words duplicate without consuming the pack inventory", !!c2);
op(host, { op: "delete", id: c2.id });
await p2.waitFor("canvas", (m) => (m.removed || []).includes(c2.id));
ok("custom word tiles can be deleted", true);
op(host, { op: "edit", id: t1.id, text: "alt" });
const notCustom = await host.waitFor("error", (m) => m.code === "not_custom");
ok("pack word tiles cannot be edited into other words", !!notCustom);
op(host, { op: "spawn", text: "un cuvant foarte foarte foarte foarte foarte foarte foarte lung", custom: true });
const tooLong = await host.waitFor("error", (m) => m.code === "bad_word");
ok("custom words are length-limited (40 chars)", !!tooLong);

// -------------------------------------------------- diacritics in the pack
for (const word of ["dimineață", "pădure", "împreună", "echipă", "împărtășim"]) {
  op(p2, { op: "spawn", text: word, x: 600, y: 500 });
}
for (const word of ["dimineață", "pădure", "împreună", "echipă", "împărtășim"]) {
  await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === word), 4000);
}
ok("RO pack words with diacritics spawn (dimineață pădure împreună echipă împărtășim)", true);

// pack exhaustion for a small-count word
const nisteCount = init.canvas.inventory["niște"];
for (let i = 0; i < nisteCount; i++) {
  op(host, { op: "spawn", text: "niște", x: 900, y: 500 });
  await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "niște"), 4000);
}
op(host, { op: "spawn", text: "niște", x: 900, y: 500 });
const exhausted = await host.waitFor("canvasRejected", (m) => m.reason === "inventory" && m.text === "niște");
ok("pack words exhaust and then are rejected", !!exhausted, `niște count was ${nisteCount}`);

// ----------------------------------------------- simultaneous collaboration
op(host, { op: "spawn", text: "drum", x: 300, y: 700 });
op(p2, { op: "spawn", text: "soare", x: 800, y: 700 });
const a1 = await host.waitFor("canvas", (m) => m.list?.some((t) => t.text === "drum"));
const a2 = await p2.waitFor("canvas", (m) => m.list?.some((t) => t.text === "soare"));
ok("simultaneous collaboration: both spawns land", !!a1 && !!a2 && tilesOf(host).some((t) => t.text === "soare") && tilesOf(p2).some((t) => t.text === "drum"));

// -------------------------------------------------------------- completion
send(host, { t: "control", action: "complete" });
const completion = await p2.waitFor("completion", (m) => m.room.completed);
const lines = (completion.canvasText || "").split("\n");
const firstLine = lines[0];
ok("text reconstruction by rows + coordinates", firstLine === "poveste este.", JSON.stringify(firstLine));
ok("second row is a separate line in the text", lines.length >= 2, JSON.stringify(lines.slice(0, 2)));

// ---------------------------------------------------------------- EN room
const enRoom = await post("/api/rooms", { puzzleId: "sentence-travel", difficulty: "quick", name: "Bob", contentLanguage: "en" });
const enHost = await connect(enRoom.data.room.id, enRoom.data.playerId);
await enHost.waitFor("init");
send(enHost, { t: "control", action: "start" });
await enHost.waitFor("room", (m) => m.room.stage === "play");
op(enHost, { op: "spawn", text: "poveste", x: 100, y: 100 });
const roInEn = await enHost.waitFor("error", (m) => m.code === "word_unavailable");
ok("RO words are rejected in an EN room (packs are separate)", !!roInEn);
op(enHost, { op: "spawn", text: "journey", x: 100, y: 100 });
const j1 = (await enHost.waitFor("canvas", (m) => m.list?.some((t) => t.text === "journey"))).list.find((t) => t.text === "journey");
op(enHost, { op: "move", id: j1.id, x: 100, y: 100, drag: false });
op(enHost, { op: "spawn", text: "is", x: 100 + j1.w + 36 + 5, y: 100 });
const j2s = (await enHost.waitFor("canvas", (m) => m.list?.some((t) => t.text === "is"))).list.find((t) => t.text === "is");
op(enHost, { op: "move", id: j2s.id, x: 100 + j1.w + 36 + 5, y: 100, drag: false });
op(enHost, { op: "spawn", text: "bright", x: 100 + j1.w + 36 + j2s.w + 36 + 5, y: 102 });
const j3s = (await enHost.waitFor("canvas", (m) => m.list?.some((t) => t.text === "bright"))).list.find((t) => t.text === "bright");
op(enHost, { op: "move", id: j3s.id, x: 100 + j1.w + 36 + j2s.w + 36 + 5, y: 102, drag: false });
send(enHost, { t: "control", action: "complete" });
const enCompletion = await enHost.waitFor("completion", (m) => m.room.completed);
ok("EN sentence reconstructs correctly", (enCompletion.canvasText || "").includes("journey is bright"), JSON.stringify((enCompletion.canvasText || "").split("\n")[0]));

host.close(); p2.close(); enHost.close();
void wait;
const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? "🎉" : "⚠️"} sentence-canvas protocol: ${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
