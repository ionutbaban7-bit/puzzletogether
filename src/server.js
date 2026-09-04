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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import puzzlesData from "../shared/puzzles.json" with { type: "json" };
import coachingData from "../shared/coaching.json" with { type: "json" };
import sentenceVocab from "../shared/sentence-vocabulary.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "server", "public");
const distDir = path.join(rootDir, "dist");
// DATA_DIR is primarily an isolated integration-test/operations hook; the
// default preserves the existing on-disk room/upload location.
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || ".data");
const uploadsDir = path.join(dataDir, "uploads");
const snapshotFile = path.join(dataDir, "rooms.json");
const retiredCatalogFile = path.join(rootDir, "data", "catalog", "retired-stage5.json");
let retiredCatalog = { entries: [], puzzles: [] };
try { retiredCatalog = JSON.parse(fs.readFileSync(retiredCatalogFile, "utf8")); } catch { /* optional before the retirement ledger exists */ }
const retiredPuzzleById = new Map((retiredCatalog.puzzles || []).map((puzzle) => [puzzle.id, puzzle]));
const retiredEntryByPuzzleId = new Map((retiredCatalog.entries || []).map((entry) => [entry.puzzleId, entry]));

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PROTOCOL_VERSION = 2;
const MAX_PLAYERS = 20;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;
const PENDING_TTL_MS = 60 * 1000;
// Claims must be short-lived in practice, not merely in documentation. The
// values are configurable for integration tests/operations but bounded so a
// typo cannot create an endless held piece.
const configuredClaimTtl = Number(process.env.CLAIM_TTL_MS || 8_000);
const CLAIM_TTL_MS = Number.isFinite(configuredClaimTtl) ? Math.max(250, Math.min(60_000, configuredClaimTtl)) : 8_000;
const configuredClaimSweep = Number(process.env.CLAIM_SWEEP_MS || 1_000);
const CLAIM_SWEEP_MS = Number.isFinite(configuredClaimSweep)
  ? Math.max(100, Math.min(CLAIM_TTL_MS, configuredClaimSweep))
  : Math.min(1_000, CLAIM_TTL_MS);
const CURSOR_RELAY_MS = 33;
const HEARTBEAT_MS = 30_000;
const VALID_STAGES = new Set(["lobby", "brief", "play", "reveal", "debrief", "harvest", "closed"]);
const TEAM_MODE_SHARED = "shared";
const TEAM_MODE_COLOR = "color-teams";
const TEAM_TEMPLATES = [
  { id: "team-red", name: "Red", color: "red", marker: "●" },
  { id: "team-yellow", name: "Yellow", color: "yellow", marker: "▲" },
  { id: "team-green", name: "Green", color: "green", marker: "■" },
  { id: "team-blue", name: "Blue", color: "blue", marker: "◆" },
  { id: "team-purple", name: "Purple", color: "purple", marker: "✦" },
  { id: "team-orange", name: "Orange", color: "orange", marker: "●" },
];

function normalizeTeamMode(value) {
  return value === TEAM_MODE_COLOR ? TEAM_MODE_COLOR : TEAM_MODE_SHARED;
}

function normalizeTeamCount(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(2, Math.min(TEAM_TEMPLATES.length, number)) : 2;
}

function buildTeams(mode, count) {
  if (normalizeTeamMode(mode) !== TEAM_MODE_COLOR) return [];
  return TEAM_TEMPLATES.slice(0, normalizeTeamCount(count)).map((team, order) => ({ ...team, order }));
}

/** Old snapshots did not have a Team domain. Normalize them idempotently. */
function ensureTeamState(room) {
  room.teamMode = normalizeTeamMode(room.teamMode);
  room.teams = Array.isArray(room.teams)
    ? room.teams.filter((team) => TEAM_TEMPLATES.some((template) => template.id === team?.id)).map((team, order) => {
      const template = TEAM_TEMPLATES.find((candidate) => candidate.id === team.id);
      return { ...template, order };
    })
    : [];
  if (room.teamMode === TEAM_MODE_COLOR && room.teams.length < 2) room.teams = buildTeams(TEAM_MODE_COLOR, 2);
  if (room.teamMode === TEAM_MODE_SHARED) room.teams = [];
  const allowed = new Set(room.teams.map((team) => team.id));
  for (const collection of [room.knownPlayers, room.players, room.pending]) {
    if (!(collection instanceof Map)) continue;
    for (const [, player] of collection) {
      if (!player) continue;
      player.teamId = room.teamMode === TEAM_MODE_COLOR && allowed.has(player.teamId) ? player.teamId : null;
    }
  }
}

function teamViews(room) {
  ensureTeamState(room);
  return room.teams.map((team) => ({
    ...team,
    memberIds: [...room.knownPlayers.entries()]
      .filter(([, player]) => player?.teamId === team.id)
      .map(([playerId]) => playerId),
  }));
}

function assignPlayerTeam(room, playerId, teamId) {
  ensureTeamState(room);
  const next = room.teamMode === TEAM_MODE_COLOR && room.teams.some((team) => team.id === teamId) ? teamId : null;
  const known = room.knownPlayers.get(playerId);
  const active = room.players.get(playerId);
  const pending = room.pending.get(playerId);
  if (!known && !active && !pending) return false;
  if (known) known.teamId = next;
  if (active) active.teamId = next;
  if (pending) pending.teamId = next;
  return true;
}

function playerTeamId(room, playerId) {
  return room.players.get(playerId)?.teamId || room.knownPlayers.get(playerId)?.teamId || null;
}

const PUZZLES = puzzlesData.puzzles;
const CATEGORIES = puzzlesData.categories;
const DIFFICULTIES = puzzlesData.difficulties;
const CANVAS_MODES = new Map((puzzlesData.canvasModes || []).map((m) => [m.id, m.tiles]));
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

// ---------------------------------------------------------------------------
// Letter / Sentence Canvas — a SEPARATE model from the jigsaw pieces.
//
// There is deliberately no correctX/correctY, no snap-to-grid and no
// per-piece lock. Tiles are freely placeable on a blank white sheet until the
// facilitator locks the board or completes the session. Every tile action is
// validated here (the server is authoritative for claims, inventory, undo,
// duplication, deletion and completion).
// ---------------------------------------------------------------------------

const CANVAS_CATEGORIES = new Set(["letter-canvas", "sentence-canvas"]);
const CANVAS_CONTENT_LANGUAGES = new Set(["ro", "en"]);

/** Blank sheet (world units). The sheet is the whole board — nothing on it is "correct". */
const CANVAS_SHEET_W = 1920;
const CANVAS_SHEET_H = 1200;
/** Letter canvas tile geometry. */
const CANVAS_TILE_W = 100;
const CANVAS_TILE_H = 100;
/** Sentence canvas tile geometry (word width is computed from the text). */
const CANVAS_WORD_H = 96;
const CANVAS_WORD_GAP = 36;
const CANVAS_PUNCT_W = 64;
const CANVAS_MAX_CUSTOM_LEN = 40;
/** A claim stays active this long after the last claim touch before it expires. */
const CANVAS_CLAIM_TTL_MS = CLAIM_TTL_MS;
/** Per-player undo history depth. */
const CANVAS_UNDO_DEPTH = 60;
/** Jokers (mystery letters) each team can draw per letter-canvas session. */
const CANVAS_JOKERS_PER_TEAM = 3;
/** Map key used for the shared-mode (single-team) joker bank. */
const JOKER_SHARED_KEY = "shared";

/** Alphabets per content language (NFC-normalized; UI language is separate). */
const CANVAS_LETTER_SETS = {
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ro: "ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘȚ",
};
/** Approximate letter frequency weights used to build the finite inventory. */
const CANVAS_LETTER_WEIGHTS = {
  en: { A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 1, X: 1, Y: 2, Z: 1 },
  ro: { A: 7, B: 1, C: 3, D: 3, E: 9, F: 1, G: 3, H: 1, I: 5, J: 1, K: 1, L: 4, M: 2, N: 4, O: 6, P: 2, Q: 1, R: 7, S: 5, T: 6, U: 3, V: 2, W: 1, X: 1, Y: 1, Z: 1, Ă: 4, Â: 3, Î: 6, Ș: 1, Ț: 2 },
};
const CANVAS_PUNCT_SET = [".", ".", ".", ",", ",", "!", "?", "-", "'", "\"", ":", ";"];

/** Wildcard tile marker (stands for any letter). */
const CANVAS_WILDCARD = "?";

function nfc(value) {
  return String(value || "").normalize("NFC");
}

function isCanvasPuzzle(puzzle) {
  return CANVAS_CATEGORIES.has(puzzle?.category);
}

/** Deterministic word-tile width so every client renders identical tiles. */
function canvasWordWidth(text, kind) {
  if (kind === "punctuation") return CANVAS_PUNCT_W;
  const len = [...nfc(text)].length;
  return Math.max(96, Math.min(720, 40 + len * 19));
}

/**
 * Builds the finite letter inventory (a Map letter -> remaining count) using
 * largest-remainder distribution of the weighted frequencies.
 * Returns null for the unlimited sandbox mode.
 */
function buildLetterInventory(mode, contentLanguage) {
  const total = CANVAS_MODES.get(mode);
  if (!total || total <= 0) return null; // sandbox = unlimited
  const lang = contentLanguage === "ro" ? "ro" : "en";
  const letters = CANVAS_LETTER_SETS[lang];
  const weights = CANVAS_LETTER_WEIGHTS[lang];

  const wildcards = Math.max(2, Math.round(total * 0.032));
  const punctuationTotal = Math.max(6, Math.round(total * 0.075));
  const letterBudget = total - wildcards - punctuationTotal;

  const inventory = new Map();
  inventory.set(CANVAS_WILDCARD, wildcards);
  // Punctuation: weighted spread over the punctuation set (periods most common —
  // the set lists the period three times, so it gets ~3x the share).
  for (let i = 0; i < punctuationTotal; i++) {
    const p = CANVAS_PUNCT_SET[i % CANVAS_PUNCT_SET.length];
    inventory.set(p, (inventory.get(p) || 0) + 1);
  }
  // Letters: largest remainder of the weighted budget.
  const weightSum = [...letters].reduce((sum, ch) => sum + (weights[ch] || 0), 0);
  const shares = [...letters].map((ch) => ({ ch, exact: (letterBudget * (weights[ch] || 0)) / weightSum }));
  for (const s of shares) inventory.set(s.ch, Math.floor(s.exact));
  let rest = letterBudget - shares.reduce((sum, s) => sum + Math.floor(s.exact), 0);
  shares.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) || a.ch.localeCompare(b.ch));
  for (let i = 0; rest > 0; i = (i + 1) % shares.length) {
    inventory.set(shares[i].ch, (inventory.get(shares[i].ch) || 0) + 1);
    rest--;
  }
  return inventory;
}

/** Builds the sentence inventory (a Map word -> remaining count) from the pack. */
function buildSentenceInventory(contentLanguage) {
  const pack = sentenceVocab[contentLanguage === "ro" ? "ro" : "en"] || sentenceVocab.en;
  const inventory = new Map();
  for (const entry of pack) {
    const word = nfc(entry.w);
    inventory.set(word, (inventory.get(word) || 0) + (entry.n || 1));
  }
  return inventory;
}

function cloneInventory(inventory) {
  return inventory ? new Map(inventory) : null;
}

function canvasBaseInventory(canvas) {
  return canvas.category === "letter-canvas"
    ? buildLetterInventory(canvas.mode, canvas.contentLanguage)
    : buildSentenceInventory(canvas.contentLanguage);
}

/**
 * Canvas v2 is structured around a few meaningful composition lanes. A lane
 * retains normal x/y geometry for the canvas renderer, plus a semantic role
 * used in exports and accessibility/UI labels. Legacy v1 snapshots omit this.
 */
