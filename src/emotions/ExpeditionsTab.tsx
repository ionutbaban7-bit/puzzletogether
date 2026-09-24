import { useMemo, useState } from "react";
import { T, useLang } from "../lib/i18n";
import { Archetypes, Situations, pickB, type Situation } from "./data";
import { expeditions, logExpedition, type ExpeditionEntry } from "./store";
import { Card, EmotionPicker, IntensitySlider, LineInput, Title, emotionChips, formatDate } from "./tabShared";

/**
 * Expediții — solo situations. Pick a real situation from your life,
 * name what you feel in it, read the debrief questions. Everything stays local.
 */
export default function ExpeditionsTab() {
  const { lang } = useLang();
  const groups = useMemo(() => {
    const map = new Map<string, Situation[]>();
    for (const s of Situations.solo) {
      const list = map.get(s.category) || [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()];
  }, []);

  const [active, setActive] = useState<Situation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(5);
  const [archetype, setArchetype] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [log, setLog] = useState<ExpeditionEntry[]>(expeditions());
  const [done, setDone] = useState(false);

  function pick(s: Situation) {
    setActive(s); setSelected([]); setIntensity(5); setArchetype(null); setNote(""); setDone(false);
  }
  function submit(passed = false) {
    if (!active) return;
    if (!passed && !selected.length) return;
    setLog(logExpedition({
      situationId: active.id, situationText: active.text, heavy: active.heavy,
      emotions: selected, intensity, archetype, note: note.trim(), at: Date.now(),
    }));
    setDone(true);
  }

  return (
    <div className="space-y-6">
      <Title
        ro="Expediții"
        en="Expeditions"
        sub={{
          ro: "Alege o situație din viața ta reală, numește ce simți în ea, apoi citește întrebările de debrief. Situațiile sunt exemple — înlocuiește-le cu ale tale.",
          en: "Pick a real situation from your life, name what you feel in it, then read the debrief questions. The situations are examples — swap them for your own.",
        }}
      />

      {!active ? (
        <div className="space-y-5">
          {groups.map(([category, list], gi) => (
            <Card key={category} delay={gi * 0.05}>
              <h2 className="font-display text-base font-bold text-g-ink">{pickCategoryLabel(category, lang)}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {list.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className="rounded-2xl border border-g-line bg-g-soft p-3.5 text-left transition hover:border-g-blue/50 hover:bg-g-blue-tint"
                  >
                    <p className="text-sm font-semibold leading-snug text-g-ink">
                      {s.heavy && <span title={lang === "ro" ? "poate activa" : "may activate"}>⚠️ </span>}
                      <T value={s.text} />
                    </p>
                    {s.debriefPrompts && <p className="mt-1 text-[11px] text-g-faint">{lang === "ro" ? `${s.debriefPrompts.length} întrebări de debrief` : `${s.debriefPrompts.length} debrief questions`}</p>}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.2em] text-g-sub">{pickCategoryLabel(active.category, lang)}</p>
                <h2 className="font-display mt-1 text-xl font-bold leading-snug text-g-ink"><T value={active.text} /></h2>
                {active.heavy && <p className="mt-2 text-xs text-[#b06000]"><T value={{ ro: "Această situație poate activa. Poți închide oricând — «Pas» e o mișcare legală.", en: "This situation may activate. You can close it at any time — “Pass” is a legal move." }} /></p>}
              </div>
              <button type="button" onClick={() => setActive(null)} className="rounded-full border border-g-line bg-g-soft px-3 py-1.5 text-xs font-semibold text-g-sub hover:bg-g-soft">←</button>
            </div>

            {!done ? (
              <>
                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold text-g-sub"><T value={{ ro: "Ce simți în această situație? (1–3)", en: "What do you feel in this situation? (1–3)" }} /></p>
                  <EmotionPicker value={selected} onChange={setSelected} />
                </div>
                <div className="mt-5"><IntensitySlider value={intensity} onChange={setIntensity} /></div>
                <div className="mt-4">
                  <p className="text-xs font-bold text-g-sub"><T value={{ ro: "Ce parte din tine vorbește? (opțional)", en: "Which part of you is speaking? (optional)" }} /></p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Archetypes.archetypes.map((a) => (
                      <button key={a.id} type="button" onClick={() => setArchetype((cur) => (cur === a.id ? null : a.id))}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${archetype === a.id ? "border-g-blue bg-g-soft text-g-ink" : "border-g-line bg-g-soft text-g-sub hover:bg-g-soft"}`}>
                        {a.icon} <T value={a.name} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-bold text-g-sub"><T value={{ ro: "Context (opțional, doar pentru tine)", en: "Context (optional, only for you)" }} /></p>
                  <div className="mt-1.5"><LineInput value={note} onChange={setNote} maxLength={140} placeholder={lang === "ro" ? "ex. la școală, la ședința de luni…" : "e.g. at school, Monday's standup…"} /></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => submit(false)} disabled={!selected.length}><T value={{ ro: "Salvează expediția", en: "Save the expedition" }} /></button>
                  <button className="btn btn-dark" onClick={() => submit(true)}><T value={{ ro: "Pas", en: "Pass" }} /></button>
                </div>
              </>
            ) : (
              <div className="mt-5">
                <p className="text-sm font-bold text-g-green">✓ <T value={{ ro: "expediția e salvată (doar în browserul tău)", en: "expedition saved (only in your browser)" }} /></p>
                {active.debriefPrompts && active.debriefPrompts.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-g-blue/25 bg-g-blue-tint p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[.2em] text-g-blue"><T value={{ ro: "Întrebări pentru tine", en: "Questions for you" }} /></p>
                    <ul className="mt-2 space-y-1.5">
                      {active.debriefPrompts.map((q, i) => <li key={i} className="text-sm leading-relaxed text-g-ink">• <T value={q} /></li>)}
                    </ul>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button className="btn btn-dark btn-sm" onClick={() => setDone(false)}><T value={{ ro: "Reia", en: "Redo" }} /></button>
                  <button className="btn-primary btn-sm" onClick={() => setActive(null)}><T value={{ ro: "Altă expediție", en: "Another expedition" }} /></button>
                </div>
              </div>
            )}
          </Card>

          {log.length > 0 && (
            <Card delay={0.1}>
              <h2 className="font-display text-base font-bold text-g-ink"><T value={{ ro: "Jurnalul expedițiilor", en: "The expedition log" }} /></h2>
              <div className="mt-3 space-y-1.5">
                {log.slice(0, 10).map((e) => (
                  <div key={e.at} className="flex items-center gap-3 rounded-xl bg-g-soft px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-g-sub"><T value={e.situationText} /></span>
                    <span className="hidden sm:block">{e.emotions.length ? emotionChips(e.emotions) : <span className="text-[11px] text-g-faint">Pas</span>}</span>
                    <span className="text-[10px] text-g-faint">{formatDate(e.at, lang).split(",")[0]}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function pickCategoryLabel(category: string, lang: "ro" | "en"): string {
  const labels: Record<string, { ro: string; en: string }> = {
    body: { ro: "Corp & sănătate", en: "Body & health" },
    conflict: { ro: "Conflicte", en: "Conflicts" },
    evaluation: { ro: "Evaluare & performanță", en: "Evaluation & performance" },
    future: { ro: "Viitorul & necunoscutul", en: "The future & the unknown" },
    job: { ro: "Muncă", en: "Work" },
    money: { ro: "Bani", en: "Money" },
    relations: { ro: "Relații", en: "Relationships" },
    social: { ro: "Viață socială", en: "Social life" },
  };
  const l = labels[category];
  return l ? l[lang] : category;
}
