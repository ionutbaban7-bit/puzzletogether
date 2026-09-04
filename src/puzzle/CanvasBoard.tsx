import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasLane, CanvasState, CanvasTile, CursorView, PlayerView, PuzzleView } from "../types";
import { canvasRenderScale, MAX_SCALE, MIN_SCALE, useViewport } from "./useViewport";
import { usePointerLifecycle, type PointerSample, type PointerTerminationReason } from "./usePointerLifecycle";
import { store } from "../store";
import { pick, useLang } from "../lib/i18n";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useVisualViewport } from "../lib/useVisualViewport";
import { downloadJsonFile, downloadTextFile, exportCanvasPng, reconstructCanvasText, roundRectPath } from "../lib/canvasText";

interface CanvasBoardProps {
  puzzle: PuzzleView;
  canvas: CanvasState;
  tiles: Record<number, CanvasTile>;
  cursors: Record<string, CursorView>;
  players: PlayerView[];
  youId: string | null;
  inputEnabled: boolean;
  resetSignal: number;
}

const DESK_BG = "#080b14";
const SHEET_BG = "#12192b";
const SELECT_COLOR = "#c084fc";
const TEAM_HEX: Record<string, string> = {
  red: "#f87171", yellow: "#facc15", green: "#4ade80", blue: "#60a5fa", purple: "#c084fc", orange: "#fb923c",
};

function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((v) => v + v).join("") : clean, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

interface TileStyle {
  fill: string;
  border: string;
  text: string;
}

function tileStyle(tile: CanvasTile, accent?: string): TileStyle {
  if (tile.kind === "wildcard") return { fill: "#4f46e5", border: accent || "#818cf8", text: "#ffffff" };
  if (tile.kind === "punctuation") return { fill: "#334155", border: accent || "#64748b", text: "#ffffff" };
  if (tile.kind === "custom") return { fill: "#fff7ed", border: accent || "#fdba74", text: "#7c2d12" };
  return { fill: "#fffef8", border: accent || "#d9d3c0", text: "#26221a" };
}

/**
 * Draws one tile in sheet-local world coordinates. Shared by the live board
 * and the PNG export so the download matches what the team sees.
 */
function paintTile(
  ctx: CanvasRenderingContext2D,
  tile: CanvasTile,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { selected?: boolean; shadow?: boolean; accent?: string } = {},
) {
  const radius = Math.min(16, w * 0.16, h * 0.2);
  ctx.save();
  if (opts.shadow) {
    ctx.shadowColor = "rgba(15,23,42,0.28)";
    ctx.shadowBlur = opts.selected ? 18 : 8;
    ctx.shadowOffsetY = opts.selected ? 8 : 3;
  }
  const style = tileStyle(tile, opts.accent);
  if (tile.flipped) {
    // Reversible: the back of the card is plain (no letter, no decorations).
    ctx.fillStyle = "#f3f4f6";
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();
    ctx.strokeStyle = "rgba(100,116,139,0.25)";
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, x + 7, y + 7, w - 14, h - 14, radius * 0.6);
    ctx.stroke();
  } else {
    ctx.fillStyle = style.fill;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();
    // Glyph
    let size = tile.kind === "punctuation" ? h * 0.5 : tile.kind === "word" || tile.kind === "custom" ? h * 0.4 : h * 0.55;
    if (tile.kind === "word" || tile.kind === "custom") {
      ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
      while (ctx.measureText(tile.text).width > w - 22 && size > 13) {
        size -= 1;
        ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
      }
    } else {
      ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
    }
    ctx.fillStyle = style.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tile.text, x + w / 2, y + h / 2 + size * 0.04);
  }
  if (opts.selected) {
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 3;
    roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, radius + 3);
    ctx.stroke();
  }
  ctx.restore();
}

function paintCanvasLane(
  ctx: CanvasRenderingContext2D,
  lane: CanvasLane,
  camera: { x: number; y: number; scale: number },
  lang: "ro" | "en",
  selected: boolean,
) {
  const { x: cx, y: cy, scale } = camera;
  const x = cx + lane.x * scale;
  const y = cy + lane.y * scale;
  const w = lane.w * scale;
  const h = lane.h * scale;
  const accent = lane.teamColor ? TEAM_HEX[lane.teamColor] || "#60a5fa" : "#60a5fa";
  const radius = Math.min(18, 16 * scale);
  ctx.save();
  ctx.fillStyle = withAlpha(accent, selected ? 0.22 : 0.09);
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, selected ? 0.95 : 0.4);
  ctx.lineWidth = selected ? Math.max(2, 3 * scale) : Math.max(1, 1.5 * scale);
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.stroke();
  const pad = Math.max(9, 16 * scale);
  const title = `${lane.teamMarker ? `${lane.teamMarker} ${lane.teamName || ""} · ` : ""}${lane.label[lang]}`;
  ctx.font = `700 ${Math.max(10, 17 * scale)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + pad, y + Math.max(14, 21 * scale));
  if (h > 100 * scale) {
    ctx.font = `500 ${Math.max(8, 12 * scale)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#aab8d3";
    ctx.fillText(lane.hint[lang], x + pad, y + Math.max(29, 43 * scale));
  }
  ctx.restore();
}