function buildCanvasLanes(category, teams = []) {
  const scopes = teams.length ? teams : [{ id: null, name: "Shared", color: "blue", marker: "●", order: 0 }];
  const columns = Math.min(3, Math.max(1, scopes.length));
  const rows = Math.ceil(scopes.length / columns);
  const outer = 42;
  const gap = 28;
  const cellW = (CANVAS_SHEET_W - outer * 2 - gap * (columns - 1)) / columns;
  const cellH = (CANVAS_SHEET_H - outer * 2 - gap * (rows - 1)) / rows;
  const templates = category === "letter-canvas"
    ? [
      { kind: "word", label: { ro: "Cuvântul 1", en: "Word 1" }, hint: { ro: "Pune literele în ordine.", en: "Put letters in order." } },
      { kind: "word", label: { ro: "Cuvântul 2", en: "Word 2" }, hint: { ro: "Construiește încă un cuvânt.", en: "Build another word." } },
      { kind: "word", label: { ro: "Cuvântul 3", en: "Word 3" }, hint: { ro: "Lasă o idee pentru echipă.", en: "Leave an idea for the team." } },
    ]
    : [
      { kind: "idea", label: { ro: "Ideea", en: "Idea" }, hint: { ro: "Ce contează acum?", en: "What matters now?" } },
      { kind: "reason", label: { ro: "Motivul", en: "Reason" }, hint: { ro: "De ce este important?", en: "Why does it matter?" } },
      { kind: "commitment", label: { ro: "Următorul pas", en: "Next step" }, hint: { ro: "Ce facem mai departe?", en: "What will we do next?" } },
    ];
  return scopes.flatMap((team, scopeIndex) => {
    const col = scopeIndex % columns;
    const row = Math.floor(scopeIndex / columns);
    const x = outer + col * (cellW + gap);
    const y = outer + row * (cellH + gap);
    const laneGap = 16;
    const header = 44;
    const laneH = Math.max(116, (cellH - header - laneGap * (templates.length - 1)) / templates.length);
    return templates.map((template, laneIndex) => ({
      id: `${team.id || "shared"}-${template.kind}-${laneIndex + 1}`,
      teamId: team.id || null,
      teamColor: team.id ? team.color : undefined,
      teamMarker: team.id ? team.marker : undefined,
      teamName: team.id ? team.name : undefined,
      kind: template.kind,
      label: template.label,
      hint: template.hint,
      x,
      y: y + header + laneIndex * (laneH + laneGap),
      w: cellW,
      h: laneH,
    }));
  });
}

function applyCanvasTeamModel(room, { resetInventory = false } = {}) {
  const canvas = room.canvas;
  if (!canvas) return;
  ensureTeamState(room);
  canvas.version = 2;
  const colourTeams = room.teamMode === TEAM_MODE_COLOR ? room.teams : [];
  canvas.lanes = buildCanvasLanes(canvas.category, colourTeams);
  if (!resetInventory) return;
  const base = canvasBaseInventory(canvas);
  if (colourTeams.length) {
    canvas.inventory = null;
    canvas.teamInventory = new Map(colourTeams.map((team) => [team.id, cloneInventory(base)]));
  } else {
    canvas.inventory = base;
    canvas.teamInventory = null;
  }
  resetCanvasJokers(room);
}

/** Places lane tiles deterministically; freeform v1 tiles retain their x/y. */
function layoutCanvasLane(canvas, laneId) {
  if (!canvas.version || canvas.version < 2 || !laneId) return [];
  const lane = (canvas.lanes || []).find((item) => item.id === laneId);
  if (!lane) return [];
  const tiles = [...canvas.tiles.values()]
    .filter((tile) => tile.laneId === laneId)
    .sort((a, b) => (a.laneIndex ?? 0) - (b.laneIndex ?? 0) || a.id - b.id);
  const inset = 18;
  const gap = canvas.category === "letter-canvas" ? 12 : 16;
  let x = lane.x + inset;
  let y = lane.y + inset;
  let row = 0;
  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index];
    if (x + tile.w > lane.x + lane.w - inset && x > lane.x + inset) {
      row++;
      x = lane.x + inset;
      y += tile.h + gap;
    }
    // Retain a useful, reachable layout even when a facilitator deliberately
    // puts more content in a lane than its visual height suggests.
    tile.x = x;
    tile.y = Math.min(lane.y + lane.h - tile.h - inset, y);
    tile.laneIndex = index;
    x += tile.w + gap;
    clampCanvasTile(canvas, tile);
  }
  return tiles;
}

function setCanvasTileLane(canvas, tile, laneId, requestedIndex) {
  if (!canvas.version || canvas.version < 2) return [];
  const lane = (canvas.lanes || []).find((item) => item.id === laneId);
  if (!lane) return null;
  const oldLaneId = tile.laneId;
  tile.laneId = lane.id;
  const siblings = [...canvas.tiles.values()]
    .filter((item) => item.id !== tile.id && item.laneId === lane.id)
    .sort((a, b) => (a.laneIndex ?? 0) - (b.laneIndex ?? 0) || a.id - b.id);
  const index = Number.isFinite(Number(requestedIndex)) ? Math.max(0, Math.min(siblings.length, Math.floor(Number(requestedIndex)))) : siblings.length;
  siblings.splice(index, 0, tile);
  siblings.forEach((item, laneIndex) => { item.laneIndex = laneIndex; });
  const changed = [...layoutCanvasLane(canvas, lane.id)];
  if (oldLaneId && oldLaneId !== lane.id) changed.push(...layoutCanvasLane(canvas, oldLaneId));
  return changed;
}

function teamInventoryFor(room, canvas, playerId) {
  if (room.teamMode !== TEAM_MODE_COLOR) return canvas.inventory;
  const teamId = playerTeamId(room, playerId);
  return teamId ? canvas.teamInventory?.get(teamId) || null : undefined;
}

function canvasTeamInventoryPayload(canvas) {
  if (!canvas.teamInventory) return null;
  return Object.fromEntries([...canvas.teamInventory.entries()].map(([teamId, inventory]) => [teamId, inventory ? Object.fromEntries(inventory) : null]));
}

/** Rebuilds the per-team joker bank (defaults each team to 3 draws). */
function resetCanvasJokers(room) {
  const canvas = room.canvas;
  if (!canvas) return;
  const keys = room.teamMode === TEAM_MODE_COLOR ? room.teams.map((team) => team.id) : [JOKER_SHARED_KEY];
  canvas.jokers = new Map(keys.map((key) => [key, CANVAS_JOKERS_PER_TEAM]));
}

function canvasJokersPayload(canvas) {
  if (!canvas || !canvas.jokers) return null;
  return Object.fromEntries([...canvas.jokers.entries()].map(([key, count]) => [key, count]));
}

/** Which joker bank a player draws from (their colour team, or the shared one). */
function canvasJokerKey(room, playerId) {
  if (room.teamMode === TEAM_MODE_COLOR) return playerTeamId(room, playerId);
  return JOKER_SHARED_KEY;
}

/** Clamps a tile inside the blank sheet. */
function clampCanvasTile(canvas, tile) {
  tile.x = Math.max(0, Math.min(canvas.sheetW - tile.w, tile.x));
  tile.y = Math.max(0, Math.min(canvas.sheetH - tile.h, tile.y));
}

/**
 * Sentence canvas only: align the dropped tile to the nearest row and snap its
 * x to the discrete word gap next to the closest horizontal neighbour.
 */
function snapSentenceTile(canvas, tile) {
  const others = [...canvas.tiles.values()].filter((t) => t.id !== tile.id);
  const rowTol = tile.h * 0.55;
  const nearRow = others.filter((t) => Math.abs(t.y - tile.y) <= rowTol);
  if (nearRow.length) {
    const rowY = Math.min(...nearRow.map((t) => t.y));
    if (Math.abs(rowY - tile.y) <= rowTol) tile.y = rowY;
  }
  const row = others.filter((t) => Math.abs(t.y - tile.y) <= 10);
  let best = null;
  let bestScore = Infinity;
  for (const t of row) {
    const gapRight = tile.x - (t.x + t.w); // tile should sit to the right of t
    const gapLeft = t.x - (tile.x + t.w); // tile should sit to the left of t
    for (const [gap, side, of] of [[gapRight, "right", t], [gapLeft, "left", t]]) {
      if (gap < -CANVAS_WORD_GAP || gap > CANVAS_WORD_GAP * 3.5) continue;
      const score = Math.abs(gap - CANVAS_WORD_GAP);
      if (score < bestScore) { bestScore = score; best = { side, of }; }
    }
  }
  if (best && bestScore < CANVAS_WORD_GAP * 1.6) {
    tile.x = best.side === "right" ? best.of.x + best.of.w + CANVAS_WORD_GAP : best.of.x - CANVAS_WORD_GAP - tile.w;
  }
  clampCanvasTile(canvas, tile);
}

/**
 * Reconstructs the composition text from tile positions: tiles are grouped
 * into rows by y-proximity, sorted by x, punctuation attaches without a space
 * and large gaps become spaces. Shared with the client (src/lib/canvasText.ts).
 */
function reconstructCanvasText(tiles, opts = {}) {
  const { bigGapFactor = 1.8, spaceBeforePunct = false } = opts;
  if (!tiles.length) return "";
  // v2 lanes are an explicit shared composition order. Use them whenever all
  // live tiles opted into lanes; legacy/freeform snapshots keep spatial text.
  if (tiles.every((tile) => tile.laneId)) {
    const groups = new Map();
    for (const tile of tiles) {
      const group = groups.get(tile.laneId) || { x: tile.x, y: tile.y, items: [] };
      group.x = Math.min(group.x, tile.x);
      group.y = Math.min(group.y, tile.y);
      group.items.push(tile);
      groups.set(tile.laneId, group);
    }
    return [...groups.values()]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((group) => {
        const items = group.items.sort((a, b) => (a.laneIndex ?? 0) - (b.laneIndex ?? 0) || a.id - b.id);
        const letters = items.every((tile) => ["letter", "wildcard", "punctuation"].includes(tile.kind));
        let line = "";
        for (let index = 0; index < items.length; index++) {
          const tile = items[index];
          if (!letters && index > 0 && tile.kind !== "punctuation") line += " ";
          line += tile.text;
        }
        return line.trim();
      })
      .filter(Boolean)
      .join("\n");
  }
  const list = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const t of list) {
    const row = rows.find((r) => Math.abs(r.y - t.y) < t.h * 0.55);
    if (row) { row.items.push(t); row.y = (row.y * row.n + t.y) / (row.n + 1); row.n++; }
    else rows.push({ y: t.y, n: 1, items: [t] });
  }
  const lines = rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    let line = "";
    for (let i = 0; i < row.items.length; i++) {
      const t = row.items[i];
      if (i > 0) {
        const prev = row.items[i - 1];
        const gap = t.x - (prev.x + prev.w);
        const eitherPunct = t.kind === "punctuation" || prev.kind === "punctuation";
        const isSpace = !eitherPunct || spaceBeforePunct;
        if (isSpace) line += gap > prev.w * bigGapFactor ? "  " : " ";
      }
      line += t.text;
    }
    return line.trim();
  });
  return lines.filter(Boolean).join("\n");
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
    contentLanguage: room.config.contentLanguage || null,
    teamMode: room.teamMode || TEAM_MODE_SHARED,
    teams: teamViews(room),
    canvasVersion: room.canvas?.version || undefined,
    retiredCatalog: !!room.retiredCatalog,
    maxPlayers: MAX_PLAYERS,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    pausedAt: room.pausedAt,
    pausedDurationMs: room.pausedDurationMs,
    stage: room.stage,
    boardLocked: room.boardLocked,
    /** Jigsaw-only helper layout. Positions remain authoritative either way. */
    jigsawLayout: room.jigsawLayout || "scatter",
    revealed: room.revealed,
    timerEndsAt: room.timerEndsAt,
    timerDurationMs: room.timerDurationMs,
    completed: room.completed,
    completedAt: room.completedAt,
    completedInMs: room.completedInMs,
    completionPlayers: room.completionPlayers || [],
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
  if (room.canvas) {
    const isLetter = room.canvas.category === "letter-canvas";
    return {
      image: room.puzzle.image,
      name: room.puzzle.name,
      category: room.puzzle.category,
      credit: room.puzzle.credit,
      license: room.puzzle.license,
      source: room.puzzle.source,
      width: room.puzzle.width,
      height: room.puzzle.height,
      cols: 0,
      rows: 0,
      pieceW: room.puzzle.pieceW,
      pieceH: room.puzzle.pieceH,
      seed: room.seed,
      snapDistance: 0,
      isCanvas: true,
      canvasMode: room.canvas.mode,
      contentLanguage: room.canvas.contentLanguage,
      scenario: room.puzzle.scenario || null,
      sheetW: room.canvas.sheetW,
      sheetH: room.canvas.sheetH,
      tileW: room.canvas.tileW,
      tileH: room.canvas.tileH,
      wordGap: room.canvas.wordGap,
      // Sentence canvas: the client needs the pack to build the word tray.
      sentencePack: isLetter ? undefined : (sentenceVocab[room.canvas.contentLanguage === "ro" ? "ro" : "en"] || []).map((e) => ({ w: e.w, c: e.c, n: e.n })),
    };
  }
  const boardImage = room.retiredCatalog
    ? `/api/retired-images/${encodeURIComponent(room.config.puzzleId)}?room=${encodeURIComponent(room.id)}`
    : room.puzzle.image;
  return {
    image: boardImage,
    name: room.puzzle.name,
    nameRo: room.puzzle.nameRo,
    category: room.puzzle.category,
    credit: room.puzzle.credit,
    license: room.puzzle.license,
    source: room.puzzle.source,
    attribution: room.puzzle.attribution,
    sourceUrl: room.puzzle.sourceUrl,
    licenseUrl: room.puzzle.licenseUrl,
    mystery: room.puzzle.mystery || undefined,
    width: room.puzzle.width,
    height: room.puzzle.height,
    cols: room.puzzle.cols,
    rows: room.puzzle.rows,
    pieceW: room.puzzle.pieceW,
    pieceH: room.puzzle.pieceH,
    seed: room.seed,
    snapDistance: snapDistance(room.puzzle.pieceW, room.puzzle.pieceH),
    wordModeNotice: false,
  };
}

