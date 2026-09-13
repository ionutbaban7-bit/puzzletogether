import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { EmotionLabel, IntensitySlider, LineInput, Title, Card } from "./tabShared";
import { addPrediction, predictions, removePrediction, resolvePrediction, type Prediction } from "./store";
import { EmotionPicker } from "./tabShared";

/**
 * Frontiera — the prediction tracker.
 * Name what you expect, then check what actually happened. A violated
 * prediction is new information for the brain (inhibitory learning),
 * not a failure — that is the whole point of the frontier.
 */
export default function FrontierTab() {
  const { lang } = useLang();
  const [list, setList] = useState<Prediction[]>(predictions());
  const [situation, setSituation] = useState("");
  const [expect, setExpect] = useState("");
  const [expectEmotions, setExpectEmotions] = useState<string[]>([]);
  const [expectIntensity, setExpectIntensity] = useState(5);
  const [resolving, setResolving] = useState<Prediction | null>(null);
  const [actual, setActual] = useState("");

  function add() {
    if (!situation.trim() || !expect.trim()) return;
    setList(addPrediction({
      situation: situation.trim(),
      expect: expect.trim(),
      expectEmotion: expectEmotions[0] || null,
      expectIntensity,
      resolved: null,
      actual: "",
    }));
    setSituation(""); setExpect(""); setExpectEmotions([]); setExpectIntensity(5);
  }
  function resolve(outcome: "confirmed" | "partial" | "violated") {
    if (!resolving) return;
    setList(resolvePrediction(resolving.situation, outcome, actual.trim()));
    setResolving(null); setActual("");
  }

  const open = list.filter((p) => p.resolved === null);
  const resolved = list.filter((p) => p.resolved !== null);
  const violated = resolved.filter((p) => p.resolved === "violated").length;

  return (
    <div className="space-y-6">
      <Title
        ro="Frontiera"
        en="The Frontier"
        sub={{
          ro: "Frica trăiește din predicții. Aici le pui pe hârtie: ce crezi că se va întâmpla, apoi verifici ce s-a întâmplat de fapt. O predicție nerealizată nu e eșec — e informație nouă pentru creier (aprenare inhibitorie).",
          en: "Fear lives on predictions. Here you put them on paper: what you expect to happen, then check what actually happened. A violated prediction is not a failure — it is new information for the brain (inhibitory learning).",
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card>
          <h2 className="font-display text-lg font-bold text-white"><T value={{ ro: "O predicție nouă", en: "A new prediction" }} /></h2>
          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-1 text-xs font-bold text-ink-300"><T value={{ ro: "Situația (de pe frontiera ta)", en: "The situation (on your frontier)" }} /></p>
              <LineInput value={situation} onChange={setSituation} maxLength={120} placeholder={lang === "ro" ? "ex. telefonul de la angajator" : "e.g. the call from the employer"} />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-ink-300"><T value={{ ro: "Ce aș putea simți (opțional, 1)", en: "What might I feel (optional, 1)" }} /></p>
              <EmotionPicker value={expectEmotions} onChange={(ids) => setExpectEmotions(ids.slice(0, 1))} max={1} />
              <div className="mt-3"><IntensitySlider value={expectIntensity} onChange={setExpectIntensity} /></div>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-ink-300"><T value={{ ro: "Ce prevăd că se va întâmpla?", en: "What do I predict will happen?" }} /></p>
              <LineInput value={expect} onChange={setExpect} maxLength={200} placeholder={lang === "ro" ? "ex. o să refuze cererea, toți o să râdă…" : "e.g. the request will be refused, everyone will laugh…"} />
            </div>
            <button className="btn-primary" onClick={add} disabled={!situation.trim() || !expect.trim()}>
              <T value={{ ro: "Pune predicția pe hartă", en: "Put the prediction on the map" }} />
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card delay={0.08}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white"><T value={{ ro: "Frontieră deschisă", en: "Open frontier" }} /></h2>
              <span className="text-xs text-ink-400">{open.length}</span>
            </div>
            {open.length === 0 && <p className="mt-2 text-sm text-ink-500"><T value={{ ro: "Nicio predicție așteptând verificare.", en: "No predictions waiting to be checked." }} /></p>}
            <div className="mt-2 space-y-2">
              {open.map((p) => (
                <div key={p.situation} className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
                  <p className="text-sm font-bold text-white">{p.situation}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-300">
                    {lang === "ro" ? "Prevăd:" : "I predict:"} <span className="text-ink-100">„{p.expect}"</span>
                    {p.expectEmotion && <span className="ml-1 text-ink-400">(<EmotionLabel id={p.expectEmotion} /> ~{p.expectIntensity}/10)</span>}
                  </p>
                  {resolving === p ? (
                    <div className="mt-3 space-y-2">
                      <LineInput value={actual} onChange={setActual} maxLength={200} autoFocus placeholder={lang === "ro" ? "Ce s-a întâmplat de fapt?" : "What actually happened?"} />
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-dark btn-sm" onClick={() => resolve("confirmed")}><T value={{ ro: "Exact cum prevădusem", en: "Exactly as predicted" }} /></button>
                        <button className="btn btn-dark btn-sm" onClick={() => resolve("partial")}><T value={{ ro: "Parțial", en: "Partly" }} /></button>
                        <button className="btn-primary btn-sm" onClick={() => resolve("violated")}><T value={{ ro: "N-a fost așa — altceva", en: "Not like that — something else" }} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button className="btn btn-dark btn-sm" onClick={() => { setResolving(p); setActual(""); }}><T value={{ ro: "A fost momentul — verifică", en: "The moment came — check" }} /></button>
                      <button className="btn btn-sm border border-white/10 bg-transparent text-ink-500 hover:text-rose-300" onClick={() => setList(removePrediction(p.situation))}>✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {resolved.length > 0 && (
            <Card delay={0.14}>
              <h2 className="font-display text-lg font-bold text-white"><T value={{ ro: "Teritoriu cucerit", en: "Territory crossed" }} /></h2>
              <p className="mt-1 text-xs text-ink-400">
                <T value={{ ro: `${violated} ${violated === 1 ? "predicție nerealizată = o informație nouă asimilată" : "predicții nerealizate = informații noi asimilate"}`, en: `${violated} violated ${violated === 1 ? "prediction = one new piece of learning" : "predictions = new pieces of learning"}` }} />
              </p>
              <div className="mt-2 space-y-1.5">
                {resolved.slice(0, 8).map((p, i) => (
                  <div key={p.situation + i} className="rounded-xl bg-white/[.03] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{p.resolved === "confirmed" ? "🔁" : p.resolved === "partial" ? "◐" : "🌪️"}</span>
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-100">{p.situation}</p>
                      <span className="text-[10px] text-ink-500">{p.resolved}</span>
                    </div>
                    {p.actual && <p className="mt-1 text-[11px] italic leading-relaxed text-ink-400">„{p.actual}"</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-500">
        <T value={{ ro: "Mechanica se bazează pe aprenarea inhibitorie (Craske et al., 2014): expunerea funcționează prin noutatea informației, nu prin obișnuință. E un exercițiu de reflecție, nu tratament.", en: "The mechanic is based on inhibitory learning (Craske et al., 2014): exposure works through new information, not habituation. It is a reflection exercise, not treatment." }} />
      </p>
    </div>
  );
}
