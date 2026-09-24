import { useEffect, useRef, useState } from "react";
import { actionCalendar, datedActions, downloadText } from "../lib/workshopTools";
import { pick, useLang } from "../lib/i18n";
import { store, useStore } from "../store";
import type { CoachingActivity, PlayerView, RoomView, WorkshopInsights } from "../types";

const FIELDS = [
  ["observed", "Ce am observat", "What we observed"],
  ["learned", "Ce am învățat", "What we learned"],
  ["tryNext", "Ce încercăm", "What we'll try"],
] as const;

function SessionPostcard({ room, activity, players }: { room: RoomView; activity?: CoachingActivity; players: PlayerView[] }) {
  const { lang } = useLang();
  const ro = lang === "ro";
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const title = activity ? pick(activity.name, lang) : room.sessionName;
  const summary = [
    `PuzzleTogether — ${room.sessionName}`,
    `${title} · ${new Date(room.createdAt).toLocaleDateString(ro ? "ro-RO" : "en-GB")}`,
    ...FIELDS.filter(([key]) => room.insights[key]).map(([key, r, e]) => `\n${ro ? r : e}\n${room.insights[key]}`),
    ...room.debriefNotes.flatMap((note, i) => note ? [`\n${activity?.debrief?.[i] ? pick(activity.debrief[i], lang) : `Debrief ${i + 1}`}\n${note}`] : []),
    `\n${ro ? "Acțiuni" : "Actions"}`,
    ...(room.actions.length ? room.actions.map(a => `${a.done ? "[x]" : "[ ]"} ${a.text || (ro ? "De completat" : "To complete")} — ${players.find(p => p.id === a.ownerId)?.name || (ro ? "Responsabil neales" : "Owner unassigned")}${a.due ? ` · ${a.due}` : ""}`) : [ro ? "Nu sunt încă acțiuni stabilite." : "No actions agreed yet."]),
  ].join("\n");
  async function copy() {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setCopyFailed(false); }
    catch { setCopyFailed(true); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([summary], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "puzzletogether-rezumat-sesiune.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => setCopied(false), [summary]);
  return <section className="mt-7 rounded-xl border border-brand-200 bg-brand-50 p-5 text-g-ink sm:p-6" aria-label={ro ? "Rezumatul sesiunii" : "Session summary"}>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="studio-kicker">PuzzleTogether</p><h2 className="font-display mt-2 text-2xl">{ro ? "Ce luăm cu noi" : "What we take away"}</h2><p className="mt-1 text-sm text-g-sub">{ro ? "Concluziile salvate și acțiunile echipei, într-un singur loc." : "Saved reflections and team actions, in one place."}</p></div><div className="flex flex-wrap gap-2"><button onClick={copy} className="btn-primary btn-sm">{copied ? (ro ? "Copiat ✓" : "Copied ✓") : ro ? "Copiază rezumatul" : "Copy summary"}</button><button onClick={download} className="btn-secondary btn-sm">{ro ? "Descarcă .txt" : "Download .txt"}</button><button className="btn-secondary btn-sm" disabled={!datedActions(room).length} title={ro ? "Adaugă text și o dată acțiunilor pentru a le exporta." : "Add action text and a date to export."} onClick={() => downloadText(actionCalendar(room, players, lang), "puzzletogether-actiuni.ics", "text/calendar;charset=utf-8")}>{ro ? "Acțiuni în calendar" : "Actions to calendar"}</button></div></div>
    {copyFailed && <p role="status" className="mt-3 text-sm text-g-red">{ro ? "Copierea nu este disponibilă. Deschide textul de mai jos sau descarcă rezumatul." : "Clipboard unavailable. Open the text below or download the summary."}</p>}
    <p className="mt-3 text-xs text-g-sub">{ro ? "Calendarul include doar acțiunile cu text și dată. Tu alegi unde imporți fișierul; nu trimite invitații." : "The calendar includes dated, named actions. Choose where to import the file; it does not send invitations."}</p><details className="mt-4" open={copyFailed || undefined}><summary className="cursor-pointer text-sm font-semibold text-brand-600">{ro ? "Vezi textul rezumatului" : "View summary text"}</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-g-sub">{summary}</pre></details>
  </section>;
}

/** Keep an unsaved draft when another participant edits this field. */
export function SharedText({ value, label, maxLength, disabled, save, kind = "text" }: { kind?: "text" | "date"; value: string; label: string; maxLength: number; disabled: boolean; save: (value: string, previous: string) => void }) {
  const { lang } = useLang();
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const base = useRef(value);
  useEffect(() => {
    if (!dirty || value === draft) { setDraft(value); base.current = value; setDirty(false); }
  }, [value, dirty, draft]);
  const conflict = dirty && value !== base.current && value !== draft;
  const submit = () => { if (dirty && !disabled && !conflict) save(draft, base.current); };
  return <div>
    {kind === "date" ? <input type="date" aria-label={label} disabled={disabled} className="mt-1 block w-full rounded-lg border border-white/15 bg-ink-800 p-2 text-sm text-white [color-scheme:dark]" value={draft} onInput={e => { if (!dirty) base.current = value; setDraft(e.currentTarget.value); setDirty(true); }} onChange={e => { if (!dirty) base.current = value; setDraft(e.target.value); setDirty(true); }} onBlur={submit} /> : <textarea aria-label={label} disabled={disabled} maxLength={maxLength} className="mt-3 min-h-24 w-full resize-y rounded-lg border border-white/15 bg-ink-900/70 p-3 text-sm leading-relaxed text-white outline-none focus:border-brand-300 disabled:opacity-60" value={draft} onChange={e => { if (!dirty) base.current = value; setDraft(e.target.value); setDirty(true); }} onBlur={submit} />}
    {conflict && <div className="mt-2 text-xs leading-relaxed text-brand-200"><p>{lang === "ro" ? "Un coleg a schimbat acest câmp. Varianta echipei:" : "A teammate changed this field. Team version:"} {value || "—"}</p><div className="mt-2 flex flex-wrap gap-3"><button className="underline" onClick={() => { base.current = value; save(draft, value); }}>{lang === "ro" ? "Salvează textul meu" : "Save my text"}</button><button className="underline" onClick={() => { setDraft(value); setDirty(false); }}>{lang === "ro" ? "Păstrează varianta echipei" : "Keep team version"}</button></div></div>}
    {dirty && !conflict && <p className="text-xs text-ink-300">{lang === "ro" ? "Text local; se salvează când ieși din câmp." : "Local draft; saves when you leave the field."}</p>}
  </div>;
}

export default function HarvestBoard({ room, activity, players }: { room: RoomView; activity?: CoachingActivity; players: PlayerView[] }) {
  const { lang } = useLang(); const ro = lang === "ro";
  const you = useStore(s => s.you); const connected = useStore(s => s.connected);
  const participant = players.find(p => p.id === you);
  const canEdit = connected && !!participant && (participant.role !== "spectator" || room.hostId === you) && ["debrief", "harvest"].includes(room.stage);
  return <div className="h-full overflow-y-auto bg-ink-950 px-4 pb-28 pt-24 text-white sm:px-8 sm:pt-28"><div className="mx-auto max-w-6xl">
    <p className="text-xs uppercase tracking-[.16em] text-brand-300">{room.stage === "debrief" ? "Debrief" : ro ? "Pașii următori" : "Next steps"}</p><h1 className="font-display mt-2 text-3xl sm:text-4xl">{ro ? "Din joc în practică" : "From play to practice"}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-200">{ro ? "Notați ce ați observat și alegeți 1–3 lucruri pe care vreți să le încercați. Păstrați rezumatul înainte să plecați." : "Note what you observed and choose 1–3 things to try. Save the summary before you leave."}</p>
    {!canEdit && <p role="status" className="mt-3 text-sm text-brand-200">{connected ? (ro ? "Poți citi notițele. Participanții și facilitatorul le pot modifica." : "You can read the notes. Participants and the facilitator can edit them.") : (ro ? "Reconectare… Textul local rămâne aici; așteaptă conexiunea înainte să salvezi." : "Reconnecting… Your local text stays here; wait for the connection before saving.")}</p>}
    {activity?.debrief?.length ? <section className="mt-8"><h2 className="font-display text-2xl">{ro ? "Conversația echipei" : "Team conversation"}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{activity.debrief.map((prompt,i) => <div key={i} className="rounded-xl border border-white/15 p-5"><p className="text-sm text-ink-100">{i + 1}. {pick(prompt,lang)}</p><SharedText label={pick(prompt,lang)} value={room.debriefNotes[i] || ""} maxLength={2000} disabled={!canEdit} save={(value,previous) => store.saveDebriefField(i,value,previous)} /></div>)}</div></section> : null}
    <section className="mt-8 grid gap-4 lg:grid-cols-3">{FIELDS.map(([key,r,e]) => <div key={key} className="rounded-xl border border-white/15 p-5"><h2 className="font-display text-2xl">{ro ? r : e}</h2><SharedText label={ro ? r : e} value={room.insights[key as keyof WorkshopInsights]} maxLength={4000} disabled={!canEdit} save={(value,previous) => store.saveInsight(key,value,previous)} /></div>)}</section>
    <section className="mt-8 rounded-xl border border-white/15 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-display text-2xl">{ro ? "Ce facem, cine și până când" : "What, who and by when"}</h2><button className="btn-dark btn-sm" disabled={!canEdit || room.actions.length >= 20} onClick={() => store.addAction()}>{ro ? "+ Adaugă o acțiune" : "+ Add an action"}</button></div><div className="mt-4 space-y-4">{room.actions.length === 0 && <p className="py-4 text-sm text-ink-300">{ro ? "Începeți cu un pas mic, concret și ales de echipă." : "Start with one small, concrete step chosen by the team."}</p>}{room.actions.map((a,i) => <div key={a.id} className="rounded-lg border border-white/10 bg-white/[.03] p-4">
      <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={a.done} onChange={e => store.saveActionField(a.id,"done",e.target.checked,a.done)} />{ro ? `Acțiunea ${i+1}` : `Action ${i+1}`}</label><button aria-label={ro ? `Șterge acțiunea ${i+1}` : `Remove action ${i+1}`} disabled={!canEdit} className="rounded px-2 py-1 text-sm text-ink-200 hover:bg-white/10" onClick={() => store.removeAction(a)}>×</button></div>
      <SharedText label={ro ? `Ce facem — acțiunea ${i+1}` : `What we will do — action ${i+1}`} value={a.text} maxLength={500} disabled={!canEdit} save={(value,previous) => store.saveActionField(a.id,"text",value,previous)} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-ink-200">{ro ? "Responsabil" : "Owner"}<select className="mt-1 block w-full rounded-lg border border-white/15 bg-ink-800 p-2 text-sm text-white" disabled={!canEdit} value={a.ownerId} onChange={e => store.saveActionField(a.id,"ownerId",e.target.value,a.ownerId)}><option value="">{ro ? "Alegeți împreună" : "Choose together"}</option>{a.ownerId && !players.some(p => p.id === a.ownerId) && <option value={a.ownerId}>{ro ? "Participant deconectat" : "Disconnected participant"}</option>}{players.filter(p => p.role !== "spectator").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-xs text-ink-200">{ro ? "Până când" : "Due date"}<SharedText kind="date" label={ro ? `Până când — acțiunea ${i+1}` : `Due date — action ${i+1}`} value={a.due} maxLength={10} disabled={!canEdit} save={(value, previous) => store.saveActionField(a.id,"due",value,previous)} /></label></div>
    </div>)}</div></section>
    <SessionPostcard room={room} activity={activity} players={players} />
  </div></div>;
}