function activePlayerList(room) {
  ensureTeamState(room);
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    role: p.role || "player",
    teamId: p.teamId || null,
    joinedAt: p.joinedAt,
    lastSeenAt: p.lastSeenAt,
  }));
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

function isJigsawRoom(room) {
  return !!room && !room.coachingActivity && !room.canvas && room.pieces.length > 0;
}

function scatterPosition(room) {
  const { width, height } = room.board || room.puzzle;
  return {
    x: -320 + Math.random() * (width + 640),
    y: height + 140 + Math.random() * 680,
  };
}

/**
 * Deterministic help-tray geometry. It intentionally sits below the target,
 * so the target remains easy to inspect while the team names/compares pieces.
 * This mirrors src/puzzle/tray.ts; clients render the server's plain x/y
 * values and never synthesize a fallback position of their own.
 */
function jigsawTrayLayout(room, total) {
  const { width, height, pieceW, pieceH } = room.board || room.puzzle;
  const cellW = pieceW + 24;
  const cellH = pieceH + 24;
  const origin = { x: 0, y: height + 80 };
  const cols = Math.max(1, Math.floor(width / cellW));
  const rows = Math.max(1, Math.ceil(total / cols));
  return { cellW, cellH, origin, cols, rows, width: cols * cellW, height: rows * cellH };
}

/** Full reset/new-puzzle scatter: all jigsaw pieces become unplaced. */
function scatterPieces(room) {
  for (const p of room.pieces) {
    const pos = scatterPosition(room);
    p.x = pos.x;
    p.y = pos.y;
    p.drag = false;
    p.moved = false;
    p.locked = false;
    p.heldBy = null;
    p.heldAt = null;
    p.placedOnSlot = null;
  }
  if (isJigsawRoom(room)) room.jigsawLayout = "scatter";
}

/**
 * Reposition only untouched jigsaw pieces. Moved / locked pieces preserve the
 * team’s work. A piece claimed by another player is left exactly as-is.
 */
function applyJigsawLayout(room, playerId, mode) {
  const candidates = room.pieces
    .filter((piece) => !piece.locked && !piece.moved && (!piece.heldBy || piece.heldBy === playerId))
    .sort((a, b) => a.id - b.id);
  if (mode === "scatter") {
    for (const piece of candidates) {
      const pos = scatterPosition(room);
      piece.x = pos.x;
      piece.y = pos.y;
      // Deliberately keep moved=false; these are still untouched pieces.
    }
  } else {
    const tray = jigsawTrayLayout(room, candidates.length);
    candidates.forEach((piece, index) => {
      piece.x = tray.origin.x + (index % tray.cols) * tray.cellW;
      piece.y = tray.origin.y + Math.floor(index / tray.cols) * tray.cellH;
      // Deliberately keep moved=false; the tray is a help layout, not a move.
    });
  }
  room.jigsawLayout = mode;
  return candidates.map(serializePiece);
}

function normalizeContentLanguage(value, fallback = "en") {
  return CANVAS_CONTENT_LANGUAGES.has(value) ? value : fallback;
}

function buildCanvasState(puzzle, mode, contentLanguage) {
  const isLetter = puzzle.category === "letter-canvas";
  const inventory = isLetter ? buildLetterInventory(mode, contentLanguage) : buildSentenceInventory(contentLanguage);
  return {
    version: 2,
    category: puzzle.category,
    mode,
    contentLanguage,
    sheetW: CANVAS_SHEET_W,
    sheetH: CANVAS_SHEET_H,
    tileW: isLetter ? CANVAS_TILE_W : 0, // sentence tile widths are per-word
    tileH: isLetter ? CANVAS_TILE_H : CANVAS_WORD_H,
    wordGap: isLetter ? 0 : CANVAS_WORD_GAP,
    tiles: new Map(),
    inventory, // Map<text, remaining> or null (sandbox)
    teamInventory: null,
    jokers: new Map(), // teamKey -> remaining joker draws (filled per canvas)
    lanes: buildCanvasLanes(puzzle.category),
    nextId: 1,
    history: new Map(), // playerId -> undo stack
  };
}

function serializeCanvasTile(t) {
  return {
    id: t.id,
    text: t.text,
    kind: t.kind,
    x: t.x,
    y: t.y,
    w: t.w,
    h: t.h,
    flipped: !!t.flipped,
    heldBy: t.heldBy || null,
    createdBy: t.createdBy || null,
    custom: !!t.custom,
    laneId: t.laneId || null,
    laneIndex: Number.isFinite(t.laneIndex) ? t.laneIndex : null,
    teamId: t.teamId || null,
  };
}

function buildPuzzleSetup(config) {
  let puzzle = puzzleById.get(config.puzzleId) || null;
  const coachingActivity = !puzzle ? activityById.get(config.puzzleId) : null;
  // Custom user-uploaded image (room-scoped; the file is deleted when the
  // room is reaped — see reapRoom cleanup).
  if (!puzzle && !coachingActivity && config.customImage) {
    const ci = config.customImage;
    if (typeof ci.url !== "string" || !ci.url.startsWith("/uploads/")) {
      throw new Error("Invalid custom image.");
    }
    if (typeof ci.file !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(ci.file)) {
      throw new Error("Invalid custom image file.");
    }
    puzzle = {
      id: "custom-upload",
      category: "custom",
      image: ci.url,
      name: typeof ci.name === "string" && ci.name.trim() ? ci.name.trim().slice(0, 60) : "Imagine personalizată",
      nameRo: "Imagine personalizată",
      credit: `Upload local — ${typeof ci.by === "string" && ci.by.trim() ? ci.by.trim().slice(0, 24) : "echipa"}`,
      license: "Personal upload (doar pentru această cameră)",
      source: "Upload local (șters la închiderea camerei)",
      attribution: "Imagine încărcată local pentru această sesiune — nu este stocată decât pentru camera curentă.",
      width: Math.min(4096, Math.max(300, Math.round(ci.width) || 1600)),
      height: Math.min(4096, Math.max(300, Math.round(ci.height) || 1000)),
    };
  }
  if (!puzzle && !coachingActivity) throw new Error("Unknown puzzle or activity.");

  if (isCanvasPuzzle(puzzle)) {
    // Canvas modes replace the photo difficulties for these categories.
    if (!CANVAS_MODES.has(config.difficulty)) throw new Error("Unknown canvas mode.");
    const mode = config.difficulty;
    const contentLanguage = normalizeContentLanguage(config.contentLanguage);
    const canvas = buildCanvasState(puzzle, mode, contentLanguage);
    const total = CANVAS_MODES.get(mode) || 0; // 0 = unlimited sandbox
    return {
      config: { puzzleId: puzzle.id, difficulty: mode, total, contentLanguage },
      coachingActivity: null,
      canvas,
      board: { width: canvas.sheetW, height: canvas.sheetH, pieceW: canvas.tileW, pieceH: canvas.tileH },
      rankingSlots: [],
      puzzleMeta: {
        image: puzzle.image, // cover — used in selectors only, never on the sheet
        name: puzzle.name,
        category: puzzle.category,
        credit: puzzle.credit || "",
        license: puzzle.license || "",
        source: puzzle.source || "",
        width: canvas.sheetW,
        height: canvas.sheetH,
        cols: 0,
        rows: 0,
        pieceW: canvas.tileW,
        pieceH: canvas.tileH,
        scenario: puzzle.scenario || null,
        canvasMode: mode,
        contentLanguage,
        isCanvas: true,
      },
      pieces: [],
    };
  }

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

  const dims = puzzle
    ? imageDims[puzzle.image.split("/").pop()] ||
      (puzzle.id === "custom-upload" ? { w: puzzle.width, h: puzzle.height } : { w: 1600, h: 1000 })
    : { w: 0, h: 0 };
  const grid = computeGrid(dims.w, dims.h, difficulty.pieces);
  const pieces = [];

  if (coachingActivity?.mode === "ranking") {
    coachingActivity.items.forEach((_item, id) => pieces.push({ id, x: 0, y: 0, correctX: 0, correctY: 0, drag: false, moved: false, locked: false, heldBy: null, heldAt: null, placedOnSlot: null }));
  } else if (!coachingActivity) {
    for (let id = 0; id < difficulty.pieces; id++) {
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
      });
    }
  }

  return {
    config: {
      puzzleId: coachingActivity ? coachingActivity.id : puzzle.id,
      difficulty: difficulty.id,
      total,
      contentLanguage: null,
      customImage: config.customImage || undefined,
    },
    coachingActivity: coachingActivity || null,
    canvas: null,
    board,
    rankingSlots,
    puzzleMeta: {
      image: coachingActivity ? coachingActivity.cover : puzzle.image,
      name: coachingActivity ? coachingActivity.name : puzzle.name,
      nameRo: puzzle?.nameRo || undefined,
      category: coachingActivity ? "coaching" : puzzle.category,
      credit: puzzle?.credit || "",
      license: puzzle?.license || "",
      source: puzzle?.source || "",
      attribution: puzzle?.attribution || undefined,
      sourceUrl: puzzle?.sourceUrl || undefined,
      licenseUrl: puzzle?.licenseUrl || undefined,
      mystery: !coachingActivity ? !!config.mystery : undefined,
      width: board ? board.width : dims.w,
      height: board ? board.height : dims.h,
      cols: layout ? layout.cols : grid.cols,
      rows: layout ? layout.rows : grid.rows,
      pieceW: board ? board.pieceW : grid.pieceW,
      pieceH: board ? board.pieceH : grid.pieceH,
      scenario: null,
      canvasMode: null,
      contentLanguage: null,
      isCanvas: false,
    },
    pieces,
  };
}

