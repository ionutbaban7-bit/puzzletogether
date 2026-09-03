import { useEffect, useState } from "react";
import Board from "../puzzle/Board";
import CanvasBoard from "../puzzle/CanvasBoard";
import RankingActivity from "../puzzle/RankingActivity";
import QuestionnaireActivity from "../puzzle/QuestionnaireActivity";
import { api } from "../lib/api";
import { copyToClipboard, formatClock, inviteUrl } from "../lib/format";
import { navigate } from "../lib/router";
import { store, useStore } from "../store";
import { Confetti, LogoMark, Modal, Spinner, useCopied } from "../components/ui";
import PuzzlePicker from "../components/PuzzlePicker";
import FacilitatorPanel from "../components/FacilitatorPanel";
import HarvestBoard from "../components/HarvestBoard";
import { LangToggle, pick, useLang, T } from "../lib/i18n";
import { lockedCountOf } from "../store";

const CATEGORY_ICON: Record<string, string> = {
  "letter-canvas": "✍️",
  "sentence-canvas": "💬",
  paintings: "🎨",
  landscapes: "🏔️",
  landmarks: "🗼",
  nature: "🌿",
  cities: "🏙️",
  coaching: "🧭",
};

/** Level ladder — mirrors shared/puzzles.json difficulties. */
const LEVELS = [
  { id: "easy", pieces: 25 },
  { id: "medium", pieces: 64 },
  { id: "hard", pieces: 100 },
  { id: "expert", pieces: 144 },
] as const;

const PODIUM_STYLES = [
  {
    place: 1,
    medal: "\u{1F947}",
    label: { ro: "Locul 1", en: "1st Place" },
    accent: "text-amber-200",
    height: "h-28",
    box: "border-amber-300/60 bg-gradient-to-b from-amber-300/60 via-amber-400/30 to-amber-500/10",
  },
  {
    place: 2,
    medal: "\u{1F948}",
    label: { ro: "Locul 2", en: "2nd Place" },
    accent: "text-slate-200",
    height: "h-20",
    box: "border-slate-300/55 bg-gradient-to-b from-slate-200/45 via-slate-300/18 to-slate-400/8",
  },
  {
    place: 3,
    medal: "\u{1F949}",
    label: { ro: "Locul 3", en: "3rd Place" },
    accent: "text-orange-200",
    height: "h-16",
    box: "border-orange-300/55 bg-gradient-to-b from-orange-300/45 via-orange-400/20 to-orange-500/8",
  },
] as const;

const DIFFICULTY_STRINGS = {
  easy: { ro: "Ușor", en: "Easy" },
  medium: { ro: "Mediu", en: "Medium" },
  hard: { ro: "Greu", en: "Hard" },
  expert: { ro: "Expert", en: "Expert" },
} as const;

const CATEGORY_LABELS = {
  "letter-canvas": { ro: "Foaie de litere", en: "Letter Canvas" },
  "sentence-canvas": { ro: "Foaie de propoziții", en: "Sentence Canvas" },
  paintings: { ro: "Picturi celebre", en: "Famous Paintings" },
  landscapes: { ro: "Peisaje celebre", en: "Famous Landscapes" },
  landmarks: { ro: "Repere globale", en: "World Landmarks" },
  nature: { ro: "Natură", en: "Nature" },
  cities: { ro: "Orașe", en: "Cities" },
  coaching: { ro: "Coaching", en: "Coaching" },
} as const;

const CANVAS_MODE_LABELS: Record<string, { ro: string; en: string }> = {
  quick: { ro: "Quick · 96", en: "Quick · 96" },
  standard: { ro: "Standard · 180", en: "Standard · 180" },
  extended: { ro: "Extended · 260", en: "Extended · 260" },
  sandbox: { ro: "Sandbox · ∞", en: "Sandbox · ∞" },
};

