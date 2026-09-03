import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bilingual, Lang } from "../lib/i18n";
import { pick, useLang } from "../lib/i18n";
import type { CursorView, Piece, PlayerView, PuzzleView } from "../types";
import { MAX_SCALE, MIN_SCALE, useViewport } from "./useViewport";
import { buildEdgeMap, buildPiecePath, pieceEdges, spritePad } from "./jigsaw";
import { isEdgePiece, trayLayout, traySlot } from "./tray";
import { store } from "../store";

interface BoardProps {
  puzzle: PuzzleView;
  pieces: Record<number, Piece>;
  cursors: Record<string, CursorView>;
  players: PlayerView[];
  youId: string | null;
  onPieceDrop: (id: number, x: number, y: number, snapped: boolean) => void;
  onResetRequest: () => void;
  allowReset: boolean;
  resetSignal: number;
  inputEnabled: boolean;
}

interface Grab {
  id: number;
  offsetX: number;
  offsetY: number;
  throttle: number;
  lastSentX: number;
  lastSentY: number;
  first: boolean;
}

const SNAP_RING_COLOR = "#34d399";
const TARGET_RING_COLOR = "rgba(99,102,241,0.9)";
const PLACED_RING_COLOR = "rgba(52,211,153,0.9)";
const WORD_TILE_RADIUS = 18;

type FilterMode = "all" | "edge" | "interior" | "unplaced";

const STR = {
  zoomIn: { ro: "Mărește", en: "Zoom in" },
  zoomOut: { ro: "Micșorează", en: "Zoom out" },
  resetView: { ro: "Resetează vederea", en: "Reset view" },
  reference: { ro: "Referință", en: "Reference" },
  playAgain: { ro: "Joacă din nou", en: "Play again" },
  filterAll: { ro: "Toate", en: "All" },
  filterEdge: { ro: "Margine", en: "Edge" },
  filterInterior: { ro: "Interior", en: "Interior" },
  filterUnplaced: { ro: "Neplasate", en: "Unplaced" },
  tray: { ro: "Casetă cu piese", en: "Piece tray" },
  bringUnplaced: { ro: "Aduce piesele neplasate în cadru", en: "Bring unplaced pieces into view" },
  minimap: { ro: "Minihartă", en: "Minimap" },
  board: { ro: "Tablieră puzzle", en: "Puzzle board" },
  pieces: { ro: "piese", en: "pieces" },
} as const satisfies Record<string, Bilingual>;

function buildRoundedRectPath(width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  const path = new Path2D();
  path.moveTo(r, 0);
  path.lineTo(width - r, 0);
  path.quadraticCurveTo(width, 0, width, r);
  path.lineTo(width, height - r);
  path.quadraticCurveTo(width, height, width - r, height);
  path.lineTo(r, height);
  path.quadraticCurveTo(0, height, 0, height - r);
  path.lineTo(0, r);
  path.quadraticCurveTo(0, 0, r, 0);
  path.closePath();
  return path;
}

