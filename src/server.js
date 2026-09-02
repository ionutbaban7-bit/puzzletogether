/**
 * PuzzleTogether — single Node.js backend.
 *
 * Serves the web app (Vite middleware in dev, static build in prod) and hosts
 * the realtime WebSocket server on the same origin. Rooms live in memory and
 * expire after 24 h of inactivity. No accounts, no external services.
 */
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import puzzlesData from "../shared/puzzles.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "server", "public");
const distDir = path.join(rootDir, "dist");

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const MAX_PLAYERS = 20;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // rooms expire after 24 h of inactivity
const PENDING_TTL_MS = 60 * 1000; // HTTP join seat reserved for a minute awaiting the socket
const CURSOR_RELAY_MS = 33; // ~30 fps cursor relay
const HEARTBEAT_MS = 30_000;

// ---------------------------------------------------------------------------
// Curated puzzle library
// ---------------------------------------------------------------------------

const PUZZLES = puzzlesData.puzzles;
const CATEGORIES = puzzlesData.categories;
const DIFFICULTIES = puzzlesData.difficulties;
const puzzleById = new Map(PUZZLES.map((p) => [p.id, p]));

let imageDims = {};
try {
  imageDims = JSON.parse(
    fs.readFileSync(path.join(publicDir, "images", "manifest.json"), "utf8"),
  );
} catch {
  imageDims = {};
}

function computeGrid(width, height, total) {
  const aspect = width / height;
  let best = { cols: 1, rows: total, score: Infinity };
  for (let c = 1; c <= total; c++) {
    if (total % c !== 0) continue;
    const r = total / c;
    const score = Math.abs(Math.log(c / r / aspect));
    if (score < best.score) best = { cols: c, rows: r, score };
  }
  return {
    cols: best.cols,
    rows: best.rows,
    pieceW: width / best.cols,
    pieceH: height / best.rows,
  };
}

function snapDistance(pieceW, pieceH) {
  return 24 + Math.min(pieceW, pieceH) * 0.15;
}

// ---------------------------------------------------------------------------
// Rooms (in-memory)
// ---------------------------------------------------------------------------

/** @type {Map<string, Room>} */
const rooms = new Map();
const codeIndex = new Map(); // code -> roomId

/** Looks up a room by id or by share code. */
function findRoom(ref) {
  const key = String(ref || "");
  let room = rooms.get(key);
  if (room) return room;
  const id = codeIndex.get(key.toUpperCase());
  if (id) room = rooms.get(id);
  return room || null;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const PLAYER_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6",
  "#14b8a6", "#f97316", "#84cc16", "#ec4899", "#06b6d4", "#a855f7",
];
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function pickColor(room, pid) {
  const used = new Set([...room.players.values()].map((p) => p.color).filter(Boolean));
  const base = PLAYER_COLORS[hashString(pid) % PLAYER_COLORS.length];
  if (!used.has(base)) return base;
  return PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
}
function generateCode() {
  for (;;) {
    let code = "";
    const bytes = crypto.randomBytes(6);
    for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!codeIndex.has(code)) return code;
  }
}

function newPlayerId() {
  return crypto.randomUUID();
}

function touch(room) {
  room.lastActivityAt = Date.now();
}

function serializePiece(p) {
  return {
    id: p.id,
    x: p.x,
    y: p.y,
    correctX: p.correctX,
    correctY: p.correctY,
    rotation: 0,
    drag: !!p.drag,
    moved: !!p.moved,
    locked: !!p.locked,
  };
}

function roomView(room) {
  return {
    id: room.id,
    code: room.code,
    puzzleId: room.config.puzzleId,
    difficulty: room.config.difficulty,
    total: room.config.total,
    maxPlayers: MAX_PLAYERS,
    createdAt: room.createdAt,
    completed: room.completed,
    completedAt: room.completedAt,
    completedInMs: room.completedInMs,
  };
}

function puzzleView(room) {
  return {
    image: room.puzzle.image,
    name: room.puzzle.name,
    category: room.puzzle.category,
    credit: room.puzzle.credit,
    license: room.puzzle.license,
    source: room.puzzle.source,
    width: room.puzzle.width,
    height: room.puzzle.height,
    cols: room.puzzle.cols,
    rows: room.puzzle.rows,
    pieceW: room.puzzle.pieceW,
    pieceH: room.puzzle.pieceH,
    snapDistance: snapDistance(room.puzzle.pieceW, room.puzzle.pieceH),
  };
}

