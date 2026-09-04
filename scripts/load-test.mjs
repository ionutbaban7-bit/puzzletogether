/* Lightweight 20-client / 144-piece smoke load. Server must be running. */
import WebSocket from "ws";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
async function post(path, body) { const response = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${data.error}`); return data; }
function connect(roomId, playerId) { return new Promise((resolve, reject) => { const socket = new WebSocket(WS_URL); socket.on("open", () => socket.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId }))); socket.on("message", function init(raw) { const message = JSON.parse(raw); if (message.t === "init") { socket.off("message", init); resolve({ socket, init: message }); } }); socket.on("error", reject); }); }
const started = performance.now();
const created = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "expert", name: "LoadHost", sessionName: "Load smoke" });
const identities = [created.playerId];
for (let index = 1; index < 20; index++) identities.push((await post(`/api/rooms/${created.room.id}/join`, { name: `Load${index}`, code: created.room.code })).playerId);
const clients = await Promise.all(identities.map((id) => connect(created.room.id, id)));
if (!clients.every((client) => client.init.pieces.length === 144)) throw new Error("Not every client received 144 pieces.");
clients[0].socket.send(JSON.stringify({ t: "control", action: "start" }));
await new Promise((resolve) => setTimeout(resolve, 50));
for (let round = 0; round < 20; round++) {
  clients.forEach((client, index) => {
    client.socket.send(JSON.stringify({ t: "cursor", x: round * 20, y: index * 20 }));
    const piece = client.init.pieces[(round * clients.length + index) % 144];
    client.socket.send(JSON.stringify({ t: "piece", id: piece.id, x: 1500 + round, y: 1000 + index, drag: true }));
    client.socket.send(JSON.stringify({ t: "piece", id: piece.id, x: 1500 + round, y: 1000 + index, drag: false }));
  });
}
await new Promise((resolve) => setTimeout(resolve, 500));
const health = await fetch(`${BASE}/api/health`).then((response) => response.json());
const elapsed = Math.round(performance.now() - started);
clients.forEach((client) => client.socket.close());
console.log(`✅ 20 clients received 144 pieces and sent 800 piece frames + 400 cursors in ${elapsed}ms`);
console.log(`   server heap=${health.heapUsedMb}MB ws=${health.wsConnections} rooms=${health.rooms}`);
if (elapsed > 10_000 || health.wsConnections < 20) process.exit(1);
