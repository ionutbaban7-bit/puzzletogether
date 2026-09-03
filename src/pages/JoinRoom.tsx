import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { extractRoomRef } from "../lib/format";
import { joinQueryCode, navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { LangToggle, pick, T, useLang } from "../lib/i18n";
import { Logo, Spinner } from "../components/ui";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function JoinRoom() {
  const { lang } = useLang();
  const [ref, setRef] = useState(() => joinQueryCode() || "");
  const [name, setName] = useState(() => getSession().name || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ sessionName: string; puzzle: string; count: number; stage: string } | null>(null);
  const parsedRef = extractRoomRef(ref);
  const needsCode = !!parsedRef && UUID_RE.test(parsedRef);

  useEffect(() => {
    if (!parsedRef) { setPreview(null); return; }
    const timer = setTimeout(() => api.getRoom(parsedRef).then((data) => setPreview({ sessionName: data.room.sessionName, puzzle: typeof data.puzzle.name === "string" ? data.puzzle.name : "Team activity", count: data.playerCount, stage: data.room.stage })).catch(() => setPreview(null)), 250);
    return () => clearTimeout(timer);
  }, [parsedRef]);

  async function join() {
    const roomRef = extractRoomRef(ref);
    if (!roomRef) return setError(pick({ ro: "Introdu un cod sau un link de cameră.", en: "Enter a room code or room link." }, lang));
    if (!name.trim()) return setError(pick({ ro: "Introdu numele tău.", en: "Enter your display name." }, lang));
    if (needsCode && !code.trim()) return setError(pick({ ro: "Linkul necesită și codul primit de la facilitator.", en: "Room links also require the access code shared by the facilitator." }, lang));
    setBusy(true); setError("");
    try {
      const existing = getSession();
      const result = await api.joinRoom(roomRef, name.trim(), existing.roomId === parsedRef ? existing.pid : undefined, code.trim() || undefined);
      saveSession({ name: name.trim(), pid: result.playerId, roomId: result.room.id });
      navigate(`/room/${result.room.id}`);
    } catch (reason) {
      const typed = reason as Error & { code?: string };
      const messages: Record<string, { ro: string; en: string }> = {
        room_missing: { ro: "Camera nu a fost găsită sau a expirat.", en: "The room was not found or has expired." },
        bad_code: { ro: "Codul de acces este greșit.", en: "That access code is incorrect." },
        code_required: { ro: "Cere codul de acces facilitatorului.", en: "Ask the facilitator for the access code." },
        room_full: { ro: "Camera este plină.", en: "This room is full." },
        duplicate_name: { ro: "Acest nume este deja folosit în cameră. Alege altul.", en: "That name is already in the room. Choose another one." },
      };
      setError(typed.code && messages[typed.code] ? pick(messages[typed.code], lang) : typed.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between"><button onClick={() => navigate("/")}><Logo size={38} /></button><LangToggle /></div>
        <div className="card p-6 animate-fade-up sm:p-8">
          <h1 className="font-display text-2xl font-bold text-ink-900"><T value={{ ro: "Intră într-o sesiune", en: "Join a session" }} /></h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500"><T value={{ ro: "Introdu linkul sau codul proiectat de facilitator. Nu ai nevoie de cont.", en: "Enter the link or code shown by the facilitator. No account required." }} /></p>
          <label className="mt-6 block text-sm font-semibold text-ink-700" htmlFor="roomref"><T value={{ ro: "Link sau cod", en: "Room link or code" }} /></label>
          <input id="roomref" className="input mt-2 font-mono tracking-wide" placeholder="K7F2MX — or paste a link" value={ref} autoFocus onChange={(event) => setRef(event.target.value)} onKeyDown={(event) => event.key === "Enter" && join()} />

          {preview && <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50 p-4"><div className="font-display font-bold text-ink-900">{preview.sessionName}</div><div className="mt-1 text-xs text-ink-500">🧩 {preview.puzzle} · 👥 {preview.count} · {preview.stage === "lobby" ? (lang === "ro" ? "așteaptă startul" : "waiting to start") : (lang === "ro" ? "în desfășurare" : "in progress")}</div></div>}

          {needsCode && <><label className="mt-4 block text-sm font-semibold text-ink-700" htmlFor="joincode"><T value={{ ro: "Cod de acces", en: "Access code" }} /></label><input id="joincode" className="input mt-2 font-mono uppercase tracking-[0.25em]" placeholder="K7F2MX" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && join()} /><div className="mt-1.5 text-xs text-ink-400"><T value={{ ro: "Codul nu este inclus în link, pentru siguranță.", en: "For safety, the access code is not embedded in the link." }} /></div></>}

          <label className="mt-4 block text-sm font-semibold text-ink-700" htmlFor="joinname"><T value={{ ro: "Numele tău", en: "Display name" }} /></label>
          <input id="joinname" className="input mt-2" placeholder="e.g. Maria" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && join()} />
          {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
          <button className="btn-primary mt-6 min-h-11 w-full" disabled={busy} onClick={join}>{busy ? <Spinner /> : <T value={{ ro: "Intră în lobby", en: "Join lobby" }} />}</button>
          <div className="mt-4 text-center text-xs text-ink-400"><T value={{ ro: "Fără cont · maximum 20 conexiuni", en: "No sign-up · up to 20 connections" }} /></div>
        </div>
        <div className="mt-6 text-center"><button onClick={() => navigate("/create")} className="text-sm font-semibold text-brand-600"><T value={{ ro: "Sau creează o sesiune →", en: "Or create a session →" }} /></button></div>
      </div>
    </div>
  );
}