function activePlayerList(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
  }));
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptPlayerId) {
  const data = JSON.stringify(msg);
  for (const [, conn] of room.conns) {
    if (conn.playerId === exceptPlayerId) continue;
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(data);
  }
}

function scatterPieces(room) {
  const { width, height } = room.puzzle;
  const bandY0 = height + 140;
  const bandY1 = height + 820;
  const x0 = -320;
  const x1 = width + 320;
  for (const p of room.pieces) {
    p.x = x0 + Math.random() * (x1 - x0);
    p.y = bandY0 + Math.random() * (bandY1 - bandY0);
    p.drag = false;
    p.moved = true;
    p.locked = false;
  }
}

function createRoom(config) {
  const puzzle = puzzleById.get(config.puzzleId);
  if (!puzzle) throw new Error("unknown puzzle");
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty);
  if (!difficulty) throw new Error("unknown difficulty");

  const dims = imageDims[puzzle.image.split("/").pop()] || { w: 1600, h: 1000 };
  const grid = computeGrid(dims.w, dims.h, difficulty.pieces);

  const room = {
    id: crypto.randomUUID(),
    code: generateCode(),
    config: { puzzleId: puzzle.id, difficulty: difficulty.id, total: difficulty.pieces },
    puzzle: {
      image: puzzle.image,
      name: puzzle.name,
      category: puzzle.category,
      credit: puzzle.credit,
      license: puzzle.license,
      source: puzzle.source,
      width: dims.w,
      height: dims.h,
      cols: grid.cols,
      rows: grid.rows,
      pieceW: grid.pieceW,
      pieceH: grid.pieceH,
    },
    pieces: [],
    players: new Map(), // active playerId -> {id,name,color,joinedAt,lastSeenAt}
    knownPlayers: new Map(), // playerId -> {name,color} for the room lifetime (reconnects)
    pending: new Map(), // playerId -> {name,color,expiresAt} (joined via HTTP, awaiting socket)
    conns: new Map(), // playerId -> {ws, playerId, alive, cursor:{x,y,dirty}}
    cursorTimer: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    completed: false,
    completedAt: null,
    completedInMs: null,
    completionPlayers: [],
  };

  const pw = grid.pieceW;
  const ph = grid.pieceH;
  for (let i = 0; i < difficulty.pieces; i++) {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    room.pieces.push({
      id: i,
      x: 0,
      y: 0,
      correctX: col * pw,
      correctY: row * ph,
      drag: false,
      moved: false,
      locked: false,
    });
  }
  scatterPieces(room);

  rooms.set(room.id, room);
  codeIndex.set(room.code, room.id);
  return room;
}

function startCursorRelay(room) {
  if (room.cursorTimer) return;
  room.cursorTimer = setInterval(() => {
    const updates = [];
    for (const [, conn] of room.conns) {
      if (conn.cursor.dirty) {
        conn.cursor.dirty = false;
        updates.push({ id: conn.playerId, x: conn.cursor.x, y: conn.cursor.y });
      }
    }
    if (updates.length) broadcast(room, { t: "cursors", list: updates });
  }, CURSOR_RELAY_MS);
}

function stopCursorRelay(room) {
  if (room.cursorTimer) clearInterval(room.cursorTimer);
  room.cursorTimer = null;
}

function dropPlayerConnection(room, playerId) {
  const conn = room.conns.get(playerId);
  if (conn) {
    try {
      conn.ws.close();
    } catch {}
    room.conns.delete(playerId);
  }
  if (room.players.has(playerId)) {
    room.players.delete(playerId);
    broadcast(room, { t: "players", list: activePlayerList(room) });
  }
  if (room.conns.size === 0) stopCursorRelay(room);
}

function checkCompletion(room) {
  if (room.completed) return;
  const locked = room.pieces.filter((p) => p.locked).length;
  if (locked >= room.config.total) {
    room.completed = true;
    room.completedAt = Date.now();
    room.completedInMs = room.completedAt - room.createdAt;
    room.completionPlayers = activePlayerList(room).map((p) => p.name);
    broadcast(room, {
      t: "completion",
      room: roomView(room),
      players: room.completionPlayers,
    });
  }
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/api/puzzles", (_req, res) => {
  res.json({
    categories: CATEGORIES,
    difficulties: DIFFICULTIES,
    puzzles: PUZZLES.map((p) => ({ ...p })),
    maxPlayers: MAX_PLAYERS,
  });
});

