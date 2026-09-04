/*
 * Participant-safe chat protocol regression.
 *
 * Requires the normal local server, matching the rest of test:protocol:
 *   BASE=http://127.0.0.1:3000 node scripts/chat-protocol-test.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const results = [];
const ok = (name, condition, extra = "") => {
  results.push(!!condition);
  console.log(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(base, pathname, body) {
  const response = await fetch(base + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function get(base, pathname) {
  const response = await fetch(base + pathname);
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

function connect(base, roomId, playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace(/^http/, "ws") + "/ws");
    const queue = [];
    const received = [];
    const waiters = [];
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId })));
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      received.push(message);
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
    ws.waitFor = (type, predicate = () => true, timeout = 5_000) => new Promise((resolveWait, rejectWait) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return resolveWait(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rejectWait(new Error(`timeout waiting for ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: resolveWait, timer });
    });
    ws.messages = received;
    resolve(ws);
  });
}

const created = await post(BASE, "/api/rooms", {
  puzzleId: "starry-night",
  difficulty: "easy",
  name: "Chat host",
  sessionName: "Participant chat protocol",
});
ok("creates a chat room", created.status === 200 && !!created.data.room?.id);
if (created.status !== 200) process.exit(1);
const roomId = created.data.room.id;
const hostId = created.data.playerId;
const joined = await post(BASE, `/api/rooms/${roomId}/join`, { name: "Chat participant", code: created.data.room.code });
ok("admits a participant", joined.status === 200 && !!joined.data.playerId);
if (joined.status !== 200) process.exit(1);
const participantId = joined.data.playerId;

const host = await connect(BASE, roomId, hostId);
const participant = await connect(BASE, roomId, participantId);
const [hostInit, participantInit] = await Promise.all([host.waitFor("init"), participant.waitFor("init")]);
ok("both host and participant receive initial chat history", Array.isArray(hostInit.chat) && Array.isArray(participantInit.chat) && !hostInit.chat.length && !participantInit.chat.length);

const participantClientId = "participant-message-0001";
const participantText = "Participant-visible message";
const hostGetsParticipant = host.waitFor("chat", (message) => message.entry?.clientMessageId === participantClientId);
const participantGetsOwn = participant.waitFor("chat", (message) => message.entry?.clientMessageId === participantClientId);
participant.send(JSON.stringify({ t: "chat", text: participantText, clientMessageId: participantClientId }));
const [receivedByHost, receivedByParticipant] = await Promise.all([hostGetsParticipant, participantGetsOwn]);
ok("participant message reaches host and sender", receivedByHost.entry?.playerId === participantId && receivedByParticipant.entry?.playerId === participantId);
ok("participant message preserves content and sender-scoped client id", receivedByHost.entry?.text === participantText && receivedByHost.entry?.clientMessageId === participantClientId);

// Retrying an already accepted WebSocket message must not produce a second
// room entry or a second message for other participants.
participant.send(JSON.stringify({ t: "chat", text: participantText, clientMessageId: participantClientId }));
const retry = await participant.waitFor("chat", (message) => message.entry?.clientMessageId === participantClientId);
await wait(250);
const duplicateAtHost = host.messages.filter((message) => message.t === "chat" && message.entry?.clientMessageId === participantClientId).length;
ok("retry is idempotent and does not rebroadcast a duplicate", retry.entry?.id === receivedByHost.entry?.id && duplicateAtHost === 1);

const hostClientId = "host-message-0002";
const hostText = "Host reply stays in the same room";
const participantGetsHost = participant.waitFor("chat", (message) => message.entry?.clientMessageId === hostClientId);
host.send(JSON.stringify({ t: "chat", text: hostText, clientMessageId: hostClientId }));
const reply = await participantGetsHost;
ok("host-to-participant delivery works", reply.entry?.playerId === hostId && reply.entry?.text === hostText);

participant.send(JSON.stringify({ t: "chat", text: "   ", clientMessageId: "empty-message-0003" }));
await wait(120);
ok("empty chat input creates no room message", !participant.messages.some((message) => message.t === "chat" && message.entry?.clientMessageId === "empty-message-0003"));
const longClientId = "long-message-0004";
const participantGetsLong = participant.waitFor("chat", (message) => message.entry?.clientMessageId === longClientId);
host.send(JSON.stringify({ t: "chat", text: "x".repeat(540), clientMessageId: longClientId }));
const longMessage = await participantGetsLong;
ok("chat payload is length-limited", longMessage.entry?.text?.length === 500, `${longMessage.entry?.text?.length} chars`);

participant.close();
await wait(120);
const returning = await connect(BASE, roomId, participantId);
const reconnectInit = await returning.waitFor("init");
const historyIds = reconnectInit.chat.map((entry) => entry.clientMessageId);
ok("participant reconnect receives ordered room history", JSON.stringify(historyIds.slice(-3)) === JSON.stringify([participantClientId, hostClientId, longClientId]), JSON.stringify(historyIds));

// Snapshot persistence is tested from a separate process so a restart cannot
// accidentally rely on in-memory room state.
await wait(900);
ok("chat is included in the room snapshot", existsSync(path.join(ROOT, ".data", "rooms.json")));
const secondBase = "http://127.0.0.1:3101";
const child = spawn(process.execPath, [path.join(ROOT, "src", "server.js")], {
  env: { ...process.env, PORT: "3101", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let childLog = "";
child.stdout.on("data", (data) => { childLog += data.toString(); });
child.stderr.on("data", (data) => { childLog += data.toString(); });
try {
  await new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      const health = await get(secondBase, "/api/health").catch(() => null);
      if (health?.status === 200) { clearInterval(timer); resolve(); }
    }, 200);
    setTimeout(() => { clearInterval(timer); reject(new Error(`secondary server did not start: ${childLog.slice(-400)}`)); }, 12_000);
  });
  const restored = await connect(secondBase, roomId, participantId);
  const restoredInit = await restored.waitFor("init");
  ok("chat history survives a server restart", restoredInit.chat?.some((entry) => entry.clientMessageId === participantClientId) && restoredInit.chat?.some((entry) => entry.clientMessageId === hostClientId));
  restored.close();
} finally {
  child.kill("SIGTERM");
  await wait(250);
}

host.close();
returning.close();
const failures = results.filter((value) => !value).length;
console.log(`\n${results.length - failures}/${results.length} chat protocol checks passed`);
process.exit(failures ? 1 : 0);
