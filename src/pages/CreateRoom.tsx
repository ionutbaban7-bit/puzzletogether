import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { LangToggle, useLang } from "../lib/i18n";
import { Logo } from "../components/ui";
import { PhotoPicker } from "../components/PhotoPicker";
import type { CatalogData } from "../types";
export default function CreateRoom() {
  const { lang } = useLang();
  const ro = lang === "ro";
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [name, setName] = useState(getSession().name || "");
  const [puzzle, setPuzzle] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [observer, setObserver] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  useEffect(() => {
    api
      .fetchCatalog()
      .then((c) => {
        setCatalog(c);
        setPuzzle((current) => current || c.puzzles[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  async function create() {
    if (!name.trim() || !puzzle || busy) return;
    setBusy(true);
    setError("");
    try {
      const customImage = puzzle === "custom-upload" && photo ? await api.uploadImage(photo) : undefined;
      const result = await api.createRoom(puzzle, difficulty, name.trim(), {
        role: observer ? "spectator" : "host",
        sessionName: catalog?.puzzles.find((p) => p.id === puzzle)?.name,
        customImage,
      });
      saveSession({
        name: name.trim(),
        pid: result.playerId,
        roomId: result.room.id,
        credential: result.credential,
      });
      navigate(`/room/${result.room.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="marketing-page min-h-dvh px-4 pb-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between py-6">
          <button onClick={() => navigate("/")} aria-label="PuzzleTogether">
            <Logo />
          </button>
          <LangToggle />
        </header>
        <h1 className="font-display text-3xl font-bold">
          {ro ? "Creează un puzzle" : "Create a puzzle"}
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <fieldset className="mt-6" disabled={busy}>
            <legend className="mb-3 font-semibold">
              {ro ? "1. Imaginea" : "1. Picture"}
            </legend>
            <PhotoPicker file={photo} selected={puzzle === "custom-upload"} onChange={setPhoto} onSelect={() => setPuzzle("custom-upload")} onError={setError} disabled={busy} />
            <details open={puzzle !== "custom-upload"}>
              <summary className="mb-3 cursor-pointer text-sm font-semibold">{ro ? "Sau din bibliotecă" : "Or from the library"}</summary>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {catalog?.puzzles.map((p) => (
                <label
                  key={p.id}
                  className={`cursor-pointer rounded-xl border-2 p-2 ${puzzle === p.id ? "border-brand-600 bg-brand-50" : "border-transparent bg-white"}`}
                >
                  <input
                    className="mr-2"
                    type="radio"
                    name="picture"
                    value={p.id}
                    checked={puzzle === p.id}
                    onChange={() => setPuzzle(p.id)}
                  />
                  <span className="text-xs font-semibold">{p.name}</span>
                  <img
                    src={p.thumbnail || p.image}
                    alt=""
                    loading="lazy"
                    className="mt-2 aspect-[4/3] w-full rounded-lg object-cover"
                  />
                </label>
              ))}
            </div>
            </details>
          </fieldset>
          <fieldset className="mt-6" disabled={busy}>
            <legend className="mb-3 font-semibold">
              {ro ? "2. Numărul de piese" : "2. Piece count"}
            </legend>
            <div className="flex flex-wrap gap-3">
              {catalog?.difficulties
                .filter((d) => advanced || d.pieces <= 100)
                .map((d) => (
                  <label
                    key={d.id}
                    className="rounded-xl border border-ink-200 bg-white p-3"
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      checked={difficulty === d.id}
                      onChange={() => setDifficulty(d.id)}
                    />{" "}
                    {d.pieces} {ro ? "piese" : "pieces"}
                  </label>
                ))}
            </div>
            <label className="mt-3 block text-sm">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) => {
                  setAdvanced(e.target.checked);
                  if (
                    !e.target.checked &&
                    ["expert", "master"].includes(difficulty)
                  )
                    setDifficulty("easy");
                }}
              />{" "}
              {ro ? "Arată nivelurile avansate" : "Show advanced levels"}
            </label>
          </fieldset>
          <label className="mt-6 block font-semibold" htmlFor="creator-name">
            {ro ? "3. Numele tău" : "3. Your name"}
          </label>
          <input
            id="creator-name"
            className="input mt-2 max-w-sm"
            required
            maxLength={24}
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="mt-4 block text-sm">
            <input
              type="checkbox"
              checked={observer}
              onChange={(e) => setObserver(e.target.checked)}
            />{" "}
            {ro ? "Doar observ" : "Observe only"}
          </label>
          {error && (
            <p role="alert" className="mt-4 text-red-700">
              {error}
            </p>
          )}
          <button
            className="btn-primary mt-6"
            disabled={busy || !catalog || !name.trim()}
          >
            {busy ? "…" : ro ? "Creează și invită" : "Create and invite"}
          </button>
        </form>
      </div>
    </main>
  );
}