export default function GamePage() {
  const { lang } = useLang();
  const status = useStore((s) => s.status);
  const room = useStore((s) => s.room);
  const puzzle = useStore((s) => s.puzzle);
  const players = useStore((s) => s.players);
  const pieces = useStore((s) => s.pieces);
  const cursors = useStore((s) => s.cursors);
  const youId = useStore((s) => s.you);
  const completion = useStore((s) => s.completion);
  const denyMessage = useStore((s) => s.denyMessage);
  const closedMessage = useStore((s) => s.closedMessage);
  const epoch = useStore((s) => s.epoch);
  const scores = useStore((s) => s.scores);
  const connected = useStore((s) => s.connected);
  const reconnectExhausted = useStore((s) => s.reconnectExhausted);
  const protocolError = useStore((s) => s.protocolError);
  const chat = useStore((s) => s.chat);
  const canvas = useStore((s) => s.canvas);
  const canvasTiles = useStore((s) => s.canvasTiles);

  const [shareOpen, setShareOpen] = useState(false);
  const [facilitatorOpen, setFacilitatorOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [completionVisible, setCompletionVisible] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  // HUD starts collapsed on phones so the board gets the whole screen.
  const [hudOpen, setHudOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 640,
  );
  const [now, setNow] = useState(Date.now());
  const [resetSignal, setResetSignal] = useState(0);
  const [copied, markCopied] = useCopied();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When the board is rebuilt (new puzzle / reset from anyone), close the picker.
  useEffect(() => {
    setPickerOpen(false);
    setCompletionVisible(true);
  }, [epoch]);

  useEffect(() => {
    if (completion) setCompletionVisible(true);
  }, [completion]);

  const locked = lockedCountOf(pieces);
  const isCanvas = !!puzzle?.isCanvas;
  const total = room?.total || 1;
  const tileCount = Object.keys(canvasTiles).length;
  const progress = isCanvas
    ? canvas && canvas.inventory
      ? Math.min(100, Math.round((tileCount / total) * 100))
      : 0
    : Math.round((locked / total) * 100);
  const elapsed = room?.startedAt
    ? room.completed
      ? room.completedInMs || 0
      : Math.max(0, now - room.startedAt - room.pausedDurationMs - (room.pausedAt ? now - room.pausedAt : 0))
    : 0;
  const playerCount = players.length;
  const isCoaching = !!puzzle?.isCoaching;
  const mode = puzzle?.mode;

  const scoreSource = completion?.scores?.length ? completion.scores : scores;
  const scoreByPlayer = new Map(scoreSource.map((sc) => [sc.playerId, sc.placed]));

  const hostConnected = !!room?.hostId && players.some((player) => player.id === room.hostId);
  const isHost = !!youId && room?.hostId === youId;
  const canTakeOver = !!youId && !hostConnected && players[0]?.id === youId && !isHost;
  const meRole = players.find((player) => player.id === youId)?.role;
  const inputEnabled = connected && room?.stage === "play" && !room?.boardLocked && meRole !== "spectator";

  async function handleReset() {
    if (!room || !youId || !isHost) return;
    await api.resetRoom(room.id, youId);
    setResetSignal((n) => n + 1);
  }

  function handleLeave() {
    if (!window.confirm(lang === "ro" ? "Sigur vrei să părăsești sesiunea?" : "Leave this session?")) return;
    store.leaveRoom();
    navigate("/");
  }

  const getDifficultyLabel = (diff: string) => {
    const key = diff as keyof typeof DIFFICULTY_STRINGS;
    return pick(DIFFICULTY_STRINGS[key] || { ro: diff, en: diff }, lang);
  };

  const getCategoryLabel = (category: string) => {
    const key = category as keyof typeof CATEGORY_LABELS;
    return pick(CATEGORY_LABELS[key] || { ro: category, en: category }, lang);
  };

  // --------------------------------------------------------------- states
  if (status === "connecting") {
    return (
      <Screen>
        <div className="text-center">
          {reconnectExhausted ? <div className="text-4xl">📡</div> : <Spinner className="mx-auto h-8 w-8 text-brand-500" />}
          <div className="font-display mt-5 text-lg font-semibold text-white">
            <T value={reconnectExhausted ? { ro: "Camera nu poate fi contactată", en: "The room cannot be reached" } : { ro: "Se intră în cameră…", en: "Joining the room…" }} />
          </div>
          <div className="mt-1 text-sm text-ink-400">
            <T value={reconnectExhausted ? { ro: "Verifică rețeaua și reîncarcă pagina.", en: "Check your network and reload the page." } : { ro: "Conectare la colegi", en: "Connecting to your teammates" }} />
          </div>
          {reconnectExhausted && <button className="btn-primary mt-5" onClick={() => location.reload()}><T value={{ ro: "Reîncarcă", en: "Reload" }} /></button>}
        </div>
      </Screen>
    );
  }

  if (status === "denied" || status === "closed") {
    const message = denyMessage || closedMessage || "Something went wrong.";
    return (
      <Screen>
        <div className="card mx-auto w-full max-w-md p-8 text-center">
          <div className="text-4xl">🧩</div>
          <h1 className="font-display mt-4 text-xl font-bold text-ink-900">
            {status === "denied" ? (
              <T value={{ ro: "Nu poți intra în această cameră", en: "Can't join this room" }} />
            ) : (
              <T value={{ ro: "Camera s-a închis", en: "Room closed" }} />
            )}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn-secondary btn-sm" onClick={() => navigate("/")}>
              <T value={{ ro: "Acasă", en: "Back home" }} />
            </button>
            <button className="btn-primary btn-sm" onClick={() => navigate("/create")}>
              <T value={{ ro: "Creează o cameră nouă", en: "Create a new room" }} />
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  if (!room || !puzzle) {
    return (
      <Screen>
        <div className="text-center">
          <Spinner className="mx-auto h-8 w-8 text-brand-500" />
          <div className="mt-4 text-sm text-ink-400">
            <T value={{ ro: "Se încarcă puzzle-ul…", en: "Loading the puzzle…" }} />
          </div>
        </div>
      </Screen>
    );
  }

  const me = players.find((p) => p.id === youId);

  // Level progression + final leaderboard (completion modal)
  const levelIdx = Math.max(0, LEVELS.findIndex((l) => l.id === room.difficulty));
  const nextLevel = levelIdx < LEVELS.length - 1 ? LEVELS[levelIdx + 1] : null;
  const rankingMap = new Map<string, { playerId: string; name: string; color: string; placed: number }>();
  players.forEach((player) => {
    rankingMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      color: player.color,
      placed: scoreByPlayer.get(player.id) || 0,
    });
  });
  scoreSource.forEach((entry) => {
    rankingMap.set(entry.playerId, {
      playerId: entry.playerId,
      name: entry.name,
      color: entry.color,
      placed: entry.placed,
    });
  });
  const finalRanking = [...rankingMap.values()].sort(
    (a, b) => b.placed - a.placed || a.name.localeCompare(b.name),
  );
  const podium = finalRanking.slice(0, 3);
  const formatContribution = (placed: number) =>
    `${placed} ${lang === "ro" ? "piese" : "pieces"} · ${Math.round((placed / total) * 100)}%`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink-950">
      {(room.stage === "debrief" || room.stage === "harvest") ? (
        <HarvestBoard room={room} activity={puzzle.activity} players={players} />
      ) : isCoaching && mode === "ranking" ? (
        <RankingActivity
          key={`${room.puzzleId}:${epoch}`}
          puzzle={puzzle}
          pieces={pieces}
          players={players}
          youId={youId}
        />
      ) : isCoaching && mode === "questionnaire" ? (
        <QuestionnaireActivity
          key={`${room.puzzleId}:${epoch}`}
          puzzle={puzzle}
          players={players}
          youId={youId}
        />
      ) : isCanvas && canvas ? (
        <CanvasBoard
          key={`${room.puzzleId}:${epoch}`}
          puzzle={puzzle}
          canvas={canvas}
          tiles={canvasTiles}
          cursors={cursors}
          players={players}
          youId={youId}
          inputEnabled={inputEnabled}
          resetSignal={resetSignal + epoch}
        />
      ) : (
        <Board
          puzzle={puzzle}
          pieces={pieces}
          cursors={cursors}
          players={players}
          youId={youId}
          onPieceDrop={() => {}}
          onResetRequest={() => window.confirm(lang === "ro" ? "Resetezi puzzle-ul pentru toată echipa?" : "Reset the puzzle for everyone?") && handleReset()}
          allowReset={!!room.completed && isHost}
          resetSignal={resetSignal + epoch}
          inputEnabled={inputEnabled}
        />
      )}

      {/* ------------------------------------------------------- top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:gap-3 sm:p-4" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
        {/* Game HUD (collapsible) */}
        {hudOpen ? (
          <div className="overlay-card pointer-events-auto w-[290px] max-w-[calc(100vw-108px)] p-4 sm:w-[300px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <LogoMark size={26} />
                <div className="min-w-0">
                  <div className="font-display truncate text-[15px] font-bold text-white">
                    {pick(puzzle.name, lang)}
                  </div>
                  <div className="truncate text-xs text-ink-300">
                    {isCoaching
                      ? mode === "ranking"
                        ? "Team ranking · " + total + " items"
                        : "Questionnaire · " + total + " questions"
                      : isCanvas
                        ? `${pick(CANVAS_MODE_LABELS[room.difficulty] || { ro: room.difficulty, en: room.difficulty }, lang)} · ${puzzle.contentLanguage?.toUpperCase() || ""}${
                            puzzle.category ? ` · ${CATEGORY_ICON[puzzle.category] || ""} ${getCategoryLabel(puzzle.category)}` : ""
                          }`
                        : `${getDifficultyLabel(room.difficulty)} · ${total} pieces${
                            puzzle.category ? ` · ${CATEGORY_ICON[puzzle.category] || ""} ${getCategoryLabel(puzzle.category)}` : ""
                          }`}
                  </div>
                </div>
              </div>
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => setHudOpen(false)}
                title="Hide panel"
                aria-label="Hide panel"
              >
                ▲
              </button>
            </div>

            {!isCoaching && (
              <div className="mt-3.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-ink-200">
                    <T value={isCanvas ? { ro: "Cărți pe foaie", en: "Tiles on the sheet" } : { ro: "Progres", en: "Progress" }} />
                  </span>
                  <span className="font-bold text-white">{isCanvas ? tileCount : `${progress}%`}</span>
                </div>
                {!isCanvas && (
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                <div className="mt-1 text-[11px] text-ink-400">
                  {isCanvas
                    ? canvas?.inventory
                      ? `${tileCount} / ${total} ${lang === "ro" ? "cărți din inventar" : "tiles from inventory"}`
                      : `${tileCount} ${lang === "ro" ? "cărți · sandbox nelimitat" : "tiles · unlimited sandbox"}`
                    : `${locked} / ${total} pieces`}
                </div>
              </div>
            )}

            {/* Players (with live placed-piece counts) */}
            {!isCoaching && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  <T value={{ ro: "În această cameră", en: "In this room" }} />
                  <span>
                    {playerCount}/{room.maxPlayers}
                  </span>
                </div>
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1 sm:max-h-48">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-[13px]">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/20"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-white">
                        {p.name}
                        {p.id === youId && (
                          <span className="text-ink-400">
                            {" "}(<T value={{ ro: "tu", en: "you" }} />)
                          </span>
                        )}
                      </span>
                      {(scoreByPlayer.get(p.id) || 0) > 0 && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-brand-200">
                          🧩 {scoreByPlayer.get(p.id)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-ink-200">
                👤 {playerCount} / {room.maxPlayers} <T value={{ ro: "jucători", en: "players" }} />
              </span>
              <span className="font-mono text-[13px] font-semibold text-white tabular-nums">
                ⏱ {formatClock(elapsed)}
              </span>
            </div>
          </div>
        ) : (
          <button
            className="overlay-card pointer-events-auto flex items-center gap-2 px-3 py-2 text-white"
            onClick={() => setHudOpen(true)}
            title="Show panel"
            aria-label="Show panel"
          >
            <LogoMark size={22} />
            {!isCoaching && <span className="text-xs font-bold">{progress}%</span>}
            <span className="font-mono text-xs font-semibold tabular-nums text-ink-200">
              ⏱ {formatClock(elapsed)}
            </span>
            <span className="text-xs text-ink-300">👤{playerCount}</span>
            <span className="text-[10px] text-ink-400">▼</span>
          </button>
        )}

        {/* Actions — icons on mobile, icon + label from sm up */}
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <LangToggle dark />
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isHost && (
              <button
                className="btn btn-dark btn-sm !px-2.5 sm:!px-4"
                onClick={() => setPickerOpen(true)}
                title="New puzzle"
              >
                🧩<span className="hidden sm:inline">&nbsp;<T value={{ ro: "Alt puzzle", en: "New puzzle" }} /></span>
              </button>
            )}
            <button
              className="btn btn-dark btn-sm !px-2.5 sm:!px-4"
              onClick={() => setShareOpen(true)}
              title="Share"
            >
              🔗<span className="hidden sm:inline">&nbsp;<T value={{ ro: "Partajează", en: "Share" }} /></span>
            </button>
            {isHost && (
              <button className="btn btn-dark btn-sm !border-emerald-400/30 !px-2.5 sm:!px-4" onClick={() => setFacilitatorOpen(true)} title="Facilitator controls">
                🎛<span className="hidden sm:inline">&nbsp;<T value={{ ro: "Facilitează", en: "Facilitate" }} /></span>
              </button>
            )}
            <button className="btn btn-dark btn-sm !px-2.5 sm:!px-4" onClick={() => setChatOpen((open) => !open)} title="Team chat">
              💬<span className="hidden sm:inline">&nbsp;Chat</span>{chat.length > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[10px]">{chat.length}</span>}
            </button>
            <button
              className="btn btn-dark btn-sm !px-2.5 sm:!px-4"
              onClick={handleLeave}
              title="Leave room"
            >
              🚪<span className="hidden sm:inline">&nbsp;<T value={{ ro: "Pleacă", en: "Leave" }} /></span>
            </button>
          </div>
        </div>
      </div>


      {/* Connection and facilitator state are always visible. Input is frozen offline. */}
      {!connected && status === "joined" && (
        <div className={`pointer-events-auto absolute inset-x-3 top-20 z-40 mx-auto max-w-md rounded-2xl border px-4 py-3 text-center text-sm font-semibold shadow-pop ${reconnectExhausted ? "border-rose-400/40 bg-rose-950/95 text-rose-100" : "border-amber-300/40 bg-amber-950/95 text-amber-100"}`}>
          {reconnectExhausted
            ? <T value={{ ro: "Conexiunea s-a pierdut. Reîncarcă pagina pentru a reintra în cameră.", en: "Connection lost. Reload the page to rejoin the room." }} />
            : <T value={{ ro: "Se reconectează… board-ul este blocat ca să nu pierzi mutări.", en: "Reconnecting… the board is frozen so no moves are lost." }} />}
        </div>
      )}
      {protocolError && <button className="absolute bottom-5 left-1/2 z-40 max-w-md -translate-x-1/2 rounded-xl border border-rose-400/30 bg-rose-950/95 px-4 py-2 text-sm text-rose-100" onClick={() => store.clearError()}>{protocolError} · ✕</button>}
      {room.startedAt && room.stage !== "lobby" && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-ink-900/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur sm:flex">
          <span>{room.boardLocked ? "🔒" : "●"}</span><span>{room.stage}</span>{room.timerEndsAt && <span className="font-mono text-amber-200">{formatClock(Math.max(0, room.timerEndsAt - now))}</span>}
        </div>
      )}

      {/* Lobby keeps the clock honest and gives the facilitator a clear start. */}
      {room.stage === "lobby" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-md">
          <div className="overlay-card w-[560px] max-w-full p-6 text-center sm:p-8">
            <div className="text-[11px] font-bold uppercase tracking-[.25em] text-brand-300"><T value={{ ro: "Lobby de workshop", en: "Workshop lobby" }} /></div>
            <h1 className="font-display mt-3 text-2xl font-extrabold text-white sm:text-3xl">{room.sessionName}</h1>
            <p className="mt-2 text-sm text-ink-300"><T value={{ ro: "Activitatea și cronometrul pornesc numai când facilitatorul apasă Start.", en: "The activity and session clock begin only when the facilitator presses Start." }} /></p>
            {isCanvas && puzzle.scenario && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <div className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-300"><T value={{ ro: "Scenariu", en: "Scenario" }} /> · {puzzle.contentLanguage?.toUpperCase()}</div>
                <div className="font-display mt-1 font-bold text-white"><T value={puzzle.scenario.title} /></div>
                <p className="mt-1 text-sm text-ink-300"><T value={puzzle.scenario.situation} /></p>
              </div>
            )}
            {isCanvas && (
              <p className="mt-3 text-xs text-ink-400">
                <T value={{ ro: "Foaie albă, fără imagine de referință. Finalizarea o declanșează facilitatorul.", en: "Blank sheet, no reference image. The facilitator triggers completion." }} />
              </p>
            )}
            <div className="mx-auto mt-6 inline-block rounded-2xl border border-white/10 bg-white/5 px-6 py-4"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-400"><T value={{ ro: "Cod de intrare", en: "Join code" }} /></div><div className="font-display mt-1 text-3xl font-extrabold tracking-[.35em] text-white">{room.code}</div></div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">{players.map((player) => <span key={player.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: player.color }} />{player.name}{player.role === "spectator" ? " · 👁" : ""}</span>)}</div>
            <div className="mt-4 text-xs text-ink-400">{players.length} {lang === "ro" ? "conectați" : "connected"}</div>
            {isHost ? <div className="mt-6 grid gap-2 sm:grid-cols-2"><button className="btn-primary" onClick={() => store.sendControl("start")}>▶ <T value={{ ro: "Start pentru toți", en: "Start for everyone" }} /></button><button className="btn btn-dark" onClick={() => setShareOpen(true)}>🔗 <T value={{ ro: "Invită colegi", en: "Invite teammates" }} /></button></div> : canTakeOver ? <button className="btn-primary mt-6" onClick={() => youId && api.takeover(room.id, youId)}>🎛 <T value={{ ro: "Preia rolul de facilitator", en: "Take over facilitation" }} /></button> : <div className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm text-ink-300">⏳ <T value={{ ro: "Așteptăm facilitatorul…", en: "Waiting for the facilitator…" }} /></div>}
          </div>
        </div>
      )}

      {room.stage === "brief" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-md">
          <div className="overlay-card w-[680px] max-w-full p-6 sm:p-9">
            <div className="text-[11px] font-bold uppercase tracking-[.25em] text-brand-300"><T value={{ ro: "Brief de activitate", en: "Activity brief" }} /></div>
            <h1 className="font-display mt-3 text-2xl font-extrabold text-white"><T value={puzzle.activity?.scenario?.title || puzzle.activity?.name || puzzle.name} /></h1>
            <p className="mt-4 text-base leading-relaxed text-ink-200"><T value={puzzle.activity?.scenario?.situation || puzzle.activity?.description || { ro: "Facilitatorul prezintă regulile înainte de joc.", en: "The facilitator introduces the rules before play." }} /></p>
            {puzzle.activity?.instructions && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-ink-300"><T value={puzzle.activity.instructions} /></p>}
            {isHost ? <button className="btn-primary mt-6 w-full" onClick={() => store.sendControl("stage", { stage: "play" })}>▶ <T value={{ ro: "Am înțeles — începe activitatea", en: "Understood — begin activity" }} /></button> : <div className="mt-6 text-center text-sm text-ink-400">⏳ <T value={{ ro: "Facilitatorul va porni activitatea.", en: "The facilitator will start the activity." }} /></div>}
          </div>
        </div>
      )}

      {/* My cursor chip */}
      {me && !isCoaching && (
        <div
          className="pointer-events-none absolute bottom-4 right-4 hidden rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-chip md:block"
          style={{ backgroundColor: me.color }}
        >
          <T value={{ ro: "Tu", en: "You" }} /> · {me.name}
        </div>
      )}

      {/* --------------------------------------------------- share modal */}
      {shareOpen && room && (
        <Modal onClose={() => setShareOpen(false)}>
          <div className="overlay-card w-[420px] max-w-full p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">
                <T value={{ ro: "Invită colegi", en: "Invite teammates" }} />
              </h2>
              <button
                onClick={() => setShareOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-300">
              <T value={{
                ro: `Trimite linkul împreună cu codul de acces — codul este cerut obligatoriu la intrare. Maxim ${room.maxPlayers} jucători.`,
                en: `Share the link together with the access code — the code is required to enter. Up to ${room.maxPlayers} players.`
              }} />
            </p>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                <T value={{ ro: "Cod de acces", en: "Access code" }} />
              </div>
              <div className="font-display mt-1 text-3xl font-extrabold tracking-[0.35em] text-white">
                {room.code}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">
                <T value={{
                  ro: "Participanții introduc acest cod după ce deschid linkul.",
                  en: "Participants type this code after opening the link.",
                }} />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <div className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 font-mono text-xs text-ink-200">
                {inviteUrl(room)}
              </div>
              <button
                className="btn-primary btn-sm shrink-0"
                onClick={() => {
                  copyToClipboard(inviteUrl(room));
                  markCopied();
                }}
              >
                {copied ? "✓ " : ""}<T value={copied ? { ro: "Copiat", en: "Copied" } : { ro: "Copiază", en: "Copy" }} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              <button
                className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  copyToClipboard(inviteUrl(room));
                  markCopied();
                }}
              >
                <T value={{ ro: "Copie link", en: "Copy link" }} />
              </button>
              <button
                className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  copyToClipboard(`Join me on PuzzleTogether! Room code: ${room.code} — ${inviteUrl(room)}`);
                  markCopied();
                }}
              >
                <T value={{ ro: "Copie link+cod", en: "Copy link + code" }} />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------- completion modal */}
      {!isCoaching && completion && room.completed && completionVisible && (
        <>
          <Confetti />
          <Modal onClose={() => setCompletionVisible(false)}>
            <div className="overlay-card relative max-h-[92vh] w-[760px] max-w-[96vw] overflow-y-auto p-5 sm:p-8">
              <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-ink-300 hover:bg-white/10" onClick={() => setCompletionVisible(false)} aria-label="Close and view completed puzzle">✕</button>
              <div className="text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="font-display mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  <T value={isCanvas ? { ro: "Compoziție finalizată!", en: "Composition complete!" } : { ro: "Puzzle finalizat!", en: "Puzzle completed!" }} />
                </h2>
                <div className="mt-1.5 text-lg font-semibold text-brand-300">
                  {pick(puzzle.name, lang)}
                </div>
                <div className="mt-2 text-sm text-ink-400">
                  {isCanvas
                    ? `${pick(CANVAS_MODE_LABELS[room.difficulty] || { ro: room.difficulty, en: room.difficulty }, lang)} · ${puzzle.contentLanguage?.toUpperCase()} · ${completion.canvasTiles?.length ?? 0} ${lang === "ro" ? "cărți" : "tiles"}`
                    : <><T value={{ ro: "Nivel", en: "Level" }} /> {levelIdx + 1} · {getDifficultyLabel(room.difficulty)} · {total} <T value={{ ro: "piese", en: "pieces" }} /></>}
                </div>
              </div>

              {isCanvas && (
                <div className="mt-5">
                  <div className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400">
                    <T value={{ ro: "Compoziția echipei", en: "The team's composition" }} />
                  </div>
                  <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 font-serif text-lg leading-relaxed text-white">
                    {completion.canvasText?.trim() || <span className="text-sm text-ink-400"><T value={{ ro: "Foaia rămâne goală — și asta e un rezultat.", en: "The sheet stayed blank — that's a valid outcome too." }} /></span>}
                  </pre>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400">
                    <T value={{ ro: "Timp total", en: "Total time" }} />
                  </div>
                  <div className="mt-2 font-display text-2xl font-extrabold text-white">
                    {formatClock(room.completedInMs || 0)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400">
                    <T value={{ ro: "Echipă activă", en: "Active team" }} />
                  </div>
                  <div className="mt-2 font-display text-2xl font-extrabold text-white">{finalRanking.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400">
                    <T value={{ ro: "Total puzzle", en: "Puzzle total" }} />
                  </div>
                  <div className="mt-2 font-display text-2xl font-extrabold text-white">{total}</div>
                  <div className="text-xs text-ink-400">
                    <T value={{ ro: "piese finalizate", en: "pieces completed" }} />
                  </div>
                </div>
              </div>

              {room.celebrationMode === "individual" ? (
                <div className="mt-7">
                  <div className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400"><T value={{ ro: "Podium opțional de contribuție", en: "Optional contribution podium" }} /></div>
                  <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 items-end gap-3">
                    {[podium[1], podium[0], podium[2]].map((entry, visualIndex) => {
                      if (!entry) return <div key={`empty-${visualIndex}`} />;
                      const rank = finalRanking.findIndex((candidate) => candidate.playerId === entry.playerId);
                      const style = PODIUM_STYLES[rank];
                      return <div key={entry.playerId} className="text-center"><div className="text-2xl">{style.medal}</div><div className="mt-1 truncate text-sm font-bold text-white">{entry.name}</div><div className={`mt-3 flex flex-col items-center justify-center rounded-2xl border ${style.box} ${style.height}`}><b className="font-display text-3xl">{entry.placed}</b><span className="text-[10px] text-white/70">{formatContribution(entry.placed)}</span></div></div>;
                    })}
                  </div>
                  <details className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4"><summary className="cursor-pointer text-sm font-semibold text-ink-200"><T value={{ ro: "Vezi toate contribuțiile", en: "View all contributions" }} /></summary><div className="mt-3 space-y-2">{finalRanking.map((entry, index) => <div key={entry.playerId} className="flex items-center gap-3 rounded-xl bg-white/[.03] px-3 py-2 text-sm"><b className="w-5 text-ink-500">{index + 1}</b><span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} /><span className="flex-1 truncate text-white">{entry.name}</span><span className="font-semibold text-brand-200">{entry.placed}</span></div>)}</div></details>
                </div>
              ) : (
                <div className="mt-7 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6 text-center">
                  <div className="text-4xl">🤝</div>
                  <h3 className="font-display mt-2 text-xl font-bold text-white"><T value={{ ro: "O singură echipă, un singur rezultat", en: "One team, one shared result" }} /></h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-300"><T value={{ ro: `Ați plasat împreună toate cele ${total} de piese. Contribuția individuală rămâne în fundal; timpul și rezultatul echipei sunt ceea ce celebrăm.`, en: `Together you placed all ${total} pieces. Individual contribution stays in the background; the team's time and outcome are what we celebrate.` }} /></p>
                </div>
              )}

              <div className="mt-7 space-y-3">
                {isHost ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    <button
                      className={`${nextLevel ? "btn w-full border border-white/10 bg-white/5 text-white hover:bg-white/10" : "btn-primary w-full"}`}
                      onClick={() => window.confirm(lang === "ro" ? "Reîncepi pentru toată echipa?" : "Replay for the whole team?") && handleReset()}
                    >
                      ↺ <T value={{ ro: "Replay", en: "Replay" }} />
                    </button>
                    {nextLevel ? (
                      <button
                        className="btn-primary w-full"
                        onClick={() => youId && api.changePuzzle(room.id, room.puzzleId, nextLevel.id, youId)}
                      >
                        ⬆ <T value={{ ro: "Level Up", en: "Level Up" }} />
                      </button>
                    ) : (
                      <button className="btn w-full border border-white/10 bg-white/5 text-white/60" disabled>
                        ✅ <T value={{ ro: "Nivel maxim atins", en: "Top level reached" }} />
                      </button>
                    )}
                    <button
                      className="btn w-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => setPickerOpen(true)}
                    >
                      🧩 <T value={{ ro: "Selectează Alt Puzzle", en: "Select Another Puzzle" }} />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-brand-400/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
                    <span className="mr-1.5">⏳</span>
                    <T
                      value={{
                        ro: "Gazda pregătește următoarea rundă. Rămâi conectat pentru Replay, Level Up sau selectarea altui puzzle.",
                        en: "The host is preparing the next round. Stay connected for Replay, Level Up or another puzzle selection.",
                      }}
                    />
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => {
                      store.leaveRoom();
                      navigate("/create");
                    }}
                  >
                    <T value={{ ro: "Cameră nouă", en: "Create New Room" }} />
                  </button>
                  <button
                    className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setShareOpen(true)}
                  >
                    <T value={{ ro: "Partajează", en: "Share Room" }} />
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        </>
      )}

      {facilitatorOpen && isHost && youId && (
        <FacilitatorPanel room={room} players={players} youId={youId} onClose={() => setFacilitatorOpen(false)} onReset={handleReset} />
      )}

      {chatOpen && (
        <aside className="safe-bottom fixed bottom-3 right-3 z-40 flex max-h-[60vh] w-[340px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 text-white shadow-pop backdrop-blur">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><b className="font-display text-sm"><T value={{ ro: "Chat de echipă", en: "Team chat" }} /></b><button onClick={() => setChatOpen(false)}>✕</button></header>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">{chat.length === 0 ? <p className="py-8 text-center text-xs text-ink-500"><T value={{ ro: "Începe conversația.", en: "Start the conversation." }} /></p> : chat.map((entry) => <div key={entry.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm"><div className="text-[10px] font-bold" style={{ color: entry.color }}>{entry.name}</div><div className="mt-0.5 break-words text-ink-200">{entry.text}</div></div>)}</div>
          <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); if (!chatText.trim()) return; store.sendChat(chatText); setChatText(""); }}><input className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" value={chatText} maxLength={500} onChange={(event) => setChatText(event.target.value)} placeholder={lang === "ro" ? "Scrie un mesaj…" : "Write a message…"} /><button className="btn-primary btn-sm" type="submit">↑</button></form>
        </aside>
      )}

      {/* --------------------------------------------- puzzle picker (host) */}
      {pickerOpen && room && (
        <PuzzlePicker room={room} youId={youId} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">{children}</div>
  );
}
