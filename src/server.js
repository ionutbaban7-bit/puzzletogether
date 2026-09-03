/**
 * PuzzleTogether — realtime room server.
 *
 * The server is deliberately dependency-light, but room state is authoritative:
 * host controls, stage transitions, piece claims, coaching results and workshop
 * artefacts are all validated here rather than trusted to the browser.
 */
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import puzzlesData from "../shared/puzzles.json" with { type: "json" };
import coachingData from "../shared/coaching.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "server", "public");
const distDir = path.join(rootDir, "dist");
const dataDir = path.join(rootDir, ".data");
const snapshotFile = path.join(dataDir, "rooms.json");

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PROTOCOL_VERSION = 2;
const MAX_PLAYERS = 20;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;
const PENDING_TTL_MS = 60 * 1000;
const CLAIM_TTL_MS = 8_000;
const CURSOR_RELAY_MS = 33;
const HEARTBEAT_MS = 30_000;
const VALID_STAGES = new Set(["lobby", "brief", "play", "reveal", "debrief", "harvest", "closed"]);

const PUZZLES = puzzlesData.puzzles;
const CATEGORIES = puzzlesData.categories;
const DIFFICULTIES = puzzlesData.difficulties;
const COACHING = coachingData;
const puzzleById = new Map(PUZZLES.map((p) => [p.id, p]));
const activityById = new Map(COACHING.activities.map((a) => [a.id, a]));

let imageDims = {};
try {
  imageDims = JSON.parse(fs.readFileSync(path.join(publicDir, "images", "manifest.json"), "utf8"));
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
  return { cols: best.cols, rows: best.rows, pieceW: width / best.cols, pieceH: height / best.rows };
}

function snapDistance(pieceW, pieceH) {
  return 24 + Math.min(pieceW, pieceH) * 0.15;
}

const WORD_PUZZLE_SETS = {
  "agile-words": ["AGILE", "VALUES", "RETRO", "SPRINT", "TRUST", "FOCUS", "SCRUM", "FLOW", "TEAM", "GOAL", "LEARN", "DELIVER"],
  "innovation-grid": ["IDEATE", "INSIGHT", "FUTURE", "VISION", "SPARK", "BRAINSTORM", "BUILD", "TEST", "LEARN", "MOMENTUM", "CURIOUS", "CREATE"],
  "letter-anagrams": ["ANAGRAM", "LETTER", "SCORE", "BONUS", "WORDPLAY", "STACK", "CHAIN", "VALUE", "GRID", "CLUE", "BRAIN", "CREATE"],
  "team-motto": ["MOTTO", "VALUES", "TRUST", "RESPECT", "CLARITY", "COURAGE", "GROWTH", "ALIGN", "OWNERSHIP", "IMPACT", "UNITY", "CARE"],
};
const WORD_TILE_PALETTE = ["#2563eb", "#0ea5e9", "#14b8a6", "#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#8b5cf6"];
const LETTER_POINTS = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10 };

function buildWordLetters(puzzleId, total) {
  const base = WORD_PUZZLE_SETS[puzzleId] || WORD_PUZZLE_SETS["agile-words"];
  const pool = base.join("").replace(/[^A-Z]/g, "").split("");
  const letters = [];
  while (letters.length < total) letters.push(...pool);
  return letters.slice(0, total);
}

function wordTileColor(index, letter) {
  return WORD_TILE_PALETTE[((letter?.charCodeAt?.(0) || 0) + index * 3) % WORD_TILE_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Room model and views
// ---------------------------------------------------------------------------

const rooms = new Map();
const codeIndex = new Map();
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PLAYER_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16", "#ec4899", "#06b6d4", "#a855f7"];

function logEvent(event, room, extra = {}) {
  console.info(JSON.stringify({ ts: new Date().toISOString(), event, roomId: room?.id, puzzleId: room?.config?.puzzleId, players: room?.players?.size || 0, ...extra }));
}

function findRoom(ref) {
  const key = String(ref || "");
  return rooms.get(key) || rooms.get(codeIndex.get(key.toUpperCase())) || null;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickColor(room, pid) {
  const used = new Set([...room.players.values()].map((p) => p.color).filter(Boolean));
  const base = PLAYER_COLORS[hashString(pid) % PLAYER_COLORS.length];
  return !used.has(base) ? base : PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
}

function generateCode() {
  for (;;) {
    const bytes = crypto.randomBytes(6);
    let code = "";
    for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!codeIndex.has(code)) return code;
  }
}

function touch(room) {
  room.lastActivityAt = Date.now();
  scheduleSnapshot();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizedActivity(room) {
  const activity = clone(room.coachingActivity);
  if (!activity) return undefined;
  if (activity.mode === "ranking" && !room.revealed) {
    activity.items = activity.items.map(({ id, label }) => ({ id, label }));
    delete activity.debrief;
  }
  return activity;
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
    heldBy: p.heldBy || null,
    placedOnSlot: p.placedOnSlot ?? null,
    letter: p.letter,
    letterPoints: p.letterPoints,
    letterColor: p.letterColor,
  };
}

function elapsedMs(room, now = Date.now()) {
  if (!room.startedAt) return 0;
  const end = room.completedAt || now;
  const activePause = room.pausedAt ? end - room.pausedAt : 0;
  return Math.max(0, end - room.startedAt - room.pausedDurationMs - activePause);
}

function roomView(room) {
  return {
    id: room.id,
    code: room.code,
    sessionName: room.sessionName,
    hostId: room.hostId,
    puzzleId: room.config.puzzleId,
    difficulty: room.config.difficulty,
    total: room.config.total,
    maxPlayers: MAX_PLAYERS,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    pausedAt: room.pausedAt,
    pausedDurationMs: room.pausedDurationMs,
    stage: room.stage,
    boardLocked: room.boardLocked,
    revealed: room.revealed,
    timerEndsAt: room.timerEndsAt,
    timerDurationMs: room.timerDurationMs,
    completed: room.completed,
    completedAt: room.completedAt,
    completedInMs: room.completedInMs,
    celebrationMode: room.celebrationMode,
    insights: room.insights,
    debriefNotes: room.debriefNotes,
    actions: room.actions,
  };
}

function publicRoomView(room) {
  const view = roomView(room);
  delete view.code;
  delete view.insights;
  delete view.debriefNotes;
  delete view.actions;
  return view;
}

function puzzleView(room) {
  if (room.coachingActivity) {
    return {
      isCoaching: true,
      mode: room.coachingActivity.mode,
      activityId: room.coachingActivity.id,
      image: room.puzzle.image,
      name: room.puzzle.name,
      category: "coaching",
      credit: "",
      license: "Original PuzzleTogether coaching content",
      source: "PuzzleTogether",
      width: room.puzzle.width,
      height: room.puzzle.height,
      cols: room.puzzle.cols,
      rows: room.puzzle.rows,
      pieceW: room.puzzle.pieceW,
      pieceH: room.puzzle.pieceH,
      snapDistance: snapDistance(room.puzzle.pieceW, room.puzzle.pieceH),
      rankingSlots: room.rankingSlots,
      activity: sanitizedActivity(room),
    };
  }
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
    seed: room.seed,
    snapDistance: snapDistance(room.puzzle.pieceW, room.puzzle.pieceH),
    wordModeNotice: room.puzzle.category === "words",
  };
}

function activePlayerList(room) {
  return [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, role: p.role || "player", joinedAt: p.joinedAt, lastSeenAt: p.lastSeenAt }));
}