app.post("/api/rooms", (req, res) => {
  const { puzzleId, difficulty, name } = req.body || {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "A display name is required." });
  }
  try {
    const room = createRoom({ puzzleId, difficulty });
    const playerId = newPlayerId();
    room.knownPlayers.set(playerId, { name: name.trim().slice(0, 24), color: null });
    room.pending.set(playerId, {
      name: name.trim().slice(0, 24),
      color: null,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });
    res.json({ room: roomView(room), playerId, roomCode: room.code });
  } catch (e) {
    res.status(400).json({ error: e.message || "Could not create room." });
  }
});

app.post("/api/rooms/:id/join", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  }
  const { name, pid } = req.body || {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "A display name is required." });
  }
  const cleanName = name.trim().slice(0, 24);

  // Returning player (same tab/browser session): reuse their seat.
  if (pid && room.knownPlayers.has(pid)) {
    if (room.players.has(pid) && room.conns.has(pid)) {
      return res.json({ room: roomView(room), playerId: pid, returning: true });
    }
    return res.json({ room: roomView(room), playerId: pid, returning: true });
  }

  if (room.players.size + room.pending.size >= MAX_PLAYERS) {
    return res.status(409).json({
      error: `This room is full (${MAX_PLAYERS} players max).`,
      code: "room_full",
    });
  }

  const playerId = newPlayerId();
  room.knownPlayers.set(playerId, { name: cleanName, color: null });
  room.pending.set(playerId, {
    name: cleanName,
    color: null,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
  touch(room);
  res.json({ room: roomView(room), playerId });
});

app.get("/api/rooms/:id", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found." });
  res.json({
    room: roomView(room),
    puzzle: puzzleView(room),
    players: activePlayerList(room),
    playerCount: room.players.size + room.pending.size,
  });
});

app.post("/api/rooms/:id/reset", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found." });
  scatterPieces(room);
  room.completed = false;
  room.completedAt = null;
  room.completedInMs = null;
  room.completionPlayers = [];
  room.createdAt = Date.now(); // restarts the timer
  touch(room);
  broadcast(room, { t: "reset", room: roomView(room), pieces: room.pieces.map(serializePiece) });
  res.json({ ok: true });
});

// Static files: curated images + favicon always from server/public.
app.use(express.static(publicDir, { maxAge: IS_PROD ? "7d" : 0 }));

// ---------------------------------------------------------------------------
// WebSocket realtime
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 64 * 1024 });

