import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { Archetypes, familyOf, familyShade } from "./data";
import { logMeteo, meteoHistory, type MeteoEntry } from "./store";
import { Card, EmotionLabel, EmotionPicker, IntensitySlider, Title, emotionChips, formatDate } from "./tabShared";

/**
 * Meteo — the daily weather check-in. Pick the sky inside (1–3 emotions),
 * its intensity, optionally who is speaking. Logged locally, no analysis.
 */
export default function MeteoTab() {
  const { lang } = useLang();
  const [history, setHistory] = useState<MeteoEntry[]>(meteoHistory());
  const [selected, setSelected] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(5);
  const [archetype, setArchetype] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState(false);

  function log() {
    if (!selected.length) return;
    setHistory(logMeteo({ emotions: selected, intensity, archetype, at: Date.now() }));
    setSelected([]); setIntensity(5); setArchetype(null); setJustLogged(true);
    setTimeout(() => setJustLogged(false), 2500);
  }

  const last = history[0];

  return (
    <div className="space-y-6">
      <Title
        ro="Meteo"
        en="Weather"
        sub={{ ro: "Verificarea de meteo a teritoriului tău. O dată pe zi sau de câte ori vrei — fără comentarii, doar o hartă a cerului de azi.", en: "The weather check-in for your territory. Once a day or as often as you like — no commentary, just a map of today's sky." }}
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card>
          <h2 className="font-display text-lg font-bold text-white">
            <T value={{ ro: "Ce cer e în tine acum?", en: "What sky is in you right now?" }} />
          </h2>
          <p className="mt-1 text-xs text-ink-400"><T value={{ ro: "1–3 emoții · nu există răspuns corect", en: "1–3 emotions · there is no right answer" }} /></p>
          <div className="mt-4">
            <EmotionPicker value={selected} onChange={setSelected} />
          </div>
          <div className="mt-5">
            <IntensitySlider value={intensity} onChange={setIntensity} />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-ink-300"><T value={{ ro: "Cine vorbește în tine? (opțional)", en: "Who is speaking in you? (optional)" }} /></p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Archetypes.archetypes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setArchetype((cur) => (cur === a.id ? null : a.id))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${archetype === a.id ? "border-white/70 bg-white/10 text-white" : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10"}`}
                >
                  {a.icon} <T value={a.name} />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary" onClick={log} disabled={!selected.length}>
              <T value={{ ro: "Înregistrează meteo", en: "Log the weather" }} />
            </button>
            {justLogged && <span className="text-xs text-emerald-300">✓ <T value={{ ro: "notat. meteoul se schimbă tot timpul — asta e normal.", en: "logged. weather is always changing — that is normal." }} /></span>}
          </div>
        </Card>

        <Card delay={0.1}>
          <h2 className="font-display text-lg font-bold text-white">
            <T value={{ ro: "Ultima verificare", en: "Last check-in" }} />
          </h2>
          {last ? (
            <div className="mt-3">
              <div className="text-3xl" aria-hidden="true">
                {last.emotions.map((id) => familyOf(id)?.icon).filter(Boolean).join("") || "🌫️"}
              </div>
              <div className="mt-2">{emotionChips(last.emotions)}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${last.intensity * 10}%` }} />
                </div>
                <span className="text-xs font-bold text-ink-200">{last.intensity}/10</span>
              </div>
              {last.archetype && (
                <p className="mt-2 text-xs text-ink-300">
                  {Archetypes.archetypes.find((a) => a.id === last.archetype)?.icon}{" "}
                  <T value={Archetypes.archetypes.find((a) => a.id === last.archetype)?.name || { ro: "", en: "" }} />
                </p>
              )}
              <p className="mt-3 text-[11px] text-ink-500">{formatDate(last.at, lang)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-500">
              <T value={{ ro: "Nicio verificare încă. Prima contează — e punctul zero al hărții.", en: "No check-in yet. The first one counts — it is the zero point of the map." }} />
            </p>
          )}

          {history.length > 1 && (
            <>
              <h3 className="mt-6 text-[11px] font-bold uppercase tracking-[.2em] text-ink-400">
                <T value={{ ro: "Ultimele verificări", en: "Recent check-ins" }} />
              </h3>
              <div className="mt-2 space-y-1.5">
                {history.slice(1, 9).map((m, i) => (
                  <div key={m.at + i} className="flex items-center gap-2 rounded-xl bg-white/[.03] px-3 py-2">
                    <span className="text-sm" aria-hidden="true">{m.emotions.map((id) => familyOf(id)?.icon).filter(Boolean).join("") || "🌫️"}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-200">{m.emotions.map((id) => <EmotionLabel key={id} id={id} />).join(", ")}</span>
                    <span className="text-[11px] font-bold text-ink-400">{m.intensity}/10</span>
                    <span className="text-[10px] text-ink-500">{formatDate(m.at, lang).split(",")[0]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1" aria-hidden="true">
                {history.slice(0, 20).map((m, i) => (
                  <span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full"
                    title={formatDate(m.at, lang)}
                    style={{ background: m.emotions.length ? familyShade(familyOf(m.emotions[0])?.color || "#3d465e", Math.max(1, Math.min(3, Math.round(m.intensity / 10 * 2 + 1))) as 1 | 2 | 3) : "#2a3145", opacity: 0.35 + (i / 20) * 0.65 }}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-500">
        <T value={{ ro: "Notarea meteului nu e un diagnostic. E ca o hărta meteo: descrie cerul, nu te descrie pe tine.", en: "Logging the weather is not a diagnosis. It is like a weather map: it describes the sky, not you." }} />
      </p>
    </div>
  );
}