/** Tiny Levenshtein for the soft spellcheck (suggestions only, never rejects). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

const CATEGORY_ORDER = ["articles", "pronouns", "nouns", "verbs", "adjectives", "adverbs", "prepositions", "conjunctions", "punctuation"] as const;
const CATEGORY_NAMES: Record<string, { ro: string; en: string }> = {
  all: { ro: "Toate", en: "All" },
  articles: { ro: "Articole", en: "Articles" },
  pronouns: { ro: "Pronume", en: "Pronouns" },
  nouns: { ro: "Substantive", en: "Nouns" },
  verbs: { ro: "Verbe", en: "Verbs" },
  adjectives: { ro: "Adjective", en: "Adjectives" },
  adverbs: { ro: "Adverbe", en: "Adverbs" },
  prepositions: { ro: "Prepoziții", en: "Prepositions" },
  conjunctions: { ro: "Conjuncții", en: "Conjunctions" },
  punctuation: { ro: "Punctuație", en: "Punctuation" },
};

const LETTER_PUNCT = [".", ",", "!", "?", "-", "'", '"', ":", ";"];

export default function CanvasBoard({ puzzle, canvas, tiles, cursors, players, youId, inputEnabled, resetSignal }: CanvasBoardProps) {
  const { lang } = useLang();
  const isLetter = puzzle.category === "letter-canvas";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { camera, cameraRef, setCamera, zoomAt, zoomBy } = useViewport();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const visualViewport = useVisualViewport();

  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const playersRef = useRef(players);
  playersRef.current = players;
  const youRef = useRef(youId);
  youRef.current = youId;
  const inputRef = useRef(inputEnabled);
  inputRef.current = inputEnabled;
  const canvasRefState = useRef(canvas);
  canvasRefState.current = canvas;
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [trayCategory, setTrayCategory] = useState("all");
  const [customWord, setCustomWord] = useState("");
  // A real pixel height (rather than a static CSS vh) keeps the mobile rack
  // reachable when iPhone Safari shows its browser chrome or keyboard.
  const visibleHeight = visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0);
  const mobileRackHeight = sheetOpen ? Math.max(220, Math.round(visibleHeight * 0.56)) : 104;

  // The shared lifecycle owns capture, fallback and terminal event hygiene.
  const pointerSamples = useRef(new Map<number, PointerSample>());
  const pinch = useRef<{ dist: number; sx: number; sy: number; scale: number } | null>(null);
  const pan = useRef<{ id: number; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const pendingGrab = useRef<{ id: number; pointerId: number; dx: number; dy: number; startX: number; startY: number } | null>(null);
  const grab = useRef<{ id: number; pointerId: number; dx: number; dy: number; throttle: number; moved: number } | null>(null);
  const gestureType = useRef<"none" | "press" | "pan" | "drag" | "pinch">("none");
  const raf = useRef(0);
  const lastTap = useRef<{ id: number | null; at: number }>({ id: null, at: 0 });
  const lastMoveSent = useRef(0);

  const selectedTile = selectedId != null ? tiles[selectedId] : null;
  const me = players.find((player) => player.id === youId);
  const myTeamId = me?.teamId || null;
  const lanes = canvas.version === 2 ? canvas.lanes || [] : [];
  const availableLanes = lanes.filter((lane) => !lane.teamId || lane.teamId === myTeamId);
  const selectedLane = availableLanes.find((lane) => lane.id === selectedLaneId) || availableLanes[0] || null;
  const inventory = canvas.teamInventory && myTeamId ? canvas.teamInventory[myTeamId] ?? null : canvas.inventory;
  // Joker bank: colour teams draw from their own key; the shared group uses "shared".
  const jokerKey = canvas.teamInventory && myTeamId ? myTeamId : "shared";
  const jokersLeft = canvas.jokers && canvas.jokers[jokerKey] != null ? canvas.jokers[jokerKey] : 0;

  useEffect(() => {
    if (selectedLane && selectedLane.id !== selectedLaneId) setSelectedLaneId(selectedLane.id);
  }, [selectedLane, selectedLaneId]);

  const fitSheet = useCallback(() => {
    const c = canvasRefState.current;
    const element = canvasRef.current;
    const vw = element?.clientWidth || visualViewport.width || window.innerWidth;
    const vh = element?.clientHeight || visualViewport.height || window.innerHeight;
    const mobile = vw < 768;
    const padLeft = mobile ? 16 : 76;
    const padRight = mobile ? 16 : 84;
    const padTop = mobile ? 84 : 90;
    // Reserve room for both the lower source bank and its compact action strip.
    const padBottom = mobile ? mobileRackHeight + 66 : 278;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(vw / (c.sheetW + padLeft + padRight), vh / (c.sheetH + padTop + padBottom))));
    const targetX = padLeft + (vw - padLeft - padRight - c.sheetW * scale) / 2;
    const targetY = padTop + (vh - padTop - padBottom - c.sheetH * scale) / 2;
    setCamera({ x: targetX, y: targetY, scale });
  }, [setCamera, mobileRackHeight, visualViewport.height, visualViewport.width]);

  // Initial fit + refit on reset / sheet resize
  const fittedFor = useRef("");
  useEffect(() => {
    const key = `${canvas.sheetW}x${canvas.sheetH}:${puzzle.image}`;
    if (fittedFor.current !== key) {
      fittedFor.current = key;
      fitSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.sheetW, canvas.sheetH, puzzle.image]);

  useEffect(() => {
    if (resetSignal > 0) {
      fittedFor.current = "";
      setSelectedId(null);
      fitSheet();
      schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useEffect(() => {
    fitSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { x, y, scale } = cameraRef.current;
    return { x: (sx - x) / scale, y: (sy - y) / scale };
  }, [cameraRef]);

  // ------------------------------------------------------------- schedule
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, []);

  const pointerLifecycle = usePointerLifecycle(canvasRef, pointerSamples, {
    debugScope: "canvas",
    debugState: () => gestureType.current,
    onMove: handleTrackedPointerMove,
    onTerminate: handlePointerTermination,
  });
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => draw();

  // Redraw on any relevant state change (dirty rendering — no continuous loop).
  useEffect(() => { schedule(); }, [tiles, cursors, canvas, selectedId, selectedLaneId, schedule]);

  // ------------------------------------------------------------- canvas setup
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const resize = () => {
      const dpr = canvasRenderScale();
      canvasEl.width = Math.round(canvasEl.clientWidth * dpr);
      canvasEl.height = Math.round(canvasEl.clientHeight * dpr);
      schedule();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvasEl);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        // StrictMode immediately remounts effects in development. Clear the
        // stored id as well or the next dirty render is incorrectly skipped.
        raf.current = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Test/debug hook
  useEffect(() => {
    (window as unknown as { __ptCanvasCamera?: unknown }).__ptCanvasCamera = cameraRef;
    return () => { delete (window as unknown as { __ptCanvasCamera?: unknown }).__ptCanvasCamera; };
  }, [cameraRef]);

  // ------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        store.sendCanvas("undo");
        schedule();
      } else if (mod && e.key.toLowerCase() === "d") {
        if (selectedTile) {
          e.preventDefault();
          store.sendCanvas("duplicate", { id: selectedTile.id });
        }
      } else if (e.key === "f" || e.key === "F") {
        if (selectedTile) store.sendCanvas("flip", { id: selectedTile.id });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTile) {
          e.preventDefault();
          store.sendCanvas("delete", { id: selectedTile.id });
          setSelectedId(null);
        }
      } else if (e.key === "Escape") {
        if (grab.current || pendingGrab.current) pointerLifecycle.cancelAll("escape");
        else setSelectedId(null);
      } else if (e.key === "+" || e.key === "=") {
        zoomBy(1.25);
      } else if (e.key === "-" || e.key === "_") {
        zoomBy(0.8);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile, zoomBy, schedule, pointerLifecycle]);

  // ------------------------------------------------------------- draw
  function draw() {
    const el = canvasRef.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = canvasRenderScale();
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    const { x: cx, y: cy, scale } = cameraRef.current;
    const c = canvasRefState.current;
    const list = Object.values(tilesRef.current);
    const playersById = new Map(playersRef.current.map((p) => [p.id, p]));
    const now = Date.now();
    const you = youRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Desk — plain, no decorative dots (requirement: fără puncte decorative)
    ctx.fillStyle = DESK_BG;
    ctx.fillRect(0, 0, w, h);

    // Structured, dark game surface — never a blank white worksheet.
    const sx = cx;
    const sy = cy;
    const sw = c.sheetW * scale;
    const sh = c.sheetH * scale;
    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,0.22)";
    ctx.shadowBlur = 26 * scale;
    ctx.shadowOffsetY = 10 * scale;
    ctx.fillStyle = SHEET_BG;
    roundRectPath(ctx, sx, sy, sw, sh, 18 * scale);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(148,163,184,0.34)";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, sx, sy, sw, sh, 18 * scale);
    ctx.stroke();

    // v2 gives every composition a visible destination. v1 snapshots retain
    // their original open sheet with no generated lanes.
    const lanes = c.version === 2 ? c.lanes || [] : [];
    for (const lane of lanes) paintCanvasLane(ctx, lane, { x: cx, y: cy, scale }, lang, lane.id === selectedLaneId);

    // Tiles (selected / claimed drawn last)
    const sorted = [...list].sort((a, b) => {
      const sa = (a.id === selectedId ? 2 : 0) + (a.heldBy === you ? 1 : 0);
      const sb = (b.id === selectedId ? 2 : 0) + (b.heldBy === you ? 1 : 0);
      return sa - sb || a.id - b.id;
    });
    for (const tile of sorted) {
      const x = cx + tile.x * scale;
      const y = cy + tile.y * scale;
      const lane = tile.laneId ? lanes.find((item) => item.id === tile.laneId) : null;
      const accent = lane?.teamColor ? TEAM_HEX[lane.teamColor] : undefined;
      paintTile(ctx, tile, x, y, tile.w * scale, tile.h * scale, { selected: tile.id === selectedId, shadow: true, accent });
      const claimOwner = tile.heldBy ? playersById.get(tile.heldBy) : null;
      if (claimOwner && tile.heldBy !== you) {
        ctx.save();
        ctx.strokeStyle = claimOwner.color;
        ctx.lineWidth = 3;
        roundRectPath(ctx, x - 4, y - 4, tile.w * scale + 8, tile.h * scale + 8, 18);
        ctx.stroke();
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        const label = `${claimOwner.name}`;
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = claimOwner.color;
        ctx.beginPath();
        ctx.roundRect(x + 2, y - 24, tw, 19, 9);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + 8, y - 14.5);
        ctx.restore();
      }
    }

    // Remote cursors
    for (const [id, cur] of Object.entries(cursorsRef.current)) {
      if (id === you || now - cur.at > 4000) continue;
      const player = playersById.get(id);
      if (!player) continue;
      const px = cur.x * scale + cx;
      const py = cur.y * scale + cy;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 13, py + 10);
      ctx.lineTo(px + 6.5, py + 9.5);
      ctx.lineTo(px + 8, py + 17);
      ctx.lineTo(px + 3, py + 12);
      ctx.lineTo(px - 1, py + 15);
      ctx.closePath();
      ctx.fillStyle = player.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fill();
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      const label = `${player.name} 👆`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.roundRect(px + 14, py + 16, tw + 14, 20, 10);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, px + 21, py + 26.5);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------- hit testing
  function pickTile(wx: number, wy: number, margin = 0): CanvasTile | null {
    const list = Object.values(tilesRef.current);
    let best: CanvasTile | null = null;
    for (const t of list) {
      if (t.heldBy && t.heldBy !== youRef.current) continue;
      if (wx >= t.x - margin && wx <= t.x + t.w + margin && wy >= t.y - margin && wy <= t.y + t.h + margin) {
        best = t; // last matching wins (sorted by id ~ insertion order)
      }
    }
    return best;
  }

  /** Returns only a player's shared/own lane. Team isolation is also enforced
   * server-side; this is the optimistic interaction affordance. */
  function pickLane(wx: number, wy: number): CanvasLane | null {
    const current = canvasRefState.current;
    if (current.version !== 2) return null;
    const mine = playersRef.current.find((player) => player.id === youRef.current)?.teamId || null;
    const candidates = (current.lanes || []).filter((lane) => !lane.teamId || lane.teamId === mine);
    for (let index = candidates.length - 1; index >= 0; index--) {
      const lane = candidates[index];
      if (wx >= lane.x && wx <= lane.x + lane.w && wy >= lane.y && wy <= lane.y + lane.h) return lane;
    }
    return null;
  }

  const posFromSample = (sample: Pick<PointerSample, "clientX" | "clientY">) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: sample.clientX - rect.left, y: sample.clientY - rect.top };
  };
  const livePoints = () => [...pointerSamples.current.values()].map(posFromSample);

  function noteTileTap(tile: CanvasTile) {
    setSelectedId(tile.id);
    const now = performance.now();
    if (lastTap.current.id === tile.id && now - lastTap.current.at < 340) {
      store.sendCanvas("flip", { id: tile.id });
      lastTap.current = { id: null, at: 0 };
    } else {
      lastTap.current = { id: tile.id, at: now };
    }
  }

  function cancelCanvasGrab(reason: PointerTerminationReason) {
    const current = grab.current;
    grab.current = null;
    pendingGrab.current = null;
    if (!current) {
      schedule();
      return;
    }
    const tile = tilesRef.current[current.id];
    if (tile) {
      store.sendCanvas("move", { id: tile.id, x: tile.x, y: tile.y, drag: false, cancel: true, cancelReason: reason });
    }
    schedule();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const el = canvasRef.current;
    if (!el) return;
    const sample = pointerLifecycle.begin(e.nativeEvent);
    const pos = posFromSample(sample);
    if (sample.pointerType === "touch" && pointerSamples.current.size === 2) {
      // A second finger is a camera gesture, never an accidental canvas drop.
      if (grab.current) cancelCanvasGrab("cancel");
      pendingGrab.current = null;
      const pts = livePoints();
      pinch.current = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), sx: (pts[0].x + pts[1].x) / 2, sy: (pts[0].y + pts[1].y) / 2, scale: cameraRef.current.scale };
      gestureType.current = "pinch";
      pan.current = null;
      schedule();
      return;
    }
    const world = screenToWorld(pos.x, pos.y);
    const hit = inputRef.current ? pickTile(world.x, world.y, sample.pointerType === "touch" ? 12 : 0) : null;
    if (hit) {
      pendingGrab.current = {
        id: hit.id,
        pointerId: sample.pointerId,
        dx: world.x - hit.x,
        dy: world.y - hit.y,
        startX: pos.x,
        startY: pos.y,
      };
      gestureType.current = "press";
    } else {
      const lane = pickLane(world.x, world.y);
      if (lane) setSelectedLaneId(lane.id);
      gestureType.current = "pan";
      pan.current = { id: sample.pointerId, sx: pos.x, sy: pos.y, cx: cameraRef.current.x, cy: cameraRef.current.y };
      setSelectedId(null);
    }
    schedule();
  }

  function handleTrackedPointerMove(sample: PointerSample) {
    const pos = posFromSample(sample);
    if (gestureType.current === "press" && pendingGrab.current?.pointerId === sample.pointerId) {
      const pending = pendingGrab.current;
      const threshold = sample.pointerType === "touch" ? 8 : 4;
      if (Math.hypot(pos.x - pending.startX, pos.y - pending.startY) < threshold) return;
      const tile = tilesRef.current[pending.id];
      if (!tile || (tile.heldBy && tile.heldBy !== youRef.current)) {
        pendingGrab.current = null;
        gestureType.current = "none";
        return;
      }
      grab.current = { id: pending.id, pointerId: pending.pointerId, dx: pending.dx, dy: pending.dy, throttle: performance.now(), moved: 0 };
      pendingGrab.current = null;
      gestureType.current = "drag";
      store.sendCanvas("move", { id: tile.id, x: tile.x, y: tile.y, drag: true });
    }
    if (gestureType.current === "drag" && grab.current?.pointerId === sample.pointerId) {
      const world = screenToWorld(pos.x, pos.y);
      const current = grab.current;
      const tile = tilesRef.current[current.id];
      if (tile) {
        tile.x = world.x - current.dx;
        tile.y = world.y - current.dy;
        current.moved += 1;
        const now = performance.now();
        if (now - current.throttle >= 50) {
          current.throttle = now;
          store.sendCanvas("move", { id: tile.id, x: tile.x, y: tile.y, drag: true });
        }
      }
      schedule();
      return;
    }
    if (gestureType.current === "pan" && pan.current && sample.pointerId === pan.current.id) {
      cameraRef.current.x = pan.current.cx + (pos.x - pan.current.sx);
      cameraRef.current.y = pan.current.cy + (pos.y - pan.current.sy);
      setCamera({ ...cameraRef.current });
      schedule();
      return;
    }
    if (gestureType.current === "pinch" && pinch.current && pointerSamples.current.size >= 2) {
      const pts = livePoints();
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current.dist > 0) {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (dist / pinch.current.dist)));
        const k = scale / cameraRef.current.scale;
        cameraRef.current.scale = scale;
        cameraRef.current.x = pinch.current.sx - (pinch.current.sx - cameraRef.current.x) * k;
        cameraRef.current.y = pinch.current.sy - (pinch.current.sy - cameraRef.current.y) * k;
        setCamera({ ...cameraRef.current });
        schedule();
      }
      return;
    }
    const now = performance.now();
    if (now - lastMoveSent.current > 40) {
      lastMoveSent.current = now;
      const world = screenToWorld(pos.x, pos.y);
      store.sendCursor(world.x, world.y);
    }
  }

  function handlePointerTermination(sample: PointerSample, reason: PointerTerminationReason) {
    const wasDragging = gestureType.current === "drag" && grab.current?.pointerId === sample.pointerId;
    const wasPressing = gestureType.current === "press" && pendingGrab.current?.pointerId === sample.pointerId;
    if (wasDragging) {
      const current = grab.current;
      const tile = current ? tilesRef.current[current.id] : null;
      grab.current = null;
      if (tile) {
        if (reason === "up") {
          const lane = pickLane(tile.x + tile.w / 2, tile.y + tile.h / 2);
          if (lane) {
            setSelectedLaneId(lane.id);
            store.sendCanvas("place", { id: tile.id, laneId: lane.id });
          } else {
            store.sendCanvas("move", { id: tile.id, x: tile.x, y: tile.y, drag: false });
          }
        } else {
          store.sendCanvas("move", { id: tile.id, x: tile.x, y: tile.y, drag: false, cancel: true, cancelReason: reason });
        }
      }
    } else if (wasPressing) {
      const pending = pendingGrab.current;
      pendingGrab.current = null;
      if (reason === "up" && pending) {
        const tile = tilesRef.current[pending.id];
        if (tile) noteTileTap(tile);
      }
    }
    if (gestureType.current === "pan" && pan.current?.id === sample.pointerId) pan.current = null;
    if (gestureType.current === "pinch" && pointerSamples.current.size < 2) pinch.current = null;
    if (pointerSamples.current.size === 0) {
      gestureType.current = "none";
      pan.current = null;
      pinch.current = null;
      pendingGrab.current = null;
    }
    schedule();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    pointerLifecycle.move(e.nativeEvent);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointerLifecycle.finish(e.nativeEvent, "up");
  }

  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    pointerLifecycle.finish(e.nativeEvent, "cancel");
  }

  function onLostPointerCapture(e: React.PointerEvent<HTMLCanvasElement>) {
    pointerLifecycle.finish(e.nativeEvent, "lostcapture");
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pos = posFromSample({ clientX: e.clientX, clientY: e.clientY });
    zoomAt(pos.x, pos.y, Math.exp(-e.deltaY * 0.0016));
  }

  // ------------------------------------------------------------- tray actions
  const viewCenter = () => {
    const el = canvasRef.current;
    const vw = el?.clientWidth || window.innerWidth;
    const vh = el?.clientHeight || window.innerHeight;
    return screenToWorld(vw / 2, vh / 2);
  };

  const spawnLetter = (text: string) => {
    const center = viewCenter();
    store.sendCanvas("spawn", { text, x: center.x, y: center.y, ...(selectedLane ? { laneId: selectedLane.id } : {}) });
  };

  const spawnWord = (word: string, custom = false) => {
    const center = viewCenter();
    store.sendCanvas("spawn", { text: word, x: center.x, y: center.y, custom, ...(selectedLane ? { laneId: selectedLane.id } : {}) });
  };

  // The joker draws a surprise letter that lands large/open on the sheet; the
  // participant sees it afterwards and decides what to do with it.
  const drawJoker = () => {
    if (!inputEnabled || (canvas.teamInventory != null && !myTeamId) || jokersLeft <= 0) return;
    store.sendCanvas("joker");
  };

  const doExport = (kind: "png" | "txt" | "json") => {
    const tileList = Object.values(tiles);
    const text = reconstructCanvasText(tileList);
    const base = `puzzletogether-${(puzzle.name as string || "canvas").replace(/\s+/g, "-").toLowerCase()}`;
    if (kind === "txt") downloadTextFile(`${base}-text.txt`, text);
    if (kind === "json") {
      downloadJsonFile(`${base}.json`, {
        app: "PuzzleTogether",
        exportedAt: new Date().toISOString(),
        mode: canvas.mode,
        contentLanguage: canvas.contentLanguage,
        text,
        lanes: canvas.lanes,
        tiles: tileList.map((t) => ({ ...t })),
      });
    }
    if (kind === "png") {
      exportCanvasPng({
        sheetW: canvas.sheetW,
        sheetH: canvas.sheetH,
        tiles: tileList,
        lanes: canvas.lanes,
        isLetter,
        filename: `${base}.png`,
        drawTile: (ctx, tile, x, y, w, h) => paintTile(ctx, tile, x, y, w, h, { shadow: true }),
      });
    }
  };

  // ------------------------------------------------------------- tray data
  const alphabet = canvas.contentLanguage === "ro" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘȚ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // null means an unlimited sandbox; colour-team rooms select their own bank above.
  const remainingOf = (text: string) => (inventory ? Math.max(0, inventory[text] ?? 0) : Infinity);

  const packWords = useMemo(() => {
    if (isLetter) return [];
    const source = puzzle.sentencePack || [];
    return source;
  }, [isLetter, puzzle.sentencePack]);

  const packWordsByCategory = useMemo(() => {
    const map = new Map<string, { w: string; c: string; n: number }[]>();
    for (const entry of packWords) {
      const list = map.get(entry.c) || [];
      list.push(entry);
      map.set(entry.c, list);
    }
    return map;
  }, [packWords]);

  const suggestions = useMemo(() => {
    if (isLetter || !customWord.trim()) return [];
    const value = customWord.normalize("NFC").trim().toLowerCase();
    if (value.length < 3) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of packWords) {
      if (entry.c === "punctuation") continue;
      const key = entry.w.toLowerCase();
      if (seen.has(key)) continue;
      const dist = Math.abs(key.length - value.length) > 2 ? 3 : levenshtein(key, value);
      if (dist >= 1 && dist <= 2) {
        seen.add(key);
        out.push(entry.w);
        if (out.length >= 3) break;
      }
    }
    return out;
  }, [isLetter, customWord, packWords]);

  const inPack = !isLetter && customWord.trim() && (packWords.some((e) => e.w.toLowerCase() === customWord.normalize("NFC").trim().toLowerCase()) || remainingOf(customWord.normalize("NFC").trim()) > 0);

  // ------------------------------------------------------------- render
  const zoomBtn = (factor: number, label: string) => (
    <button
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink-900/95 text-lg font-bold text-white shadow-chip backdrop-blur transition hover:bg-ink-800 active:scale-95"
      onClick={() => zoomBy(factor)}
      title={label}
      aria-label={label}
    >
      {factor > 1 ? "+" : "−"}
    </button>
  );

  const trayContent = (
    <div className="space-y-3">
      {canvas.version === 2 && <LanePicker lanes={availableLanes} selectedId={selectedLane?.id || null} onSelect={setSelectedLaneId} isLetter={isLetter} />}
      {canvas.version === 2 && selectedLane && <CompositionOutline lane={selectedLane} tiles={Object.values(tiles)} selectedId={selectedId} onSelect={setSelectedId} />}
      {isLetter ? (
        <LetterTray
          alphabet={alphabet}
          remainingOf={remainingOf}
          onSpawn={spawnLetter}
          disabled={!inputEnabled || (canvas.teamInventory != null && !myTeamId)}
          onJoker={drawJoker}
          jokersLeft={jokersLeft}
        />
      ) : (
        <SentenceTray
          categories={packWordsByCategory}
          selected={trayCategory}
          onSelectCategory={setTrayCategory}
          remainingOf={remainingOf}
          onSpawn={spawnWord}
          disabled={!inputEnabled || (canvas.teamInventory != null && !myTeamId)}
          customWord={customWord}
          setCustomWord={setCustomWord}
          suggestions={suggestions}
          inPack={!!inPack}
        />
      )}
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: DESK_BG }}>
      <canvas
        ref={canvasRef}
        className="board-input block h-full w-full touch-none"
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={lang === "ro" ? "Foaie de lucru — canvas de litere" : "Work sheet — letter canvas"}
      />

      {/* The source bank deliberately lives along the lower board edge, not as
          a detached left inventory. It makes selecting, composing and seeing
          the current destination feel like one game surface. */}
      {!isMobile && (
        <aside className="absolute bottom-4 left-1/2 z-20 flex max-h-[232px] w-[min(940px,calc(100vw-132px))] -translate-x-1/2 flex-col overflow-hidden rounded-3xl border border-white/15 bg-ink-900/96 text-white shadow-pop backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-300">{isLetter ? (lang === "ro" ? "Rastel de litere" : "Letter rack") : (lang === "ro" ? "Bancă de cuvinte" : "Word bank")}</div><div className="mt-0.5 text-xs text-ink-300">{isLetter ? (lang === "ro" ? "Alege o zonă, apoi atinge literele ca să construiești." : "Choose a lane, then tap letters to build.") : (lang === "ro" ? "Alege o zonă, apoi construiește o idee clară." : "Choose a lane, then build a clear thought.")}</div></div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-brand-100">{canvas.contentLanguage.toUpperCase()} · {pick(puzzle.name, lang)}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{trayContent}</div>
        </aside>
      )}

      {/* Mobile keeps the same lower rack as a generous, keyboard-safe sheet. */}
      {isMobile && (
        <div
          className="safe-bottom absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl border-t border-white/10 bg-ink-900/[.98] text-white shadow-pop backdrop-blur transition-[height] duration-200"
          style={{ height: `${mobileRackHeight}px` }}
        >
          <button
            className="flex w-full cursor-pointer flex-col items-center pb-1 pt-2"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label={sheetOpen ? (lang === "ro" ? "Închide rastelul" : "Collapse rack") : (lang === "ro" ? "Deschide rastelul" : "Open rack")}
          >
            <span className="h-1.5 w-10 rounded-full bg-white/30" />
            <span className="mt-1.5 text-[11px] font-bold text-ink-200">
              {isLetter ? (lang === "ro" ? "Rastel de litere" : "Letter rack") : (lang === "ro" ? "Bancă de cuvinte" : "Word bank")} · {selectedLane ? pick(selectedLane.label, lang) : (lang === "ro" ? "zonă liberă" : "free canvas")} {sheetOpen ? "▾" : "▴"}
            </span>
          </button>
          <div className={`min-h-0 flex-1 overflow-y-auto px-3 pb-3 ${sheetOpen ? "" : "flex items-center"}`}>
            {trayContent}
          </div>
        </div>
      )}

      {/* Action toolbar (exports + undo) */}
      <div
        className={`safe-bottom absolute z-30 flex items-center gap-2 ${isMobile ? "left-2 right-2 justify-center" : "bottom-6 right-5 flex-col"}`}
        style={isMobile ? { bottom: `${mobileRackHeight + 10}px` } : undefined}
      >
        <div className={`flex gap-1.5 ${isMobile ? "flex-row" : "flex-col"}`}>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-ink-900/95 text-sm text-white shadow-chip backdrop-blur hover:bg-ink-800 disabled:opacity-40"
            onClick={() => store.sendCanvas("undo")}
            title={lang === "ro" ? "Anulează ultima acțiune (Ctrl+Z)" : "Undo last action (Ctrl+Z)"}
            aria-label={lang === "ro" ? "Anulează" : "Undo"}
          >
            ↩
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-ink-900/95 text-sm text-white shadow-chip backdrop-blur hover:bg-ink-800"
            onClick={() => doExport("png")}
            title={lang === "ro" ? "Exportă compoziția ca PNG" : "Export composition as PNG"}
            aria-label={lang === "ro" ? "Export PNG" : "Export PNG"}
          >
            📷
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-ink-900/95 text-sm text-white shadow-chip backdrop-blur hover:bg-ink-800"
            onClick={() => doExport("txt")}
            title={lang === "ro" ? "Exportă textul (UTF-8)" : "Export text (UTF-8)"}
            aria-label={lang === "ro" ? "Export text" : "Export text"}
          >
            📄
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-ink-900/95 text-sm text-white shadow-chip backdrop-blur hover:bg-ink-800"
            onClick={() => doExport("json")}
            title={lang === "ro" ? "Exportă JSON" : "Export JSON"}
            aria-label={lang === "ro" ? "Export JSON" : "Export JSON"}
          >
            {"{ }"}
          </button>
        </div>
        <div className={`flex gap-1.5 ${isMobile ? "flex-row" : "mt-1 flex-col"}`}>
          {zoomBtn(1.25, lang === "ro" ? "Mărește" : "Zoom in")}
          <button
            className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/10 bg-ink-900/95 text-[11px] font-bold text-ink-200 shadow-chip backdrop-blur"
            onClick={fitSheet}
            title={lang === "ro" ? "Asează foaia în vedere" : "Fit the sheet"}
            aria-label={lang === "ro" ? "Asează foaia" : "Fit sheet"}
          >
            {Math.round(camera.scale * 100)}%
          </button>
          {zoomBtn(0.8, lang === "ro" ? "Micșorează" : "Zoom out")}
        </div>
      </div>

      {/* Selected tile actions */}
      {selectedTile && (
        <div
          className={`absolute left-1/2 z-30 flex max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-ink-900/97 p-1.5 text-white shadow-pop backdrop-blur ${isMobile ? "" : "top-16"}`}
          style={isMobile ? { bottom: `${mobileRackHeight + 62}px` } : undefined}
        >
          <span className="max-w-[110px] truncate px-1.5 text-sm font-bold text-white">{selectedTile.text}</span>
          {selectedLane && <button className="rounded-xl bg-brand-500/25 px-2.5 py-1.5 text-xs font-bold text-brand-100 hover:bg-brand-500/35" onClick={() => store.sendCanvas("place", { id: selectedTile.id, laneId: selectedLane.id })} title={lang === "ro" ? `Pune în ${pick(selectedLane.label, lang)}` : `Place in ${pick(selectedLane.label, lang)}`} aria-label={lang === "ro" ? `Pune în ${pick(selectedLane.label, lang)}` : `Place in ${pick(selectedLane.label, lang)}`}>⇥ <span className="hidden sm:inline">{lang === "ro" ? "Pune" : "Place"}</span></button>}
          {selectedTile.laneId && selectedLane?.id === selectedTile.laneId && <><button className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-bold text-white hover:bg-white/15" onClick={() => store.sendCanvas("place", { id: selectedTile.id, laneId: selectedTile.laneId, laneIndex: Math.max(0, (selectedTile.laneIndex || 0) - 1) })} title={lang === "ro" ? "Mută mai devreme" : "Move earlier"} aria-label={lang === "ro" ? "Mută mai devreme" : "Move earlier"}>←</button><button className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-bold text-white hover:bg-white/15" onClick={() => store.sendCanvas("place", { id: selectedTile.id, laneId: selectedTile.laneId, laneIndex: (selectedTile.laneIndex || 0) + 1 })} title={lang === "ro" ? "Mută mai târziu" : "Move later"} aria-label={lang === "ro" ? "Mută mai târziu" : "Move later"}>→</button></>}
          <button
            className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15"
            onClick={() => store.sendCanvas("flip", { id: selectedTile.id })}
            title={lang === "ro" ? "Răstoarnă (F)" : "Flip (F)"}
            aria-label={lang === "ro" ? "Răstoarnă cărția" : "Flip tile"}
          >
            ↻
          </button>
          <button
            className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15"
            onClick={() => store.sendCanvas("duplicate", { id: selectedTile.id })}
            title={lang === "ro" ? "Dublează (Ctrl+D)" : "Duplicate (Ctrl+D)"}
            aria-label={lang === "ro" ? "Dublează cărția" : "Duplicate tile"}
          >
            ⧉
          </button>
          <button
            className="rounded-xl bg-rose-500/20 px-2.5 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
            onClick={() => {
              store.sendCanvas("delete", { id: selectedTile.id });
              setSelectedId(null);
            }}
            title={lang === "ro" ? "Șterge (Delete)" : "Delete (Delete)"}
            aria-label={lang === "ro" ? "Șterge cărția" : "Delete tile"}
          >
            🗑
          </button>
          <button
            className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-bold text-ink-300 hover:bg-white/15"
            onClick={() => setSelectedId(null)}
            aria-label={lang === "ro" ? "Deselectează" : "Deselect"}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Semantic lane selector + source banks
// ---------------------------------------------------------------------------

/** A keyboard/screen-reader equivalent for the visual canvas tiles. */
function CompositionOutline({ lane, tiles, selectedId, onSelect }: { lane: CanvasLane; tiles: CanvasTile[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const { lang } = useLang();
  const items = tiles.filter((tile) => tile.laneId === lane.id).sort((a, b) => (a.laneIndex ?? 0) - (b.laneIndex ?? 0) || a.id - b.id);
  return (
    <section className="rounded-xl border border-white/10 bg-black/15 px-2.5 py-2" aria-label={lang === "ro" ? "Conținutul zonei selectate" : "Selected lane contents"}>
      <div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold uppercase tracking-[.15em] text-ink-400">{lang === "ro" ? "3. Construiește aici" : "3. Build here"} · {pick(lane.label, lang)}</span><span className="text-[10px] text-ink-500">{items.length} {lang === "ro" ? "cărți" : "tiles"}</span></div>
      <div className="mt-1.5 flex max-h-[52px] flex-wrap gap-1 overflow-y-auto pr-1">
        {items.length ? items.map((tile) => <button key={tile.id} type="button" onClick={() => onSelect(tile.id)} aria-pressed={selectedId === tile.id} className={`min-h-7 rounded-md border px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${selectedId === tile.id ? "border-brand-300 bg-brand-500/35 text-white" : "border-white/15 bg-white/[.07] text-ink-100 hover:bg-white/[.13]"}`} aria-label={lang === "ro" ? `Selectează ${tile.text}, poziția ${(tile.laneIndex || 0) + 1}` : `Select ${tile.text}, position ${(tile.laneIndex || 0) + 1}`}>{tile.text}</button>) : <span className="py-1 text-[11px] text-ink-500">{lang === "ro" ? "Alege o carte din bancă." : "Choose a tile from the bank."}</span>}
      </div>
    </section>
  );
}

function LanePicker({ lanes, selectedId, onSelect, isLetter }: { lanes: CanvasLane[]; selectedId: string | null; onSelect: (id: string) => void; isLetter: boolean }) {
  const { lang } = useLang();
  if (!lanes.length) return <p className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-[11px] text-ink-300">{lang === "ro" ? "Canvas liber restaurat — mută cărțile oriunde pe tablă." : "Restored free canvas — move tiles anywhere on the board."}</p>;
  const groups = new Map<string, CanvasLane[]>();
  for (const lane of lanes) {
    const key = lane.teamId || "shared";
    groups.set(key, [...(groups.get(key) || []), lane]);
  }
  return (
    <section aria-label={lang === "ro" ? "Alege zona de compoziție" : "Choose composition lane"}>
      <div className="mb-1.5 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-ink-400">{lang === "ro" ? "1. Alege zona" : "1. Choose a lane"}</span><span className="text-[10px] text-ink-500">{isLetter ? (lang === "ro" ? "litere în ordine" : "letters in order") : (lang === "ro" ? "idee → motiv → pas" : "idea → reason → step")}</span></div>
      <div className="flex flex-wrap gap-1.5">
        {[...groups.values()].flat().map((lane) => {
          const selected = lane.id === selectedId;
          const accent = lane.teamColor ? TEAM_HEX[lane.teamColor] || "#60a5fa" : "#60a5fa";
          return <button key={lane.id} type="button" onClick={() => onSelect(lane.id)} aria-pressed={selected} className={`min-h-9 rounded-xl border px-3 py-1.5 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${selected ? "text-white" : "bg-white/[.035] text-ink-200 hover:bg-white/[.09]"}`} style={selected ? { borderColor: accent, backgroundColor: withAlpha(accent, .26) } : { borderColor: withAlpha(accent, .36) }}><span style={{ color: accent }} aria-hidden>{lane.teamMarker ? `${lane.teamMarker} ` : ""}</span>{lane.teamName ? `${lane.teamName} · ` : ""}{pick(lane.label, lang)}</button>;
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Letter tray
// ---------------------------------------------------------------------------

function LetterTray({ alphabet, remainingOf, onSpawn, disabled, onJoker, jokersLeft }: { alphabet: string; remainingOf: (t: string) => number; onSpawn: (t: string) => void; disabled: boolean; onJoker: () => void; jokersLeft: number }) {
  const { lang } = useLang();
  const letters = [...alphabet];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-ink-400">{lang === "ro" ? "2. Litere — multe, împrăștiate" : "2. Letters — many, scattered"}</span><span className="text-[10px] text-ink-500">{lang === "ro" ? "Atinge pentru a plasa" : "Tap to place"}</span></div>
      {/* Letters are presented scattered with slight tilts, like puzzle pieces on a
          table, so the tray reads as a pool to pick from rather than a strict grid. */}
      <div className="flex flex-wrap gap-1.5" aria-label={lang === "ro" ? "Rastel de litere" : "Letter rack"}>
        {letters.map((letter, index) => <TrayButton key={letter} label={letter} count={remainingOf(letter)} onClick={() => onSpawn(letter)} disabled={disabled} tilt={[-3, 2, -1, 3, -2, 1, -2, 2][index % 8]} />)}
        <span className="mx-0.5 h-9 w-px self-center bg-white/10" aria-hidden />
        <TrayButton label="?" count={remainingOf("?")} onClick={() => onSpawn("?")} disabled={disabled} wildcard />
        {LETTER_PUNCT.map((punct, index) => <TrayButton key={`${punct}-${index}`} label={punct} count={remainingOf(punct)} onClick={() => onSpawn(punct)} disabled={disabled} punct />)}
      </div>
      <p className="text-[11px] leading-relaxed text-ink-400">{lang === "ro" ? "Schimbă zona oricând; trage o literă pe o zonă sau alege-o și apasă Pune." : "Change lanes any time; drag a letter onto a lane or select it and press Place."}</p>
      {/* Joker: a surprise letter you only see after you draw it. */}
      <div className="rounded-2xl border border-cp-purple-300/35 bg-cp-purple-500/12 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-cp-purple-100">{lang === "ro" ? "Joker — literă surpriză" : "Joker — surprise letter"}</div>
            <p className="mt-0.5 text-[11px] text-ink-300">{lang === "ro" ? "Apasă și afli după ce litera ajunge mare pe foaie." : "Press and see which letter lands big on the sheet."}</p>
          </div>
          <button
            onClick={onJoker}
            disabled={disabled || jokersLeft <= 0}
            className="btn btn-sm shrink-0 !border-cp-purple-300/50 !bg-cp-purple-500/45 !text-white hover:!bg-cp-purple-500/60"
            aria-label={lang === "ro" ? `Joker — ${jokersLeft} rămase` : `Joker — ${jokersLeft} left`}
          >
            🃏 <span className="hidden sm:inline">{lang === "ro" ? "Joker" : "Joker"}</span>
            <span className="rounded-full bg-ink-950/60 px-1.5 text-[10px] font-bold">{jokersLeft}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sentence tray (word tiles grouped by grammatical category + custom word)
// ---------------------------------------------------------------------------

function SentenceTray({
  categories,
  selected,
  onSelectCategory,
  remainingOf,
  onSpawn,
  disabled,
  customWord,
  setCustomWord,
  suggestions,
  inPack,
}: {
  categories: Map<string, { w: string; c: string; n: number }[]>;
  selected: string;
  onSelectCategory: (c: string) => void;
  remainingOf: (t: string) => number;
  onSpawn: (w: string, custom?: boolean) => void;
  disabled: boolean;
  customWord: string;
  setCustomWord: (v: string) => void;
  suggestions: string[];
  inPack: boolean;
}) {
  const { lang } = useLang();
  const shown: [string, { w: string; c: string; n: number }[]][] = selected === "all"
    ? [...categories.entries()].sort((a, b) => CATEGORY_ORDER.indexOf(a[0] as (typeof CATEGORY_ORDER)[number]) - CATEGORY_ORDER.indexOf(b[0] as (typeof CATEGORY_ORDER)[number]))
    : [[selected, categories.get(selected) || []]];
  return (
    <div className="space-y-4">
      {/* Custom word */}
      <TraySection label={<span><span className="mr-1">✏️</span><TrayLabel ro="Cuvânt personal" en="Custom word" /></span>}>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const word = customWord.trim();
            if (!word || disabled) return;
            onSpawn(word.normalize("NFC"), !inPack);
            setCustomWord("");
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-ink-500 focus:border-brand-400"
            value={customWord}
            maxLength={40}
            onChange={(e) => setCustomWord(e.target.value)}
            placeholder={lang === "ro" ? "ex. București" : "e.g. PuzzleTogether"}
            aria-label={lang === "ro" ? "Cuvânt personal" : "Custom word"}
          />
          <button type="submit" className="btn-primary btn-sm !px-3" disabled={disabled || !customWord.trim()}>+</button>
        </form>
        <div className="mt-1.5 min-h-[18px] text-[11px] leading-tight">
          {suggestions.length > 0 ? (
            <span className="text-ink-300">
              {lang === "ro" ? "Poate vrei:" : "Did you mean:"}{" "}
              {suggestions.map((s) => (
                <button key={s} className="mx-0.5 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-semibold text-white hover:bg-white/15" onClick={() => setCustomWord(s)}>
                  {s}
                </button>
              ))}
            </span>
          ) : customWord.trim() && !inPack ? (
            <span className="text-amber-300">
              {lang === "ro" ? "Nu e în pachet — rămâne cuvânt personal (soft spellcheck)." : "Not in the pack — stays a custom word (soft spellcheck)."}</span>
          ) : null}
        </div>
      </TraySection>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1">
        {["all", ...CATEGORY_ORDER].map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${selected === cat ? "border-brand-600 bg-brand-600 text-white" : "border-white/15 bg-white/5 text-ink-200 hover:bg-white/10"}`}
          >
            {pick(CATEGORY_NAMES[cat] || { ro: cat, en: cat }, lang)}
          </button>
        ))}
      </div>

      {shown.map(([cat, words]) => (
        <TraySection key={cat} label={<TrayLabel ro={pick(CATEGORY_NAMES[cat] || { ro: cat, en: cat }, lang)} en={pick(CATEGORY_NAMES[cat] || { ro: cat, en: cat }, "en")} />}>
          <div className={cat === "punctuation" ? "grid grid-cols-8 gap-1.5" : "grid grid-cols-2 gap-1.5"}>
            {words.map((entry) => (
              <TrayButton
                key={`${cat}-${entry.w}`}
                label={entry.w}
                count={remainingOf(entry.w)}
                onClick={() => onSpawn(entry.w, false)}
                disabled={disabled}
                wide={entry.c !== "punctuation"}
                punct={entry.c === "punctuation"}
              />
            ))}
          </div>
        </TraySection>
      ))}
    </div>
  );
}

function TraySection({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  const { lang } = useLang();
  return (
    <section>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-ink-400">{label}</div>
      {children}
    </section>
  );
}

function TrayLabel({ ro, en }: { ro: string; en: string }) {
  const { lang } = useLang();
  return <>{lang === "ro" ? ro : en}</>;
}

function TrayButton({ label, count, onClick, disabled, wide = false, punct = false, wildcard = false, tilt = 0 }: { label: string; count: number; onClick: () => void; disabled: boolean; wide?: boolean; punct?: boolean; wildcard?: boolean; tilt?: number }) {
  const { lang } = useLang();
  const depleted = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={disabled || depleted}
      className={`relative flex h-10 select-none items-center justify-center rounded-lg border font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${wide ? "text-sm" : "text-base"} ${
        wildcard
          ? "border-cp-purple-300/45 bg-cp-purple-500/45 text-white hover:bg-cp-purple-500/60"
          : punct
            ? "border-brand-300/35 bg-brand-500/20 text-white hover:bg-brand-500/30"
            : "border-amber-300/35 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25"
      }`}
      title={depleted ? (lang === "ro" ? "Stoc epuizat" : "Out of stock") : undefined}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
      aria-label={`${label} (${count === Infinity ? lang === "ro" ? "nelimitat" : "unlimited" : count})`}
    >
      {label}
      <span className={`absolute -right-1 -top-1 min-w-[16px] rounded-full px-1 text-center text-[9px] font-bold leading-[16px] ${count === Infinity ? "bg-brand-600 text-white" : depleted ? "bg-ink-500 text-white" : "bg-ink-950 text-white"}`}>
        {count === Infinity ? "∞" : count}
      </span>
    </button>
  );
}
