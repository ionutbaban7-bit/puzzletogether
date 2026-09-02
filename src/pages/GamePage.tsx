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
  { medal: "\u{1F947}", height: "h-20", box: "border-amber-300/60 bg-gradient-to-b from-amber-400/50 to-amber-500/15" },
  { medal: "\u{1F948}", height: "h-14", box: "border-slate-300/50 bg-gradient-to-b from-slate-300/40 to-slate-400/10" },
  { medal: "\u{1F949}", height: "h-11", box: "border-orange-400/50 bg-gradient-to-b from-orange-500/40 to-orange-600/10" },
];

const DIFFICULTY_STRINGS = {
  easy: { ro: "Ușor", en: "Easy" },
  medium: { ro: "Mediu", en: "Medium" },
  hard: { ro: "Greu", en: "Hard" },
  expert: { ro: "Expert", en: "Expert" },
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

  const scoreByPlayer = new Map(scores.map((sc) => [sc.playerId, sc.placed]));

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
  const finalScores = (completion?.scores?.length ? completion.scores : scores).filter(
    (s) => s.placed > 0,
  );
  const podium = finalScores.slice(0, 3);
  const restOfRanking = finalScores.slice(3, 12);

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
                          puzzle.category ? ` · ${CATEGORY_ICON[puzzle.category] || ""} ${puzzle.category}` : ""
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
            <div className="overlay-card max-h-[90vh] w-[470px] max-w-full overflow-y-auto p-6 text-center sm:p-8">
              <div className="text-5xl">🎉</div>
              <h2 className="font-display mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                <T value={{ ro: "Puzzle finalizat!", en: "Puzzle completed!" }} />
              </h2>
              <div className="mt-1.5 text-lg font-semibold text-brand-300">
                {pick(puzzle.name, lang)}
              </div>
              <div className="mt-1 text-sm text-ink-400">
                <T value={{ ro: "Nivel", en: "Level" }} /> {levelIdx + 1} · {getDifficultyLabel(room.difficulty)} · {total}{" "}
                <T value={{ ro: "piese", en: "pieces" }} /> · ⏱ {formatClock(room.completedInMs || 0)}
              </div>

              {/* ----------------------------------------------- podium */}
              {podium.length > 0 ? (
                <div className="mt-6">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    <T value={{ ro: "Clasamentul pieselor puse", en: "Pieces placed — leaderboard" }} />
                  </div>
                  <div className="mt-4 flex items-end justify-center gap-2">
                    {[1, 0, 2].map((rank) => {
                      const s = podium[rank];
                      if (!s) return null;
                      const style = PODIUM_STYLES[rank];
                      return (
                        <div key={s.playerId} className="flex w-[88px] flex-col items-center sm:w-24">
                          <div className="text-2xl">{style.medal}</div>
                          <div className="mt-0.5 flex w-full items-center justify-center gap-1">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="truncate text-xs font-bold text-white">{s.name}</span>
                          </div>
                          <div
                            className={`mt-1.5 flex w-full flex-col items-center justify-center rounded-t-xl border-t border-x ${style.box} ${style.height}`}
                          >
                            <span className="font-display text-xl font-extrabold text-white">
                              {s.placed}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                              <T value={{ ro: "piese", en: "pieces" }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {restOfRanking.length > 0 && (
                    <div className="mx-auto mt-2 max-w-xs divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
                      {restOfRanking.map((s, i) => (
                        <div key={s.playerId} className="flex items-center gap-2 px-3.5 py-2 text-[13px]">
                          <span className="w-5 shrink-0 text-left font-bold text-ink-400">{i + 4}.</span>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="min-w-0 flex-1 truncate text-left font-medium text-white">{s.name}</span>
                          <span className="shrink-0 font-bold text-ink-200">
                            {s.placed} <span className="text-[10px] font-semibold text-ink-400">🧩</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                completion.players.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                      <T value={{ ro: "Rezolvat de", en: "Solved by" }} />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                      {completion.players.slice(0, 20).map((name, i) => (
                        <span
                          key={`${name}-${i}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}

              <div className="mt-7 grid gap-2">
                {isHost ? (
                  <>
                    {nextLevel && (
                      <button
                        className="btn-primary w-full"
                        onClick={() =>
                          youId && api.changePuzzle(room.id, room.puzzleId, nextLevel.id, youId)
                        }
                      >
                        ⬆ <T value={{ ro: "Mergi mai departe — Nivel", en: "Level up — Level" }} /> {levelIdx + 2}
                        {": "}
                        {getDifficultyLabel(nextLevel.id)} · {nextLevel.pieces}{" "}
                        <T value={{ ro: "piese", en: "pieces" }} />
                      </button>
                    )}
                    <button
                      className={`${nextLevel ? "btn w-full border border-white/10 bg-white/5 text-white hover:bg-white/10" : "btn-primary w-full"}`}
                      onClick={handleReset}
                    >
                      ↺ <T value={{ ro: "Reia jocul (același puzzle)", en: "Replay this puzzle" }} />
                    </button>
                    <button
                      className="btn w-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => setPickerOpen(true)}
                    >
                      🧩 <T value={{ ro: "Joacă alt puzzle în această cameră", en: "Play another puzzle in this room" }} />
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl border border-brand-400/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
                    <span className="mr-1.5">⏳</span>
                    <T
                      value={{
                        ro: "Gazda alege următorul nivel sau puzzle — rămâi conectat, jocul pornește automat pentru toți.",
                        en: "The host is picking the next level or puzzle — stay connected, the game starts automatically for everyone.",
                      }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
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
