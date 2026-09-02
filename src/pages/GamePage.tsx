import { useEffect, useState } from "react";
import Board from "../puzzle/Board";
import RankingActivity from "../puzzle/RankingActivity";
import QuestionnaireActivity from "../puzzle/QuestionnaireActivity";
import { api } from "../lib/api";
import { copyToClipboard, formatClock, inviteUrl } from "../lib/format";
import { navigate } from "../lib/router";
import { store, useStore } from "../store";
import { Confetti, LogoMark, Modal, Spinner, useCopied } from "../components/ui";
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

  const [shareOpen, setShareOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [resetSignal, setResetSignal] = useState(0);
  const [copied, markCopied] = useCopied();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const locked = lockedCountOf(pieces);
  const total = room?.total || 1;
  const progress = Math.round((locked / total) * 100);
  const elapsed = room ? (room.completed ? room.completedInMs || 0 : now - room.createdAt) : 0;
  const playerCount = players.length;
  const isCoaching = !!puzzle?.isCoaching;
  const mode = puzzle?.mode;

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink-950">
      {isCoaching && mode === "ranking" ? (
        <RankingActivity puzzle={puzzle} pieces={pieces} players={players} youId={youId} />
      ) : isCoaching && mode === "questionnaire" ? (
        <QuestionnaireActivity puzzle={puzzle} players={players} youId={youId} />
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
          resetSignal={resetSignal}
        />
      )}

      {/* ------------------------------------------------------- top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        {/* Game info panel */}
        <div className="overlay-card pointer-events-auto w-[300px] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
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

          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-ink-200">
              👤 {playerCount} / {room.maxPlayers} <T value={{ ro: "jucători", en: "players" }} />
            </span>
            <span className="font-mono text-[13px] font-semibold text-white tabular-nums">
              ⏱ {formatClock(elapsed)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pointer-events-auto flex items-center gap-2">
          <LangToggle dark />
          {!isCoaching && (
            <button className="btn btn-dark btn-sm" onClick={() => setShareOpen(true)}>
              🔗 <T value={{ ro: "Partajează", en: "Share" }} />
            </button>
          )}
          <button
            className="btn btn-dark btn-sm"
            onClick={() => {
              store.leaveRoom();
              navigate("/");
            }}
          >
            <T value={{ ro: "Pleacă", en: "Leave" }} />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------- players sidebar */}
      {!isCoaching && (
        <div className="overlay-card pointer-events-auto absolute right-4 top-[152px] hidden w-56 p-4 sm:block">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            <T value={{ ro: "În această cameră", en: "In this room" }} />
          </div>
          <div className="mt-2.5 space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[13px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate font-medium text-white">
                  {p.name}
                  {p.id === youId && (
                    <span className="text-ink-400">
                      {" "}(<T value={{ ro: "tu", en: "you" }} />)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          {playerCount < 20 && (
            <div className="mt-3 text-[11px] text-ink-400">
              <T value={{ ro: "Partajează camera pentru a adăuga jucători", en: "Share the room to add players" }} />
            </div>
          )}
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
                ro: `Oricine cu linkul sau codul poate intra — maxim ${room.maxPlayers} jucători.`,
                en: `Anyone with the link or code can join — up to ${room.maxPlayers} players.`
              }} />
            </p>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                <T value={{ ro: "Codul camerei", en: "Room code" }} />
              </div>
              <div className="font-display mt-1 text-3xl font-extrabold tracking-[0.35em] text-white">
                {room.code}
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
            <div className="overlay-card w-[440px] max-w-full p-8 text-center">
              <div className="text-5xl">🎉</div>
              <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-white">
                <T value={{ ro: "Puzzle finalizat!", en: "Puzzle completed!" }} />
              </h2>
              <div className="mt-2 text-lg font-semibold text-brand-300">
                {pick(puzzle.name, lang)}
              </div>
              <div className="mt-1 text-sm text-ink-400">
                {total} <T value={{ ro: "piese", en: "pieces" }} /> · {getDifficultyLabel(room.difficulty)}
              </div>

              <div className="mx-auto mt-5 max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  <T value={{ ro: "Completat în", en: "Completed in" }} />
                </div>
                <div className="font-display mt-0.5 text-xl font-bold text-white">
                  {formatClock(room.completedInMs || 0)}
                </div>
              </div>

              {completion.players.length > 0 && (
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
              )}

              <div className="mt-7 grid gap-2">
                <button className="btn-primary w-full" onClick={handleReset}>
                  ↺ <T value={{ ro: "Joacă alt puzzle în această cameră", en: "Play Another Puzzle in this Room" }} />
                </button>
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
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">{children}</div>
  );
}
