import { useEffect, useState } from "react";
import { pick, T, useLang } from "../lib/i18n";
import { store } from "../store";
import type { ActionItem, CoachingActivity, PlayerView, RoomView, WorkshopInsights } from "../types";

export default function HarvestBoard({ room, activity, players }: { room: RoomView; activity?: CoachingActivity; players: PlayerView[] }) {
  const { lang } = useLang();
  const [insights, setInsights] = useState<WorkshopInsights>(room.insights);
  const [debrief, setDebrief] = useState<string[]>(room.debriefNotes);
  const [actions, setActions] = useState<ActionItem[]>(room.actions);
  useEffect(() => setInsights(room.insights), [room.insights]);
  useEffect(() => setDebrief(room.debriefNotes), [room.debriefNotes]);
  useEffect(() => setActions(room.actions), [room.actions]);
  const prompts = activity?.debrief || [];

  const updateInsight = (key: keyof WorkshopInsights, value: string) => setInsights((current) => ({ ...current, [key]: value }));
  const saveInsight = () => store.saveInsights(insights);
  const updateAction = (id: string, patch: Partial<ActionItem>) => setActions((current) => current.map((action) => action.id === id ? { ...action, ...patch } : action));
  const saveActions = (next = actions) => store.saveActions(next);

  return (
    <div className="h-full overflow-y-auto bg-ink-950 px-4 pb-28 pt-24 text-white sm:px-8 sm:pt-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-[.24em] text-emerald-300">{room.stage === "debrief" ? "Debrief" : "Harvest"}</div><h1 className="font-display mt-1 text-2xl font-extrabold sm:text-3xl"><T value={{ ro: "Din joc în decizii", en: "Turn play into decisions" }} /></h1><p className="mt-2 max-w-2xl text-sm text-ink-300"><T value={{ ro: "Capturați ce ați observat, ce ați învățat și ce veți încerca. Conținutul rămâne în sesiune și intră în export.", en: "Capture what you observed, learned and will try next. Everything stays with the session and appears in the export." }} /></p></div><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink-300">{room.sessionName}</span></div>

        {prompts.length > 0 && <section className="mt-7 rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><h2 className="font-display font-bold"><T value={{ ro: "Întrebări de debrief", en: "Debrief prompts" }} /></h2><div className="mt-4 grid gap-3 md:grid-cols-2">{prompts.map((prompt, index) => <label key={index} className="block rounded-2xl border border-white/10 bg-ink-900/70 p-4"><span className="text-xs font-semibold leading-relaxed text-ink-200">{index + 1}. {pick(prompt, lang)}</span><textarea className="mt-3 min-h-20 w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-brand-400" value={debrief[index] || ""} onChange={(event) => setDebrief((current) => { const next = [...current]; next[index] = event.target.value; return next; })} onBlur={() => store.saveDebrief(debrief)} placeholder={lang === "ro" ? "Scribe-ul captează ideea echipei…" : "The scribe captures the team's thought…"} /></label>)}</div></section>}

        <section className="mt-7"><h2 className="font-display font-bold"><T value={{ ro: "Trei artefacte ale echipei", en: "Three team artefacts" }} /></h2><div className="mt-3 grid gap-4 lg:grid-cols-3"><InsightCard icon="👀" title={{ ro: "Ce am observat", en: "What we observed" }} value={insights.observed} onChange={(value) => updateInsight("observed", value)} onBlur={saveInsight} /><InsightCard icon="💡" title={{ ro: "Ce am învățat", en: "What we learned" }} value={insights.learned} onChange={(value) => updateInsight("learned", value)} onBlur={saveInsight} /><InsightCard icon="🧪" title={{ ro: "Ce încercăm", en: "What we'll try" }} value={insights.tryNext} onChange={(value) => updateInsight("tryNext", value)} onBlur={saveInsight} /></div></section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display font-bold"><T value={{ ro: "Acțiuni cu owner", en: "Owned action items" }} /></h2><p className="mt-1 text-xs text-ink-400"><T value={{ ro: "O decizie fără owner rămâne doar o intenție.", en: "A decision without an owner is only an intention." }} /></p></div><button className="btn-primary btn-sm" onClick={() => { const next = [...actions, { id: crypto.randomUUID(), text: "", ownerId: "", due: "", done: false }]; setActions(next); saveActions(next); }}>+ <T value={{ ro: "Acțiune", en: "Action" }} /></button></div><div className="mt-4 space-y-2">{actions.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-ink-500"><T value={{ ro: "Adăugați până la 3 acțiuni concrete înainte de închidere.", en: "Add up to 3 concrete actions before closing." }} /></div> : actions.map((action) => <div key={action.id} className="grid gap-2 rounded-2xl border border-white/10 bg-ink-900/60 p-3 sm:grid-cols-[auto_1fr_170px_150px_auto]"><input aria-label="Done" type="checkbox" className="mt-3 h-4 w-4 accent-emerald-500" checked={action.done} onChange={(event) => { const next = actions.map((item) => item.id === action.id ? { ...item, done: event.target.checked } : item); setActions(next); saveActions(next); }} /><input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" value={action.text} onChange={(event) => updateAction(action.id, { text: event.target.value })} onBlur={() => saveActions()} placeholder={lang === "ro" ? "Ce facem concret?" : "What exactly will we do?"} /><select className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white" value={action.ownerId} onChange={(event) => { const next = actions.map((item) => item.id === action.id ? { ...item, ownerId: event.target.value } : item); setActions(next); saveActions(next); }}><option value="">{lang === "ro" ? "Fără owner" : "Unassigned"}</option>{players.filter((player) => player.role !== "spectator").map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><input type="date" className="rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white" value={action.due} onChange={(event) => { const next = actions.map((item) => item.id === action.id ? { ...item, due: event.target.value } : item); setActions(next); saveActions(next); }} /><button className="rounded-xl px-3 text-rose-300 hover:bg-rose-500/10" onClick={() => { const next = actions.filter((item) => item.id !== action.id); setActions(next); saveActions(next); }}>✕</button></div>)}</div></section>
      </div>
    </div>
  );
}

function InsightCard({ icon, title, value, onChange, onBlur }: { icon: string; title: { ro: string; en: string }; value: string; onChange: (value: string) => void; onBlur: () => void }) {
  return <label className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.025] p-5"><span className="text-2xl">{icon}</span><span className="font-display ml-2 font-bold"><T value={title} /></span><textarea className="mt-4 min-h-40 w-full resize-y rounded-2xl border border-white/10 bg-ink-900/70 p-4 text-sm leading-relaxed text-white outline-none focus:border-brand-400" value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} /></label>;
}