function resetWorkshopState(room, { lobby = true } = {}) {
  room.ratings.clear();
  room.scores.clear();
  if (room.canvas) resetCanvasState(room);
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
  // Any host-selected activity comes from the reviewed active catalog.
  room.retiredCatalog = false;
  room.config = setup.config;
  room.coachingActivity = setup.coachingActivity;
  room.canvas = setup.canvas;
  if (room.canvas) applyCanvasTeamModel(room, { resetInventory: true });
  else {
    // Colour lanes/banks are a Canvas collaboration mechanic, not a misleading
    // jigsaw/coaching start gate. Switching away from Canvas clears it safely.
    room.teamMode = TEAM_MODE_SHARED;
    room.teams = [];
    ensureTeamState(room);
  }
  room.board = setup.board;
  room.rankingSlots = setup.rankingSlots;
  room.puzzle = setup.puzzleMeta;
  room.pieces = setup.pieces;
  room.seed = crypto.randomInt(1, 2 ** 31);
  // Track the uploaded file (if any) so it is deleted when the room is reaped.
  room.customImageFile =
    setup.puzzleMeta && setup.puzzleMeta.image && setup.puzzleMeta.image.startsWith("/uploads/")
      ? path.basename(config.customImage?.file || "")
      : null;
  if (room.pieces.length) scatterPieces(room);
  resetWorkshopState(room, { lobby: true });
}

/** Clears tiles and restores the full inventory (used by reset / puzzle switch). */
function resetCanvasState(room) {
  if (!room.canvas) return;
  room.canvas.tiles.clear();
  room.canvas.nextId = 1;
  room.canvas.history.clear();
  applyCanvasTeamModel(room, { resetInventory: true });
}

