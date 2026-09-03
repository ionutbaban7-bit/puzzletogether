import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Modal, Spinner } from "./ui";
import { T, useLang } from "../lib/i18n";
import type { CatalogData, RoomView } from "../types";

const CATEGORY_EMOJI: Record<string, string> = {
  words: "🔤",
  paintings: "🎨",
  landscapes: "🏔️",
  landmarks: "🗼",
  nature: "🌿",
  cities: "🏙️",
  coaching: "🧭",
};

/**
 * In-room puzzle picker: lets the host start a different puzzle/activity in
 * the SAME room. Everyone stays connected — the server broadcasts the switch.
 */
export default function PuzzlePicker({
  room,
  youId,
  onClose,
}: {
  room: RoomView;
  youId: string | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [category, setCategory] = useState<string>("");
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string>(room.difficulty || "medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .fetchCatalog()
      .then(setCatalog)
      .catch(() => setError("Could not load the puzzle library."));
  }, []);

  const isCoaching = category === "coaching";
  const selectedPuzzle = catalog?.puzzles.find((p) => p.id === puzzleId) || null;
  const selectedActivity = catalog?.coaching.activities.find((a) => a.id === puzzleId) || null;
  const puzzlesForCategory = (catalog?.puzzles || []).filter((p) => p.category === category);
  const canStart = isCoaching ? !!selectedActivity : !!selectedPuzzle;

  async function handleStart() {
    if (!canStart || !youId || busy) return;
    if (!window.confirm(lang === "ro" ? "Progresul activității curente se va pierde. Pregătești următoarea activitate?" : "Current activity progress will be lost. Prepare the next activity?")) return;
    setBusy(true);
    setError("");
    try {
      await api.changePuzzle(room.id, puzzleId!, difficulty, youId);
      onClose(); // everyone (including us) switches via the websocket broadcast
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the puzzle.");
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? undefined : onClose}>
      <div className="overlay-card flex max-h-[85vh] w-[680px] max-w-[94vw] flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              🧩 <T value={{ ro: "Alege următorul puzzle", en: "Pick the next puzzle" }} />
            </h2>
            <p className="mt-1 text-sm text-ink-300">
              <T
                value={{
                  ro: "Toți jucătorii rămân conectați — jocul nou pornește instant pentru toată lumea.",
                  en: "Everyone stays connected — the new game starts instantly for the whole room.",
                }}
              />
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!catalog && !error && (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-brand-400" />
          </div>
        )}

        {catalog && (
          <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {catalog.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategory(c.id);
                    setPuzzleId(null);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    category === c.id
                      ? "border-brand-500 bg-brand-600 text-white"
                      : "border-white/15 bg-white/5 text-ink-200 hover:bg-white/10"
                  }`}
                >
                  <span className="mr-1.5">{CATEGORY_EMOJI[c.id] || c.icon}</span>
                  {c.name}
                </button>
              ))}
              {catalog.coaching && (
                <button
                  onClick={() => {
                    setCategory(catalog.coaching.category.id);
                    setPuzzleId(null);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    category === catalog.coaching.category.id
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : "border-white/15 bg-white/5 text-ink-200 hover:bg-white/10"
                  }`}
                >
                  <span className="mr-1.5">{catalog.coaching.category.icon}</span>
                  {catalog.coaching.category.name}
                </button>
              )}
            </div>

            {/* Image puzzles */}
            {category && !isCoaching && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {puzzlesForCategory.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPuzzleId(p.id)}
                    className={`group overflow-hidden rounded-xl border text-left transition ${
                      puzzleId === p.id
                        ? "border-brand-500 ring-2 ring-brand-500/40"
                        : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-ink-900">
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="truncate bg-white/5 px-2.5 py-2 text-xs font-semibold text-white">
                      {puzzleId === p.id && <span className="mr-1 text-brand-300">✓</span>}
                      {p.name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Coaching activities */}
            {isCoaching && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {catalog.coaching.activities.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setPuzzleId(a.id)}
                    className={`flex gap-3 overflow-hidden rounded-xl border p-3 text-left transition ${
                      puzzleId === a.id
                        ? "border-emerald-500 ring-2 ring-emerald-500/40"
                        : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-900">
                      <img src={a.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {puzzleId === a.id && <span className="mr-1 text-emerald-300">✓</span>}
                        <T value={a.name} />
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                        {a.mode === "ranking" ? (
                          <T value={{ ro: "Clasament de echipă", en: "Team ranking" }} />
                        ) : (
                          <T value={{ ro: "Chestionar", en: "Questionnaire" }} />
                        )}{" "}
                        · ⏱ {a.duration}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-300">
                        <T value={a.description} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Difficulty (image puzzles only) */}
            {category && !isCoaching && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  <T value={{ ro: "Dificultate", en: "Difficulty" }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {catalog.difficulties.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={`rounded-xl border px-3.5 py-2 text-left transition ${
                        difficulty === d.id
                          ? "border-brand-500 bg-brand-600/20 text-white"
                          : "border-white/10 bg-white/5 text-ink-200 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-[13px] font-bold">{d.name}</span>
                      <span className="ml-1.5 text-[11px] text-ink-300">{d.pieces}p</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!category && (
              <div className="rounded-xl border border-dashed border-white/15 py-10 text-center text-sm text-ink-400">
                <T value={{ ro: "Alege o categorie de mai sus", en: "Pick a category above" }} />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            className="btn btn-sm border border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={onClose}
            disabled={busy}
          >
            <T value={{ ro: "Anulează", en: "Cancel" }} />
          </button>
          <button className="btn-primary btn-sm" disabled={!canStart || busy} onClick={handleStart}>
            {busy ? <Spinner /> : <>→ <T value={{ ro: "Pregătește lobby-ul", en: "Prepare lobby" }} /></>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
