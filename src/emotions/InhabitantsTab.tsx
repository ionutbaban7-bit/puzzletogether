import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { Archetypes, type Archetype } from "./data";
import { inhabitantsLog, logInhabitants, type InhabitantsEntry } from "./store";
import { Card, LineInput, Title, formatDate } from "./tabShared";

/**
 * Locuitorii — the archetypes zone. Eight resident voices that speak in all of us.
 * A metamodel for self-talk, not a personality test: you can be all of them on one day.
 */
export default function InhabitantsTab() {
  const { lang } = useLang();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [log, setLog] = useState<InhabitantsEntry[]>(inhabitantsLog());
  const [done, setDone] = useState(false);

  function toggle(id: string) {
    setDone(false);
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? cur : [...cur, id]));
  }
  function submit() {
    if (!picked.length) return;
    setLog(logInhabitants({ archetypes: picked, note: note.trim(), at: Date.now() }));
    setDone(true); setPicked([]); setNote("");
  }

  return (
    <div className="space-y-6">
      <Title
        ro="Locuitorii"
        en="The Inhabitants"
        sub={{
          ro: "Opt voci rezidente care vorbesc în fiecare dintre noi — de la Gardianul la Observatorul. E un metamodel pentru dialogul interior, nu un test de personalitate: într-o zi poți fi toți la un moment dat.",
          en: "Eight resident voices that speak in everyone — from the Guardian to the Observer. It is a metamodel for inner dialogue, not a personality test: in one day you can be all of them.",
        }}
      />

      <Card>
        <h2 className="font-display text-lg font-bold text-g-ink"><T value={{ ro: "Ce parte din tine vorbește astăzi?", en: "Which part of you is speaking today?" }} /></h2>
        <p className="mt-1 text-xs text-g-sub"><T value={{ ro: "Alege 1–2 voci. Apoi citește ce spune fiecare — și ce s-ar putea să fie prea mult.", en: "Pick 1–2 voices. Then read what each one says — and what it might be saying too much of." }} /></p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Archetypes.archetypes.map((a) => (
            <button key={a.id} type="button" onClick={() => toggle(a.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${picked.includes(a.id) ? "border-g-blue bg-g-soft text-g-ink" : "border-g-line bg-g-soft text-g-sub hover:bg-g-soft"}`}>
              {a.icon} <T value={a.name} />
            </button>
          ))}
        </div>
        <div className="mt-3">
          <p className="text-xs font-bold text-g-sub"><T value={{ ro: "Ce ți-a spus astăzi (opțional, doar pentru tine)", en: "What it told you today (optional, only for you)" }} /></p>
          <div className="mt-1.5"><LineInput value={note} onChange={setNote} maxLength={140} placeholder={lang === "ro" ? "ex. „Dacă nu e perfect, nu conta.”…" : "e.g. “If it's not perfect, it doesn't count.”…"} /></div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={submit} disabled={!picked.length}><T value={{ ro: "Notează cine a vorbit", en: "Log who spoke" }} /></button>
          {done && <span className="text-xs text-g-green">✓ <T value={{ ro: "notat — vocile se rotesc, e normal.", en: "logged — the voices rotate, that is normal." }} /></span>}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {Archetypes.archetypes.map((a, i) => <ArchetypeCard key={a.id} a={a} delay={i * 0.04} />)}
      </div>

      {log.length > 0 && (
        <Card>
          <h2 className="font-display text-base font-bold text-g-ink"><T value={{ ro: "Cine a vorbit în ultimele zile", en: "Who has been speaking recently" }} /></h2>
          <div className="mt-3 space-y-1.5">
            {log.slice(0, 10).map((e) => (
              <div key={e.at} className="flex items-center gap-3 rounded-xl bg-g-soft px-3 py-2">
                <span className="text-base" aria-hidden="true">{e.archetypes.map((id) => Archetypes.archetypes.find((x) => x.id === id)?.icon).filter(Boolean).join(" ")}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-g-sub">
                  {e.note ? `„${e.note}"` : e.archetypes.map((id) => { const a = Archetypes.archetypes.find((x) => x.id === id); return a ? <T key={id} value={a.name} /> : id; }).join(" + ")}
                </span>
                <span className="text-[10px] text-g-faint">{formatDate(e.at, lang).split(",")[0]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-center text-[11px] leading-relaxed text-g-faint">
        <T value={Archetypes.disclaimer} />
      </p>
    </div>
  );
}

function ArchetypeCard({ a, delay }: { a: Archetype; delay: number }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((v) => !v)} className="animate-fade-up rounded-[24px] border border-g-line bg-white p-5 text-left transition hover:border-brand-300" style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ background: `${a.color}22`, border: `1px solid ${a.color}44` }}>{a.icon}</span>
        <div>
          <p className="font-display text-base font-bold text-g-ink"><T value={a.name} /></p>
          <p className="text-[11px] text-g-sub"><T value={a.system} /></p>
        </div>
        <span className="ml-auto text-g-faint">{open ? "−" : "+"}</span>
      </div>
      <p className="mt-3 text-sm italic leading-relaxed text-g-sub">„<T value={a.claim} />"</p>
      {open && (
        <div className="mt-3 space-y-2.5 border-t border-g-line pt-3 text-xs leading-relaxed">
          <Row label={lang === "ro" ? "Ce face bine" : "What it does well"} value={a.function} />
          <Row label={lang === "ro" ? "E util când" : "Useful when"} value={a.usefulWhen} />
          <Row label={lang === "ro" ? "Devine prea mult când" : "Overreaches when"} value={a.overreachesWhen} />
          <Row label={lang === "ro" ? "De ce are frică" : "What it fears"} value={a.itsFear} />
          <div className="rounded-xl border border-g-blue/25 bg-g-blue-tint p-3">
            <p className="font-bold text-g-blue">{lang === "ro" ? "Ce ai putea să-i spui" : "What you could say to it"}</p>
            <p className="mt-1 text-g-ink">„<T value={a.whatToSay} />"</p>
            <p className="mt-2 text-[11px] italic text-g-sub"><T value={a.reflectionQuestion} /></p>
          </div>
        </div>
      )}
    </button>
  );
}
function Row({ label, value }: { label: string; value: { ro: string; en: string } }) {
  return (
    <p>
      <b className="text-g-sub">{label}: </b>
      <span className="text-g-sub"><T value={value} /></span>
    </p>
  );
}
