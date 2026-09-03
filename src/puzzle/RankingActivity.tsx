import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../components/ui";
import { pick, T, useLang } from "../lib/i18n";
import { store, useStore } from "../store";
import { MAX_SCALE, MIN_SCALE, useViewport } from "./useViewport";
import type { CoachingActivity, Piece, PlayerView, PuzzleView } from "../types";

interface Props { puzzle: PuzzleView; pieces: Record<number, Piece>; players: PlayerView[]; youId: string | null }

export default function RankingActivity({ puzzle, pieces, players, youId }: Props) {
  const { lang } = useLang();
  const activity = puzzle.activity as CoachingActivity;
  const items = activity.items || [];
  const slots = puzzle.rankingSlots || [];
  const layout = activity.layout || { cols: 2, rows: 6, padX: 70, padY: 70, slotW: 460, slotH: 110, gapX: 28, gapY: 24 };
  const boardW = Math.max(1400, layout.padX * 2 + layout.cols * layout.slotW + (layout.cols - 1) * layout.gapX);
  const boardH = layout.padY * 2 + layout.rows * layout.slotH + (layout.rows - 1) * layout.gapY;
  const room = useStore((state) => state.room);
  const connected = useStore((state) => state.connected);
  const cursors = useStore((state) => state.cursors);
  const canMove = !!room && room.stage === "play" && !room.boardLocked && connected && players.find((player) => player.id === youId)?.role !== "spectator";
  const { camera, cameraRef, setCamera, zoomAt, zoomBy } = useViewport();
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ id: number; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const pinch = useRef<{ dist: number; sx: number; sy: number; scale: number } | null>(null);
  const drag = useRef<{ id: number; offsetX: number; offsetY: number; throttle: number } | null>(null);
  const dragPosition = useRef<{ x: number; y: number } | null>(null);
  const gesture = useRef<"none" | "pan" | "drag" | "pinch">("none");
  const [, redraw] = useState(0);
  const lastCursorSent = useRef(0);

  const fit = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const worldH = boardH + 760;
    const pad = width < 640 ? 24 : 120;
    const scale = width < 640
      ? 0.55
      : Math.max(0.62, Math.min(0.92, (width - pad * 2) / boardW, (height - 80) / worldH));
    // Phones open at a readable card size and pan across the board instead of
    // shrinking 460px cards into illegible thumbnails.
    setCamera({ x: width < 640 ? 16 : (width - boardW * scale) / 2, y: width < 640 ? 84 : 72, scale });
  }, [boardH, boardW, setCamera]);

  useEffect(() => { fit(); }, [fit]);
  useEffect(() => { if (room?.revealed) setShowResults(true); }, [room?.revealed]);
  useEffect(() => {
    (window as Window & { __ptCamera?: unknown }).__ptCamera = cameraRef;
    return () => { delete (window as Window & { __ptCamera?: unknown }).__ptCamera; };
  }, [cameraRef]);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const camera = cameraRef.current;
    return { x: (sx - camera.x) / camera.scale, y: (sy - camera.y) / camera.scale };
  }, [cameraRef]);
  const eventPosition = (event: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function beginDrag(id: number, point: { x: number; y: number }) {
    const piece = pieces[id];
    if (!piece || !canMove || (piece.heldBy && piece.heldBy !== youId)) return false;
    const world = screenToWorld(point.x, point.y);
    drag.current = { id, offsetX: world.x - piece.x, offsetY: world.y - piece.y, throttle: 0 };
    dragPosition.current = { x: piece.x, y: piece.y };
    gesture.current = "drag";
    store.sendPiece(id, piece.x, piece.y, true);
    redraw((value) => value + 1);
    return true;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    containerRef.current?.setPointerCapture(event.pointerId);
    const point = eventPosition(event);
    pointers.current.set(event.pointerId, point);
    const card = (event.target as HTMLElement).closest("[data-ranking-item]") as HTMLElement | null;
    if (card && beginDrag(Number(card.dataset.rankingItem), point)) return;
    if (event.pointerType === "touch" && pointers.current.size === 2) {
      const points = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), sx: (points[0].x + points[1].x) / 2, sy: (points[0].y + points[1].y) / 2, scale: cameraRef.current.scale };
      gesture.current = "pinch";
      return;
    }
    gesture.current = "pan";
    pan.current = { id: event.pointerId, sx: point.x, sy: point.y, cx: cameraRef.current.x, cy: cameraRef.current.y };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = eventPosition(event);
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point);
    if (gesture.current === "drag" && drag.current) {
      const world = screenToWorld(point.x, point.y);
      const x = world.x - drag.current.offsetX;
      const y = world.y - drag.current.offsetY;
      dragPosition.current = { x, y };
      const now = performance.now();
      if (now - drag.current.throttle >= 50) { drag.current.throttle = now; store.sendPiece(drag.current.id, x, y, true); }
      redraw((value) => value + 1);
      return;
    }
    if (gesture.current === "pan" && pan.current && pan.current.id === event.pointerId) {
      cameraRef.current.x = pan.current.cx + point.x - pan.current.sx;
      cameraRef.current.y = pan.current.cy + point.y - pan.current.sy;
      setCamera({ ...cameraRef.current });
      return;
    }
    if (gesture.current === "pinch" && pinch.current && pointers.current.size >= 2) {
      const points = [...pointers.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * distance / Math.max(1, pinch.current.dist)));
      const previous = cameraRef.current.scale;
      const ratio = scale / previous;
      setCamera({ scale, x: pinch.current.sx - (pinch.current.sx - cameraRef.current.x) * ratio, y: pinch.current.sy - (pinch.current.sy - cameraRef.current.y) * ratio });
      return;
    }
    if (performance.now() - lastCursorSent.current > 40) {
      lastCursorSent.current = performance.now();
      const world = screenToWorld(point.x, point.y);
      store.sendCursor(world.x, world.y);
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (gesture.current === "drag" && drag.current) {
      const current = drag.current;
      const point = eventPosition(event);
      const world = screenToWorld(point.x, point.y);
      store.sendPiece(current.id, world.x - current.offsetX, world.y - current.offsetY, false);
      drag.current = null;
      dragPosition.current = null;
    }
    if (gesture.current === "pan") pan.current = null;
    if (gesture.current === "pinch") pinch.current = null;
    if (!pointers.current.size) gesture.current = "none";
    redraw((value) => value + 1);
  }

  const teamRanks = useMemo(() => new Map(Object.values(pieces).filter((piece) => piece.placedOnSlot != null).map((piece) => [piece.id, piece.placedOnSlot!])), [pieces]);
  const score = useMemo(() => [...teamRanks].reduce((sum, [id, rank]) => {
    const expert = items.find((item) => item.id === id)?.expertRank;
    return expert ? sum + Math.pow(rank - expert, 2) : sum;
  }, 0), [items, teamRanks]);
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const placedCount = teamRanks.size;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-ink-950 ${!connected ? "pointer-events-none" : ""}`} style={{ touchAction: "none" }}>
      <div ref={containerRef} className="absolute inset-0" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={(event) => { event.preventDefault(); const point = eventPosition(event as unknown as React.PointerEvent); zoomAt(point.x, point.y, Math.exp(-event.deltaY * 0.0016)); }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: boardW, height: boardH + 850, transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})` }}>
          <div className="absolute inset-x-0 top-0 rounded-[32px] border-2 border-dashed border-white/15 bg-white/[0.025]" style={{ height: boardH }} />
          {slots.map((slot) => <div key={slot.rank} className="absolute flex items-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03]" style={{ left: slot.x, top: slot.y, width: layout.slotW, height: layout.slotH }}><span className="ml-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-display text-lg font-extrabold text-white/50">{slot.rank}</span></div>)}
          {Object.values(pieces).map((piece) => {
            const item = items.find((entry) => entry.id === piece.id);
            if (!item) return null;
            const locallyDragged = drag.current?.id === piece.id && dragPosition.current;
            const x = locallyDragged ? dragPosition.current!.x : piece.x;
            const y = locallyDragged ? dragPosition.current!.y : piece.y;
            const owner = piece.heldBy ? playersById.get(piece.heldBy) : undefined;
            const blocked = !!piece.heldBy && piece.heldBy !== youId;
            return <div key={piece.id} data-ranking-item={piece.id} className={`absolute flex select-none items-center rounded-2xl border bg-ink-800 px-5 shadow-xl transition-shadow ${blocked ? "cursor-not-allowed" : canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`} style={{ left: x, top: y, width: layout.slotW, height: layout.slotH, borderColor: owner?.color || (piece.placedOnSlot ? "#34d399" : "rgba(255,255,255,.16)"), zIndex: locallyDragged ? 50 : piece.placedOnSlot ? 5 : 10 }}>
              <span className="mr-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 font-display font-bold text-white">{piece.placedOnSlot || "·"}</span><span className="text-[15px] font-semibold leading-snug text-white"><T value={item.label} /></span>{owner && <span className="ml-auto rounded-full px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: owner.color }}>{owner.name}</span>}
            </div>;
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">{Object.entries(cursors).map(([id, cursor]) => {
        if (id === youId || Date.now() - cursor.at > 4000) return null;
        const player = playersById.get(id); if (!player) return null;
        return <div key={id} className="absolute" style={{ left: cursor.x * camera.scale + camera.x, top: cursor.y * camera.scale + camera.y }}><span className="rounded-full px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: player.color }}>↖ {player.name}</span></div>;
      })}</div>

      <div className="safe-bottom absolute bottom-3 left-3 flex flex-col gap-2 sm:bottom-5 sm:left-5"><button className="btn btn-dark h-10 w-10" onClick={() => zoomBy(1.25)}>+</button><button className="btn btn-dark h-9 w-10 !px-1 text-[10px]" onClick={fit}>{Math.round(camera.scale * 100)}%</button><button className="btn btn-dark h-10 w-10" onClick={() => zoomBy(.8)}>−</button></div>

      <aside className="overlay-card ranking-sheet absolute inset-x-2 bottom-2 z-20 max-h-[42vh] overflow-y-auto p-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:w-[340px] sm:max-h-[calc(100vh-8rem)] sm:p-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">🧭 Team ranking</div>
        <h1 className="font-display mt-1 text-lg font-bold text-white"><T value={activity.scenario?.title || activity.name} /></h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-300"><T value={activity.scenario?.situation || activity.description} /></p>
        <p className="mt-2 text-xs text-ink-400"><T value={activity.instructions || { ro: "Trageți cardurile pe orice rang. Le puteți reordona până când facilitatorul blochează board-ul.", en: "Drag cards to any rank. Reorder them until the facilitator locks the board." }} /></p>
        <p className="mt-1 text-[11px] text-ink-500"><T value={{ ro: "Pan în jos pentru cardurile neclasificate · pinch pentru zoom", en: "Pan down for unranked cards · pinch to zoom" }} /></p>
        <div className="mt-3 flex items-center justify-between text-xs text-ink-300"><span>{lang === "ro" ? "Rankingul echipei" : "Team ranking"}</span><b>{placedCount}/{items.length}</b></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${items.length ? placedCount / items.length * 100 : 0}%` }} /></div>
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${room?.revealed ? "bg-emerald-500/15 text-emerald-200" : canMove ? "bg-brand-500/15 text-brand-200" : "bg-amber-500/15 text-amber-200"}`}>{room?.revealed ? (lang === "ro" ? "Ranking expert dezvăluit" : "Expert ranking revealed") : canMove ? (lang === "ro" ? "Board deschis — discutați și reordonați" : "Board open — discuss and reorder") : (lang === "ro" ? "Board blocat de facilitator" : "Board locked by facilitator")}</div>
        {room?.revealed && <button className="btn-primary btn-sm mt-3 w-full !bg-emerald-600" onClick={() => setShowResults(true)}>{lang === "ro" ? "Vezi rezultate și debrief" : "View results and debrief"}</button>}
      </aside>

      {showResults && room?.revealed && <ResultsModal activity={activity} items={items} teamRanks={teamRanks} score={score} onClose={() => setShowResults(false)} />}
    </div>
  );
}

