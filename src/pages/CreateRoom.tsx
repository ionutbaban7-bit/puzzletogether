import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { Logo, Spinner } from "../components/ui";
import { pick, T } from "../lib/i18n";
import type { CatalogData, CoachingActivity, Difficulty, PuzzleInfo } from "../types";

const CATEGORY_EMOJI: Record<string, string> = {
  "kids-magic": "🪄",
  paintings: "🎨",
  landscapes: "🏔️",
  landmarks: "🗼",
  nature: "🌿",
  cities: "🏙️",
  coaching: "🧭",
};

export default function CreateRoom() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(() => getSession().name || "");
  const [category, setCategory] = useState<string>("");
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.fetchCatalog().then(setCatalog).catch(() => setError("Could not load the puzzle library."));
  }, []);

  const isCoaching = category === "coaching";
  const selectedPuzzle = catalog?.puzzles.find((p) => p.id === puzzleId) || null;
  const selectedActivity = catalog?.coaching.activities.find((a) => a.id === puzzleId) || null;
  const selectedDifficulty =
    catalog?.difficulties.find((d) => d.id === difficulty) || null;

  const puzzlesForCategory = (catalog?.puzzles || []).filter(
    (p) => p.category === category,
  );

  async function handleCreate() {
    if (!name.trim()) return;
    if (!isCoaching && (!selectedPuzzle || !selectedDifficulty)) return;
    if (isCoaching && !selectedActivity) return;
    setBusy(true);
    setError("");
    try {
      const { room, playerId } = await api.createRoom(
        selectedActivity ? selectedActivity.id : selectedPuzzle!.id,
        selectedDifficulty?.id || "easy",
        name.trim(),
      );
      saveSession({ name: name.trim(), pid: playerId, roomId: room.id });
      navigate(`/room/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the room.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <header className="flex items-center justify-between py-6">
          <button onClick={() => navigate("/")} className="rounded-xl" aria-label="PuzzleTogether home">
            <Logo />
          </button>
          <button onClick={() => navigate("/join")} className="btn-secondary btn-sm">
            Join a Room
          </button>
        </header>

        {/* Stepper */}
        <div className="mx-auto mb-10 flex w-full max-w-md items-center gap-3 animate-fade-up">
          {[1, 2].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-3">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  step >= s ? "bg-brand-600 text-white" : "bg-white text-ink-400 border border-ink-200"
                }`}
              >
                {step > s ? "✓" : s}
              </div>
              <div className={`text-sm font-semibold ${step === s ? "text-ink-900" : "text-ink-400"}`}>
                {s === 1 ? "Your name" : "Choose puzzle"}
              </div>
              {s === 1 && <div className="h-px flex-1 bg-ink-200" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="card mx-auto max-w-md p-8 animate-fade-up">
            <h1 className="font-display text-2xl font-bold text-ink-900">What should we call you?</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              No account, no password — just a nickname your friends will see next to
              your cursor. We'll also pick a color for you.
            </p>
            <label className="mt-6 block text-sm font-semibold text-ink-700" htmlFor="name">
              Display name
            </label>
            <input
              id="name"
              className="input mt-2"
              placeholder="e.g. Ionut"
              value={name}
              maxLength={24}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(2)}
            />
            <button
              className="btn-primary mt-6 w-full"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-fade-up">
            <button
              onClick={() => setStep(1)}
              className="text-sm font-semibold text-ink-500 transition hover:text-ink-800"
            >
              ← Back
            </button>

            {/* Category */}
            <section>
              <h2 className="font-display text-lg font-bold text-ink-900">Pick a category</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {catalog?.categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCategory(c.id);
                      setPuzzleId(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      category === c.id
                        ? "border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20"
                        : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                    }`}
                  >
                    <span className="mr-1.5">{CATEGORY_EMOJI[c.id] || c.icon}</span>
                    {c.name}
                  </button>
                ))}
                {catalog?.coaching && (
                  <button
                    onClick={() => {
                      setCategory(catalog.coaching.category.id);
                      setPuzzleId(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      category === catalog.coaching.category.id
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                    }`}
                  >
                    <span className="mr-1.5">{catalog.coaching.category.icon}</span>
                    {catalog.coaching.category.name}
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      New
                    </span>
                  </button>
                )}
              </div>
            </section>

            {/* Puzzles (image categories) */}
            {category && !isCoaching && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink-900">
                  Choose an image
                  <span className="ml-2 text-sm font-medium text-ink-400">
                    {puzzlesForCategory.length} puzzles
                  </span>
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {puzzlesForCategory.map((p) => (
                    <PuzzleCard
                      key={p.id}
                      puzzle={p}
                      selected={puzzleId === p.id}
                      onSelect={() => setPuzzleId(p.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Coaching activities */}
            {isCoaching && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink-900">
                  Team coaching exercises
                  <span className="ml-2 text-sm font-medium text-ink-400">
                    {catalog?.coaching.activities.length} activities
                  </span>
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {catalog?.coaching.activities.map((a) => (
                    <ActivityCard
                      key={a.id}
                      activity={a}
                      selected={puzzleId === a.id}
                      onSelect={() => setPuzzleId(a.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Difficulty (only for image puzzles) */}
            {!isCoaching && (
              <section>
                <h2 className="font-display text-lg font-bold text-ink-900">Difficulty</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {catalog?.difficulties.map((d) => (
                    <DifficultyCard
                      key={d.id}
                      difficulty={d}
                      selected={difficulty === d.id}
                      onSelect={() => setDifficulty(d.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            <div className="sticky bottom-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white/95 p-4 shadow-pop backdrop-blur sm:flex-row">
              <div className="text-sm text-ink-600">
                {isCoaching && selectedActivity ? (
                  <>
                    <span className="font-semibold text-ink-900">
                      <T value={selectedActivity.name} />
                    </span>
                    {" · "}
                    {selectedActivity.mode === "ranking" ? "Team ranking" : "Personality questionnaire"}
                    {" · "}
                    {selectedActivity.duration}
                  </>
                ) : !isCoaching && selectedPuzzle && selectedDifficulty ? (
                  <>
                    <span className="font-semibold text-ink-900">{selectedPuzzle.name}</span>
                    {" · "}
                    {selectedDifficulty.name} · {selectedDifficulty.pieces} pieces
                  </>
                ) : (
                  "Select a puzzle to continue"
                )}
              </div>
              <button
                className="btn-primary w-full sm:w-auto"
                disabled={isCoaching ? !selectedActivity || busy : !selectedPuzzle || !selectedDifficulty || busy}
                onClick={handleCreate}
              >
                {busy ? <Spinner /> : "Create Room"}
              </button>
            </div>
          </div>
        )}

        {!catalog && !error && (
          <div className="flex justify-center py-24 text-ink-400">
            <Spinner className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}

function PuzzleCard({
  puzzle,
  selected,
  onSelect,
}: {
  puzzle: PuzzleInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-150 ${
        selected
          ? "border-brand-600 ring-4 ring-brand-600/15"
          : "border-ink-200 hover:-translate-y-0.5 hover:shadow-card"
      }`}
    >
      <div className="aspect-[4/3] overflow-hidden bg-ink-100">
        <img
          src={puzzle.image}
          alt={puzzle.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">{puzzle.name}</div>
          <div className="truncate text-[11px] text-ink-400">{puzzle.credit}</div>
        </div>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
            selected ? "border-brand-600 bg-brand-600" : "border-ink-300"
          }`}
        >
          {selected && <span className="text-[10px] font-bold text-white">✓</span>}
        </div>
      </div>
    </button>
  );
}

function ActivityCard({
  activity,
  selected,
  onSelect,
}: {
  activity: CoachingActivity;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-150 ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-600/15"
          : "border-ink-200 hover:-translate-y-0.5 hover:shadow-card"
      }`}
    >
      <div className="flex">
        <div className="h-32 w-40 shrink-0 overflow-hidden bg-ink-950">
          <img
            src={activity.cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                {activity.mode === "ranking" ? "Team ranking" : "Questionnaire"}
              </span>
              <span className="text-[11px] font-medium text-ink-400">⏱ {activity.duration}</span>
            </div>
            <div className="mt-1.5 truncate font-display text-[15px] font-bold text-ink-900">
              <T value={activity.name} />
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-500">
              <T value={activity.description} />
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-400">
              {activity.mode === "ranking"
                ? `${activity.items?.length ?? 0} items · expert ranking · debrief`
                : `${activity.questions?.length ?? 0} questions · 16 profiles`}
            </span>
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                selected ? "border-emerald-600 bg-emerald-600" : "border-ink-300"
              }`}
            >
              {selected && <span className="text-[10px] font-bold text-white">✓</span>}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function DifficultyCard({
  difficulty,
  selected,
  onSelect,
}: {
  difficulty: Difficulty;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition-all duration-150 ${
        selected
          ? "border-brand-600 bg-brand-50 ring-4 ring-brand-600/10"
          : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
      }`}
    >
      <div className={`font-display text-sm font-bold ${selected ? "text-brand-700" : "text-ink-900"}`}>
        {difficulty.name}
      </div>
      <div className="mt-0.5 text-xs text-ink-500">{difficulty.pieces} pieces</div>
    </button>
  );
}