function scoreList(room) {
  return [...room.scores.entries()].map(([pid, placed]) => {
    const p = room.players.get(pid) || room.knownPlayers.get(pid) || {};
    return { playerId: pid, name: p.name || "Player", color: p.color || "#94a3b8", placed };
  }).sort((a, b) => b.placed - a.placed || a.name.localeCompare(b.name));
}

function computeProfileCode(activity, answers) {
  if (!activity?.questions || !activity?.dimensions || !answers) return null;
  const letters = [];
  for (const dim of activity.dimensions) {
    const counts = new Map();
    for (const q of activity.questions.filter((item) => item.dim === dim.key)) {
      const agree = answers[q.id] === "A";
      const letter = agree
        ? q.pole === "A" ? dim.poleA.letter : dim.poleB.letter
        : q.pole === "A" ? dim.poleB.letter : dim.poleA.letter;
      counts.set(letter, (counts.get(letter) || 0) + 1);
    }
    let best = dim.poleA.letter;
    let max = -1;
    for (const [letter, count] of counts) if (count > max) { best = letter; max = count; }
    letters.push(best);
  }
  return letters.join("");
}

function ratingListFor(room, viewerId) {
  return [...room.ratings.entries()].map(([playerId, rating]) => ({
    playerId,
    done: !!rating.done,
    profileCode: rating.profileCode || null,
    ...(playerId === viewerId ? { answers: rating.answers } : {}),
  }));
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ v: PROTOCOL_VERSION, ...msg }));
}

function broadcast(room, msg, exceptPlayerId) {
  const data = JSON.stringify({ v: PROTOCOL_VERSION, ...msg });
  for (const [, conn] of room.conns) {
    if (conn.playerId === exceptPlayerId) continue;
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(data);
  }
}

function broadcastRoom(room) {
  broadcast(room, { t: "room", room: roomView(room) });
}

function scatterPieces(room) {
  const { width, height } = room.board || room.puzzle;
  const x0 = -320;
  const x1 = width + 320;
  const bandY0 = height + 140;
  const bandY1 = height + 820;
  for (const p of room.pieces) {
    p.x = x0 + Math.random() * (x1 - x0);
    p.y = bandY0 + Math.random() * (bandY1 - bandY0);
    p.drag = false;
    p.moved = true;
    p.locked = false;
    p.heldBy = null;
    p.heldAt = null;
    p.placedOnSlot = null;
  }
}

