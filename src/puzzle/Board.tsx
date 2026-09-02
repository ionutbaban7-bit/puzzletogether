import { useCallback, useEffect, useRef, useState } from "react";
import type { CursorView, Piece, PlayerView, PuzzleView } from "../types";
import { MAX_SCALE, MIN_SCALE, useViewport } from "./useViewport";
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
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { camera, cameraRef, zoomAt, zoomBy, fit } = useViewport();

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
  const gestureType = useRef<"none" | "pan" | "drag" | "pinch">("none");
  const movedDistance = useRef(0);

  const [showReference, setShowReference] = useState(true);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const spriteCache = useRef(new Map<string, HTMLCanvasElement>());
  const imgGen = useRef(0);

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

  // -------------------------------------------------------------- schedule
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, []);

  // Draw via refs so gestures never re-render React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => draw();

  // External resets: clear sprite cache & re-fit
  useEffect(() => {
    if (resetSignal > 0) {
      spriteCache.current.clear();
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

  function worldToScreen(piece: Piece) {
    const { x, y, scale } = cameraRef.current;
    return { x: piece.x * scale + x, y: piece.y * scale + y };
  }

  // ------------------------------------------------------------- sprites
  function getSprite(piece: Piece): HTMLCanvasElement | null {
    const img = imgRef.current;
    if (!img || !img.complete || !img.naturalWidth) return null;
    const key = `${piece.id}`;
    const cached = spriteCache.current.get(key);
    if (cached) return cached;
    const { correctX, correctY } = piece;
    const { pieceW, pieceH } = puzzleRef.current;
    // Include the 4px white frame + 8px shadow bleed in the source crop
    const pad = 12;
    const sx = Math.max(0, Math.floor(correctX - pad));
    const sy = Math.max(0, Math.floor(correctY - pad));
    const ex = Math.min(img.naturalWidth, Math.ceil(correctX + pieceW + pad));
    const ey = Math.min(img.naturalHeight, Math.ceil(correctY + pieceH + pad));
    const cw = Math.max(1, ex - sx);
    const ch = Math.max(1, ey - sy);
    const spr = document.createElement("canvas");
    spr.width = cw;
    spr.height = ch;
    const ctx = spr.getContext("2d")!;
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
    // White frame
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.strokeRect(4, 4, cw - 8, ch - 8);
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
    const { x: cx, y: cy, scale } = cameraRef.current;
    const puzzle = puzzleRef.current;
    const pieces = piecesRef.current;
    const cursors = cursorsRef.current;
    const players = playersRef.current;
    const you = youRef.current;
    const now = Date.now();

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

    // Ghost image (strongly dimmed) inside the target area
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) {
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

    for (const piece of list) {
      const { x, y } = worldToScreen(piece);
      const spr = getSprite(piece);
      const isGrabbed = grabPiece === piece && piece.drag;

      if (piece.locked) {
        if (spr) ctx.drawImage(spr, x, y, puzzle.pieceW * scale, puzzle.pieceH * scale);
        // Completion ring pulse right after a piece gets locked
        const lockedT = lockedTimes.current.get(piece.id);
        if (lockedT !== undefined) {
          const t = (now - lockedT) / 700;
          if (t < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = PLACED_RING_COLOR;
            ctx.lineWidth = 3;
            const r = 8 * t;
            ctx.strokeRect(x - r, y - r, puzzle.pieceW * scale + r * 2, puzzle.pieceH * scale + r * 2);
            ctx.restore();
          } else {
            lockedTimes.current.delete(piece.id);
          }
        }
        continue;
      }
      lockedTimes.current.delete(piece.id);

      if (spr) ctx.drawImage(spr, x, y, puzzle.pieceW * scale, puzzle.pieceH * scale);

      // Shadow (soft drop shadow behind free pieces)
      if (!isGrabbed) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.28)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = "rgba(255,255,255,0.0)";
        ctx.fillRect(x, y, puzzle.pieceW * scale, puzzle.pieceH * scale);
        ctx.restore();
      }

      if (isGrabbed) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        ctx.strokeStyle = SNAP_RING_COLOR;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, puzzle.pieceW * scale, puzzle.pieceH * scale);
        ctx.restore();
      } else if (piece.moved) {
        // Tuck indicator: faint target ring when a piece is near its home
        const dx = piece.correctX - piece.x;
        const dy = piece.correctY - piece.y;
        const dist = Math.hypot(dx, dy);
        const { snapDistance } = puzzle;
        if (dist < snapDistance * 6) {
          const near = dist < snapDistance * 2;
          ctx.save();
          ctx.globalAlpha = near ? 0.9 : 0.5;
          ctx.strokeStyle = near ? TARGET_RING_COLOR : "rgba(99,102,241,0.3)";
          ctx.lineWidth = 1.5;
          const off = near ? 5 : 8;
          ctx.strokeRect(
            piece.correctX * scale + cx - off,
            piece.correctY * scale + cy - off,
            puzzle.pieceW * scale + off * 2,
            puzzle.pieceH * scale + off * 2,
          );
          ctx.restore();
        }
      }
    }

    // Remote cursors + name chips
    const playersById = new Map(players.map((p) => [p.id, p]));
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

    // Reference image (top-right)
    if (showReference) {
      const pw = puzzle.width;
      const ph = puzzle.height;
      const bw = 168;
      const bh = Math.min((bw * ph) / pw, 132);
      const bx = w - bw - 20;
      const by = 20;
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
      ctx.fillText("Reference", bx + 2, by + bh + 16 + 4);
      ctx.restore();
    }
  }

  // Ring animation bookkeeping: remember when each piece became locked
  const lockedTimes = useRef(new Map<number, number>());
  const prevLocked = useRef(new Map<number, boolean>());
  useEffect(() => {
    const pieces = piecesRef.current;
    const now = Date.now();
    for (const p of Object.values(pieces)) {
      const was = prevLocked.current.get(p.id) || false;
      if (p.locked && !was) lockedTimes.current.set(p.id, now);
      if (!p.locked && was) lockedTimes.current.delete(p.id);
      prevLocked.current.set(p.id, p.locked);
    }
    schedule();
  }, [pieces, schedule]);

  // ------------------------------------------------------------- pointers
  const posFromEvent = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const pos = posFromEvent(e);
    pointers.current.set(e.pointerId, pos);
    cursorScreen.current = pos;

    if (e.pointerType === "mouse") {
      // Clicked a piece? (top-most: prefer free pieces over locked)
      const world = screenToWorld(pos.x, pos.y);
      const hit = pickPiece(world.x, world.y, !!e.shiftKey);
      if (hit) {
        gestureType.current = "drag";
        grab.current = {
          id: hit.id,
          offsetX: world.x - hit.x,
          offsetY: world.y - hit.y,
          throttle: performance.now(),
          lastSentX: hit.x,
          lastSentY: hit.y,
          first: true,
        };
        // Local visual lift immediately (server confirms)
        const pieces = piecesRef.current;
        const p = pieces[hit.id];
        if (p) {
          p.drag = true;
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
        const hit = pickPiece(world.x, world.y, false);
        if (hit) {
          gestureType.current = "drag";
          grab.current = {
            id: hit.id,
            offsetX: world.x - hit.x,
            offsetY: world.y - hit.y,
            throttle: performance.now(),
            lastSentX: hit.x,
            lastSentY: hit.y,
            first: true,
          };
          const p = piecesRef.current[hit.id];
          if (p) {
            p.drag = true;
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

  function pickPiece(wx: number, wy: number, allowLocked: boolean): Piece | null {
    const pieces = piecesRef.current;
    const puzzle = puzzleRef.current;
    let best: Piece | null = null;
    let bestFree = false;
    for (const p of Object.values(pieces)) {
      if (p.locked && !allowLocked) continue;
      if (wx >= p.x && wx <= p.x + puzzle.pieceW && wy >= p.y && wy <= p.y + puzzle.pieceH) {
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

  // ----------------------------------------------------------- controls
  const zoomControls = (factor: number, label: string) => (
    <button
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink-900/85 text-lg font-semibold text-white shadow-chip backdrop-blur transition hover:bg-ink-800 active:scale-95"
      onClick={() => zoomBy(factor)}
      title={label}
      aria-label={label}
    >
      {factor > 1 ? "+" : "−"}
    </button>
  );

  const { scale } = camera;

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: "#0b0e1a" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-5 left-5 flex flex-col items-center gap-2">
        {zoomControls(1.25, "Zoom in")}
        <button
          className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/10 bg-ink-900/85 text-[11px] font-semibold text-ink-200 shadow-chip backdrop-blur"
          onClick={() => {
            fit(puzzle);
          }}
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        {zoomControls(0.8, "Zoom out")}
      </div>

      {/* Reset view */}
      <button
        className="btn btn-dark btn-sm absolute bottom-5 left-1/2 -translate-x-1/2"
        onClick={() => fit(puzzle)}
        title="Reset view"
      >
        ⌂ Reset view
      </button>

      {/* Reference image toggle */}
      <button
        className={`btn btn-dark btn-sm absolute right-5 top-5 ${
          showReference ? "border-brand-500/60 bg-brand-600/30" : ""
        }`}
        onClick={() => setShowReference((v) => !v)}
        title="Toggle reference image"
      >
        🖼️ Reference
      </button>

      {/* Restart (room completed) */}
      {allowReset && (
        <button
          className="btn btn-dark btn-sm absolute right-5 bottom-5 !border-emerald-400/40 !bg-emerald-500/20 hover:!bg-emerald-500/30"
          onClick={onResetRequest}
          title="Scatter the pieces and play again"
        >
          ↺ Play again
        </button>
      )}
    </div>
  );
}
