import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { LangToggle, pick, T, useLang } from "../lib/i18n";
import { CategoryGlyph, Logo, Spinner } from "../components/ui";
import type { CatalogData, CoachingActivity, Difficulty, PuzzleInfo } from "../types";

const CATEGORY_EMOJI: Record<string, string> = { "letter-canvas": "✍️", "sentence-canvas": "💬", paintings: "🎨", landscapes: "🏔️", landmarks: "🗼", nature: "🌿", cities: "🏙️", coaching: "🧭" };
const CATEGORY_NAMES: Record<string, { ro: string; en: string }> = {
  "letter-canvas": { ro: "Foaie de litere", en: "Letter Canvas" }, "sentence-canvas": { ro: "Foaie de propoziții", en: "Sentence Canvas" },
  paintings: { ro: "Picturi", en: "Paintings" }, landscapes: { ro: "Peisaje", en: "Landscapes" }, landmarks: { ro: "Repere", en: "Landmarks" },
  nature: { ro: "Natură", en: "Nature" }, cities: { ro: "Orașe", en: "Cities" },
  "isometric-worlds": { ro: "Lumi izometrice", en: "Isometric worlds" },
  "abstract-geometry": { ro: "Geometrie abstractă", en: "Abstract geometry" },
  "blueprint-architecture": { ro: "Planuri arhitecturale", en: "Blueprint architecture" },
  coaching: { ro: "Team coaching", en: "Team coaching" },
};
const DIFFICULTY_META: Record<string, { minutes: string; people: string }> = {
  easy: { minutes: "8–12 min", people: "2–6" }, medium: { minutes: "15–25 min", people: "3–8" }, hard: { minutes: "25–40 min", people: "4–10" }, expert: { minutes: "40–60 min", people: "4–12" }, master: { minutes: "60–90 min", people: "4–12" },
  quick: { minutes: "10–20 min", people: "2–8" }, standard: { minutes: "20–35 min", people: "2–10" }, extended: { minutes: "35–50 min", people: "2–12" }, sandbox: { minutes: "liber", people: "2–20" },
};
const CANVAS_CATEGORIES = new Set(["letter-canvas", "sentence-canvas"]);

