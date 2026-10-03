import WebSocket from "ws";

export const BASE = process.env.BASE || "http://127.0.0.1:3000";
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function post(path, body = {}, credential) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

export function until(client, predicate, message = "realtime state", timeout = 5000) {
  if (predicate(client)) return Promise.resolve(client);
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate(client)) { cleanup(); resolve(client); }
    };
    const cleanup = () => { clearTimeout(timer); client.ws.off("message", check); client.ws.off("error", fail); };
    const fail = (error) => { cleanup(); reject(error); };
    const timer = setTimeout(() => fail(new Error(`Timeout: ${message}`)), timeout);
    client.ws.on("message", check);
    client.ws.on("error", fail);
  });
}

export async function connect(roomId, identity, { denied = false } = {}) {
  const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws");
  const client = { ws, id: identity.playerId, events: [], pieces: new Map(), scores: [], players: [], cursors: new Map(), room: null };
  ws.on("open", () => ws.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId: identity.playerId, credential: identity.credential })));
  ws.on("error", () => {});
  ws.on("message", raw => {
    const msg = JSON.parse(String(raw));
    client.events.push(msg);
    if (client.events.length > 250) client.events.shift();
    if (msg.room) client.room = msg.room;
    if (msg.t === "init" || msg.t === "puzzleReset" || msg.t === "puzzle") client.pieces = new Map((msg.pieces || []).map(p => [p.id, p]));
    if (msg.t === "pieces") for (const p of msg.list) client.pieces.set(p.id, p);
    if (msg.t === "pieceRejected") client.pieces.set(msg.piece.id, msg.piece);
    if (msg.t === "init") client.players = msg.players;
    if (msg.t === "players") client.players = msg.list;
    if (msg.scores) client.scores = msg.scores;
    if (msg.t === "scores") client.scores = msg.list;
    if (msg.t === "cursors") for (const cursor of msg.list) client.cursors.set(cursor.id, cursor);
  });
  try {
    await until(client, c => c.events.some(m => m.t === "init" || m.t === "deny"), "authenticated connection");
    const rejection = client.events.find(m => m.t === "deny");
    if (rejection && !denied) throw new Error(`Denied: ${rejection.code}`);
    return client;
  } catch (error) { ws.terminate(); throw error; }
}

export const send = (client, message) => client.ws.send(JSON.stringify(message));
export async function barrier(client) {
  client.events = client.events.filter(m => m.t !== "pong");
  send(client, { t: "ping" });
  await until(client, c => c.events.some(m => m.t === "pong"), "ordered acknowledgement");
}
export async function close(client) {
  if (client.ws.readyState === WebSocket.CLOSED) return;
  await new Promise(resolve => { client.ws.once("close", resolve); client.ws.close(); });
}
export async function place(client, piece) {
  send(client, { t: "piece", id: piece.id, x: piece.correctX, y: piece.correctY, drag: false });
  await until(client, c => c.pieces.get(piece.id)?.locked, `piece ${piece.id} placement`);
}