function buildPuzzleSetup(config) {
  const puzzle = puzzleById.get(config.puzzleId);
  const coachingActivity = !puzzle ? activityById.get(config.puzzleId) : null;
  if (!puzzle && !coachingActivity) throw new Error("Unknown puzzle or activity.");
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) || DIFFICULTIES[0];
  let total = difficulty.pieces;
  let layout = null;
  let board = null;
  let rankingSlots = [];

  if (coachingActivity?.mode === "ranking") {
    total = coachingActivity.items.length;
    layout = coachingActivity.layout || { cols: 2, rows: 6, padX: 70, padY: 70, slotW: 460, slotH: 110, gapX: 28, gapY: 24 };
    const boardW = Math.max(1400, layout.padX * 2 + layout.cols * layout.slotW + (layout.cols - 1) * layout.gapX);
    const boardH = layout.padY * 2 + layout.rows * layout.slotH + (layout.rows - 1) * layout.gapY;
    board = { width: boardW, height: boardH, pieceW: layout.slotW, pieceH: layout.slotH };
    rankingSlots = coachingActivity.items.map((_item, index) => ({
      rank: index + 1,
      x: layout.padX + (index % layout.cols) * (layout.slotW + layout.gapX),
      y: layout.padY + Math.floor(index / layout.cols) * (layout.slotH + layout.gapY),
    }));
  } else if (coachingActivity?.mode === "questionnaire") {
    total = coachingActivity.questions.length;
  }

  const dims = puzzle ? imageDims[puzzle.image.split("/").pop()] || { w: 1600, h: 1000 } : { w: 0, h: 0 };
  const grid = computeGrid(dims.w, dims.h, difficulty.pieces);
  const isWordPuzzle = puzzle?.category === "words";
  const letters = isWordPuzzle ? buildWordLetters(puzzle.id, difficulty.pieces) : [];
  const pieces = [];

  if (coachingActivity?.mode === "ranking") {
    coachingActivity.items.forEach((_item, id) => pieces.push({ id, x: 0, y: 0, correctX: 0, correctY: 0, drag: false, moved: false, locked: false, heldBy: null, heldAt: null, placedOnSlot: null }));
  } else if (!coachingActivity) {
    for (let id = 0; id < difficulty.pieces; id++) {
      const letter = letters[id];
      pieces.push({
        id,
        x: 0,
        y: 0,
        correctX: (id % grid.cols) * grid.pieceW,
        correctY: Math.floor(id / grid.cols) * grid.pieceH,
        drag: false,
        moved: false,
        locked: false,
        heldBy: null,
        heldAt: null,
        placedOnSlot: null,
        ...(isWordPuzzle ? { letter, letterPoints: LETTER_POINTS[letter] || 1, letterColor: wordTileColor(id, letter) } : {}),
      });
    }
  }

  return {
    config: { puzzleId: coachingActivity ? coachingActivity.id : puzzle.id, difficulty: difficulty.id, total },
    coachingActivity: coachingActivity || null,
    board,
    rankingSlots,
    puzzleMeta: {
      image: coachingActivity ? coachingActivity.cover : puzzle.image,
      name: coachingActivity ? coachingActivity.name : puzzle.name,
      category: coachingActivity ? "coaching" : puzzle.category,
      credit: puzzle?.credit || "",
      license: puzzle?.license || "",
      source: puzzle?.source || "",
      width: board ? board.width : dims.w,
      height: board ? board.height : dims.h,
      cols: layout ? layout.cols : grid.cols,
      rows: layout ? layout.rows : grid.rows,
      pieceW: board ? board.pieceW : grid.pieceW,
      pieceH: board ? board.pieceH : grid.pieceH,
    },
    pieces,
  };
}

function resetWorkshopState(room, { lobby = true } = {}) {
  room.ratings.clear();
  room.scores.clear();
  room.completed = false;
  room.completedAt = null;
  room.completedInMs = null;
  room.completionPlayers = [];
  room.stage = lobby ? "lobby" : "play";
  room.boardLocked = lobby;
  room.revealed = false;
  room.startedAt = lobby ? null : Date.now();
  room.pausedAt = null;
  room.pausedDurationMs = 0;
  room.timerEndsAt = null;
  room.timerDurationMs = null;
  room.insights = { observed: "", learned: "", tryNext: "" };
  room.debriefNotes = [];
  room.actions = [];
}

function applyPuzzleToRoom(room, config) {
  const setup = buildPuzzleSetup(config);
  room.config = setup.config;
  room.coachingActivity = setup.coachingActivity;
  room.board = setup.board;
  room.rankingSlots = setup.rankingSlots;
  room.puzzle = setup.puzzleMeta;
  room.pieces = setup.pieces;
  room.seed = crypto.randomInt(1, 2 ** 31);
  if (room.pieces.length) scatterPieces(room);
  resetWorkshopState(room, { lobby: true });
}

function createRoom(config, creator = {}) {
  const now = Date.now();
  const room = {
    id: crypto.randomUUID(),
    code: generateCode(),
    sessionName: String(creator.sessionName || "").trim().slice(0, 80) || "Team session",
    hostId: null,
    config: null,
    coachingActivity: null,
    board: null,
    rankingSlots: [],
    puzzle: null,
    pieces: [],
    ratings: new Map(),
    scores: new Map(),
    players: new Map(),
    knownPlayers: new Map(),
    pending: new Map(),
    conns: new Map(),
    cursorTimer: null,
    createdAt: now,
    startedAt: null,
    pausedAt: null,
    pausedDurationMs: 0,
    timerEndsAt: null,
    timerDurationMs: null,
    lastActivityAt: now,
    stage: "lobby",
    boardLocked: true,
    revealed: false,
    celebrationMode: "team",
    facilitatorNotes: "",
    insights: { observed: "", learned: "", tryNext: "" },
    debriefNotes: [],
    actions: [],
    chat: [],
    completed: false,
    completedAt: null,
    completedInMs: null,
    completionPlayers: [],
  };
  applyPuzzleToRoom(room, config);
  rooms.set(room.id, room);
  codeIndex.set(room.code, room.id);
  return room;
}

// ---------------------------------------------------------------------------
// Persistence (small JSON snapshots; no database required for the MVP)
// ---------------------------------------------------------------------------

let snapshotTimer = null;
function scheduleSnapshot() {
  if (snapshotTimer) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    saveSnapshots();
  }, 250);
  snapshotTimer.unref?.();
}

function persistableRoom(room) {
  return {
    id: room.id, code: room.code, sessionName: room.sessionName, hostId: room.hostId,
    config: room.config, pieces: room.pieces.map(serializePiece), ratings: [...room.ratings], scores: [...room.scores],
    knownPlayers: [...room.knownPlayers], createdAt: room.createdAt, startedAt: room.startedAt,
    pausedAt: room.pausedAt, pausedDurationMs: room.pausedDurationMs, timerEndsAt: room.timerEndsAt,
    timerDurationMs: room.timerDurationMs, lastActivityAt: room.lastActivityAt, stage: room.stage,
    boardLocked: room.boardLocked, revealed: room.revealed, celebrationMode: room.celebrationMode,
    facilitatorNotes: room.facilitatorNotes, insights: room.insights, debriefNotes: room.debriefNotes,
    actions: room.actions, chat: room.chat, completed: room.completed, completedAt: room.completedAt,
    completedInMs: room.completedInMs, completionPlayers: room.completionPlayers,
  };
}

