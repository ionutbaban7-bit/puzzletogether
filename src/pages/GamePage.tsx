import { useEffect, useState } from "react";
import Board from "../puzzle/Board";
import RankingActivity from "../puzzle/RankingActivity";
import QuestionnaireActivity from "../puzzle/QuestionnaireActivity";
import { api } from "../lib/api";
import { copyToClipboard, formatClock, inviteUrl } from "../lib/format";
import { navigate } from "../lib/router";
import { store, useStore } from "../store";
import { Confetti, LogoMark, Modal, Spinner, useCopied } from "../components/ui";
import PuzzlePicker from "../components/PuzzlePicker";
import { LangToggle, pick, useLang, T } from "../lib/i18n";
import { lockedCountOf } from "../store";

const CATEGORY_ICON: Record<string, string> = {
  words: "🔤",
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
  words: { ro: "Word World", en: "Word World" },
  paintings: { ro: "Picturi celebre", en: "Famous Paintings" },
  landscapes: { ro: "Peisaje celebre", en: "Famous Landscapes" },
  landmarks: { ro: "Repere globale", en: "World Landmarks" },
  nature: { ro: "Natură", en: "Nature" },
  cities: { ro: "Orașe", en: "Cities" },
  coaching: { ro: "Coaching", en: "Coaching" },
} as const;

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

  const [shareOpen, setShareOpen] = useState(false);
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
  }, [epoch]);

  const locked = lockedCountOf(pieces);
  const total = room?.total || 1;
  const progress = Math.round((locked / total) * 100);
  const elapsed = room ? (room.completed ? room.completedInMs || 0 : now - room.createdAt) : 0;
  const playerCount = players.length;
  const isCoaching = !!puzzle?.isCoaching;
  const mode = puzzle?.mode;

  const scoreSource = completion?.scores?.length ? completion.scores : scores;
  const scoreByPlayer = new Map(scoreSource.map((sc) => [sc.playerId, sc.placed]));

  // The room creator facilitates; if they left, the first connected player takes over.
  const hostConnected = !!room?.hostId && players.some((p) => p.id === room.hostId);
  const isHost =
    !!youId && !!room && (room.hostId === youId || (!hostConnected && players[0]?.id === youId));

  async function handleReset() {
    if (!room) return;
    await api.resetRoom(room.id);
    setResetSignal((n) => n + 1);
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
          <Spinner className="mx-auto h-8 w-8 text-brand-500" />
          <div className="font-display mt-5 text-lg font-semibold text-white">
            <T value={{ ro: "Se intră în cameră…", en: "Joining the room…" }} />
          </div>
          <div className="mt-1 text-sm text-ink-400">
            <T value={{ ro: "Conectare la colegi", en: "Connecting to your teammates" }} />
          </div>
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
  const restOfRanking = finalRanking.slice(3);
  const formatContribution = (placed: number) =>
    `${placed} ${lang === "ro" ? "piese" : "pieces"} · ${Math.round((placed / total) * 100)}%`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink-950">
      {isCoaching && mode === "ranking" ? (
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
      ) : (
        <Board
          puzzle={puzzle}
          pieces={pieces}
          cursors={cursors}
          players={players}
          youId={youId}
          onPieceDrop={() => {}}
          onResetRequest={handleReset}
          allowReset={!!room.completed}
          resetSignal={resetSignal + epoch}
        />
      )}

      {/* ------------------------------------------------------- top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:gap-3 sm:p-4">
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
                    <T value={{ ro: "Progres", en: "Progress" }} />
                  </span>
                  <span className="font-bold text-white">{progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-ink-400">
                  {locked} / {total} pieces
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
            {!isCoaching && (
              <button
                className="btn btn-dark btn-sm !px-2.5 sm:!px-4"
                onClick={() => setShareOpen(true)}
                title="Share"
              >
                🔗<span className="hidden sm:inline">&nbsp;<T value={{ ro: "Partajează", en: "Share" }} /></span>
              </button>
            )}
            <button
              className="btn btn-dark btn-sm !px-2.5 sm:!px-4"
              onClick={() => {
                store.leaveRoom();
                navigate("/");
              }}
              title="Leave room"
            >
              🚪<span className="hidden sm:inline">&nbsp;<T value={{ ro: "Pleacă", en: "Leave" }} /></span>
            </button>
          </div>
        </div>
      </div>


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
                {copied ? "✓ " : ""}<T value={{ ro: "Copiat", en: "Copied" }} />
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
      {!isCoaching && completion && room.completed && (
        <>
          <Confetti />
          <Modal dismissable={false}>
            <div className="overlay-card max-h-[92vh] w-[760px] max-w-[96vw] overflow-y-auto p-5 sm:p-8">
              <div className="text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="font-display mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  <T value={{ ro: "Puzzle finalizat!", en: "Puzzle completed!" }} />
                </h2>
                <div className="mt-1.5 text-lg font-semibold text-brand-300">
                  {pick(puzzle.name, lang)}
                </div>
                <div className="mt-2 text-sm text-ink-400">
                  <T value={{ ro: "Nivel", en: "Level" }} /> {levelIdx + 1} · {getDifficultyLabel(room.difficulty)} · {total}{" "}
                  <T value={{ ro: "piese", en: "pieces" }} />
                </div>
              </div>

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

              <div className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400">
                      <T value={{ ro: "Podium colaborativ", en: "Collaborative podium" }} />
                    </div>
                    <div className="mt-1 text-sm text-ink-300">
                      <T value={{ ro: "Top 3 jucători după numărul de piese plasate", en: "Top 3 players by placed pieces" }} />
                    </div>
                  </div>
                  {completion.players.length > 0 && (
                    <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-ink-300 sm:block">
                      <T value={{ ro: "Finalizat de", en: "Completed by" }} /> {completion.players.length}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-end justify-center gap-3 lg:gap-4">
                  {[1, 0, 2].map((rankIndex) => {
                    const entry = podium[rankIndex];
                    const style = PODIUM_STYLES[rankIndex];
                    if (!entry) return null;
                    const isMvp = rankIndex === 0;
                    return (
                      <button
                        key={entry.playerId}
                        type="button"
                        className={`group relative flex w-[170px] flex-col items-center rounded-[26px] border border-white/10 bg-white/[0.05] px-4 pb-4 pt-5 text-center transition duration-200 hover:-translate-y-1 hover:bg-white/[0.08] ${
                          isMvp ? "ring-2 ring-amber-300/30" : ""
                        }`}
                      >
                        {isMvp && (
                          <div className="absolute -top-4 inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-100">
                            👑 MVP · 🏆
                          </div>
                        )}
                        <div className={`text-3xl ${style.accent}`}>{style.medal}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full ring-2 ring-white/15" style={{ backgroundColor: entry.color }} />
                          <span className="max-w-[110px] truncate text-sm font-bold text-white">{entry.name}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                          <T value={style.label} />
                        </div>
                        <div className={`mt-3 flex w-full flex-col items-center justify-center rounded-[22px] border ${style.box} ${style.height}`}>
                          <div className="font-display text-3xl font-extrabold text-white">{entry.placed}</div>
                          <div className="mt-1 text-[11px] font-semibold text-white/75">{formatContribution(entry.placed)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-7 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-400">
                      <T value={{ ro: "Clasament complet", en: "Full team ranking" }} />
                    </div>
                    <div className="mt-1 text-sm text-ink-300">
                      <T value={{ ro: "Contribuția fiecărui jucător la puzzle-ul final", en: "Each player’s contribution to the finished puzzle" }} />
                    </div>
                  </div>
                  <div className="text-xs font-medium text-ink-400">100% · {total} <T value={{ ro: "piese", en: "pieces" }} /></div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8">
                  <div className="grid grid-cols-[62px_minmax(0,1fr)_110px_120px] gap-3 bg-white/[0.04] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                    <span>#</span>
                    <span><T value={{ ro: "Jucător", en: "Player" }} /></span>
                    <span className="text-right"><T value={{ ro: "Piese", en: "Pieces" }} /></span>
                    <span className="text-right">%</span>
                  </div>
                  <div className="divide-y divide-white/6 bg-ink-950/20">
                    {finalRanking.map((entry, index) => {
                      const share = Math.round((entry.placed / total) * 100);
                      const isMvp = index === 0;
                      return (
                        <div key={entry.playerId} className="grid grid-cols-[62px_minmax(0,1fr)_110px_120px] items-center gap-3 px-4 py-3 text-sm">
                          <div className="flex items-center gap-2 text-white">
                            <span className="font-display text-lg font-bold">{index + 1}</span>
                            {index < 3 && <span className="text-base">{PODIUM_STYLES[index].medal}</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/15" style={{ backgroundColor: entry.color }} />
                              <span className="truncate font-semibold text-white">{entry.name}</span>
                              {entry.playerId === youId && (
                                <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-200">
                                  <T value={{ ro: "Tu", en: "You" }} />
                                </span>
                              )}
                              {isMvp && (
                                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                                  👑 MVP
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-ink-400">{formatContribution(entry.placed)}</div>
                          </div>
                          <div className="text-right font-display text-lg font-bold text-white">{entry.placed}</div>
                          <div className="text-right font-semibold text-ink-200">{share}%</div>
                        </div>
                      );
                    })}
                    {restOfRanking.length === 0 && finalRanking.length <= 3 && (
                      <div className="px-4 py-3 text-sm text-ink-400">
                        <T value={{ ro: "Podiumul reprezintă întregul clasament al echipei.", en: "The podium already represents the full team ranking." }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                {isHost ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    <button
                      className={`${nextLevel ? "btn w-full border border-white/10 bg-white/5 text-white hover:bg-white/10" : "btn-primary w-full"}`}
                      onClick={handleReset}
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