export default function Board({
  puzzle,
  pieces,
  cursors,
  players,
  youId,
  onPieceDrop,
  onResetRequest,
  allowReset,
  resetSignal,
  inputEnabled,
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { camera, cameraRef, setCamera, zoomAt, zoomBy, fit } = useViewport();

  // Live refs for the draw loop
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const playersRef = useRef(players);
  playersRef.current = players;
  const youRef = useRef(youId);
  youRef.current = youId;
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;

  // Gesture state (mutable, never triggers renders)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; sx: number; sy: number; scale: number } | null>(null);
  const pan = useRef<{ id: number; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const grab = useRef<Grab | null>(null);
  const raf = useRef(0);
  const cursorScreen = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMoveSent = useRef(0);
  const gestureType = useRef<"none" | "pan" | "drag" | "pinch" | "minimap">("none");
  const movedDistance = useRef(0);

  const [showReference, setShowReference] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");

  const imgRef = useRef<HTMLImageElement | null>(null);
  const spriteCache = useRef(new Map<string, HTMLCanvasElement>());
  const pathCache = useRef(new Map<number, Path2D>());
  const imgGen = useRef(0);
  const minimapRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const minimapMap = useRef<{
    s: number;
    ox: number;
    oy: number;
    bx0: number;
    by0: number;
    mm: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Jigsaw cut: deterministic edge map shared by all players via the server seed.
  const edgeMap = useMemo(
    () => buildEdgeMap(puzzle.cols, puzzle.rows, puzzle.seed || 0),
    [puzzle.cols, puzzle.rows, puzzle.seed],
  );
  const edgeMapRef = useRef(edgeMap);
  useEffect(() => {
    edgeMapRef.current = edgeMap;
    spriteCache.current.clear();
    pathCache.current.clear();
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeMap]);

  // ------------------------------------------------------------------ image
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    imgGen.current += 1;
    const gen = imgGen.current;
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      spriteCache.current.clear();
      // Cheap "wake up" of the render loop
      schedule();
    };
    img.onerror = () => {
      if (!cancelled) schedule();
    };
    img.src = puzzle.image;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.image]);

  // ----------------------------------------------------------- canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      schedule();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Initial fit once puzzle geometry is known
  const fittedFor = useRef("");
  useEffect(() => {
    const key = `${puzzle.width}x${puzzle.height}`;
    if (fittedFor.current !== key) {
      fittedFor.current = key;
      fit(puzzle);
    }
  }, [puzzle, fit]);

  // ------------------------------------------- dirty rendering (no 60fps loop)
  // The board repaints ONLY when something changed: a state update marks the
  // frame dirty and requests a single rAF draw. While idle, zero draws happen.
  const dirty = useRef(true);
  const drawsRef = useRef({ count: 0, lastAt: 0 });
  const schedule = useCallback(() => {
    dirty.current = true;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (dirty.current) drawRef.current();
    });
  }, []);

  // Draw via refs so gestures never re-render React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => draw();

  // Telemetry hook for the FPS/memory tests (scripts/jigsaw-perf-test.mjs).
  useEffect(() => {
    (window as unknown as { __ptDraws?: unknown }).__ptDraws = drawsRef;
    return () => {
      delete (window as unknown as { __ptDraws?: unknown }).__ptDraws;
    };
  }, []);

  // Placement-glow driver: repaint frame-by-frame only while a glow is live
  // (700ms per snapped piece), then stop.
  const glowAnim = useRef(0);
  const startGlowAnimation = useCallback(() => {
    cancelAnimationFrame(glowAnim.current);
    const step = () => {
      const now = Date.now();
      const active = [...lockedTimes.current.values()].some((t) => now - t < 700);
      if (active) {
        schedule();
        glowAnim.current = requestAnimationFrame(step);
      }
    };
    glowAnim.current = requestAnimationFrame(step);
  }, [schedule]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(glowAnim.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  // Dirty on any external state change that draw() reads from refs/props.
  const { lang } = useLang();
  useEffect(() => {
    schedule();
  }, [pieces, cursors, players, showReference, filter, lang, schedule]);
  useEffect(() => {
    schedule();
  }, [camera, schedule]);

  // Keep cursor chips fresh/expired with at most one housekeeping draw per
  // second — and nothing at all when no remote cursor is on screen.
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      if (Object.values(cursorsRef.current).some((c) => now - c.at < 4500)) schedule();
    }, 1000);
    return () => clearInterval(iv);
  }, [schedule]);

  // External resets: clear sprite cache & re-fit
  useEffect(() => {
    if (resetSignal > 0) {
      spriteCache.current.clear();
      pathCache.current.clear();
      fittedFor.current = "";
      fit(puzzleRef.current);
      schedule();
    }
  }, [resetSignal, fit, schedule]);

  // Debug/testing hook: expose the live camera.
  useEffect(() => {
    (window as unknown as { __ptCamera?: unknown }).__ptCamera = cameraRef;
    return () => {
      delete (window as unknown as { __ptCamera?: unknown }).__ptCamera;
    };
  }, [cameraRef]);

  // Keyboard: escape cancels a drag / hides reference, arrows pan, + - zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          if (grab.current) {
            grab.current = null;
            canvasRef.current?.setPointerCapture?.(undefined as unknown as number);
          } else {
            setShowReference((v) => !v);
          }
          break;
        case "+":
        case "=":
          zoomBy(1.25);
          break;
        case "-":
        case "_":
          zoomBy(0.8);
          break;
        case "ArrowUp":
          panBy(0, 80);
          break;
        case "ArrowDown":
          panBy(0, -80);
          break;
        case "ArrowLeft":
          panBy(80, 0);
          break;
        case "ArrowRight":
          panBy(-80, 0);
          break;
      }
    };
    const panBy = (dx: number, dy: number) => {
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      schedule();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, cameraRef, schedule]);

  // ------------------------------------------------------------- geometry
  const screenToWorld = (sx: number, sy: number) => {
    const { x, y, scale } = cameraRef.current;
    return { x: (sx - x) / scale, y: (sy - y) / scale };
  };

  // ------------------------------------------------------------- sprites
  function isWordPiece(piece: Piece) {
    return puzzleRef.current.category === "words" || !!piece.letter;
  }

  function getPiecePath(piece: Piece): Path2D {
    const cached = pathCache.current.get(piece.id);
    if (cached) return cached;
    const { pieceW, pieceH, cols } = puzzleRef.current;
    const path = isWordPiece(piece)
      ? buildRoundedRectPath(pieceW, pieceH, Math.min(WORD_TILE_RADIUS, pieceW * 0.18, pieceH * 0.18))
      : buildPiecePath(pieceW, pieceH, pieceEdges(edgeMapRef.current, piece.id % cols, Math.floor(piece.id / cols)));
    pathCache.current.set(piece.id, path);
    return path;
  }

  function getSprite(piece: Piece): HTMLCanvasElement | null {
    const img = imgRef.current;
    const wordPiece = isWordPiece(piece);
    if (!wordPiece && (!img || !img.complete || !img.naturalWidth)) return null;
    const key = `${piece.id}`;
    const cached = spriteCache.current.get(key);
    if (cached) return cached;
    const { correctX, correctY } = piece;
    const { pieceW, pieceH } = puzzleRef.current;
    const pad = spritePad(pieceW, pieceH);
    const cw = Math.ceil(pieceW + pad * 2);
    const ch = Math.ceil(pieceH + pad * 2);
    const spr = document.createElement("canvas");
    spr.width = cw;
    spr.height = ch;
    const ctx = spr.getContext("2d")!;
    const path = getPiecePath(piece);
    const lw = Math.max(1.4, Math.min(pieceW, pieceH) * 0.02);

    ctx.save();
    ctx.translate(pad, pad); // piece-local origin

    if (wordPiece) {
      const radius = Math.min(WORD_TILE_RADIUS, pieceW * 0.18, pieceH * 0.18);
      const tilePath = buildRoundedRectPath(pieceW, pieceH, radius);
      const base = piece.letterColor || "#6366f1";
      const gloss = ctx.createLinearGradient(0, 0, 0, pieceH);
      gloss.addColorStop(0, "rgba(255,255,255,0.22)");
      gloss.addColorStop(0.45, "rgba(255,255,255,0.06)");
      gloss.addColorStop(1, "rgba(2,6,23,0.22)");
      const sheen = ctx.createLinearGradient(0, 0, pieceW, pieceH * 0.9);
      sheen.addColorStop(0, "rgba(255,255,255,0.26)");
      sheen.addColorStop(0.28, "rgba(255,255,255,0.08)");
      sheen.addColorStop(0.55, "rgba(255,255,255,0)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = base;
      ctx.fill(tilePath);
      ctx.fillStyle = gloss;
      ctx.fill(tilePath);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, radius + 8);
      ctx.quadraticCurveTo(pieceW * 0.22, -6, pieceW * 0.54, pieceH * 0.18);
      ctx.quadraticCurveTo(pieceW * 0.76, pieceH * 0.28, pieceW, pieceH * 0.18);
      ctx.lineTo(pieceW, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.clip(tilePath);
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, pieceW, pieceH * 0.48);
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = lw;
      ctx.lineJoin = "round";
      ctx.stroke(tilePath);

      ctx.save();
      ctx.strokeStyle = "rgba(15,23,42,0.2)";
      ctx.lineWidth = lw * 2.2;
      ctx.translate(lw * 0.5, lw * 0.7);
      ctx.stroke(tilePath);
      ctx.restore();

      const letter = (piece.letter || "?").slice(0, 1).toUpperCase();
      const fontSize = Math.max(22, Math.min(pieceW, pieceH) * 0.52);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.shadowColor = "rgba(15,23,42,0.28)";
      ctx.shadowBlur = Math.max(4, fontSize * 0.08);
      ctx.shadowOffsetY = Math.max(1, fontSize * 0.04);
      ctx.fillText(letter, pieceW / 2, pieceH / 2 + fontSize * 0.02);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const badgeSize = Math.max(18, Math.min(pieceW, pieceH) * 0.22);
      const badgeX = pieceW - badgeSize - Math.max(8, pieceW * 0.08);
      const badgeY = pieceH - badgeSize - Math.max(8, pieceH * 0.08);
      const badgePath = buildRoundedRectPath(badgeSize, badgeSize, badgeSize * 0.34);
      ctx.save();
      ctx.translate(badgeX, badgeY);
      ctx.fillStyle = "rgba(15,23,42,0.28)";
      ctx.fill(badgePath);
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.lineWidth = 1.2;
      ctx.stroke(badgePath);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.max(10, badgeSize * 0.42)}px Inter, system-ui, sans-serif`;
      ctx.fillText(String(piece.letterPoints || 1), badgeSize / 2, badgeSize / 2 + 0.5);
      ctx.restore();
    } else {
      ctx.save();
      ctx.clip(path);
      // Photo, positioned so this piece's region (plus tab bleed) lines up.
      ctx.drawImage(img!, -correctX, -correctY);
      // Bevel: light catch on the top-left, soft shade on the bottom-right.
      ctx.save();
      ctx.translate(-lw * 0.6, -lw * 0.6);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = lw * 2.1;
      ctx.stroke(path);
      ctx.restore();
      ctx.save();
      ctx.translate(lw * 0.6, lw * 0.6);
      ctx.strokeStyle = "rgba(0,0,0,0.32)";
      ctx.lineWidth = lw * 2.1;
      ctx.stroke(path);
      ctx.restore();
      ctx.restore();
      // Crisp die-cut outline.
      ctx.strokeStyle = "rgba(10,13,26,0.55)";
      ctx.lineWidth = lw;
      ctx.lineJoin = "round";
      ctx.stroke(path);
    }

    ctx.restore();
    spriteCache.current.set(key, spr);
    return spr;
  }

  // ---------------------------------------------------------------- draw
  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    drawsRef.current.count += 1;
    drawsRef.current.lastAt = performance.now();
    dirty.current = false;
    const { x: cx, y: cy, scale } = cameraRef.current;
    const puzzle = puzzleRef.current;
    const pieces = piecesRef.current;
    const cursors = cursorsRef.current;
    const players = playersRef.current;
    const you = youRef.current;
    const now = Date.now();
    const tLayout = trayLayout(puzzle, Object.keys(pieces).length);
    // Unplaced pieces live in the deterministic tray; everything else uses
    // the (server-confirmed) world position.
    const dispPos = (p: Piece) =>
      p.locked || p.moved ? { x: p.x, y: p.y } : traySlot(tLayout, p.id);
    const filterMatch = (p: Piece) => {
      if (filter === "all") return true;
      if (filter === "unplaced") return !p.locked && !p.moved;
      const edge = isEdgePiece(p.id, puzzle.cols, puzzle.rows);
      return filter === "edge" ? edge : !edge;
    };
    const lockedCount = Object.values(pieces).filter((p) => p.locked).length;
    const mysteryHidden =
      !!puzzle.mystery && Object.keys(pieces).length > 0 && lockedCount * 2 < Object.keys(pieces).length;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background dot grid (world-fixed for a subtle "infinite canvas" feel)
    const dotSpace = 34;
    const offX = ((cx / scale) % dotSpace + dotSpace) % dotSpace;
    const offY = ((cy / scale) % dotSpace + dotSpace) % dotSpace;
    const dotsX = Math.ceil(w / (dotSpace * scale)) + 1;
    const dotsY = Math.ceil(h / (dotSpace * scale)) + 1;
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    for (let i = 0; i <= dotsX; i++) {
      for (let j = 0; j <= dotsY; j++) {
        ctx.beginPath();
        ctx.arc(i * dotSpace * scale - offX * scale, j * dotSpace * scale - offY * scale, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Target area (subtle dashed outline of the final puzzle)
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      cx,
      cy,
      puzzle.width * scale,
      puzzle.height * scale,
    );
    ctx.setLineDash([]);

    // Ghost image (strongly dimmed) inside the target area — hidden in
    // mystery mode until half the pieces are locked.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth && !mysteryHidden) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, puzzle.width * scale, puzzle.height * scale);
      ctx.clip();
      ctx.globalAlpha = 0.075;
      ctx.drawImage(img, cx, cy, puzzle.width * scale, puzzle.height * scale);
      ctx.restore();
    }

    // Sort pieces: locked first, then dragging on top
    const list = Object.values(pieces);
    list.sort((a, b) => {
      const la = a.locked ? 1 : 0;
      const lb = b.locked ? 1 : 0;
      if (la !== lb) return la - lb;
      const da = a.drag ? 1 : 0;
      const db = b.drag ? 1 : 0;
      return da - db;
    });

    const grabPiece = grab.current ? pieces[grab.current.id] : null;
    const playersById = new Map(players.map((player) => [player.id, player]));
    const pad = spritePad(puzzle.pieceW, puzzle.pieceH);
    const sw = (puzzle.pieceW + pad * 2) * scale;
    const sh = (puzzle.pieceH + pad * 2) * scale;

    // Strokes a piece's jigsaw outline at an arbitrary world position.
    const strokePieceAt = (
      piece: Piece,
      worldX: number,
      worldY: number,
      style: string,
      widthPx: number,
      alpha: number,
    ) => {
      const path = getPiecePath(piece);
      ctx.save();
      ctx.translate(worldX * scale + cx, worldY * scale + cy);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = widthPx / scale;
      ctx.lineJoin = "round";
      ctx.stroke(path);
      ctx.restore();
    };

    // Tray panel behind the unplaced pieces (deterministic, non-overlapping).
    const unplacedList = list.filter((p) => !p.locked && !p.moved);
    if (unplacedList.length > 0) {
      const tx = tLayout.origin.x * scale + cx - 14;
      const ty = tLayout.origin.y * scale + cy - 28;
      const tw = tLayout.width * scale + 28;
      const th = tLayout.height * scale + 40;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "700 10px Inter, system-ui, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(
        `${pick(STR.tray, lang)} · ${unplacedList.length} ${pick(STR.pieces, lang)}`,
        tx + 12,
        ty + 16,
      );
      ctx.restore();
    }

    for (const piece of list) {
      const pos = dispPos(piece);
      const x = pos.x * scale + cx;
      const y = pos.y * scale + cy;
      const spr = getSprite(piece);
      const isGrabbed = grabPiece === piece && piece.drag;
      const dx = x - pad * scale;
      const dy = y - pad * scale;
      const dimmed = !filterMatch(piece);

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.14 : 1;

      if (piece.locked) {
        // Locked pieces sit flush in the picture — no shadow.
        if (spr) ctx.drawImage(spr, dx, dy, sw, sh);
        // Completion glow right after a piece snaps home.
        const lockedT = lockedTimes.current.get(piece.id);
        if (lockedT !== undefined) {
          const t = (now - lockedT) / 700;
          if (t < 1) {
            strokePieceAt(piece, piece.x, piece.y, PLACED_RING_COLOR, 3, 1 - t);
          } else {
            lockedTimes.current.delete(piece.id);
          }
        }
        ctx.restore();
        continue;
      }
      lockedTimes.current.delete(piece.id);

      // Free pieces cast a soft shadow that follows the jigsaw silhouette.
      if (spr) {
        ctx.save();
        if (isGrabbed) {
          ctx.shadowColor = "rgba(0,0,0,0.42)";
          ctx.shadowBlur = 22;
          ctx.shadowOffsetY = 10;
        } else {
          ctx.shadowColor = "rgba(0,0,0,0.30)";
          ctx.shadowBlur = 9;
          ctx.shadowOffsetY = 4;
        }
        ctx.drawImage(spr, dx, dy, sw, sh);
        ctx.restore();
      }

      const claimOwner = piece.heldBy ? playersById.get(piece.heldBy) : null;
      if (claimOwner) {
        strokePieceAt(piece, pos.x, pos.y, claimOwner.color, 3, 0.98);
        ctx.save();
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        const label = `${claimOwner.name} holds this piece`;
        const labelW = ctx.measureText(label).width + 14;
        ctx.fillStyle = claimOwner.color;
        ctx.beginPath();
        ctx.roundRect(x, y - 25, labelW, 20, 10);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + 7, y - 15);
        ctx.restore();
      }
      if (isGrabbed) {
        strokePieceAt(piece, pos.x, pos.y, SNAP_RING_COLOR, 2, 0.95);
      } else if (piece.moved) {
        // Ghost outline of the piece's home slot when it gets close.
        const ddx = piece.correctX - pos.x;
        const ddy = piece.correctY - pos.y;
        const dist = Math.hypot(ddx, ddy);
        const { snapDistance } = puzzle;
        if (dist < snapDistance * 6) {
          const near = dist < snapDistance * 2;
          strokePieceAt(
            piece,
            piece.correctX,
            piece.correctY,
            near ? TARGET_RING_COLOR : "rgba(99,102,241,0.35)",
            near ? 2.5 : 1.5,
            near ? 0.95 : 0.5,
          );
        }
      }
      ctx.restore();
    }

    // Remote cursors + name chips
    for (const [id, c] of Object.entries(cursors)) {
      if (id === you) continue;
      if (now - c.at > 4000) continue;
      const screenX = c.x * scale + cx;
      const screenY = c.y * scale + cy;
      const player = playersById.get(id);
      if (!player) continue;
      ctx.save();
      // Arrow pointer
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + 13, screenY + 10);
      ctx.lineTo(screenX + 6.5, screenY + 9.5);
      ctx.lineTo(screenX + 8, screenY + 17);
      ctx.lineTo(screenX + 3, screenY + 12);
      ctx.lineTo(screenX - 1, screenY + 15);
      ctx.closePath();
      ctx.fillStyle = player.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fill();
      // Name chip
      const label = `${player.name} 👆`;
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      const tw = ctx.measureText(label).width;
      const bx = screenX + 14;
      const by = screenY + 16;
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + 14, 20, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + 7, by + 10.5);
      ctx.restore();
    }

    // Reference image (top-right) — hidden in mystery mode until 50% placed
    if (showReference && !mysteryHidden) {
      const pw = puzzle.width;
      const ph = puzzle.height;
      const mobile = w < 640;
      const bw = mobile ? Math.min(124, Math.round(w * 0.34)) : 168;
      const bh = Math.min((bw * ph) / pw, mobile ? 100 : 132);
      const bx = w - bw - (mobile ? 12 : 20);
      const by = mobile ? 148 : 108;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#10141f";
      ctx.beginPath();
      ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.clip();
        ctx.drawImage(img, bx, by, bw, bh);
        ctx.restore();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 10.5px Inter, system-ui, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(pick(STR.reference, lang), bx + 2, by + bh + 16 + 4);
      ctx.restore();
    }

    // Minimap (bottom-right, screen space): target area, every piece as a dot
    // (green = placed, white = in tray, amber = free), plus the current view.
    const mm = { w: 132, h: 96, x: w - 148, y: h - 116 };
    minimapRect.current = mm;
    let bx0 = 0;
    let by0 = 0;
    let bx1 = puzzle.width;
    let by1 = puzzle.height;
    if (unplacedList.length > 0) {
      bx1 = Math.max(bx1, tLayout.origin.x + tLayout.width);
      by1 = Math.max(by1, tLayout.origin.y + tLayout.height);
    }
    for (const p of list) {
      if (!p.locked && p.moved) {
        bx0 = Math.min(bx0, p.x);
        by0 = Math.min(by0, p.y);
        bx1 = Math.max(bx1, p.x + puzzle.pieceW);
        by1 = Math.max(by1, p.y + puzzle.pieceH);
      }
    }
    const bw = Math.max(1, bx1 - bx0);
    const bh = Math.max(1, by1 - by0);
    const ms = Math.min(mm.w / bw, mm.h / bh);
    const mox = mm.x + (mm.w - bw * ms) / 2;
    const moy = mm.y + (mm.h - bh * ms) / 2;
    minimapMap.current = { s: ms, ox: mox, oy: moy, bx0, by0, mm };
    ctx.save();
    ctx.fillStyle = "rgba(10,13,26,0.85)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mm.x - 8, mm.y - 22, mm.w + 16, mm.h + 32, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "700 9px Inter, system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(pick(STR.minimap, lang), mm.x, mm.y - 8);
    const mmx = (wx: number) => mox + (wx - bx0) * ms;
    const mmy = (wy: number) => moy + (wy - by0) * ms;
    ctx.strokeStyle = "rgba(99,102,241,0.9)";
    ctx.strokeRect(mmx(0), mmy(0), puzzle.width * ms, puzzle.height * ms);
    for (const p of list) {
      const pos = dispPos(p);
      ctx.fillStyle = p.locked
        ? "rgba(52,211,153,0.95)"
        : !p.moved
          ? "rgba(255,255,255,0.55)"
          : "rgba(251,191,36,0.95)";
      ctx.fillRect(mmx(pos.x) - 1, mmy(pos.y) - 1, 2, 2);
    }
    const vw0 = -cx / scale;
    const vw1 = (w - cx) / scale;
    const vh0 = -cy / scale;
    const vh1 = (h - cy) / scale;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeRect(mmx(vw0), mmy(vh0), (vw1 - vw0) * ms, (vh1 - vh0) * ms);
    ctx.restore();
  }

  // Ring animation bookkeeping: remember when each piece became locked
  const lockedTimes = useRef(new Map<number, number>());
  const prevLocked = useRef(new Map<number, boolean>());
  useEffect(() => {
    const pieces = piecesRef.current;
    const now = Date.now();
    let newlyLocked = false;
    for (const p of Object.values(pieces)) {
      const was = prevLocked.current.get(p.id) || false;
      if (p.locked && !was) {
        lockedTimes.current.set(p.id, now);
        newlyLocked = true;
      }
      if (!p.locked && was) lockedTimes.current.delete(p.id);
      prevLocked.current.set(p.id, p.locked);
    }
    if (newlyLocked) startGlowAnimation();
    schedule();
  }, [pieces, schedule, startGlowAnimation]);

  // ------------------------------------------------------------- pointers
  const posFromEvent = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Display (on-screen world) position of a piece: tray slot while unplaced.
  function displayPos(p: Piece) {
    const puzzle = puzzleRef.current;
    if (p.locked || p.moved) return { x: p.x, y: p.y };
    return traySlot(trayLayout(puzzle, Object.keys(piecesRef.current).length), p.id);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const pos = posFromEvent(e);
    pointers.current.set(e.pointerId, pos);
    cursorScreen.current = pos;

    // Minimap navigation takes priority over piece picking / panning.
    const mm = minimapRect.current;
    if (
      mm &&
      pos.x >= mm.x - 8 &&
      pos.x <= mm.x + mm.w + 8 &&
      pos.y >= mm.y - 22 &&
      pos.y <= mm.y + mm.h + 10
    ) {
      gestureType.current = "minimap";
      schedule();
      return;
    }

    if (e.pointerType === "mouse") {
      // Clicked a piece? (top-most: prefer free pieces over locked)
      const world = screenToWorld(pos.x, pos.y);
      const hit = inputEnabled ? pickPiece(world.x, world.y, !!e.shiftKey) : null;
      if (hit) {
        gestureType.current = "drag";
        const hp = displayPos(hit);
        grab.current = {
          id: hit.id,
          offsetX: world.x - hp.x,
          offsetY: world.y - hp.y,
          throttle: performance.now(),
          lastSentX: hit.x,
          lastSentY: hit.y,
          first: true,
        };
        // Local visual lift immediately (server confirms). A tray piece
        // leaves the tray the moment it is picked up.
        const pieces = piecesRef.current;
        const p = pieces[hit.id];
        if (p) {
          p.drag = true;
          p.moved = true;
          p.x = hp.x;
          p.y = hp.y;
          store.sendPiece(hit.id, p.x, p.y, true);
          schedule();
        }
      } else {
        gestureType.current = "pan";
        pan.current = {
          id: e.pointerId,
          sx: pos.x,
          sy: pos.y,
          cx: cameraRef.current.x,
          cy: cameraRef.current.y,
        };
      }
    } else if (e.pointerType === "touch") {
      if (pointers.current.size === 1) {
        const world = screenToWorld(pos.x, pos.y);
        const hit = inputEnabled ? pickPiece(world.x, world.y, false, 20) : null;
        if (hit) {
          gestureType.current = "drag";
          const hp = displayPos(hit);
          grab.current = {
            id: hit.id,
            offsetX: world.x - hp.x,
            offsetY: world.y - hp.y,
            throttle: performance.now(),
            lastSentX: hit.x,
            lastSentY: hit.y,
            first: true,
          };
          const p = piecesRef.current[hit.id];
          if (p) {
            p.drag = true;
            p.moved = true;
            p.x = hp.x;
            p.y = hp.y;
            store.sendPiece(hit.id, p.x, p.y, true);
            schedule();
          }
        } else {
          gestureType.current = "pan";
          pan.current = {
            id: e.pointerId,
            sx: pos.x,
            sy: pos.y,
            cx: cameraRef.current.x,
            cy: cameraRef.current.y,
          };
        }
      } else if (pointers.current.size === 2) {
        // Second finger: switch to pinch
        if (gestureType.current === "drag" && grab.current) {
          const p = piecesRef.current[grab.current.id];
          if (p) {
            p.drag = false;
            store.sendPiece(grab.current.id, p.x, p.y, false);
          }
          grab.current = null;
        }
        const pts = [...pointers.current.values()];
        pinch.current = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          sx: (pts[0].x + pts[1].x) / 2,
          sy: (pts[0].y + pts[1].y) / 2,
          scale: cameraRef.current.scale,
        };
        gestureType.current = "pinch";
        pan.current = null;
      } else {
        gestureType.current = "pinch";
      }
    }
    schedule();
  }

  function pickPiece(wx: number, wy: number, allowLocked: boolean, touchMargin = 0): Piece | null {
    const pieces = piecesRef.current;
    const puzzle = puzzleRef.current;
    const margin = touchMargin / Math.max(cameraRef.current.scale, 0.001);
    const tLayout = trayLayout(puzzle, Object.keys(pieces).length);
    let best: Piece | null = null;
    let bestFree = false;
    for (const p of Object.values(pieces)) {
      if (p.locked && !allowLocked) continue;
      if (p.heldBy && p.heldBy !== youRef.current) continue;
      const pos = p.locked || p.moved ? { x: p.x, y: p.y } : traySlot(tLayout, p.id);
      if (
        wx >= pos.x - margin &&
        wx <= pos.x + puzzle.pieceW + margin &&
        wy >= pos.y - margin &&
        wy <= pos.y + puzzle.pieceH + margin
      ) {
        if (p.locked && !bestFree) {
          best = best || p;
          continue;
        }
        if (!p.locked && !bestFree) {
          bestFree = true;
          best = p;
        } else if (!p.locked && bestFree) {
          // prefer the most recently moved (top-most visually due to sort)
          best = p;
        }
      }
    }
    return best;
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = posFromEvent(e);
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pos);
    cursorScreen.current = pos;

    if (gestureType.current === "drag" && grab.current) {
      const world = screenToWorld(pos.x, pos.y);
      movedDistance.current += 1;
      const piece = piecesRef.current[grab.current.id];
      if (piece) {
        piece.x = world.x - grab.current.offsetX;
        piece.y = world.y - grab.current.offsetY;
        const now = performance.now();
        if (now - grab.current.throttle >= 50 || grab.current.first) {
          grab.current.throttle = now;
          grab.current.first = false;
          store.sendPiece(piece.id, piece.x, piece.y, true);
        }
      }
      schedule();
      return;
    }

    if (gestureType.current === "pan" && pan.current && e.pointerId === pan.current.id) {
      cameraRef.current.x = pan.current.cx + (pos.x - pan.current.sx);
      cameraRef.current.y = pan.current.cy + (pos.y - pan.current.sy);
      schedule();
      return;
    }

    if (gestureType.current === "pinch" && pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current.dist > 0) {
        const factor = dist / pinch.current.dist;
        const base = cameraRef.current;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * factor));
        const k = scale / base.scale;
        base.scale = scale;
        base.x = pinch.current.sx - (pinch.current.sx - base.x) * k;
        base.y = pinch.current.sy - (pinch.current.sy - base.y) * k;
        schedule();
      }
      return;
    }

    if (gestureType.current === "minimap") {
      const map = minimapMap.current;
      if (map) {
        const wx = (pos.x - map.ox) / map.s + map.bx0;
        const wy = (pos.y - map.oy) / map.s + map.by0;
        cameraRef.current.x = canvas.clientWidth / 2 - wx * cameraRef.current.scale;
        cameraRef.current.y = canvas.clientHeight / 2 - wy * cameraRef.current.scale;
        schedule();
      }
      return;
    }

    // No gesture: relay cursor position (throttled)
    const now = performance.now();
    if (now - lastMoveSent.current > 40) {
      lastMoveSent.current = now;
      const world = screenToWorld(pos.x, pos.y);
      store.sendCursor(world.x, world.y);
    }
  }

  function endGrab(finalX?: number, finalY?: number) {
    const g = grab.current;
    if (!g) return;
    const piece = piecesRef.current[g.id];
    grab.current = null;
    if (!piece) return;
    const px = finalX ?? piece.x;
    const py = finalY ?? piece.y;
    const puzzle = puzzleRef.current;
    const d = Math.hypot(px - piece.correctX, py - piece.correctY);
    const snapped = d <= puzzle.snapDistance;
    piece.drag = false;
    piece.x = px;
    piece.y = py;
    store.sendPiece(piece.id, px, py, false);
    if (snapped) {
      store.applyLocalDrop(piece.id, px, py, true);
    } else {
      store.applyLocalDrop(piece.id, px, py, false);
    }
    onPieceDrop(piece.id, px, py, snapped);
    schedule();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (gestureType.current === "drag") {
      const pos = posFromEvent(e);
      const world = screenToWorld(pos.x, pos.y);
      endGrab(world.x - (grab.current?.offsetX ?? 0), world.y - (grab.current?.offsetY ?? 0));
    }
    if (gestureType.current === "pan") pan.current = null;
    if (gestureType.current === "pinch") pinch.current = null;
    if (gestureType.current === "minimap" && pointers.current.size === 0) {
      gestureType.current = "none";
    }
    if (pointers.current.size === 0) {
      gestureType.current = "none";
      movedDistance.current = 0;
    }
  }

  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    onPointerUp(e);
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pos = posFromEvent(e as unknown as React.PointerEvent);
    const factor = Math.exp(-e.deltaY * 0.0016);
    zoomAt(pos.x, pos.y, factor);
  }

  // Bring the tray (unplaced pieces) into view.
  const bringUnplacedIntoView = () => {
    const p = puzzleRef.current;
    const total = Object.keys(piecesRef.current).length;
    const t = trayLayout(p, total);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(1.6, Math.max(MIN_SCALE, Math.min(vw / (t.width + 160), vh / (t.height + 200))));
    setCamera({
      x: vw / 2 - (t.origin.x + t.width / 2) * scale,
      y: vh / 2 - (t.origin.y + t.height / 2) * scale,
      scale,
    });
  };

  const totalPieces = Object.keys(pieces).length;
  const lockedCount = Object.values(pieces).filter((p) => p.locked).length;
  const mysteryHidden = !!puzzle.mystery && totalPieces > 0 && lockedCount * 2 < totalPieces;

  // ----------------------------------------------------------- controls
  const t = (b: Bilingual) => pick(b, lang);
  const zoomControls = (factor: number, label: Bilingual) => (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-ink-900/85 text-lg font-semibold text-white shadow-chip backdrop-blur transition hover:bg-ink-800 active:scale-95 sm:h-10 sm:w-10"
      onClick={() => zoomBy(factor)}
      title={t(label)}
      aria-label={t(label)}
    >
      {factor > 1 ? "+" : "−"}
    </button>
  );

  const filterOptions: Array<{ id: FilterMode; label: Bilingual }> = [
    { id: "all", label: STR.filterAll },
    { id: "edge", label: STR.filterEdge },
    { id: "interior", label: STR.filterInterior },
    { id: "unplaced", label: STR.filterUnplaced },
  ];

  const { scale } = camera;

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${t(STR.board)}${puzzle.credit ? ` · ${puzzle.credit}` : ""}`}
        className={`block h-full w-full touch-none ${inputEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-move"}`}
        style={{ backgroundColor: "#0b0e1a", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Piece filters */}
      <div
        className="absolute left-1/2 top-[64px] flex -translate-x-1/2 gap-0.5 rounded-xl border border-white/10 bg-ink-900/85 p-1 shadow-chip backdrop-blur"
        role="group"
        aria-label={t(STR.filterAll)}
      >
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            aria-pressed={filter === opt.id}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition sm:px-2.5 ${
              filter === opt.id
                ? "bg-brand-600/40 text-white"
                : "text-ink-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t(opt.label)}
          </button>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="safe-bottom absolute bottom-4 left-3 flex flex-col items-center gap-2 sm:bottom-5 sm:left-5">
        {zoomControls(1.25, STR.zoomIn)}
        <button
          className="flex h-8 w-9 items-center justify-center rounded-lg border border-white/10 bg-ink-900/85 text-[11px] font-semibold text-ink-200 shadow-chip backdrop-blur sm:w-10"
          onClick={() => {
            fit(puzzle);
          }}
          title={t(STR.resetView)}
        >
          {Math.round(scale * 100)}%
        </button>
        {zoomControls(0.8, STR.zoomOut)}
      </div>

      {/* Reset view + bring the unplaced tray into view */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-5">
        <button
          className="btn btn-dark btn-sm !px-3 sm:!px-4"
          onClick={() => fit(puzzle)}
          title={t(STR.resetView)}
        >
          ⌂<span className="hidden sm:inline">&nbsp;{t(STR.resetView)}</span>
        </button>
        <button
          className="btn btn-dark btn-sm !border-sky-400/40 !bg-sky-500/20 !px-3 hover:!bg-sky-500/30 sm:!px-4"
          onClick={bringUnplacedIntoView}
          title={t(STR.bringUnplaced)}
          aria-label={t(STR.bringUnplaced)}
        >
          🧺<span className="hidden sm:inline">&nbsp;{t(STR.bringUnplaced)}</span>
        </button>
      </div>

      {/* Reference image toggle (mystery mode reveals it at 50% placed) */}
      <button
        className={`btn btn-dark btn-sm absolute right-3 top-[104px] !px-2.5 sm:right-5 sm:top-16 sm:!px-4 ${
          showReference && !mysteryHidden ? "border-brand-500/60 bg-brand-600/30" : ""
        } ${mysteryHidden ? "opacity-50" : ""}`}
        onClick={() => {
          if (!mysteryHidden) setShowReference((v) => !v);
        }}
        disabled={mysteryHidden}
        title={
          mysteryHidden
            ? lang === "ro"
              ? "Mod mister: referința apare la 50% piese plasate"
              : "Mystery mode: the reference reveals at 50% placed pieces"
            : lang === "ro"
              ? "Comută imaginea de referință"
              : "Toggle reference image"
        }
      >
        {mysteryHidden ? "❓" : "🖼️"}
        <span className="hidden sm:inline">&nbsp;{t(STR.reference)}</span>
      </button>

      {/* Restart (room completed) */}
      {allowReset && (
        <button
          className="btn btn-dark btn-sm absolute right-3 bottom-4 !border-emerald-400/40 !bg-emerald-500/20 hover:!bg-emerald-500/30 sm:right-5 sm:bottom-5"
          onClick={onResetRequest}
          title={
            lang === "ro"
              ? "Răspânduiește piesele și joacă din nou"
              : "Scatter the pieces and play again"
          }
        >
          ↺ {t(STR.playAgain)}
        </button>
      )}
    </div>
  );
}