function saveSnapshots() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const payload = [...rooms.values()].map(persistableRoom);
    const temp = `${snapshotFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(payload));
    fs.renameSync(temp, snapshotFile);
  } catch (error) {
    console.error("Could not persist room snapshots", error);
  }
}

function restoreSnapshots() {
  try {
    const saved = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    const now = Date.now();
    for (const raw of saved) {
      if (!raw?.id || now - raw.lastActivityAt > ROOM_TTL_MS) continue;
      const room = createRoom(raw.config, { sessionName: raw.sessionName });
      rooms.delete(room.id);
      codeIndex.delete(room.code);
      room.id = raw.id;
      room.code = raw.code;
      room.hostId = raw.hostId;
      room.knownPlayers = new Map(raw.knownPlayers || []);
      room.pieces = (raw.pieces || room.pieces).map((p) => ({ ...p, heldBy: null, heldAt: null, drag: false }));
      room.ratings = new Map(raw.ratings || []);
      room.scores = new Map(raw.scores || []);
      Object.assign(room, {
        createdAt: raw.createdAt, startedAt: raw.startedAt, pausedAt: raw.pausedAt,
        pausedDurationMs: raw.pausedDurationMs || 0, timerEndsAt: raw.timerEndsAt,
        timerDurationMs: raw.timerDurationMs, lastActivityAt: raw.lastActivityAt,
        stage: raw.stage || "lobby", boardLocked: raw.boardLocked ?? true,
        revealed: !!raw.revealed, celebrationMode: raw.celebrationMode || "team",
        facilitatorNotes: raw.facilitatorNotes || "", insights: raw.insights || room.insights,
        debriefNotes: raw.debriefNotes || [], actions: raw.actions || [], chat: raw.chat || [],
        completed: !!raw.completed, completedAt: raw.completedAt, completedInMs: raw.completedInMs,
        completionPlayers: raw.completionPlayers || [],
      });
      rooms.set(room.id, room);
      codeIndex.set(room.code, room.id);
    }
    if (rooms.size) console.log(`Restored ${rooms.size} room snapshot(s).`);
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("Could not restore room snapshots", error);
  }
}
restoreSnapshots();

// ---------------------------------------------------------------------------
// Realtime helpers
// ---------------------------------------------------------------------------

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

function releaseClaims(room, playerId) {
  const released = [];
  for (const piece of room.pieces) {
    if (piece.heldBy === playerId) {
      piece.heldBy = null;
      piece.heldAt = null;
      piece.drag = false;
      released.push(serializePiece(piece));
    }
  }
  if (released.length) broadcast(room, { t: "pieces", list: released });
}

function dropPlayerConnection(room, playerId) {
  const conn = room.conns.get(playerId);
  if (conn) {
    try { conn.ws.close(); } catch {}
    room.conns.delete(playerId);
  }
  releaseClaims(room, playerId);
  if (room.players.has(playerId)) {
    room.players.delete(playerId);
    broadcast(room, { t: "players", list: activePlayerList(room) });
  }
  if (!room.conns.size) stopCursorRelay(room);
  scheduleSnapshot();
}

function checkCompletion(room) {
  if (room.completed || room.coachingActivity || !room.startedAt) return;
  if (room.pieces.filter((p) => p.locked).length >= room.config.total) {
    room.completed = true;
    room.completedAt = Date.now();
    room.completedInMs = elapsedMs(room, room.completedAt);
    room.boardLocked = true;
    room.completionPlayers = activePlayerList(room).filter((p) => p.role !== "spectator").map((p) => p.name);
    broadcast(room, { t: "completion", room: roomView(room), players: room.completionPlayers, scores: scoreList(room) });
    logEvent("complete", room, { durationMs: room.completedInMs });
    touch(room);
  }
}

function isHost(room, playerId) {
  return room.hostId === playerId;
}

function requireHostSocket(room, playerId, ws) {
  if (isHost(room, playerId)) return true;
  send(ws, { t: "error", code: "not_host", message: "Only the facilitator can do that." });
  return false;
}

function allRankingItemsPlaced(room) {
  return room.pieces.length > 0 && room.pieces.every((p) => p.placedOnSlot != null);
}

function setStage(room, stage) {
  if (!VALID_STAGES.has(stage)) return false;
  room.stage = stage;
  room.boardLocked = stage !== "play";
  if (stage === "play" && !room.startedAt) room.startedAt = Date.now();
  return true;
}

function applyControl(room, playerId, msg, ws) {
  if (!requireHostSocket(room, playerId, ws)) return;
  const now = Date.now();
  switch (msg.action) {
    case "start":
      setStage(room, room.coachingActivity ? "brief" : "play");
      if (!room.coachingActivity && !room.startedAt) room.startedAt = now;
      room.pausedAt = null;
      break;
    case "stage": {
      const nextStage = String(msg.stage);
      if (room.coachingActivity?.mode === "ranking" && (nextStage === "debrief" || nextStage === "harvest") && !room.revealed) {
        return send(ws, { t: "error", code: "reveal_required", message: "Reveal the expert ranking before opening debrief or harvest." });
      }
      if (!setStage(room, nextStage)) return;
      break;
    }
    case "lock": {
      const next = msg.locked !== false;
      room.boardLocked = next;
      if (next && !room.pausedAt && room.stage === "play") room.pausedAt = now;
      if (!next && room.pausedAt) {
        room.pausedDurationMs += now - room.pausedAt;
        room.pausedAt = null;
      }
      break;
    }
    case "reveal":
      if (room.coachingActivity?.mode === "ranking" && !allRankingItemsPlaced(room)) {
        return send(ws, { t: "error", code: "ranking_incomplete", message: "Place every item before revealing the expert ranking." });
      }
      room.revealed = true;
      room.stage = "reveal";
      room.boardLocked = true;
      broadcast(room, { t: "puzzleMeta", puzzle: puzzleView(room) });
      break;
    case "timer": {
      const seconds = Math.max(0, Math.min(60 * 60, Number(msg.seconds) || 0));
      room.timerDurationMs = seconds ? seconds * 1000 : null;
      room.timerEndsAt = seconds ? now + seconds * 1000 : null;
      break;
    }
    case "notes":
      room.facilitatorNotes = String(msg.text || "").slice(0, 10_000);
      touch(room);
      return send(ws, { t: "facilitator", notes: room.facilitatorNotes });
    case "celebration":
      room.celebrationMode = msg.mode === "individual" ? "individual" : "team";
      break;
    case "kick": {
      const target = String(msg.playerId || "");
      if (!target || target === room.hostId) return;
      const conn = room.conns.get(target);
      if (conn) send(conn.ws, { t: "closed", code: "removed", message: "The facilitator removed you from this session." });
      room.knownPlayers.delete(target);
      room.pending.delete(target);
      dropPlayerConnection(room, target);
      break;
    }
    case "close":
      room.stage = "closed";
      room.boardLocked = true;
      for (const [pid, conn] of [...room.conns]) {
        if (pid !== playerId) send(conn.ws, { t: "closed", code: "room_closed", message: "The facilitator closed this session." });
      }
      break;
    default:
      return;
  }
  touch(room);
  broadcastRoom(room);
  logEvent(`control_${msg.action}`, room, { stage: room.stage });
}

function applyHarvest(room, playerId, msg, ws) {
  if (!room.startedAt) return;
  if (msg.kind === "insights") {
    const value = msg.value && typeof msg.value === "object" ? msg.value : {};
    room.insights = {
      observed: String(value.observed || "").slice(0, 4000),
      learned: String(value.learned || "").slice(0, 4000),
      tryNext: String(value.tryNext || "").slice(0, 4000),
    };
  } else if (msg.kind === "debrief") {
    room.debriefNotes = Array.isArray(msg.value) ? msg.value.slice(0, 10).map((v) => String(v || "").slice(0, 2000)) : [];
  } else if (msg.kind === "actions") {
    room.actions = Array.isArray(msg.value) ? msg.value.slice(0, 20).map((action) => ({
      id: String(action.id || crypto.randomUUID()),
      text: String(action.text || "").slice(0, 500),
      ownerId: room.knownPlayers.has(action.ownerId) ? action.ownerId : "",
      due: /^\d{4}-\d{2}-\d{2}$/.test(action.due || "") ? action.due : "",
      done: !!action.done,
    })) : [];
  } else {
    return;
  }
  touch(room);
  broadcastRoom(room);
  send(ws, { t: "harvestSaved", kind: msg.kind, by: playerId });
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function exportPayload(room) {
  const ranking = room.coachingActivity?.mode === "ranking" ? room.pieces.map((piece) => {
    const item = room.coachingActivity.items[piece.id];
    return { item: item.label, teamRank: piece.placedOnSlot, expertRank: room.revealed ? item.expertRank : null };
  }).sort((a, b) => (a.teamRank || 99) - (b.teamRank || 99)) : null;
  const deviationScore = ranking?.every((entry) => entry.teamRank != null && entry.expertRank != null)
    ? ranking.reduce((sum, entry) => sum + Math.pow(entry.teamRank - entry.expertRank, 2), 0)
    : null;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    session: { id: room.id, name: room.sessionName, activityId: room.config.puzzleId, stage: room.stage, startedAt: room.startedAt, durationMs: elapsedMs(room) },
    participants: [...room.knownPlayers.entries()].map(([id, p]) => ({ id, name: p.name, role: p.role || "player" })),
    ranking,
    deviationScore,
    profiles: [...room.ratings.entries()].filter(([, r]) => r.done).map(([playerId, r]) => ({ playerId, profileCode: r.profileCode })),
    insights: room.insights,
    debriefNotes: room.debriefNotes,
    actions: room.actions,
    facilitatorNotes: room.facilitatorNotes,
  };
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  const memory = process.memoryUsage();
  res.json({ ok: true, protocolVersion: PROTOCOL_VERSION, rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0), wsConnections: wss?.clients?.size || 0, uptimeSeconds: Math.floor(process.uptime()), heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024) });
});
function publicCoachingCatalog() {
  const catalog = clone(COACHING);
  catalog.activities = catalog.activities.map((activity) => activity.mode === "ranking"
    ? { ...activity, items: activity.items.map(({ id, label }) => ({ id, label })), debrief: undefined }
    : activity);
  return catalog;
}
app.get("/api/puzzles", (_req, res) => res.json({ categories: CATEGORIES, difficulties: DIFFICULTIES, puzzles: PUZZLES.map((p) => ({ ...p })), coaching: publicCoachingCatalog(), maxPlayers: MAX_PLAYERS }));
app.get("/api/coaching", (_req, res) => res.json(publicCoachingCatalog()));

app.post("/api/rooms", (req, res) => {
  const { puzzleId, difficulty, name, sessionName, role } = req.body || {};
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "A display name is required." });
  try {
    const room = createRoom({ puzzleId, difficulty }, { sessionName });
    const playerId = crypto.randomUUID();
    const info = { name: name.trim().slice(0, 24), color: null, role: role === "spectator" ? "spectator" : "host" };
    room.hostId = playerId;
    room.knownPlayers.set(playerId, info);
    room.pending.set(playerId, { ...info, expiresAt: Date.now() + PENDING_TTL_MS });
    touch(room);
    logEvent("room_create", room);
    res.json({ room: roomView(room), playerId, roomCode: room.code });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not create room." });
  }
});

app.post("/api/rooms/:id/join", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room || room.stage === "closed") return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  const { name, pid, code } = req.body || {};
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "A display name is required." });
  if (pid && room.knownPlayers.has(pid)) return res.json({ room: roomView(room), playerId: pid, returning: true });

  const refIsCode = String(req.params.id).trim().toUpperCase() === room.code;
  const providedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!refIsCode && providedCode !== room.code) {
    return res.status(403).json({ error: providedCode ? "That access code is incorrect." : "This room requires an access code.", code: providedCode ? "bad_code" : "code_required" });
  }
  if (room.players.size + room.pending.size >= MAX_PLAYERS) return res.status(409).json({ error: `This room is full (${MAX_PLAYERS} players max).`, code: "room_full" });

  const playerId = crypto.randomUUID();
  const cleanName = name.trim().slice(0, 24);
  const activeNames = [...room.players.values(), ...room.pending.values()].map((player) => player.name.toLocaleLowerCase());
  if (activeNames.includes(cleanName.toLocaleLowerCase())) return res.status(409).json({ error: "That display name is already in this room.", code: "duplicate_name" });
  const info = { name: cleanName, color: null, role: "player" };
  room.knownPlayers.set(playerId, info);
  room.pending.set(playerId, { ...info, expiresAt: Date.now() + PENDING_TTL_MS });
  touch(room);
  logEvent("join_reserved", room);
  res.json({ room: roomView(room), playerId });
});

app.get("/api/rooms/:id", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room || room.stage === "closed") return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  res.json({ room: publicRoomView(room), puzzle: { ...puzzleView(room), activity: undefined }, playerCount: room.players.size + room.pending.size });
});

app.post("/api/rooms/:id/takeover", (req, res) => {
  const room = findRoom(req.params.id);
  const pid = req.body?.pid;
  if (!room) return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  if (!pid || !room.players.has(pid)) return res.status(403).json({ error: "Active room membership required.", code: "not_member" });
  if (room.conns.has(room.hostId)) return res.status(409).json({ error: "The facilitator is still connected.", code: "host_present" });
  room.hostId = pid;
  const known = room.knownPlayers.get(pid);
  if (known) known.role = "host";
  const active = room.players.get(pid);
  if (active) active.role = "host";
  touch(room);
  broadcastRoom(room);
  broadcast(room, { t: "players", list: activePlayerList(room) });
  logEvent("host_takeover", room);
  res.json({ ok: true, room: roomView(room) });
});

app.post("/api/rooms/:id/puzzle", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  const { puzzleId, difficulty, pid } = req.body || {};
  if (!pid || pid !== room.hostId) return res.status(403).json({ error: "Only the facilitator can change the activity.", code: "not_host" });
  try { applyPuzzleToRoom(room, { puzzleId, difficulty }); } catch { return res.status(400).json({ error: "Unknown puzzle or activity." }); }
  touch(room);
  broadcast(room, { t: "puzzle", room: roomView(room), puzzle: puzzleView(room), pieces: room.pieces.map(serializePiece), ratings: [] });
  logEvent("puzzle_change", room);
  res.json({ ok: true, room: roomView(room) });
});

app.post("/api/rooms/:id/reset", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  if (!req.body?.pid || req.body.pid !== room.hostId) return res.status(403).json({ error: "Only the facilitator can reset the session.", code: "not_host" });
  if (room.pieces.length) scatterPieces(room);
  resetWorkshopState(room, { lobby: true });
  touch(room);
  broadcast(room, { t: "reset", room: roomView(room), puzzle: puzzleView(room), pieces: room.pieces.map(serializePiece), ratings: [] });
  logEvent("room_reset", room);
  res.json({ ok: true });
});

app.get("/api/rooms/:id/export", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found." });
  if (String(req.query.pid || "") !== room.hostId) return res.status(403).json({ error: "Only the facilitator can export this session." });
  const payload = exportPayload(room);
  if (req.query.format !== "html") {
    res.setHeader("Content-Disposition", `attachment; filename="puzzletogether-${room.id.slice(0, 8)}.json"`);
    return res.json(payload);
  }
  const actions = payload.actions.map((a) => `<li>${htmlEscape(a.text)} — ${htmlEscape(room.knownPlayers.get(a.ownerId)?.name || "Unassigned")} ${a.due ? `(${htmlEscape(a.due)})` : ""}</li>`).join("");
  const ranking = payload.ranking ? `<h2>Team ranking${payload.deviationScore != null ? ` · deviation ${payload.deviationScore}` : ""}</h2><ol>${payload.ranking.map((r) => `<li>${htmlEscape(r.item.en || r.item.ro)} — team ${r.teamRank ?? "–"}${r.expertRank ? ` / expert ${r.expertRank}` : ""}</li>`).join("")}</ol>` : "";
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(room.sessionName)} — PuzzleTogether</title><style>body{font:14px system-ui;max-width:800px;margin:40px auto;color:#172033}h1,h2{color:#27358f}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.card{border:1px solid #ddd;border-radius:12px;padding:14px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print / Save PDF</button><h1>${htmlEscape(room.sessionName)}</h1><p>${htmlEscape(room.config.puzzleId)} · ${new Date(room.startedAt || room.createdAt).toLocaleString()}</p>${ranking}<h2>Insights</h2><div class="grid"><div class="card"><b>Observed</b><p>${htmlEscape(room.insights.observed)}</p></div><div class="card"><b>Learned</b><p>${htmlEscape(room.insights.learned)}</p></div><div class="card"><b>Try next</b><p>${htmlEscape(room.insights.tryNext)}</p></div></div><h2>Action items</h2><ul>${actions || "<li>No action items captured.</li>"}</ul></body></html>`);
});