wss.on("connection", (ws) => {
  ws.alive = true;
  let attached = null; // {room, playerId}

  ws.on("pong", () => {
    ws.alive = true;
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!attached && msg.t !== "hello") {
      return send(ws, { t: "deny", code: "bad_request", message: "Hello first." });
    }

    switch (msg.t) {
      case "hello": {
        const room = findRoom(String(msg.roomId || ""));
        if (!room) {
          send(ws, { t: "deny", code: "room_missing", message: "This room has expired or no longer exists." });
          return ws.close();
        }
        const pid = String(msg.playerId || "");
        if (!pid || !(room.knownPlayers.has(pid) || room.pending.has(pid))) {
          send(ws, { t: "deny", code: "room_missing", message: "Session lost. Please rejoin the room." });
          return ws.close();
        }

        // Replace an existing connection for the same player (reconnect race).
        if (room.conns.has(pid)) {
          const old = room.conns.get(pid);
          try {
            old.ws.close();
          } catch {}
          room.conns.delete(pid);
        }

        // Adopt the player (from pending or the room's known-player registry).
        if (!room.players.has(pid)) {
          const known = room.knownPlayers.get(pid);
          const pending = room.pending.get(pid);
          const info = pending || known;
          room.players.set(pid, {
            id: pid,
            name: info?.name || "Player",
            color: info?.color || null,
            joinedAt: Date.now(),
            lastSeenAt: Date.now(),
          });
          room.pending.delete(pid);
        }
        const player = room.players.get(pid);
        if (!player.color) player.color = pickColor(room, pid);
        player.lastSeenAt = Date.now();

        room.conns.set(pid, { ws, playerId: pid, alive: true, cursor: { x: 0, y: 0, dirty: false } });
        attached = { room, playerId: pid };
        startCursorRelay(room);
        touch(room);

        send(ws, {
          t: "init",
          you: pid,
          room: roomView(room),
          puzzle: puzzleView(room),
          players: activePlayerList(room),
          pieces: room.pieces.map(serializePiece),
          cursors: [...room.conns.entries()]
            .filter(([id]) => id !== pid)
            .map(([id, c]) => ({ id, x: c.cursor.x, y: c.cursor.y })),
        });
        broadcast(room, { t: "players", list: activePlayerList(room) });
        break;
      }

      case "piece": {
        const { room } = attached;
        touch(room);
        if (room.completed) break;
        const id = Number(msg.id);
        const piece = room.pieces[id];
        if (!piece || piece.locked) {
          // Tell the sender the authoritative state so clients re-converge.
          if (piece) send(ws, { t: "pieces", list: [serializePiece(piece)] });
          break;
        }
        const x = Math.max(-200000, Math.min(200000, Number(msg.x) || 0));
        const y = Math.max(-200000, Math.min(200000, Number(msg.y) || 0));
        piece.x = x;
        piece.y = y;
        piece.drag = !!msg.drag;
        if (!piece.drag) {
          piece.moved = true;
          const d = Math.hypot(x - piece.correctX, y - piece.correctY);
          if (d <= snapDistance(room.puzzle.pieceW, room.puzzle.pieceH)) {
            piece.x = piece.correctX;
            piece.y = piece.correctY;
            piece.locked = true;
            piece.drag = false;
          }
        }
        broadcast(room, { t: "pieces", list: [serializePiece(piece)] });
        if (piece.locked) checkCompletion(room);
        break;
      }

      case "cursor": {
        const { room, playerId } = attached;
        const conn = room.conns.get(playerId);
        if (!conn) break;
        conn.cursor.x = Number(msg.x) || 0;
        conn.cursor.y = Number(msg.y) || 0;
        conn.cursor.dirty = true;
        break;
      }

      case "ping": {
        send(ws, { t: "pong" });
        break;
      }
    }
  });

  ws.on("close", () => {
    if (!attached) return;
    const { room, playerId } = attached;
    const conn = room.conns.get(playerId);
    if (conn && conn.ws === ws) dropPlayerConnection(room, playerId);
  });

  ws.on("error", () => {});
});

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

setInterval(() => {
  // Heartbeat: drop connections that did not answer the last ping.
  for (const [, room] of rooms) {
    for (const [pid, conn] of [...room.conns]) {
      if (!conn.ws.alive) {
        conn.ws.terminate();
        dropPlayerConnection(room, pid);
      } else {
        conn.ws.alive = false;
        try {
          conn.ws.ping();
        } catch {}
      }
    }
    // Expire pending join seats.
    const now = Date.now();
    for (const [pid, p] of [...room.pending]) {
      if (p.expiresAt < now) room.pending.delete(pid);
    }
    // Reap empty rooms (players may be reconnecting).
    if (room.players.size === 0 && room.conns.size === 0 && now - room.lastActivityAt > PENDING_TTL_MS) {
      rooms.delete(room.id);
      codeIndex.delete(room.code);
      stopCursorRelay(room);
    }
  }
}, HEARTBEAT_MS);

setInterval(() => {
  // Rooms expire after 24 h of inactivity.
  const now = Date.now();
  for (const [id, room] of [...rooms]) {
    if (now - room.lastActivityAt > ROOM_TTL_MS) {
      for (const [, conn] of room.conns) {
        send(conn.ws, { t: "closed", code: "room_expired", message: "This room expired after 24 hours of inactivity." });
        try {
          conn.ws.close();
        } catch {}
      }
      room.conns.clear();
      room.players.clear();
      stopCursorRelay(room);
      rooms.delete(id);
      codeIndex.delete(room.code);
    }
  }
}, 5 * 60_000).unref();

// ---------------------------------------------------------------------------
// Frontend serving (dev: Vite middleware; prod: static build)
// ---------------------------------------------------------------------------

if (IS_PROD) {
  app.use(express.static(distDir, { maxAge: "7d", index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(rootDir, "index.html"), "utf8"));
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      next(e);
    }
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`🧩 PuzzleTogether server running on http://${HOST}:${PORT} (${IS_PROD ? "production" : "development"})`);
  console.log(`   ${PUZZLES.length} curated puzzles · ${rooms.size} active rooms`);
});