function createRoom(config, creator = {}) {
  const now = Date.now();
  const room = {
    id: crypto.randomUUID(),
    code: generateCode(),
    sessionName: String(creator.sessionName || "").trim().slice(0, 80) || "Team session",
    hostId: null,
    teamMode: normalizeTeamMode(config.teamMode),
    teams: buildTeams(config.teamMode, config.teamCount),
    config: null,
    coachingActivity: null,
    canvas: null,
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
    // Default is hard: untouched pieces use their scattered server positions.
    jigsawLayout: "scatter",
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
    teamMode: room.teamMode, teams: room.teams,
    config: room.config, pieces: room.pieces.map(serializePiece),
    canvas: room.canvas ? {
      version: room.canvas.version || 1,
      category: room.canvas.category, mode: room.canvas.mode, contentLanguage: room.canvas.contentLanguage,
      sheetW: room.canvas.sheetW, sheetH: room.canvas.sheetH, tileW: room.canvas.tileW, tileH: room.canvas.tileH,
      wordGap: room.canvas.wordGap, nextId: room.canvas.nextId, lanes: room.canvas.lanes || [],
      tiles: [...room.canvas.tiles.values()].map(serializeCanvasTile),
      inventory: room.canvas.inventory ? [...room.canvas.inventory] : null,
      teamInventory: room.canvas.teamInventory ? [...room.canvas.teamInventory.entries()].map(([teamId, inventory]) => [teamId, inventory ? [...inventory] : null]) : null,
      jokers: room.canvas.jokers ? [...room.canvas.jokers.entries()] : null,
    } : null,
    ratings: [...room.ratings], scores: [...room.scores],
    knownPlayers: [...room.knownPlayers], createdAt: room.createdAt, startedAt: room.startedAt,
    pausedAt: room.pausedAt, pausedDurationMs: room.pausedDurationMs, timerEndsAt: room.timerEndsAt,
    timerDurationMs: room.timerDurationMs, lastActivityAt: room.lastActivityAt, stage: room.stage,
    boardLocked: room.boardLocked, jigsawLayout: room.jigsawLayout || "scatter", revealed: room.revealed, celebrationMode: room.celebrationMode,
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

/**
 * Delisted items are never selectable in a new room. Existing short-lived
 * snapshot rooms instead receive a private archival image route so a session
 * that was already underway does not turn into a broken board after catalog
 * cleanup. Its next activity selection naturally uses the reviewed catalog.
 */
function applyRetiredSnapshotPuzzle(room, raw, retiredPuzzle) {
  const entry = retiredEntryByPuzzleId.get(retiredPuzzle.id) || {};
  const width = Number(entry.width) || 1800;
  const height = Number(entry.height) || 1200;
  const total = Number(raw.config?.total) || raw.pieces?.length || 25;
  const grid = computeGrid(width, height, total);
  room.config = { ...raw.config, total };
  room.coachingActivity = null;
  room.canvas = null;
  room.board = { width, height, pieceW: grid.pieceW, pieceH: grid.pieceH };
  room.rankingSlots = [];
  room.puzzle = {
    ...retiredPuzzle,
    image: `/api/retired-images/${encodeURIComponent(retiredPuzzle.id)}`,
    thumbnail: `/api/retired-images/${encodeURIComponent(retiredPuzzle.id)}`,
    width,
    height,
    cols: grid.cols,
    rows: grid.rows,
    pieceW: grid.pieceW,
    pieceH: grid.pieceH,
    mystery: !!raw.config?.mystery,
    scenario: null,
    canvasMode: null,
    contentLanguage: null,
    isCanvas: false,
  };
  room.retiredCatalog = true;
}

function restoreSnapshots() {
  try {
    const saved = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    const now = Date.now();
    for (const raw of saved) {
      if (!raw?.id || now - raw.lastActivityAt > ROOM_TTL_MS) continue;
      try {
        // A custom-upload room whose image file was deleted can no longer be served.
        if (raw.config?.customImage && !fs.existsSync(path.join(uploadsDir, path.basename(String(raw.config.customImage.file || ""))))) continue;
        const retiredPuzzle = retiredPuzzleById.get(raw.config?.puzzleId);
        // Bootstrap the generic room machinery with a reviewed item, then
        // restore the retired item metadata/pieces below without publishing it.
        const fallbackPuzzle = PUZZLES.find((puzzle) => !isCanvasPuzzle(puzzle)) || PUZZLES[0];
        const bootstrapConfig = retiredPuzzle
          ? { ...raw.config, puzzleId: fallbackPuzzle.id, difficulty: raw.config?.difficulty || "easy" }
          : raw.config;
        const room = createRoom(bootstrapConfig, { sessionName: raw.sessionName });
        if (retiredPuzzle) applyRetiredSnapshotPuzzle(room, raw, retiredPuzzle);
        rooms.delete(room.id);
        codeIndex.delete(room.code);
      room.id = raw.id;
      room.code = raw.code;
      room.hostId = raw.hostId;
      room.teamMode = normalizeTeamMode(raw.teamMode);
      room.teams = Array.isArray(raw.teams) ? raw.teams : [];
      room.knownPlayers = new Map(raw.knownPlayers || []);
      ensureTeamState(room);
      room.pieces = (raw.pieces || room.pieces).map((p) => ({ ...p, heldBy: null, heldAt: null, drag: false }));
      if (room.canvas && raw.canvas) {
        room.canvas.tiles = new Map((raw.canvas.tiles || []).map((t) => [t.id, { ...t, heldBy: null, heldAt: null }]));
        // Explicit v1 migration: do not reshuffle a lived-in legacy blank sheet.
        room.canvas.version = raw.canvas.version === 2 ? 2 : 1;
        room.canvas.lanes = room.canvas.version === 2 && Array.isArray(raw.canvas.lanes) ? raw.canvas.lanes : [];
        room.canvas.inventory = raw.canvas.inventory ? new Map(raw.canvas.inventory) : null;
        room.canvas.teamInventory = raw.canvas.teamInventory
          ? new Map(raw.canvas.teamInventory.map(([teamId, inventory]) => [teamId, inventory ? new Map(inventory) : null]))
          : null;
        room.canvas.jokers = raw.canvas.jokers ? new Map(raw.canvas.jokers) : null;
        if (!room.canvas.jokers) resetCanvasJokers(room);
        room.canvas.nextId = raw.canvas.nextId || (room.canvas.tiles.size + 1);
      }
      room.ratings = new Map(raw.ratings || []);
      room.scores = new Map(raw.scores || []);
      Object.assign(room, {
        createdAt: raw.createdAt, startedAt: raw.startedAt, pausedAt: raw.pausedAt,
        pausedDurationMs: raw.pausedDurationMs || 0, timerEndsAt: raw.timerEndsAt,
        timerDurationMs: raw.timerDurationMs, lastActivityAt: raw.lastActivityAt,
        stage: raw.stage || "lobby", boardLocked: raw.boardLocked ?? true,
        jigsawLayout: raw.jigsawLayout === "tray" ? "tray" : "scatter",
        revealed: !!raw.revealed, celebrationMode: raw.celebrationMode || "team",
        facilitatorNotes: raw.facilitatorNotes || "", insights: raw.insights || room.insights,
        debriefNotes: raw.debriefNotes || [], actions: raw.actions || [], chat: raw.chat || [],
        completed: !!raw.completed, completedAt: raw.completedAt, completedInMs: raw.completedInMs,
        completionPlayers: raw.completionPlayers || [],
      });
      rooms.set(room.id, room);
      codeIndex.set(room.code, room.id);
      } catch (err) {
        // One unrestorable snapshot must never block the rest.
        console.error("Skipping unrestorable room snapshot", raw?.id, err?.message || err);
      }
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

/**
 * Expire claims independently from the 30s WebSocket heartbeat. A held item
 * must become usable soon after its TTL even when a browser vanished without a
 * close frame (a common mobile backgrounding path).
 */
function expireClaims(room, now = Date.now()) {
  const expiredPieces = [];
  for (const piece of room.pieces) {
    if (piece.heldBy && now - Number(piece.heldAt || 0) >= CLAIM_TTL_MS) {
      piece.heldBy = null;
      piece.heldAt = null;
      piece.drag = false;
      expiredPieces.push(serializePiece(piece));
    }
  }
  if (expiredPieces.length) broadcast(room, { t: "pieces", list: expiredPieces });

  const expiredTiles = [];
  if (room.canvas) {
    for (const tile of room.canvas.tiles.values()) {
      if (tile.heldBy && now - Number(tile.heldAt || 0) >= CANVAS_CLAIM_TTL_MS) {
        const origin = takeCanvasDragOrigin(tile);
        if (origin) {
          tile.x = origin.x;
          tile.y = origin.y;
          tile.laneId = origin.laneId;
          tile.laneIndex = origin.laneIndex;
        }
        tile.heldBy = null;
        tile.heldAt = null;
        const restored = origin?.laneId ? layoutCanvasLane(room.canvas, origin.laneId) : [tile];
        expiredTiles.push(...restored.map(serializeCanvasTile));
      }
    }
    if (expiredTiles.length) broadcast(room, { t: "canvas", list: expiredTiles });
  }
  if (expiredPieces.length || expiredTiles.length) scheduleSnapshot();
  return { expiredPieces, expiredTiles };
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
  if (room.canvas) {
    const canvasReleased = [];
    for (const tile of room.canvas.tiles.values()) {
      if (tile.heldBy === playerId) {
        const origin = takeCanvasDragOrigin(tile);
        if (origin) {
          tile.x = origin.x;
          tile.y = origin.y;
          tile.laneId = origin.laneId;
          tile.laneIndex = origin.laneIndex;
        }
        tile.heldBy = null;
        tile.heldAt = null;
        const restored = origin?.laneId ? layoutCanvasLane(room.canvas, origin.laneId) : [tile];
        canvasReleased.push(...restored.map(serializeCanvasTile));
      }
    }
    if (canvasReleased.length) broadcast(room, { t: "canvas", list: canvasReleased });
  }
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
  if (room.completed || room.coachingActivity || room.canvas || !room.startedAt) return;
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

/** Participant-safe team selection. Team membership is mutable only in the
 * lobby; facilitator reassignment is a separate host-only control action. */
function applyTeamAction(room, playerId, msg, ws) {
  if (msg.action !== "select") {
    send(ws, { t: "error", code: "unknown_team_action", message: "Unknown team action." });
    return;
  }
  ensureTeamState(room);
  if (!room.canvas) {
    send(ws, { t: "error", code: "team_mode_unavailable", message: "Colour teams are available for Canvas activities." });
    return;
  }
  const player = room.players.get(playerId);
  if (!player || player.role === "spectator") {
    send(ws, { t: "error", code: "team_spectator", message: "Spectators cannot join a colour team." });
    return;
  }
  if (room.teamMode !== TEAM_MODE_COLOR) {
    send(ws, { t: "error", code: "team_mode_shared", message: "This room uses one shared team." });
    return;
  }
  if (room.stage !== "lobby") {
    send(ws, { t: "error", code: "team_selection_locked", message: "Team selection is locked after Start." });
    return;
  }
  const teamId = String(msg.teamId || "");
  if (!room.teams.some((team) => team.id === teamId)) {
    send(ws, { t: "error", code: "team_missing", message: "That team is not available in this room." });
    return;
  }
  assignPlayerTeam(room, playerId, teamId);
  touch(room);
  broadcast(room, { t: "players", list: activePlayerList(room) });
  broadcastRoom(room);
  logEvent("team_select", room, { playerId, teamId });
}

function applyControl(room, playerId, msg, ws) {
  if (!requireHostSocket(room, playerId, ws)) return;
  const now = Date.now();
  switch (msg.action) {
    case "teams": {
      if (!room.canvas) {
        return send(ws, { t: "error", code: "team_mode_unavailable", message: "Colour teams are available for Canvas activities." });
      }
      if (room.stage !== "lobby") {
        return send(ws, { t: "error", code: "team_configuration_locked", message: "Configure teams before Start." });
      }
      room.teamMode = normalizeTeamMode(msg.mode);
      room.teams = buildTeams(room.teamMode, msg.count);
      ensureTeamState(room);
      // This control is lobby-only, so rebuilding empty v2 lanes/banks cannot
      // erase a live composition or silently reassign an in-play tile.
      if (room.canvas) applyCanvasTeamModel(room, { resetInventory: true });
      broadcast(room, { t: "players", list: activePlayerList(room) });
      break;
    }
    case "teamAssign": {
      if (!room.canvas) {
        return send(ws, { t: "error", code: "team_mode_unavailable", message: "Colour teams are available for Canvas activities." });
      }
      const targetId = String(msg.playerId || "");
      const target = room.players.get(targetId) || room.knownPlayers.get(targetId);
      if (!target || target.role === "spectator") {
        return send(ws, { t: "error", code: "team_member_missing", message: "Choose an active participant." });
      }
      const teamId = String(msg.teamId || "");
      if (room.teamMode !== TEAM_MODE_COLOR || !room.teams.some((team) => team.id === teamId)) {
        return send(ws, { t: "error", code: "team_missing", message: "That team is not available in this room." });
      }
      assignPlayerTeam(room, targetId, teamId);
      broadcast(room, { t: "players", list: activePlayerList(room) });
      break;
    }
    case "start":
      ensureTeamState(room);
      if (room.teamMode === TEAM_MODE_COLOR) {
        const unassigned = [...room.players.values()].filter((player) => player.role !== "spectator" && !player.teamId);
        if (unassigned.length) return send(ws, { t: "error", code: "teams_incomplete", message: "Assign every active participant to a team before Start." });
      }
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
    case "complete": {
      // Canvas sessions are completed by the facilitator, never by placement.
      if (!room.canvas) return send(ws, { t: "error", code: "not_canvas", message: "Only letter/sentence canvas sessions use Complete." });
      if (room.completed) return;
      room.completed = true;
      room.completedAt = now;
      room.completedInMs = elapsedMs(room, now);
      room.boardLocked = true;
      room.completionPlayers = activePlayerList(room).filter((p) => p.role !== "spectator").map((p) => p.name);
      const canvasText = reconstructCanvasText([...room.canvas.tiles.values()]);
      broadcast(room, {
        t: "completion",
        room: roomView(room),
        players: room.completionPlayers,
        scores: scoreList(room),
        canvasText,
        canvasTiles: [...room.canvas.tiles.values()].map(serializeCanvasTile),
      });
      logEvent("complete", room, { durationMs: room.completedInMs, tiles: room.canvas.tiles.size });
      touch(room);
      return;
    }
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
  const canvas = room.canvas ? {
    version: room.canvas.version || 1,
    mode: room.canvas.mode,
    contentLanguage: room.canvas.contentLanguage,
    lanes: room.canvas.lanes || [],
    text: reconstructCanvasText([...room.canvas.tiles.values()]),
    tiles: [...room.canvas.tiles.values()].map(serializeCanvasTile),
  } : null;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    session: { id: room.id, name: room.sessionName, activityId: room.config.puzzleId, stage: room.stage, startedAt: room.startedAt, durationMs: elapsedMs(room) },
    teams: { mode: room.teamMode || TEAM_MODE_SHARED, list: teamViews(room) },
    participants: [...room.knownPlayers.entries()].map(([id, p]) => ({ id, name: p.name, role: p.role || "player", teamId: p.teamId || null })),
    ranking,
    deviationScore,
    canvas,
    profiles: [...room.ratings.entries()].filter(([, r]) => r.done).map(([playerId, r]) => ({ playerId, profileCode: r.profileCode })),
    insights: room.insights,
    debriefNotes: room.debriefNotes,
    actions: room.actions,
    facilitatorNotes: room.facilitatorNotes,
  };
}

// ---------------------------------------------------------------------------
// Canvas operations (letter + sentence). The server is authoritative for
// every tile: claims, inventory, snapping, duplication, deletion, undo.
// ---------------------------------------------------------------------------

function canvasGuard(room, playerId, ws) {
  const canvas = room.canvas;
  if (!canvas) return null;
  if (room.completed) { send(ws, { t: "error", code: "room_completed", message: "The session is complete — the canvas is frozen." }); return null; }
  if (room.stage !== "play" || room.boardLocked) { send(ws, { t: "error", code: "board_locked", message: "The board is locked by the facilitator." }); return null; }
  const player = room.players.get(playerId);
  if (!player || player.role === "spectator") { send(ws, { t: "error", code: "spectator", message: "Spectators can't touch the canvas." }); return null; }
  if (room.teamMode === TEAM_MODE_COLOR && !player.teamId) {
    send(ws, { t: "error", code: "team_required", message: "Choose a colour team before using the canvas." });
    return null;
  }
  return canvas;
}

function canvasBroadcast(room, { list = [], removed = [], inventory = false } = {}) {
  const payload = { t: "canvas" };
  if (list.length) payload.list = list;
  if (removed.length) payload.removed = removed;
  if (inventory && room.canvas) {
    payload.inventory = room.canvas.inventory ? Object.fromEntries(room.canvas.inventory) : null;
    payload.teamInventory = canvasTeamInventoryPayload(room.canvas);
    payload.jokers = canvasJokersPayload(room.canvas);
  }
  if (!list.length && !removed.length && payload.inventory === undefined && payload.teamInventory === undefined && payload.jokers === undefined) return;
  broadcast(room, payload);
}

function takeCanvasInventory(inventory, text) {
  if (!inventory) return true; // sandbox = unlimited
  const left = inventory.get(text) || 0;
  if (left <= 0) return false;
  inventory.set(text, left - 1);
  return true;
}

function returnCanvasInventory(inventory, text) {
  if (!inventory) return;
  inventory.set(text, (inventory.get(text) || 0) + 1);
}

function inventoryForCanvasTile(room, canvas, tile) {
  if (room.teamMode !== TEAM_MODE_COLOR) return canvas.inventory;
  return tile.teamId ? canvas.teamInventory?.get(tile.teamId) || null : null;
}

function canvasTileAllowed(room, playerId, tile, ws) {
  if (room.teamMode !== TEAM_MODE_COLOR || !tile.teamId || isHost(room, playerId)) return true;
  if (tile.teamId === playerTeamId(room, playerId)) return true;
  send(ws, { t: "error", code: "team_tile_locked", message: "This tile belongs to another colour team." });
  return false;
}

/** Keep the first position of an active drag so cancel/undo means what a
 * participant expects even after many throttled drag frames reached the server. */
function rememberCanvasDragOrigin(tile) {
  if (!tile.dragOrigin) {
    tile.dragOrigin = {
      x: tile.x,
      y: tile.y,
      laneId: tile.laneId || null,
      laneIndex: tile.laneIndex ?? null,
    };
  }
}

function takeCanvasDragOrigin(tile) {
  const origin = tile.dragOrigin || null;
  delete tile.dragOrigin;
  return origin;
}

function clearCanvasDragOrigin(tile) {
  delete tile.dragOrigin;
}

function pushCanvasHistory(canvas, playerId, entry) {
  const stack = canvas.history.get(playerId) || [];
  stack.push(entry);
  while (stack.length > CANVAS_UNDO_DEPTH) stack.shift();
  canvas.history.set(playerId, stack);
}

function spawnCanvasTile(canvas, text, kind, opts) {
  const isLetter = canvas.category === "letter-canvas";
  const id = canvas.nextId++;
  const tile = {
    id,
    text,
    kind,
    x: opts.x,
    y: opts.y,
    w: isLetter ? canvas.tileW : canvasWordWidth(text, kind),
    h: canvas.tileH,
    flipped: false,
    heldBy: opts.heldBy || null,
    heldAt: opts.heldBy ? Date.now() : null,
    createdBy: opts.createdBy || null,
    custom: !!opts.custom,
    laneId: opts.laneId || null,
    laneIndex: Number.isFinite(opts.laneIndex) ? opts.laneIndex : null,
    teamId: opts.teamId || null,
  };
  clampCanvasTile(canvas, tile);
  canvas.tiles.set(id, tile);
  return tile;
}

function applyCanvasOp(room, playerId, msg, ws) {
  const canvas = canvasGuard(room, playerId, ws);
  if (!canvas) return;
  const now = Date.now();
  // Resolve a stale Canvas claim before evaluating the next client operation.
  // This mirrors classic-piece semantics and avoids a 30-second dead tile.
  expireClaims(room, now);
  const isLetter = canvas.category === "letter-canvas";
  const ownTeamId = playerTeamId(room, playerId);
  const playerInventory = teamInventoryFor(room, canvas, playerId);
  let inventoryChanged = false;
  const list = [];
  const removed = [];

  const claimBlocked = (tile) => tile.heldBy && tile.heldBy !== playerId && now - (tile.heldAt || 0) < CANVAS_CLAIM_TTL_MS;
  const rejectClaimed = (tile) => send(ws, { t: "canvasRejected", reason: "held", ownerId: tile.heldBy, tile: serializeCanvasTile(tile) });

  switch (msg.op) {
    case "spawn": {
      const raw = nfc(String(msg.text || ""));
      let text;
      let kind;
      if (isLetter) {
        if (raw.length !== 1) { send(ws, { t: "error", code: "bad_letter", message: "One letter per tile." }); return; }
        const alphabet = CANVAS_LETTER_SETS[canvas.contentLanguage];
        if (raw === CANVAS_WILDCARD) { text = CANVAS_WILDCARD; kind = "wildcard"; }
        else if (CANVAS_PUNCT_SET.includes(raw)) { text = raw; kind = "punctuation"; }
        else if (alphabet.includes(raw.toUpperCase())) { text = raw.toUpperCase(); kind = "letter"; }
        else { send(ws, { t: "error", code: "letter_unavailable", message: "This letter is not available in the selected content language." }); return; }
      } else {
        const custom = !!msg.custom;
        if (custom) {
          const trimmed = raw.replace(/\s+/g, " ").trim();
          if (!trimmed || trimmed.length > CANVAS_MAX_CUSTOM_LEN) { send(ws, { t: "error", code: "bad_word", message: "Custom words must be 1–40 characters." }); return; }
          text = trimmed;
          kind = "custom";
        } else if (CANVAS_PUNCT_SET.includes(raw)) {
          text = raw;
          kind = "punctuation";
        } else if (playerInventory?.has(raw)) {
          text = raw;
          kind = "word";
        } else {
          send(ws, { t: "error", code: "word_unavailable", message: "This word is not in the vocabulary pack." });
          return;
        }
      }
      if (kind !== "custom") {
        if (!takeCanvasInventory(playerInventory, text)) {
          inventoryChanged = true;
          send(ws, { t: "canvasRejected", reason: "inventory", text });
          return;
        }
        inventoryChanged = true;
      }
      const jitter = ((canvas.nextId * 137) % 90) - 45;
      const baseX = Number.isFinite(Number(msg.x)) ? Number(msg.x) : canvas.sheetW / 2;
      const baseY = Number.isFinite(Number(msg.y)) ? Number(msg.y) : canvas.sheetH / 2;
      const requestedLaneId = canvas.version >= 2 && typeof msg.laneId === "string" ? msg.laneId : null;
      const requestedLane = requestedLaneId ? (canvas.lanes || []).find((lane) => lane.id === requestedLaneId) : null;
      if (requestedLaneId && (!requestedLane || (room.teamMode === TEAM_MODE_COLOR && requestedLane.teamId !== ownTeamId))) {
        send(ws, { t: "error", code: "lane_unavailable", message: "That composition lane is not available to your team." });
        if (kind !== "custom") returnCanvasInventory(playerInventory, text);
        return;
      }
      const tile = spawnCanvasTile(canvas, text, kind, {
        x: baseX + jitter, y: baseY + jitter,
        heldBy: requestedLane ? null : playerId, createdBy: playerId, custom: kind === "custom", teamId: ownTeamId,
      });
      pushCanvasHistory(canvas, playerId, { op: "spawn", id: tile.id, fromInventory: !tile.custom });
      if (requestedLane) {
        const changed = setCanvasTileLane(canvas, tile, requestedLane.id, msg.laneIndex);
        list.push(...(changed || []).map(serializeCanvasTile));
      } else list.push(serializeCanvasTile(tile));
      break;
    }
    case "joker": {
      if (!isLetter) { send(ws, { t: "error", code: "joker_letter_only", message: "The joker is a Letter Canvas surprise draw." }); return; }
      const key = canvasJokerKey(room, playerId);
      const remaining = key ? (canvas.jokers?.get(key) ?? 0) : 0;
      if (!key || remaining <= 0) {
        send(ws, { t: "canvasRejected", reason: "joker_exhausted" });
        return;
      }
      // Pick a genuinely random letter from the content-language alphabet. When
      // the bank is finite, prefer letters that are still in stock so the draw
      // is always usable; sandbox mode is unlimited.
      const alphabet = CANVAS_LETTER_SETS[canvas.contentLanguage] || CANVAS_LETTER_SETS.en;
      const available = [...alphabet].filter((ch) => {
        if (!playerInventory) return true; // unlimited sandbox
        return (playerInventory.get(ch) || 0) > 0;
      });
      const pool = available.length ? available : [...alphabet];
      const text = pool[Math.floor(Math.random() * pool.length)];
      if (!takeCanvasInventory(playerInventory, text)) {
        send(ws, { t: "canvasRejected", reason: "inventory", text });
        return;
      }
      inventoryChanged = true;
      canvas.jokers.set(key, remaining - 1);
      const jitterX = ((canvas.nextId * 53) % 160) - 80;
      const jitterY = ((canvas.nextId * 97) % 90) - 45;
      const tile = spawnCanvasTile(canvas, text, "letter", {
        // Place it large/open on the sheet (not into a lane) so the surprise
        // letter lands front and centre for the team to decide what to do with.
        x: canvas.sheetW / 2 + jitterX,
        y: canvas.sheetH * 0.4 + jitterY,
        heldBy: playerId,
        createdBy: playerId,
        teamId: ownTeamId,
      });
      pushCanvasHistory(canvas, playerId, { op: "spawn", id: tile.id, fromInventory: true });
      list.push(serializeCanvasTile(tile));
      break;
    }
    case "place": {
      if (canvas.version < 2) { send(ws, { t: "error", code: "canvas_legacy", message: "This restored canvas uses the legacy freeform layout." }); return; }
      const tile = canvas.tiles.get(Number(msg.id));
      if (!tile) { send(ws, { t: "error", code: "tile_missing", message: "Tile not found." }); return; }
      if (!canvasTileAllowed(room, playerId, tile, ws)) return;
      if (claimBlocked(tile)) { rejectClaimed(tile); return; }
      const laneId = String(msg.laneId || "");
      const lane = (canvas.lanes || []).find((item) => item.id === laneId);
      if (!lane || (room.teamMode === TEAM_MODE_COLOR && lane.teamId !== ownTeamId)) {
        send(ws, { t: "error", code: "lane_unavailable", message: "That composition lane is not available to your team." });
        return;
      }
      const previous = takeCanvasDragOrigin(tile) || { laneId: tile.laneId || null, laneIndex: tile.laneIndex ?? null, x: tile.x, y: tile.y };
      tile.heldBy = null;
      tile.heldAt = null;
      const changed = setCanvasTileLane(canvas, tile, laneId, msg.laneIndex) || [];
      pushCanvasHistory(canvas, playerId, { op: "place", id: tile.id, previous });
      list.push(...changed.map(serializeCanvasTile));
      break;
    }
    case "move": {
      const tile = canvas.tiles.get(Number(msg.id));
      if (!tile) { send(ws, { t: "error", code: "tile_missing", message: "Tile not found." }); return; }
      if (!canvasTileAllowed(room, playerId, tile, ws)) return;
      const x = Math.max(-2000, Math.min(canvas.sheetW + 2000, Number(msg.x) || 0));
      const y = Math.max(-2000, Math.min(canvas.sheetH + 2000, Number(msg.y) || 0));
      const cancelling = !msg.drag && msg.cancel === true;
      if (cancelling) {
        if (tile.heldBy !== playerId) {
          // A terminal browser event can race the initial claim frame. Do not
          // accept an unclaimed cancellation; send authoritative state back.
          send(ws, { t: "canvas", list: [serializeCanvasTile(tile)] });
          return;
        }
        const origin = takeCanvasDragOrigin(tile);
        tile.x = origin?.x ?? x;
        tile.y = origin?.y ?? y;
        tile.laneId = origin?.laneId ?? tile.laneId ?? null;
        tile.laneIndex = origin?.laneIndex ?? tile.laneIndex ?? null;
        tile.heldBy = null;
        tile.heldAt = null;
        if (canvas.version === 2 && tile.laneId) list.push(...layoutCanvasLane(canvas, tile.laneId).map(serializeCanvasTile));
        else clampCanvasTile(canvas, tile);
        // No sentence snapping/history entry on cancellation. A browser loss
        // restores the pre-drag state rather than becoming a composition move.
      } else if (msg.drag) {
        if (claimBlocked(tile)) { rejectClaimed(tile); return; }
        if (tile.heldBy !== playerId) rememberCanvasDragOrigin(tile);
        tile.heldBy = playerId;
        tile.heldAt = now;
        tile.x = x;
        tile.y = y;
        clampCanvasTile(canvas, tile);
      } else {
        if (claimBlocked(tile)) { rejectClaimed(tile); return; }
        const origin = takeCanvasDragOrigin(tile);
        const prevX = origin?.x ?? tile.x;
        const prevY = origin?.y ?? tile.y;
        const prevLaneId = origin?.laneId ?? (tile.laneId || null);
        const prevLaneIndex = origin?.laneIndex ?? tile.laneIndex ?? null;
        tile.x = x;
        tile.y = y;
        tile.heldBy = null;
        tile.heldAt = null;
        if (!isLetter) snapSentenceTile(canvas, tile);
        else clampCanvasTile(canvas, tile);
        // A normal freeform drop deliberately leaves a semantic lane. The
        // client uses `place` for a drop inside a lane, so lane membership is
        // never inferred from a coordinate on the server.
        if (canvas.version === 2 && prevLaneId) {
          tile.laneId = null;
          tile.laneIndex = null;
          list.push(...layoutCanvasLane(canvas, prevLaneId).map(serializeCanvasTile));
        }
        pushCanvasHistory(canvas, playerId, { op: "move", id: tile.id, prevX, prevY, prevLaneId, prevLaneIndex });
      }
      list.push(serializeCanvasTile(tile));
      break;
    }
    case "flip": {
      const tile = canvas.tiles.get(Number(msg.id));
      if (!tile) return;
      if (!canvasTileAllowed(room, playerId, tile, ws)) return;
      if (claimBlocked(tile)) { rejectClaimed(tile); return; }
      clearCanvasDragOrigin(tile);
      tile.flipped = !tile.flipped;
      pushCanvasHistory(canvas, playerId, { op: "flip", id: tile.id, was: !tile.flipped });
      list.push(serializeCanvasTile(tile));
      break;
    }
    case "duplicate": {
      const tile = canvas.tiles.get(Number(msg.id));
      if (!tile) return;
      if (!canvasTileAllowed(room, playerId, tile, ws)) return;
      if (claimBlocked(tile)) { rejectClaimed(tile); return; }
      clearCanvasDragOrigin(tile);
      const tileInventory = inventoryForCanvasTile(room, canvas, tile);
      if (!tile.custom) {
        if (!takeCanvasInventory(tileInventory, tile.text)) {
          send(ws, { t: "canvasRejected", reason: "inventory", text: tile.text });
          return;
        }
        inventoryChanged = true;
      }
      const gap = Math.max(canvas.wordGap, 20);
      const candidates = [
        { x: tile.x + tile.w + gap, y: tile.y },
        { x: tile.x, y: tile.y + tile.h + 20 },
        { x: tile.x - tile.w - gap, y: tile.y },
        { x: 24, y: (tile.y + tile.h + 20) % Math.max(1, canvas.sheetH - tile.h - 24) },
      ];
      let pos = candidates[0];
      for (const c of candidates) {
        if (c.x >= 0 && c.y >= 0 && c.x + tile.w <= canvas.sheetW && c.y + tile.h <= canvas.sheetH) { pos = c; break; }
      }
      const copy = spawnCanvasTile(canvas, tile.text, tile.kind, {
        x: pos.x, y: pos.y, heldBy: tile.laneId ? null : playerId, createdBy: playerId, custom: tile.custom, teamId: tile.teamId,
      });
      pushCanvasHistory(canvas, playerId, { op: "duplicate", id: copy.id, fromInventory: !copy.custom });
      if (canvas.version === 2 && tile.laneId) {
        const changed = setCanvasTileLane(canvas, copy, tile.laneId, (tile.laneIndex ?? 0) + 1) || [];
        list.push(...changed.map(serializeCanvasTile));
      } else list.push(serializeCanvasTile(copy));
      break;
    }
    case "edit": {
      const tile = canvas.tiles.get(Number(msg.id));
      if (!tile || !tile.custom) { send(ws, { t: "error", code: "not_custom", message: "Only custom word tiles can be edited." }); return; }
      if (!canvasTileAllowed(room, playerId, tile, ws)) return;
      if (claimBlocked(tile)) { rejectClaimed(tile); return; }
      clearCanvasDragOrigin(tile);
      const next = nfc(String(msg.text || "")).replace(/\s+/g, " ").trim();
      if (!next || next.length > CANVAS_MAX_CUSTOM_LEN) { send(ws, { t: "error", code: "bad_word", message: "Custom words must be 1–40 characters." }); return; }
      const prevText = tile.text;
      const prevW = tile.w;
      tile.text = next;
      tile.w = canvasWordWidth(next, "custom");
      clampCanvasTile(canvas, tile);
      pushCanvasHistory(canvas, playerId, { op: "edit", id: tile.id, prevText, prevW });
      if (canvas.version === 2 && tile.laneId) list.push(...layoutCanvasLane(canvas, tile.laneId).map(serializeCanvasTile));
      else list.push(serializeCanvasTile(tile));
      break;
    }
    case "delete": {
      const tile = canvas.tiles.get(Number(msg.id));
      if (!tile) return;
      if (!canvasTileAllowed(room, playerId, tile, ws)) return;
      const isOwner = tile.createdBy === playerId;
      if (!isOwner && claimBlocked(tile)) { rejectClaimed(tile); return; }
      clearCanvasDragOrigin(tile);
      const snapshot = serializeCanvasTile(tile);
      const formerLaneId = tile.laneId || null;
      canvas.tiles.delete(tile.id);
      if (!tile.custom) { returnCanvasInventory(inventoryForCanvasTile(room, canvas, tile), tile.text); inventoryChanged = true; }
      if (canvas.version === 2 && formerLaneId) list.push(...layoutCanvasLane(canvas, formerLaneId).map(serializeCanvasTile));
      removed.push(tile.id);
      pushCanvasHistory(canvas, playerId, { op: "delete", tile: snapshot, fromInventory: !tile.custom });
      break;
    }
    case "undo": {
      const stack = canvas.history.get(playerId) || [];
      const entry = stack.pop();
      if (!entry) { send(ws, { t: "canvasRejected", reason: "nothing_to_undo" }); return; }
      if (entry.op === "spawn" || entry.op === "duplicate") {
        const tile = canvas.tiles.get(entry.id);
        if (tile) {
          const formerLaneId = tile.laneId || null;
          canvas.tiles.delete(entry.id);
          if (entry.fromInventory) { returnCanvasInventory(inventoryForCanvasTile(room, canvas, tile), tile.text); inventoryChanged = true; }
          if (canvas.version === 2 && formerLaneId) list.push(...layoutCanvasLane(canvas, formerLaneId).map(serializeCanvasTile));
          removed.push(entry.id);
        }
      } else if (entry.op === "move") {
        const tile = canvas.tiles.get(entry.id);
        if (tile) {
          if (claimBlocked(tile)) { canvas.history.set(playerId, [entry, ...stack]); rejectClaimed(tile); return; }
          tile.x = entry.prevX;
          tile.y = entry.prevY;
          tile.laneId = entry.prevLaneId || null;
          tile.laneIndex = entry.prevLaneIndex ?? null;
          if (canvas.version === 2 && tile.laneId) list.push(...layoutCanvasLane(canvas, tile.laneId).map(serializeCanvasTile));
          else {
            clampCanvasTile(canvas, tile);
            list.push(serializeCanvasTile(tile));
          }
        }
      } else if (entry.op === "place") {
        const tile = canvas.tiles.get(entry.id);
        if (tile) {
          if (!canvasTileAllowed(room, playerId, tile, ws) || claimBlocked(tile)) {
            canvas.history.set(playerId, [entry, ...stack]);
            if (tile.heldBy && tile.heldBy !== playerId) rejectClaimed(tile);
            return;
          }
          const oldLaneId = tile.laneId;
          tile.laneId = entry.previous.laneId;
          tile.laneIndex = entry.previous.laneIndex;
          tile.x = entry.previous.x;
          tile.y = entry.previous.y;
          const changed = oldLaneId ? layoutCanvasLane(canvas, oldLaneId) : [];
          if (tile.laneId) changed.push(...layoutCanvasLane(canvas, tile.laneId));
          if (!tile.laneId) clampCanvasTile(canvas, tile);
          list.push(...changed.map(serializeCanvasTile));
          if (!changed.some((item) => item.id === tile.id)) list.push(serializeCanvasTile(tile));
        }
      } else if (entry.op === "flip") {
        const tile = canvas.tiles.get(entry.id);
        if (tile) {
          if (claimBlocked(tile)) { canvas.history.set(playerId, [entry, ...stack]); rejectClaimed(tile); return; }
          tile.flipped = entry.was;
          list.push(serializeCanvasTile(tile));
        }
      } else if (entry.op === "edit") {
        const tile = canvas.tiles.get(entry.id);
        if (tile) {
          tile.text = entry.prevText;
          tile.w = entry.prevW;
          clampCanvasTile(canvas, tile);
          if (canvas.version === 2 && tile.laneId) list.push(...layoutCanvasLane(canvas, tile.laneId).map(serializeCanvasTile));
          else list.push(serializeCanvasTile(tile));
        }
      } else if (entry.op === "delete") {
        const t = entry.tile;
        if (!canvas.tiles.has(t.id)) {
          if (t.custom || takeCanvasInventory(inventoryForCanvasTile(room, canvas, t), t.text)) {
            if (!t.custom) inventoryChanged = true;
            const restored = { ...t, heldBy: null, heldAt: null };
            canvas.tiles.set(t.id, restored);
            if (canvas.version === 2 && restored.laneId) list.push(...layoutCanvasLane(canvas, restored.laneId).map(serializeCanvasTile));
            else list.push(serializeCanvasTile(restored));
          } else {
            send(ws, { t: "canvasRejected", reason: "inventory" });
          }
        }
      }
      canvas.history.set(playerId, stack);
      break;
    }
    default:
      send(ws, { t: "error", code: "unknown_op", message: "Unknown canvas operation." });
      return;
  }

  canvasBroadcast(room, { list, removed, inventory: inventoryChanged });
  touch(room);
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
app.get("/api/puzzles", (_req, res) => res.json({
  categories: CATEGORIES,
  difficulties: DIFFICULTIES,
  puzzles: PUZZLES.map((p) => ({ ...p })),
  canvasModes: puzzlesData.canvasModes || [],
  letterSets: CANVAS_LETTER_SETS,
  sentencePacks: { ro: sentenceVocab.ro, en: sentenceVocab.en },
  coaching: publicCoachingCatalog(),
  maxPlayers: MAX_PLAYERS,
}));
app.get("/api/coaching", (_req, res) => res.json(publicCoachingCatalog()));

app.post("/api/rooms", (req, res) => {
  const { puzzleId, difficulty, name, sessionName, role, contentLanguage, mystery, customImage, teamMode, teamCount } = req.body || {};
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "A display name is required." });
  try {
    const ci = customImage && typeof customImage === "object" ? customImage : null;
    const room = createRoom(
      {
        puzzleId,
        difficulty,
        contentLanguage,
        mystery: !!mystery,
        teamMode: normalizeTeamMode(teamMode),
        teamCount: normalizeTeamCount(teamCount),
        customImage: ci
          ? {
              url: String(ci.url || "").slice(0, 200),
              file: String(ci.file || "").slice(0, 64),
              width: Number(ci.width),
              height: Number(ci.height),
              name: String(ci.name || "").slice(0, 60),
              by: name.trim().slice(0, 24),
            }
          : undefined,
      },
      { sessionName },
    );
    const playerId = crypto.randomUUID();
    const info = { name: name.trim().slice(0, 24), color: null, role: role === "spectator" ? "spectator" : "host", teamId: null };
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
  const info = { name: cleanName, color: null, role: "player", teamId: null };
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

function canvasSnapshot(room) {
  if (!room.canvas) return undefined;
  return {
    version: room.canvas.version || 1,
    mode: room.canvas.mode,
    contentLanguage: room.canvas.contentLanguage,
    sheetW: room.canvas.sheetW,
    sheetH: room.canvas.sheetH,
    tileW: room.canvas.tileW,
    tileH: room.canvas.tileH,
    wordGap: room.canvas.wordGap,
    lanes: room.canvas.lanes || [],
    tiles: [...room.canvas.tiles.values()].map(serializeCanvasTile),
    inventory: room.canvas.inventory ? Object.fromEntries(room.canvas.inventory) : null,
    teamInventory: canvasTeamInventoryPayload(room.canvas),
    jokers: canvasJokersPayload(room.canvas),
  };
}

app.post("/api/rooms/:id/puzzle", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  const { puzzleId, difficulty, pid, contentLanguage } = req.body || {};
  if (!pid || pid !== room.hostId) return res.status(403).json({ error: "Only the facilitator can change the activity.", code: "not_host" });
  try { applyPuzzleToRoom(room, { puzzleId, difficulty, contentLanguage }); } catch { return res.status(400).json({ error: "Unknown puzzle or activity." }); }
  touch(room);
  broadcast(room, { t: "puzzle", room: roomView(room), puzzle: puzzleView(room), pieces: room.pieces.map(serializePiece), ratings: [], canvas: canvasSnapshot(room) });
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
  broadcast(room, { t: "reset", room: roomView(room), puzzle: puzzleView(room), pieces: room.pieces.map(serializePiece), ratings: [], canvas: canvasSnapshot(room) });
  logEvent("room_reset", room);
  res.json({ ok: true });
});


// Puzzle-only reset deliberately differs from /reset: it keeps the active
// workshop, stage and honest clock intact while giving the jigsaw a fresh,
// scattered board. Coaching and Canvas flows retain their existing reset.
app.post("/api/rooms/:id/puzzle-reset", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found.", code: "room_missing" });
  if (!req.body?.pid || req.body.pid !== room.hostId) return res.status(403).json({ error: "Only the facilitator can reset this puzzle.", code: "not_host" });
  if (!isJigsawRoom(room)) return res.status(400).json({ error: "This reset is only available for jigsaw rooms.", code: "not_jigsaw" });
  if (room.stage !== "play") return res.status(409).json({ error: "The puzzle can be reset only during play.", code: "not_playing" });

  const startedAt = room.startedAt;
  const timerEndsAt = room.timerEndsAt;
  const timerDurationMs = room.timerDurationMs;
  const pausedAt = room.pausedAt;
  const pausedDurationMs = room.pausedDurationMs;
  scatterPieces(room);
  // Scores belong to the current board attempt. Do not use resetWorkshopState:
  // it would also reset the stage, clock, people and coaching workshop data.
  room.scores.clear();
  room.completed = false;
  room.completedAt = null;
  room.completedInMs = null;
  room.completionPlayers = [];
  // Explicitly preserve all timer fields in case this endpoint is maintained
  // near future reset code that changes scatterPieces.
  room.startedAt = startedAt;
  room.timerEndsAt = timerEndsAt;
  room.timerDurationMs = timerDurationMs;
  room.pausedAt = pausedAt;
  room.pausedDurationMs = pausedDurationMs;
  touch(room);
  broadcast(room, {
    t: "puzzleReset",
    room: roomView(room),
    puzzle: puzzleView(room),
    pieces: room.pieces.map(serializePiece),
    scores: scoreList(room),
  });
  logEvent("puzzle_reset", room, { stage: room.stage });
  res.json({ ok: true, room: roomView(room) });
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
  const canvas = payload.canvas ? `<h2>Canvas composition (${payload.canvas.contentLanguage.toUpperCase()} · ${htmlEscape(payload.canvas.mode)} · ${payload.canvas.tiles.length} tiles)</h2><pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:17px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">${htmlEscape(payload.canvas.text || "—")}</pre>` : "";
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(room.sessionName)} — PuzzleTogether</title><style>body{font:14px system-ui;max-width:800px;margin:40px auto;color:#172033}h1,h2{color:#27358f}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.card{border:1px solid #ddd;border-radius:12px;padding:14px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print / Save PDF</button><h1>${htmlEscape(room.sessionName)}</h1><p>${htmlEscape(room.config.puzzleId)} · ${new Date(room.startedAt || room.createdAt).toLocaleString()}</p>${ranking}${canvas}<h2>Insights</h2><div class="grid"><div class="card"><b>Observed</b><p>${htmlEscape(room.insights.observed)}</p></div><div class="card"><b>Learned</b><p>${htmlEscape(room.insights.learned)}</p></div><div class="card"><b>Try next</b><p>${htmlEscape(room.insights.tryNext)}</p></div></div><h2>Action items</h2><ul>${actions || "<li>No action items captured.</li>"}</ul></body></html>`);
});

// Compatibility-only archival image route for a room snapshot created before
// the 2026-09-04 content retirement. It is intentionally not listed in the
// catalog, public manifest, or picker.
app.get("/api/retired-images/:id", (req, res) => {
  const id = String(req.params.id || "");
  // Scope the compatibility asset to a currently-restored legacy room. This
  // prevents the retirement archive becoming a second public catalog URL.
  const room = findRoom(String(req.query.room || ""));
  if (!room || !room.retiredCatalog || room.config?.puzzleId !== id) {
    return res.status(404).json({ error: "Retired image not available." });
  }
  const entry = retiredEntryByPuzzleId.get(id);
  if (!entry) return res.status(404).json({ error: "Retired image not found." });
  const original = path.join(rootDir, "data", "catalog", "originals", path.basename(String(entry.asset || "")));
  if (!fs.existsSync(original)) return res.status(404).json({ error: "Retired image archive unavailable." });
  res.setHeader("Cache-Control", "private, max-age=300");
  res.type("jpeg").sendFile(original);
});

// Custom image uploads (room-scoped). The file is stored under .data/uploads
// (never in the public bundle) and deleted when its room is reaped.
app.post("/api/uploads", express.raw({ type: "*/*", limit: "10mb" }), (req, res) => {
  const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    return res.status(415).json({ error: "Only JPEG, PNG or WebP images are allowed." });
  }
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length < 1024) {
    return res.status(400).json({ error: "Upload is empty or too small (min 1 KB)." });
  }
  if (body.length > 9 * 1024 * 1024) {
    return res.status(413).json({ error: "Image is too large (max 9 MB)." });
  }
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    const file = `${crypto.randomUUID()}.webp`;
    const dest = path.join(uploadsDir, file);
    // Validate it really is an image and read dimensions via ImageMagick.
    const tmp = path.join(uploadsDir, `${crypto.randomUUID()}.in`);
    fs.writeFileSync(tmp, body);
    let dims = null;
    try {
      const out = execFileSync("identify", ["-format", "%w %h", tmp], { encoding: "utf8", stdio: "pipe" }).trim().split(/\s+/);
      const w = parseInt(out[0], 10);
      const h = parseInt(out[1], 10);
      if (Number.isFinite(w) && Number.isFinite(h) && w >= 200 && h >= 200 && w <= 6000 && h <= 6000) dims = { w, h };
    } catch { /* not an image */ }
    if (!dims) {
      try { fs.unlinkSync(tmp); } catch {}
      return res.status(400).json({ error: "Could not read a valid image (200–6000px per side)." });
    }
    // Re-encode to WebP, capped at 2200px, so the room image is optimized.
    const maxEdge = Math.max(dims.w, dims.h) > 2200 ? 2200 : null;
    const args = [tmp];
    if (maxEdge) args.push("-resize", `${maxEdge}x${maxEdge}>`);
    args.push("-quality", "82", dest);
    execFileSync("convert", args, { stdio: "pipe" });
    try { fs.unlinkSync(tmp); } catch {}
    let outDims = dims;
    try {
      const out2 = execFileSync("identify", ["-format", "%w %h", dest], { encoding: "utf8", stdio: "pipe" }).trim().split(/\s+/);
      outDims = { w: parseInt(out2[0], 10), h: parseInt(out2[1], 10) };
    } catch {}
    return res.json({ url: `/uploads/${file}`, file, width: outDims.w, height: outDims.h });
  } catch (err) {
    return res.status(500).json({ error: "Could not process the image." });
  }
});

// Serve room uploads (no long cache — they are room-scoped and short-lived).
app.use("/uploads", express.static(uploadsDir, { maxAge: 0, immutable: false, fallthrough: false }));

// Catalog images are a closed public bundle. A missing derivative must answer
// promptly with a real 404 rather than falling into Vite's SPA/proxy handling
// in development (which can turn a missing image into a self-proxy timeout).
app.use("/images", express.static(path.join(publicDir, "images"), { maxAge: IS_PROD ? "7d" : 0, fallthrough: false }));
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
          room.players.set(pid, { id: pid, name: info.name || "Player", color: info.color || null, role: info.role || "player", teamId: info.teamId || null, joinedAt: Date.now(), lastSeenAt: Date.now() });
          room.pending.delete(pid);
        }
        const player = room.players.get(pid);
        if (!player.color) player.color = pickColor(room, pid);
        player.lastSeenAt = Date.now();
        const known = room.knownPlayers.get(pid);
        if (known) { known.color = player.color; known.role = player.role; known.teamId = player.teamId || null; }
        room.conns.set(pid, { ws, playerId: pid, cursor: { x: 0, y: 0, dirty: false } });
        attached = { room, playerId: pid };
        startCursorRelay(room);
        touch(room);
        send(ws, {
          t: "init", protocolVersion: PROTOCOL_VERSION, you: pid, room: roomView(room), puzzle: puzzleView(room), players: activePlayerList(room), pieces: room.pieces.map(serializePiece), ratings: ratingListFor(room, pid), scores: scoreList(room), chat: room.chat,
          facilitator: isHost(room, pid) ? { notes: room.facilitatorNotes } : undefined,
          cursors: [...room.conns.entries()].filter(([id]) => id !== pid).map(([id, c]) => ({ id, x: c.cursor.x, y: c.cursor.y })),
          canvas: canvasSnapshot(room),
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
        const cancelling = !dragging && msg.cancel === true;
        // A claim is checked lazily too, so an item is never held until the
        // next sweep just because a frame arrived on the TTL boundary.
        expireClaims(room);
        if (piece.heldBy && piece.heldBy !== playerId) {
          send(ws, { t: "pieceRejected", reason: "held", ownerId: piece.heldBy, piece: serializePiece(piece) });
          return;
        }
        if (cancelling) {
          if (piece.heldBy !== playerId) {
            // The initial claim may have been lost while a page was hidden.
            // Reconcile the client instead of accepting an unclaimed cancel.
            send(ws, { t: "pieces", list: [serializePiece(piece)] });
            return;
          }
          piece.x = x;
          piece.y = y;
          piece.drag = false;
          piece.heldBy = null;
          piece.heldAt = null;
          // Cancellation intentionally never snaps, scores or locks. It is a
          // release/reconcile operation, not an invented pointerup/drop.
          touch(room);
          broadcast(room, { t: "pieces", list: [serializePiece(piece)] });
          break;
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
      case "layout": {
        const { room, playerId } = attached;
        const player = room.players.get(playerId);
        const mode = msg.mode === "tray" ? "tray" : msg.mode === "scatter" ? "scatter" : null;
        if (!mode) {
          send(ws, { t: "error", code: "bad_layout", message: "Unknown jigsaw layout." });
          break;
        }
        if (!isJigsawRoom(room) || room.completed || room.stage !== "play" || room.boardLocked || !player || player.role === "spectator") {
          send(ws, { t: "error", code: "layout_unavailable", message: "Piece layouts are available to players during an open jigsaw game." });
          break;
        }
        const updated = applyJigsawLayout(room, playerId, mode);
        touch(room);
        if (updated.length) broadcast(room, { t: "pieces", list: updated });
        // The mode only controls the client-side help-panel framing; x/y
        // positions above are sufficient to resync after reconnect.
        broadcastRoom(room);
        logEvent(`layout_${mode}`, room, { changed: updated.length, playerId });
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
      case "canvas": {
        const { room, playerId } = attached;
        const player = room.players.get(playerId);
        if (player) player.lastSeenAt = Date.now();
        applyCanvasOp(room, playerId, msg, ws);
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
      case "team": {
        const { room, playerId } = attached;
        applyTeamAction(room, playerId, msg, ws);
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
        const rawClientMessageId = String(msg.clientMessageId || "").trim();
        const clientMessageId = /^[A-Za-z0-9_-]{8,96}$/.test(rawClientMessageId) ? rawClientMessageId : null;
        // WebSocket ordering is reliable, but a client can retry after a
        // reconnect race. The sender-scoped id makes that retry idempotent.
        if (clientMessageId) {
          const existing = room.chat.find((entry) => entry.playerId === playerId && entry.clientMessageId === clientMessageId);
          if (existing) {
            send(ws, { t: "chat", entry: existing });
            break;
          }
        }
        const player = room.players.get(playerId);
        const entry = {
          id: crypto.randomUUID(),
          playerId,
          name: player?.name || "Player",
          color: player?.color || "#94a3b8",
          text,
          at: Date.now(),
          ...(clientMessageId ? { clientMessageId } : {}),
        };
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

/** Remove a room and any user-uploaded image file that belonged to it. */
function reapRoom(room) {
  if (room.customImageFile) {
    try {
      const file = path.join(uploadsDir, path.basename(room.customImageFile));
      if (file.startsWith(uploadsDir + path.sep) && fs.existsSync(file)) fs.unlinkSync(file);
    } catch { /* best effort */ }
  }
  rooms.delete(room.id);
  codeIndex.delete(room.code);
  stopCursorRelay(room);
  scheduleSnapshot();
}

// Claim expiration must not wait for the liveness heartbeat (30 seconds).
setInterval(() => {
  for (const room of rooms.values()) expireClaims(room);
}, CLAIM_SWEEP_MS).unref();

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const [pid, conn] of [...room.conns]) {
      if (!conn.ws.alive) { conn.ws.terminate(); dropPlayerConnection(room, pid); }
      else { conn.ws.alive = false; try { conn.ws.ping(); } catch {} }
    }
    for (const [pid, pending] of [...room.pending]) if (pending.expiresAt < now) room.pending.delete(pid);
    if (room.conns.size) broadcast(room, { t: "players", list: activePlayerList(room) });
    if (!room.players.size && !room.conns.size && now - room.lastActivityAt > EMPTY_ROOM_TTL_MS) {
      reapRoom(room); logEvent("room_empty_reaped", room);
    }
  }
}, HEARTBEAT_MS).unref();

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of [...rooms]) if (now - room.lastActivityAt > ROOM_TTL_MS) {
    for (const [, conn] of room.conns) { send(conn.ws, { t: "closed", code: "room_expired", message: "This room expired after 24 hours of inactivity." }); try { conn.ws.close(); } catch {} }
    reapRoom(room); logEvent("room_expired", room);
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
  // Do not inherit standalone Vite proxy routes here: this Express server is
  // already the backend, so a missing /images asset must not proxy back to its
  // own port. Standalone Vite can still opt into its configured proxy.
  const vite = await createViteServer({ server: { middlewareMode: true, ws: { server: httpServer }, proxy: {} }, appType: "custom" });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(rootDir, "index.html"), "utf8"));
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) { next(error); }
  });
}

app.use((error, _req, res, _next) => {
  // express.static reports an absent file with status 404. Preserve that
  // contract so callers can distinguish a missing asset from an outage.
  const candidate = Number(error?.status || error?.statusCode);
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status === 404 ? "Not found." : "Internal server error" });
});
httpServer.listen(PORT, HOST, () => {
  console.log(`🧩 PuzzleTogether server running on http://${HOST}:${PORT} (${IS_PROD ? "production" : "development"})`);
  console.log(`   protocol v${PROTOCOL_VERSION} · ${PUZZLES.length} licensed puzzles · ${rooms.size} active rooms`);
});