app.use(express.static(publicDir, { maxAge: IS_PROD ? "7d" : 0 }));

// ---------------------------------------------------------------------------
// WebSocket protocol
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 64 * 1024 });

wss.on("connection", (ws) => {
  ws.alive = true;
  let attached = null;
  ws.on("pong", () => { ws.alive = true; });
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { t: "error", code: "bad_json", message: "Malformed message." }); }
    if (!attached && msg.t !== "hello") return send(ws, { t: "deny", code: "bad_request", message: "Hello first." });

    switch (msg.t) {
      case "hello": {
        const room = findRoom(String(msg.roomId || ""));
        if (!room || room.stage === "closed") { send(ws, { t: "deny", code: "room_missing", message: "This room has expired or no longer exists." }); return ws.close(); }
        const pid = String(msg.playerId || "");
        if (!pid || !(room.knownPlayers.has(pid) || room.pending.has(pid))) { send(ws, { t: "deny", code: "room_missing", message: "Session lost. Please rejoin the room." }); return ws.close(); }
        if (room.conns.has(pid)) { try { room.conns.get(pid).ws.close(); } catch {} room.conns.delete(pid); }
        if (!room.players.has(pid)) {
          const info = room.pending.get(pid) || room.knownPlayers.get(pid) || {};
          room.players.set(pid, { id: pid, name: info.name || "Player", color: info.color || null, role: info.role || "player", joinedAt: Date.now(), lastSeenAt: Date.now() });
          room.pending.delete(pid);
        }
        const player = room.players.get(pid);
        if (!player.color) player.color = pickColor(room, pid);
        player.lastSeenAt = Date.now();
        const known = room.knownPlayers.get(pid);
        if (known) { known.color = player.color; known.role = player.role; }
        room.conns.set(pid, { ws, playerId: pid, cursor: { x: 0, y: 0, dirty: false } });
        attached = { room, playerId: pid };
        startCursorRelay(room);
        touch(room);
        send(ws, {
          t: "init", protocolVersion: PROTOCOL_VERSION, you: pid, room: roomView(room), puzzle: puzzleView(room), players: activePlayerList(room), pieces: room.pieces.map(serializePiece), ratings: ratingListFor(room, pid), scores: scoreList(room), chat: room.chat,
          facilitator: isHost(room, pid) ? { notes: room.facilitatorNotes } : undefined,
          cursors: [...room.conns.entries()].filter(([id]) => id !== pid).map(([id, c]) => ({ id, x: c.cursor.x, y: c.cursor.y })),
        });
        broadcast(room, { t: "players", list: activePlayerList(room) });
        logEvent("join_connected", room, { role: player.role });
        break;
      }
      case "piece": {
        const { room, playerId } = attached;
        const player = room.players.get(playerId);
        if (player) player.lastSeenAt = Date.now();
        const id = Number(msg.id);
        const piece = room.pieces[id];
        const ranking = room.coachingActivity?.mode === "ranking";
        if (!piece || room.completed || room.stage !== "play" || room.boardLocked || player?.role === "spectator" || (!ranking && piece.locked)) {
          if (piece) send(ws, { t: "pieces", list: [serializePiece(piece)] });
          return;
        }
        const x = Math.max(-200000, Math.min(200000, Number(msg.x) || 0));
        const y = Math.max(-200000, Math.min(200000, Number(msg.y) || 0));
        const dragging = !!msg.drag;
        if (piece.heldBy && piece.heldBy !== playerId && Date.now() - piece.heldAt < CLAIM_TTL_MS) {
          send(ws, { t: "pieceRejected", reason: "held", ownerId: piece.heldBy, piece: serializePiece(piece) });
          return;
        }
        if (dragging) {
          piece.heldBy = playerId;
          piece.heldAt = Date.now();
          if (ranking && piece.placedOnSlot != null) { piece.placedOnSlot = null; piece.locked = false; }
          piece.x = x; piece.y = y; piece.drag = true; piece.moved = true;
        } else {
          if (piece.heldBy && piece.heldBy !== playerId) { send(ws, { t: "pieceRejected", reason: "held", ownerId: piece.heldBy, piece: serializePiece(piece) }); return; }
          piece.x = x; piece.y = y; piece.drag = false; piece.moved = true; piece.heldBy = null; piece.heldAt = null;
          if (ranking) {
            let closest = null;
            for (const slot of room.rankingSlots) {
              if (room.pieces.some((other) => other.id !== piece.id && other.placedOnSlot === slot.rank)) continue;
              const distance = Math.hypot(x - slot.x, y - slot.y);
              if (!closest || distance < closest.distance) closest = { slot, distance };
            }
            if (closest && closest.distance <= snapDistance(room.puzzle.pieceW, room.puzzle.pieceH)) {
              piece.x = closest.slot.x; piece.y = closest.slot.y; piece.correctX = closest.slot.x; piece.correctY = closest.slot.y;
              piece.placedOnSlot = closest.slot.rank; piece.locked = true;
            } else { piece.placedOnSlot = null; piece.locked = false; }
          } else {
            const distance = Math.hypot(x - piece.correctX, y - piece.correctY);
            if (distance <= snapDistance(room.puzzle.pieceW, room.puzzle.pieceH)) {
              piece.x = piece.correctX; piece.y = piece.correctY; piece.locked = true;
              room.scores.set(playerId, (room.scores.get(playerId) || 0) + 1);
              broadcast(room, { t: "scores", list: scoreList(room) });
            }
          }
        }
        touch(room);
        broadcast(room, { t: "pieces", list: [serializePiece(piece)] });
        if (piece.locked && !ranking) checkCompletion(room);
        break;
      }
      case "cursor": {
        const { room, playerId } = attached;
        const conn = room.conns.get(playerId);
        if (!conn) break;
        conn.cursor.x = Number(msg.x) || 0; conn.cursor.y = Number(msg.y) || 0; conn.cursor.dirty = true;
        const player = room.players.get(playerId); if (player) player.lastSeenAt = Date.now();
        break;
      }
      case "rating": {
        const { room, playerId } = attached;
        if (room.coachingActivity?.mode !== "questionnaire" || room.stage !== "play") break;
        const answers = {};
        for (const q of room.coachingActivity.questions) if (msg.answers?.[q.id] === "A" || msg.answers?.[q.id] === "B") answers[q.id] = msg.answers[q.id];
        const done = !!msg.done && Object.keys(answers).length === room.coachingActivity.questions.length;
        const profileCode = done ? computeProfileCode(room.coachingActivity, answers) : null;
        room.ratings.set(playerId, { answers, done, profileCode });
        touch(room);
        for (const [pid, conn] of room.conns) send(conn.ws, { t: "ratings", list: ratingListFor(room, pid) });
        if (done) logEvent("rating_done", room, { playerId });
        break;
      }
      case "control": {
        const { room, playerId } = attached;
        applyControl(room, playerId, msg, ws);
        break;
      }
      case "harvest": {
        const { room, playerId } = attached;
        applyHarvest(room, playerId, msg, ws);
        break;
      }
      case "chat": {
        const { room, playerId } = attached;
        const text = String(msg.text || "").trim().slice(0, 500);
        if (!text) break;
        const player = room.players.get(playerId);
        const entry = { id: crypto.randomUUID(), playerId, name: player?.name || "Player", color: player?.color || "#94a3b8", text, at: Date.now() };
        room.chat = [...room.chat.slice(-49), entry];
        touch(room);
        broadcast(room, { t: "chat", entry });
        break;
      }
      case "ping": send(ws, { t: "pong", serverNow: Date.now() }); break;
      default: send(ws, { t: "error", code: "unknown_message", message: "Unknown protocol message." });
    }
  });
  ws.on("close", () => {
    if (!attached) return;
    const { room, playerId } = attached;
    if (room.conns.get(playerId)?.ws === ws) dropPlayerConnection(room, playerId);
  });
  ws.on("error", (error) => console.warn("WebSocket error", error.message));
});

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const [pid, conn] of [...room.conns]) {
      if (!conn.ws.alive) { conn.ws.terminate(); dropPlayerConnection(room, pid); }
      else { conn.ws.alive = false; try { conn.ws.ping(); } catch {} }
    }
    for (const [pid, pending] of [...room.pending]) if (pending.expiresAt < now) room.pending.delete(pid);
    const expiredClaims = [];
    for (const piece of room.pieces) if (piece.heldBy && now - piece.heldAt > CLAIM_TTL_MS) {
      piece.heldBy = null; piece.heldAt = null; piece.drag = false; expiredClaims.push(serializePiece(piece));
    }
    if (expiredClaims.length) broadcast(room, { t: "pieces", list: expiredClaims });
    if (room.conns.size) broadcast(room, { t: "players", list: activePlayerList(room) });
    if (!room.players.size && !room.conns.size && now - room.lastActivityAt > EMPTY_ROOM_TTL_MS) {
      rooms.delete(room.id); codeIndex.delete(room.code); stopCursorRelay(room); logEvent("room_empty_reaped", room);
    }
  }
}, HEARTBEAT_MS).unref();

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of [...rooms]) if (now - room.lastActivityAt > ROOM_TTL_MS) {
    for (const [, conn] of room.conns) { send(conn.ws, { t: "closed", code: "room_expired", message: "This room expired after 24 hours of inactivity." }); try { conn.ws.close(); } catch {} }
    stopCursorRelay(room); rooms.delete(id); codeIndex.delete(room.code); logEvent("room_expired", room);
  }
  saveSnapshots();
}, 5 * 60_000).unref();

process.on("SIGTERM", () => { saveSnapshots(); httpServer.close(() => process.exit(0)); });
process.on("SIGINT", () => { saveSnapshots(); httpServer.close(() => process.exit(0)); });

if (IS_PROD) {
  app.use(express.static(distDir, { maxAge: "7d", index: false }));
  app.use((req, res, next) => req.path.startsWith("/api") || req.path.startsWith("/ws") ? next() : res.sendFile(path.join(distDir, "index.html")));
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ server: { middlewareMode: true, ws: { server: httpServer } }, appType: "custom" });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(rootDir, "index.html"), "utf8"));
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) { next(error); }
  });
}

app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: "Internal server error" }); });
httpServer.listen(PORT, HOST, () => {
  console.log(`🧩 PuzzleTogether server running on http://${HOST}:${PORT} (${IS_PROD ? "production" : "development"})`);
  console.log(`   protocol v${PROTOCOL_VERSION} · ${PUZZLES.length} licensed puzzles · ${rooms.size} active rooms`);
});