export default function CreateRoom() {
  const { lang } = useLang();
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(() => getSession().name || "");
  const [sessionName, setSessionName] = useState("");
  const [facilitatorOnly, setFacilitatorOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [contentLanguage, setContentLanguage] = useState<"ro" | "en">("ro");
  const [mystery, setMystery] = useState(false);
  const [upload, setUpload] = useState<{ url: string; file: string; width: number; height: number } | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.fetchCatalog().then(setCatalog).catch(() => setError(lang === "ro" ? "Biblioteca nu a putut fi încărcată." : "Could not load the activity library.")); }, [lang]);
  const isCoaching = category === "coaching";
  const isCanvas = CANVAS_CATEGORIES.has(category);
  const selectedPuzzle = catalog?.puzzles.find((p) => p.id === puzzleId) || null;
  const selectedActivity = catalog?.coaching.activities.find((a) => a.id === puzzleId) || null;
  const difficultyList = isCanvas ? (catalog?.canvasModes || []) : (catalog?.difficulties || []);
  const selectedDifficulty = (difficultyList as { id: string; name: string; pieces: number }[]).find((d) => d.id === difficulty) || null;
  const puzzles = useMemo(() => (catalog?.puzzles || []).filter((p) => p.category === category), [catalog, category]);
  const isJigsaw = !isCanvas && !isCoaching && !!category;
  const selectionReady = isCoaching ? !!selectedActivity : !!selectedDifficulty && (!!selectedPuzzle || !!upload);

  async function handleUploadFile(file: File) {
    setUploading(true); setError("");
    try {
      const result = await api.uploadImage(file);
      setUpload(result);
      setUploadName(file.name.replace(/\.[^.]+$/, "").slice(0, 60));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : lang === "ro" ? "Imaginea nu a putut fi încărcată." : "Could not upload the image.");
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    if (!name.trim() || !selectionReady) return;
    setBusy(true); setError("");
    try {
      const chosen = selectedActivity?.id || selectedPuzzle?.id || "custom-upload";
      const response = await api.createRoom(chosen, isCanvas ? difficulty : (selectedDifficulty?.id || "easy"), name.trim(), {
        sessionName: sessionName.trim() || (selectedActivity ? pick(selectedActivity.name, lang) : upload ? uploadName || pick({ ro: "Imagine personalizată", en: "Custom image" }, lang) : selectedPuzzle!.name),
        role: facilitatorOnly ? "spectator" : "host",
        ...(isCanvas ? { contentLanguage } : {}),
        ...(isJigsaw ? {
          mystery,
          customImage: upload ? { url: upload.url, file: upload.file, width: upload.width, height: upload.height, name: uploadName } : undefined,
        } : {}),
      });
      saveSession({ name: name.trim(), pid: response.playerId, roomId: response.room.id });
      navigate(`/room/${response.room.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : lang === "ro" ? "Camera nu a putut fi creată." : "Could not create the room.");
      setBusy(false);
    }
  }

  return (
    <div className="marketing-page">
      <div aria-hidden className="marketing-orb -left-20 top-36 h-52 w-52 bg-cp-pink-300/35" />
      <div aria-hidden className="marketing-orb -right-24 top-12 h-72 w-72 bg-cp-purple-300/35" />
      <div className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <button onClick={() => navigate("/")} aria-label="PuzzleTogether home"><Logo /></button>
          <div className="flex items-center gap-2"><LangToggle /><button onClick={() => navigate("/join")} className="btn-secondary btn-sm"><T value={{ ro: "Intră în cameră", en: "Join a room" }} /></button></div>
        </header>

        <div className="mx-auto mb-8 flex max-w-lg items-center gap-3">
          {[1, 2].map((value) => <div key={value} className="flex flex-1 items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= value ? "bg-brand-600 text-white" : "border border-ink-200 bg-white text-ink-400"}`}>{step > value ? "✓" : value}</span><span className={`text-sm font-semibold ${step === value ? "text-ink-900" : "text-ink-400"}`}>{value === 1 ? (lang === "ro" ? "Alege activitatea" : "Choose activity") : (lang === "ro" ? "Pregătește sesiunea" : "Set up session")}</span>{value === 1 && <span className="h-px flex-1 bg-ink-200" />}</div>)}
        </div>

        {step === 1 ? (
          <div className="space-y-7 animate-fade-up">
            <div>
              <h1 className="font-display text-3xl font-extrabold text-ink-900"><T value={{ ro: "Alege activitatea", en: "Choose activity" }} /></h1>
              <p className="mt-2 text-ink-600"><T value={{ ro: "Apoi creezi lobby-ul.", en: "Then create the lobby." }} /></p>
            </div>
            <section>
              <div className="flex flex-wrap gap-2">
                {catalog?.categories.map((item) => <CategoryButton key={item.id} id={item.id} active={category === item.id} onClick={() => { setCategory(item.id); setPuzzleId(null); setUpload(null); setDifficulty(CANVAS_CATEGORIES.has(item.id) ? "quick" : "medium"); }} lang={lang} />)}
                {catalog?.coaching && <CategoryButton id="coaching" active={category === "coaching"} onClick={() => { setCategory("coaching"); setPuzzleId(null); setDifficulty("medium"); }} lang={lang} coaching />}
              </div>
            </section>

            {isCanvas && (
              <div className="rounded-[24px] border border-cp-purple-300 bg-cp-purple-50 px-4 py-3 text-sm leading-relaxed text-cp-purple-700">
                <b><T value={{ ro: "Foaie liberă.", en: "Free sheet." }} /></b>{" "}
                <T value={{ ro: "Facilitatorul pornește și finalizează.", en: "The facilitator starts and completes it." }} />
              </div>
            )}

            {isJigsaw && <section className="rounded-[24px] border border-brand-100 bg-white p-4"><div className="flex flex-wrap items-center gap-3"><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-3 transition hover:border-brand-500"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFile(file); e.target.value = ""; }} /><span className="text-sm font-semibold text-ink-700">{uploading ? <Spinner /> : "📷 "}{upload ? (lang === "ro" ? "Schimbă imaginea" : "Change image") : lang === "ro" ? "Încarcă imagine" : "Upload image"}</span></label>{upload && <button onClick={() => { setUpload(null); setUploadName(""); }} className="btn-secondary btn-sm">{lang === "ro" ? "Folosește catalogul" : "Use catalog"}</button>}{upload && <label className="ml-auto flex min-w-0 items-center gap-2 text-sm"><span className="shrink-0 font-semibold text-ink-700">{lang === "ro" ? "Nume:" : "Name:"}</span><input className="input w-44" maxLength={60} value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder={lang === "ro" ? "ex. Fotografia echipei" : "e.g. Team photo"} /></label>}</div>{upload && <div className="mt-3 flex items-center gap-3"><img src={upload.url} alt={uploadName || "custom"} className="h-20 w-28 rounded-xl border border-ink-200 object-cover" /><p className="text-xs leading-relaxed text-ink-500"><b className="text-ink-700">{lang === "ro" ? "Confidențialitate:" : "Privacy:"}</b> {lang === "ro" ? "Doar pentru această cameră. Se șterge la expirare." : "Only for this room. Deleted when it expires."}</p></div>}</section>}
            {(isCanvas || (isJigsaw && !upload)) && <section><h2 className="font-display text-lg font-bold text-ink-900">{isCanvas ? <T value={{ ro: "Alege foaia", en: "Choose canvas" }} /> : <T value={{ ro: "Alege imaginea", en: "Choose an image" }} />} <span className="ml-1 text-sm font-medium text-ink-400">({puzzles.length})</span></h2><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{puzzles.map((puzzle) => <PuzzleCard key={puzzle.id} puzzle={puzzle} selected={puzzle.id === puzzleId} onSelect={() => setPuzzleId(puzzle.id)} />)}</div></section>}
            {isCoaching && <section><h2 className="font-display text-lg font-bold text-ink-900"><T value={{ ro: "Exerciții pentru 3–8 participanți", en: "Exercises for 3–8 participants" }} /></h2><div className="mt-3 grid gap-4 sm:grid-cols-2">{catalog?.coaching.activities.map((activity) => <ActivityCard key={activity.id} activity={activity} selected={activity.id === puzzleId} onSelect={() => setPuzzleId(activity.id)} lang={lang} />)}</div></section>}
            {category && !isCoaching && <section><h2 className="font-display text-lg font-bold text-ink-900">{isCanvas ? <T value={{ ro: "Modul foii", en: "Sheet mode" }} /> : <T value={{ ro: "Dificultate", en: "Difficulty" }} />}</h2><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{(isCanvas ? (catalog?.canvasModes || []).map((m) => ({ id: m.id, name: m.name, pieces: m.tiles })) : catalog?.difficulties || []).map((item) => <DifficultyCard key={item.id} difficulty={item as Difficulty} selected={difficulty === item.id} onSelect={() => setDifficulty(item.id)} lang={lang} canvas={isCanvas} />)}</div>{isJigsaw && <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[24px] border border-brand-100 bg-white p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={mystery} onChange={(e) => setMystery(e.target.checked)} /><span><b className="block text-sm text-ink-900">🕵️ {lang === "ro" ? "Mod mister" : "Mystery mode"}</b><span className="mt-1 block text-xs leading-relaxed text-ink-500">{lang === "ro" ? "Referința apare după jumătate din piese." : "Reference appears after half the pieces."}</span></span></label>}</section>}
            {isCanvas && <section><h2 className="font-display text-lg font-bold text-ink-900"><T value={{ ro: "Limba conținutului", en: "Content language" }} /></h2><p className="mt-1 text-sm text-ink-600"><T value={{ ro: "Separată de limba interfeței.", en: "Separate from the interface language." }} /></p><div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm"><button onClick={() => setContentLanguage("ro")} className={`rounded-2xl border p-4 text-left transition ${contentLanguage === "ro" ? "border-brand-600 bg-brand-50 ring-4 ring-brand-600/15" : "border-brand-100 bg-white hover:border-brand-400"}`}><b className={contentLanguage === "ro" ? "text-brand-700" : "text-ink-900"}>RO · Română</b><div className="mt-1 text-xs text-ink-500">A B C … Z Ă Â Î Ș Ț</div></button><button onClick={() => setContentLanguage("en")} className={`rounded-2xl border p-4 text-left transition ${contentLanguage === "en" ? "border-brand-600 bg-brand-50 ring-4 ring-brand-600/15" : "border-brand-100 bg-white hover:border-brand-400"}`}><b className={contentLanguage === "en" ? "text-brand-700" : "text-ink-900"}>EN · English</b><div className="mt-1 text-xs text-ink-500">A B C … Z</div></button></div></section>}

            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl border border-ink-200 bg-white/95 p-4 shadow-pop backdrop-blur"><div className="min-w-0 text-sm text-ink-500">{selectionReady ? <><b className="text-ink-900">{selectedActivity ? pick(selectedActivity.name, lang) : selectedPuzzle?.name}</b>{selectedActivity ? ` · ${selectedActivity.duration}` : isCanvas ? ` · ${selectedDifficulty?.pieces === 0 ? (lang === "ro" ? "nelimitat" : "unlimited") : `${selectedDifficulty?.pieces} ${lang === "ro" ? "cărți" : "tiles"}`}` : ` · ${selectedDifficulty?.pieces} ${lang === "ro" ? "piese" : "pieces"}`}</> : <T value={{ ro: "Selectează o activitate", en: "Select an activity" }} />}</div><button className="btn-primary shrink-0" disabled={!selectionReady} onClick={() => setStep(2)}><T value={{ ro: "Continuă", en: "Continue" }} /> →</button></div>
          </div>
        ) : (
          <div className="card mx-auto max-w-xl p-6 animate-fade-up sm:p-8">
            <button className="text-sm font-semibold text-ink-500 hover:text-ink-900" onClick={() => setStep(1)}>← <T value={{ ro: "Înapoi", en: "Back" }} /></button>
            <h1 className="font-display mt-5 text-2xl font-bold text-ink-900"><T value={{ ro: "Pregătește lobby-ul", en: "Prepare the lobby" }} /></h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-600"><T value={{ ro: "Invitații așteaptă Start. Timpul nu pornește înainte.", en: "Guests wait for Start. Time does not start early." }} /></p>
            <label className="mt-6 block text-sm font-semibold text-ink-700" htmlFor="session-name"><T value={{ ro: "Numele sesiunii", en: "Session name" }} /></label>
            <input id="session-name" className="input mt-2" maxLength={80} value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder={lang === "ro" ? "ex. Retrospectiva Sprint 24" : "e.g. Sprint 24 retrospective"} />
            <label className="mt-5 block text-sm font-semibold text-ink-700" htmlFor="display-name"><T value={{ ro: "Numele tău", en: "Your display name" }} /></label>
            <input id="display-name" className="input mt-2" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ana" autoFocus />
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={facilitatorOnly} onChange={(e) => setFacilitatorOnly(e.target.checked)} /><span><b className="block text-sm text-ink-900"><T value={{ ro: "Facilitez, nu joc", en: "I facilitate, I don't play" }} /></b><span className="mt-1 block text-xs leading-relaxed text-ink-600"><T value={{ ro: "Vezi, dar nu muți piese sau carduri.", en: "Watch, but do not move pieces or cards." }} /></span></span></label>
            {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
            <button className="btn-primary mt-6 w-full" disabled={!name.trim() || busy} onClick={create}>{busy ? <Spinner /> : <><T value={{ ro: "Creează lobby-ul", en: "Create lobby" }} /> →</>}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryButton({ id, active, onClick, lang, coaching = false }: { id: string; active: boolean; onClick: () => void; lang: "ro" | "en"; coaching?: boolean }) {
  return <button onClick={onClick} className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${active ? coaching ? "border-cp-purple-700 bg-cp-purple-700 text-white" : "border-brand-700 bg-brand-700 text-white" : "border-brand-100 bg-white text-ink-700 hover:border-brand-400"}`}><span className="mr-1.5"><CategoryGlyph id={id} fallback={CATEGORY_EMOJI[id]} /></span>{pick(CATEGORY_NAMES[id], lang)}</button>;
}
function PuzzleCard({ puzzle, selected, onSelect }: { puzzle: PuzzleInfo; selected: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${selected ? "border-brand-600 ring-4 ring-brand-600/15" : "border-ink-200 hover:-translate-y-0.5 hover:shadow-card"}`}><div className="aspect-[4/3] overflow-hidden bg-ink-100"><img src={puzzle.image} alt={puzzle.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /></div><div className="p-3"><div className="truncate text-sm font-semibold text-ink-900">{puzzle.name}</div><div className="mt-1 truncate text-[11px] text-ink-400">{puzzle.credit} · {puzzle.license}</div></div></button>;
}
function ActivityCard({ activity, selected, onSelect, lang }: { activity: CoachingActivity; selected: boolean; onSelect: () => void; lang: "ro" | "en" }) {
  return <button onClick={onSelect} className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${selected ? "border-emerald-600 ring-4 ring-emerald-600/15" : "border-ink-200 hover:-translate-y-0.5 hover:shadow-card"}`}><div className="flex"><img src={activity.cover} alt="" className="h-36 w-36 shrink-0 object-cover" /><div className="min-w-0 p-4"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{activity.mode === "ranking" ? "Team ranking" : "Compass"}</span><span className="text-xs text-ink-400">⏱ {activity.duration}</span></div><h3 className="font-display mt-2 font-bold text-ink-900"><T value={activity.name} /></h3><p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-500"><T value={activity.description} /></p><div className="mt-2 text-[11px] font-medium text-ink-400">{activity.mode === "ranking" ? (lang === "ro" ? "Ranking liber · reveal ghidat · debrief" : "Free ranking · guided reveal · debrief") : (lang === "ro" ? "Răspunsuri private · sumar de echipă" : "Private answers · team summary")}</div></div></div></button>;
}
function DifficultyCard({ difficulty, selected, onSelect, lang, canvas = false }: { difficulty: Difficulty; selected: boolean; onSelect: () => void; lang: "ro" | "en"; canvas?: boolean }) {
  const meta = DIFFICULTY_META[difficulty.id];
  return <button onClick={onSelect} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand-600 bg-brand-50 ring-4 ring-brand-600/15" : "border-brand-100 bg-white hover:border-brand-400"}`}><b className={selected ? "text-brand-700" : "text-ink-900"}>{difficulty.name}</b><div className="mt-1 text-xs text-ink-500">{difficulty.pieces === 0 ? (lang === "ro" ? "nelimitat" : "unlimited") : `${difficulty.pieces} ${canvas ? (lang === "ro" ? "cărți" : "tiles") : lang === "ro" ? "piese" : "pieces"}`}</div><div className="mt-2 text-[11px] text-ink-400">⏱ {meta?.minutes} · 👥 {meta?.people}</div></button>;
}
function ErrorBox({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{children}</div>; }