function ResultsModal({ activity, items, teamRanks, score, onClose }: { activity: CoachingActivity; items: NonNullable<CoachingActivity["items"]>; teamRanks: Map<number, number>; score: number; onClose: () => void }) {
  const { lang } = useLang();
  const sorted = [...items].sort((a, b) => (teamRanks.get(a.id) || 99) - (teamRanks.get(b.id) || 99));
  const verdict = score <= 30 ? (lang === "ro" ? "Excelent — prioritizarea este aproape de cea a experților." : "Excellent — your priorities are close to the experts'.") : score <= 80 ? (lang === "ro" ? "Bun — aveți câteva diferențe valoroase de discutat." : "Good — you have a few useful differences to discuss.") : (lang === "ro" ? "Diferențele sunt mari — aici începe conversația utilă." : "The differences are large — this is where the useful conversation begins.");
  return <Modal onClose={onClose}><div className="overlay-card flex max-h-[calc(100dvh-1.5rem)] overflow-y-auto w-[640px] max-w-[95vw] flex-col p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-display text-xl font-bold text-white">{lang === "ro" ? "Rezultatele echipei" : "Team results"}</h2><p className="text-sm text-ink-300"><T value={activity.name} /></p></div><button className="h-9 w-9 rounded-lg text-ink-300 hover:bg-white/10" onClick={onClose}>✕</button></div><div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-baseline justify-between"><b className="text-xs uppercase tracking-wider text-ink-400">{lang === "ro" ? "Scor de deviere" : "Deviation score"}</b><span className="font-display text-3xl font-extrabold text-emerald-300">{score}</span></div><p className="mt-1 text-sm text-ink-300">{verdict}</p></div><div className="mt-4 flex-1 space-y-2 overflow-y-auto">{sorted.map((item) => { const team = teamRanks.get(item.id); const expert = item.expertRank; return <div key={item.id} className="rounded-xl border border-white/10 bg-white/[.04] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-white"><T value={item.label} /></b><div className="flex gap-2 text-xs"><span className="rounded-md bg-white/10 px-2 py-1">{lang === "ro" ? "Echipă" : "Team"}: {team || "–"}</span><span className="rounded-md bg-emerald-500/20 px-2 py-1 text-emerald-200">Expert: {expert || "–"}</span>{expert && team && <span className="rounded-md bg-amber-500/15 px-2 py-1 text-amber-200">Δ {Math.abs(team - expert)}</span>}</div></div>{item.rationale && <p className="mt-2 text-xs leading-relaxed text-ink-400"><T value={item.rationale} /></p>}</div>; })}</div>{activity.debrief?.length ? <div className="mt-4 border-t border-white/10 pt-4"><b className="text-xs uppercase tracking-wider text-ink-400">{lang === "ro" ? "Întrebări de debrief" : "Debrief questions"}</b><ol className="mt-2 space-y-1 text-xs text-ink-200">{activity.debrief.map((question, index) => <li key={index}>{index + 1}. {pick(question, lang)}</li>)}</ol></div> : null}</div></Modal>;
}
