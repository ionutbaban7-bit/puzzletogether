import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Spinner } from "../components/ui";
import { pick, T, useLang } from "../lib/i18n";
import { api } from "../lib/api";
import { store, useStore } from "../store";
import { MAX_SCALE, MIN_SCALE, useViewport } from "./useViewport";
import type { CoachingActivity, Piece, PlayerView, PuzzleView } from "../types";

interface Props {
  puzzle: PuzzleView;
  pieces: Record<number, Piece>;
  players: PlayerView[];
  youId: string | null;
}

export default function RankingActivity({ puzzle, pieces, players, youId }: Props) {
  const activity = puzzle.activity as CoachingActivity;
  const { lang } = useLang();
  const items = activity.items || [];
  const layout = activity.layout || { cols: 2, rows: 6, padX: 70, padY: 70, slotW: 460, slotH: 110, gapX: 28, gapY: 24 };

  const boardW = Math.max(1400, layout.padX * 2 + layout.cols * layout.slotW + (layout.cols - 1) * layout.gapX);
  const boardH = layout.padY * 2 + layout.rows * layout.slotH + (layout.rows - 1) * layout.gapY;

  const { camera, cameraRef, zoomAt, zoomBy, fit } = useViewport();
  const [showResults, setShowResults] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [busyReset, setBusyReset] = useState(false);

  const lockedCount = Object.values(pieces).filter((p) => p.locked).length;
  const allPlaced = lockedCount >= items.length;

  // auto-open results once everything is placed
  const openedForCompletion = useRef(false);
  useEffect(() => {
    if (allPlaced && !openedForCompletion.current) {
      openedForCompletion.current = true;
      const t = setTimeout(() => setShowResults(true), 900);
      return () => clearTimeout(t);
    }
    if (!allPlaced) openedForCompletion.current = false;
  }, [allPlaced]);

  // initial fit
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current) {
      fitted.current = true;
      fit({ width: boardW, height: boardH } as PuzzleView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug/testing hook: expose the live camera.
  useEffect(() => {
    (window as unknown as { __ptCamera?: unknown }).__ptCamera = cameraRef;
    return () => {
      delete (window as unknown as { __ptCamera?: unknown }).__ptCamera;
    };
  }, [cameraRef]);

  useEffect(() => {
    if (resetSignal > 0) {
      fitted.current = false;
      fit({ width: boardW, height: boardH } as PuzzleView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // ------------------------------------------------------------- gestures
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ id: number; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const pinch = useRef<{ dist: number; sx: number; sy: number; scale: number } | null>(null);
  const drag = useRef<{ id: number; offsetX: number; offsetY: number; throttle: number; first: boolean } | null>(null);
  const gesture = useRef<"none" | "pan" | "drag" | "pinch">("none");
  const [frame, setFrame] = useState(0);
  const lastMoveSent = useRef(0);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { x, y, scale } = cameraRef.current;
    return { x: (sx - x) / scale, y: (sy - y) / scale };
  }, [cameraRef]);

  function posFromEvent(e: React.PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const pos = posFromEvent(e);
    pointers.current.set(e.pointerId, pos);

    const cardEl = (e.target as HTMLElement).closest("[data-item]") as HTMLElement | null;
    if (cardEl && e.pointerType === "mouse") {
      const id = Number(cardEl.dataset.item);
      const piece = pieces[id];
      if (piece && !piece.locked) {
        const world = screenToWorld(pos.x, pos.y);
        gesture.current = "drag";
        drag.current = { id, offsetX: world.x - piece.x, offsetY: world.y - piece.y, throttle: performance.now(), first: true };
        store.sendPiece(id, piece.x, piece.y, true);
        bump();
        return;
      }
    }

    if (e.pointerType === "touch") {
      if (pointers.current.size === 1 && cardEl) {
        const id = Number(cardEl.dataset.item);
        const piece = pieces[id];
        if (piece && !piece.locked) {
          const world = screenToWorld(pos.x, pos.y);
          gesture.current = "drag";
          drag.current = { id, offsetX: world.x - piece.x, offsetY: world.y - piece.y, throttle: performance.now(), first: true };
          store.sendPiece(id, piece.x, piece.y, true);
          bump();
          return;
        }
      }
      if (pointers.current.size === 2) {
        if (gesture.current === "drag" && drag.current) {
          const p = pieces[drag.current.id];
          if (p) store.sendPiece(drag.current.id, p.x, p.y, false);
          drag.current = null;
        }
        const pts = [...pointers.current.values()];
        pinch.current = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          sx: (pts[0].x + pts[1].x) / 2,
          sy: (pts[0].y + pts[1].y) / 2,
          scale: cameraRef.current.scale,
        };
        gesture.current = "pinch";
        return;
      }
    }

    gesture.current = "pan";
    pan.current = { id: e.pointerId, sx: pos.x, sy: pos.y, cx: cameraRef.current.x, cy: cameraRef.current.y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pos = posFromEvent(e);
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pos);

    if (gesture.current === "drag" && drag.current) {
      const world = screenToWorld(pos.x, pos.y);
      const piece = pieces[drag.current.id];
      if (piece) {
        const x = world.x - drag.current.offsetX;
        const y = world.y - drag.current.offsetY;
        dragPos.current = { x, y };
        const now = performance.now();
        if (now - drag.current.throttle >= 50 || drag.current.first) {
          drag.current.throttle = now;
          drag.current.first = false;
          store.sendPiece(piece.id, x, y, true);
        }
      }
      bump();
      return;
    }

    if (gesture.current === "pan" && pan.current && e.pointerId === pan.current.id) {
      cameraRef.current.x = pan.current.cx + (pos.x - pan.current.sx);
      cameraRef.current.y = pan.current.cy + (pos.y - pan.current.sy);
      setFrame((f) => f + 1);
      return;
    }

    if (gesture.current === "pinch" && pinch.current && pointers.current.size >= 2) {
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
        setFrame((f) => f + 1);
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

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (gesture.current === "drag" && drag.current) {
      const d = drag.current;
      drag.current = null;
      dragPos.current = null;
      const piece = pieces[d.id];
      if (piece) {
        const pos = posFromEvent(e);
        const world = screenToWorld(pos.x, pos.y);
        const x = world.x - d.offsetX;
        const y = world.y - d.offsetY;
        const dist = Math.hypot(x - piece.correctX, y - piece.correctY);
        const snapped = dist <= puzzle.snapDistance;
        store.sendPiece(piece.id, x, y, false);
        store.applyLocalDrop(piece.id, x, y, snapped);
      }
    }
    if (gesture.current === "pan") pan.current = null;
    if (gesture.current === "pinch") pinch.current = null;
    if (pointers.current.size === 0) gesture.current = "none";
  }

  function bump() {
    setFrame((f) => f + 1);
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const pos = posFromEvent(e as unknown as React.PointerEvent);
    zoomAt(pos.x, pos.y, Math.exp(-e.deltaY * 0.0016));
  }

  // ------------------------------------------------------------- results
  const teamRanks = useMemo(() => {
    const ranks = new Map<number, number>();
    for (const p of Object.values(pieces)) {
      if (p.locked) ranks.set(p.id, p.id + 1); // slot order = reading order = rank
    }
    return ranks;
  }, [pieces]);

  const score = useMemo(() => {
    let s = 0;
    let n = 0;
    for (const item of items) {
      const team = teamRanks.get(item.id);
      if (team) {
        s += Math.pow(team - item.expertRank, 2);
        n += 1;
      }
    }
    return { value: s, count: n };
  }, [items, teamRanks]);

  async function handleReset() {
    setBusyReset(true);
    const roomId = store.getState().room?.id;
    if (roomId) await api.resetRoom(roomId);
    setShowResults(false);
    setResetSignal((n) => n + 1);
    setBusyReset(false);
  }

  const cursors = useStore((s) => s.cursors);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950" style={{ touchAction: "none" }}>
      {/* world */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ cursor: gesture.current === "pan" ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* board frame */}
          <div
            className="absolute rounded-2xl border-2 border-dashed border-white/15"
            style={{ left: 0, top: 0, width: boardW, height: boardH }}
          >
            <div className="absolute -top-9 left-2 text-[13px] font-semibold text-ink-300">
              {lang === "ro" ? "1 = cel mai important · 12 = cel mai puțin important" : "1 = most important · 12 = least important"}
            </div>
            {items.map((item, i) => {
              const col = i % layout.cols;
              const row = Math.floor(i / layout.cols);
              const x = layout.padX + col * (layout.slotW + layout.gapX);
              const y = layout.padY + row * (layout.slotH + layout.gapY);
              return (
                <div key={item.id} className="absolute rounded-xl border border-white/10 bg-white/[0.03]" style={{ left: x, top: y, width: layout.slotW, height: layout.slotH }}>
                  <span className="absolute left-2.5 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-ink-200">
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* item cards */}
          {items.map((item) => {
            const piece = pieces[item.id];
            if (!piece) return null;
            const dragged = drag.current?.id === piece.id;
            const local = dragged ? dragPos.current : null;
            const px = local ? local.x : piece.x;
            const py = local ? local.y : piece.y;
            const locked = piece.locked;
            return (
              <div
                key={item.id}
                data-item={item.id}
                className={`absolute flex select-none flex-col justify-between rounded-xl border-2 bg-white p-3 shadow-lg transition-shadow ${
                  locked
                    ? "border-emerald-400 shadow-emerald-500/20"
                    : dragged
                      ? "border-brand-400 shadow-pop cursor-grabbing"
                      : "border-ink-200 shadow-chip cursor-grab hover:border-brand-300"
                }`}
                style={{ left: px, top: py, width: layout.slotW, height: layout.slotH }}
              >
                <div className="text-[15px] font-semibold leading-snug text-ink-900">
                  <T value={item.label} />
                </div>
                {locked && (
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                      {lang === "ro" ? "Poziția" : "Rank"} {teamRanks.get(item.id) ?? piece.id + 1}
                    </span>
                    <span className="text-[10px] text-ink-400">{lang === "ro" ? "blocat" : "locked"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* remote cursors */}
      <div className="pointer-events-none absolute inset-0">
        {Object.entries(cursors).map(([id, c]) => {
          if (id === youId) return null;
          if (Date.now() - c.at > 4000) return null;
          const player = playersById.get(id);
          if (!player) return null;
          const sx = c.x * camera.scale + camera.x;
          const sy = c.y * camera.scale + camera.y;
          return (
            <div key={id} className="absolute" style={{ left: sx, top: sy }}>
              <svg width="16" height="18" viewBox="0 0 16 18">
                <path d="M1 1 L1 14.5 L5.5 11.5 L7.5 16.5 L10 15.5 L8 10.5 L14.5 12 Z" fill={player.color} stroke="#fff" strokeWidth="1.2" />
              </svg>
              <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-chip" style={{ backgroundColor: player.color }}>
                {player.name} 👆
              </span>
            </div>
          );
        })}
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-5 left-5 flex flex-col items-center gap-2">
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink-900/85 text-lg font-semibold text-white shadow-chip backdrop-blur transition hover:bg-ink-800" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
        <button className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/10 bg-ink-900/85 text-[11px] font-semibold text-ink-200 shadow-chip backdrop-blur" onClick={() => fit({ width: boardW, height: boardH } as PuzzleView)}>
          {Math.round(camera.scale * 100)}%
        </button>
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink-900/85 text-lg font-semibold text-white shadow-chip backdrop-blur transition hover:bg-ink-800" onClick={() => zoomBy(0.8)} title="Zoom out">−</button>
      </div>

      {/* reset view */}
      <button className="btn btn-dark btn-sm absolute bottom-5 left-1/2 -translate-x-1/2" onClick={() => fit({ width: boardW, height: boardH } as PuzzleView)}>
        ⌂ {lang === "ro" ? "Resetare vizualizare" : "Reset view"}
      </button>

      {/* side panel */}
      <div className="overlay-card absolute right-4 top-4 flex w-[340px] flex-col p-5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          🧭 {lang === "ro" ? "Team Coaching" : "Team Coaching"}
        </div>
        <h1 className="font-display mt-1 text-lg font-bold text-white">
          <T value={activity.scenario?.title || activity.name} />
        </h1>
        <p className="mt-2 max-h-40 overflow-y-auto text-[13px] leading-relaxed text-ink-300">
          <T value={activity.scenario?.situation || activity.description} />
        </p>
        <p className="mt-2 text-[12px] text-ink-400">
          <T value={activity.instructions || { ro: "", en: "" }} />
        </p>

        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-semibold text-ink-300">
            <span>{lang === "ro" ? "Progres" : "Progress"}</span>
            <span>{lockedCount} / {items.length}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-400 transition-all duration-500" style={{ width: `${(lockedCount / items.length) * 100}%` }} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn-primary btn-sm flex-1 !bg-emerald-600 hover:!bg-emerald-500" onClick={() => setShowResults(true)}>
            {lang === "ro" ? "Vezi rankingul experților" : "See expert ranking"}
          </button>
          <button className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={handleReset} disabled={busyReset}>
            {busyReset ? <Spinner className="h-3.5 w-3.5" /> : "↺"}
          </button>
        </div>
      </div>

      {/* results modal */}
      {showResults && (
        <ResultsModal
          activity={activity}
          items={items}
          teamRanks={teamRanks}
          score={score}
          onClose={() => setShowResults(false)}
          onReset={handleReset}
          busyReset={busyReset}
        />
      )}
    </div>
  );
}

// Live drag position (updated via ref during pointermove, rendered by `frame` bumps)
const dragPos = { current: null as { x: number; y: number } | null };

function ResultsModal({
  activity,
  items,
  teamRanks,
  score,
  onClose,
  onReset,
  busyReset,
}: {
  activity: CoachingActivity;
  items: NonNullable<CoachingActivity["items"]>;
  teamRanks: Map<number, number>;
  score: { value: number; count: number };
  onClose: () => void;
  onReset: () => void;
  busyReset: boolean;
}) {
  const { lang } = useLang();
  const verdict =
    score.value <= 30
      ? lang === "ro" ? "Excelent — echipa voastră gândește ca experții." : "Excellent — your team thinks like the experts."
      : score.value <= 80
        ? lang === "ro" ? "Bun — cu câteva diferențe de prioritizare de discutat." : "Good — a few prioritization differences worth discussing."
        : lang === "ro" ? "Interesant — diferențele de prioritizare sunt mari. Debrief-ul contează cel mai mult." : "Interesting — large prioritization gaps. The debrief matters most.";

  const sorted = [...items].sort((a, b) => (teamRanks.get(a.id) ?? 99) - (teamRanks.get(b.id) ?? 99));

  return (
    <Modal onClose={onClose}>
      <div className="overlay-card flex max-h-[85vh] w-[560px] max-w-[92vw] flex-col p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              {lang === "ro" ? "Rezultatele echipei" : "Team results"}
            </h2>
            <div className="mt-0.5 text-sm text-ink-300">
              <T value={activity.name} />
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
              {lang === "ro" ? "Scor de deviere" : "Deviation score"}
            </span>
            <span className="font-display text-2xl font-extrabold text-emerald-300">{score.value}</span>
          </div>
          <p className="mt-1 text-[13px] text-ink-300">{verdict}</p>
          <p className="mt-1 text-[11px] text-ink-500">
            {lang === "ro"
              ? "Suma pătratelor diferențelor față de rankingul experților — mai mic = mai aproape de experți."
              : "Sum of squared differences vs. the experts' ranking — lower = closer to the experts."}
          </p>
        </div>

        <div className="mt-4 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {sorted.map((item) => {
            const team = teamRanks.get(item.id);
            const diff = team != null ? Math.abs(team - item.expertRank) : null;
            return (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-white">
                    <T value={item.label} />
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[11px]">
                    <span className="rounded-md bg-white/10 px-2 py-0.5 font-bold text-white">
                      {lang === "ro" ? "Echipa" : "Team"}: {team ?? "–"}
                    </span>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                      {lang === "ro" ? "Expert" : "Expert"}: {item.expertRank}
                    </span>
                    {diff !== null && (
                      <span className={`rounded-md px-2 py-0.5 font-bold ${diff <= 2 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                        Δ {diff}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
                  <T value={item.rationale} />
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            {lang === "ro" ? "Întrebări de debrief" : "Debrief questions"}
          </div>
          <ol className="mt-2 space-y-1.5">
            {(activity.debrief || []).map((q, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-200">
                <span className="font-bold text-brand-300">{i + 1}.</span>
                <span>{pick(q, lang)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 flex gap-2">
          <button className="btn-primary btn-sm flex-1 !bg-emerald-600 hover:!bg-emerald-500" onClick={onReset} disabled={busyReset}>
            {busyReset ? <Spinner className="h-3.5 w-3.5" /> : lang === "ro" ? "↺ Joacă din nou" : "↺ Play again"}
          </button>
          <button className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={onClose}>
            {lang === "ro" ? "Închide" : "Close"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
