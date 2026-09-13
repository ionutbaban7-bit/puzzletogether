import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { Taxonomy, familyOf, familyShade } from "./data";
import { clearAll, expeditions, meteoHistory, museumLines, namedCount, predictions } from "./store";
import { Card, Title } from "./tabShared";

/**
 * Atlasul — the map so far. A local summary of everything you have named,
 * honest about what the data does and does not say, plus export & reset.
 */
export default function AtlasTab() {
  const { lang } = useLang();
  const [version, setVersion] = useState(0);
  const meteo = meteoHistory();
  const exped = expeditions();
  const frontier = predictions();
  const lines = museumLines();
  const stats = namedCount();

  const resolved = frontier.filter((p) => p.resolved !== null);
  const violated = resolved.filter((p) => p.resolved === "violated").length;

  const families = Taxonomy.meta.families
    .map((f) => ({ f, count: stats.byFamily[f.id] || 0 }))
    .sort((a, b) => b.count - a.count);
  const maxFamily = Math.max(1, ...families.map((x) => x.count));

  function exportJson() {
    const payload = {
      tool: "CARTOGRAF",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: lang === "ro"
        ? "Date de reflecție personale, salvate doar în browserul tău. Nu sunt date clinice."
        : "Personal reflection data, saved only in your browser. Not clinical data.",
      meteo: meteoHistory(),
      expeditions: expeditions(),
      frontier: predictions(),
      museum: museumLines(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cartograf-atlas.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    if (confirm(lang === "ro" ? "Ștergi tot atlasul local? Acțiunea nu se poate anula." : "Delete the whole local atlas? This cannot be undone.")) {
      clearAll();
      setVersion((v) => v + 1);
    }
  }

  return (
    <div className="space-y-6" key={version}>
      <Title
        ro="Atlasul"
        en="The Atlas"
        sub={{ ro: "Harta până acum. Numără emoțiile numite, cerurile notate și frontierele cucerite — și spune exact ce pot și ce nu pot face aceste numere.", en: "The map so far. It counts the emotions named, the skies logged, and the frontiers crossed — and says exactly what those numbers can and cannot do." }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="🏷️" label={lang === "ro" ? "emoții numite" : "emotions named"} value={String(stats.total)} sub={`${lang === "ro" ? "din" : "of"} ${Taxonomy.emotions.length + Taxonomy.blends.length}`} />
        <Stat icon="🌦️" label={lang === "ro" ? "verificări meteo" : "weather check-ins"} value={String(meteo.length)} />
        <Stat icon="🧭" label={lang === "ro" ? "expediții" : "expeditions"} value={String(exped.length)} />
        <Stat icon="⛰️" label={lang === "ro" ? "predicții verificate" : "predictions checked"} value={`${resolved.length}`} sub={resolved.length ? `${violated}/${resolved.length} ${lang === "ro" ? "nerealizate (= învățat)" : "violated (= learned)"}` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold text-g-ink"><T value={{ ro: "Teritoriile vizitate", en: "Territories visited" }} /></h2>
          <p className="mt-1 text-xs text-g-sub">
            <T value={{ ro: "În ce familii de emoții ai numit cel puțin o dată ceva.", en: "In which emotion families you have named something at least once." }} />
          </p>
          <div className="mt-4 space-y-2">
            {families.map(({ f, count }) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="w-6 text-center" aria-hidden="true">{f.icon}</span>
                <span className="w-28 shrink-0 truncate text-xs font-semibold text-g-sub"><T value={f.name} /></span>
                <div className="h-4 flex-1 overflow-hidden rounded-md bg-g-soft">
                  <div className="h-full rounded-md transition-all duration-700" style={{ width: `${(count / maxFamily) * 100}%`, background: familyShade(f.color, 2) }} />
                </div>
                <span className="w-5 text-right text-xs font-bold text-g-ink">{count}</span>
              </div>
            ))}
          </div>
          {stats.total === 0 && <p className="mt-3 text-sm text-g-faint"><T value={{ ro: "Atlasul e gol. Numește prima emoție din Hartă sau Meteo.", en: "The atlas is empty. Name your first emotion in Map or Weather." }} /></p>}
        </Card>

        <Card delay={0.08}>
          <h2 className="font-display text-lg font-bold text-g-ink"><T value={{ ro: "Ce pot și ce nu pot aceste numere", en: "What these numbers can and cannot do" }} /></h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-g-sub">
            <li>✅ <T value={{ ro: "arată ce ai ales să numești — o hartă a atenției tale", en: "show what you chose to name — a map of your attention" }} /></li>
            <li>✅ <T value={{ ro: "arată frontierele unde predicția ta s-a nerealizat (informație nouă)", en: "show frontiers where your prediction was violated (new information)" }} /></li>
            <li>⛔ <T value={{ ro: "nu sunt diagnostic, tip de personalitate sau prognostic", en: "are not a diagnosis, personality type, or prognosis" }} /></li>
            <li>⛔ <T value={{ ro: "nu înlocuiesc conversația cu un psiholog/psihoterapeut", en: "do not replace the conversation with a psychologist/psychotherapist" }} /></li>
          </ul>
          <p className="mt-4 rounded-xl border border-g-line bg-g-soft p-3 text-xs leading-relaxed text-g-sub">
            <T value={{ ro: "Ce spune cercetarea, onest: numirea emoțiilor reduce modest activarea (Lieberman et al., 2007); expunerea funcționează prin învățare nouă, nu prin obișnuință (Craske et al., 2014); hărțile corporale ale emoțiilor sunt reale dar medii de grup, nu predicții personale (Nummenmaa et al., 2014).", en: "What research says, honestly: labeling emotions modestly reduces activation (Lieberman et al., 2007); exposure works through new learning, not habituation (Craske et al., 2014); bodily maps of emotions are real but group averages, not personal predictions (Nummenmaa et al., 2014)." }} />
          </p>
        </Card>
      </div>

      <Card delay={0.14}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-g-ink"><T value={{ ro: "Datele tale", en: "Your data" }} /></h2>
            <p className="mt-1 text-xs text-g-sub">
              <T value={{ ro: `Totul stă în browserul tău (localStorage), niciodată pe un server. ${lines.length} ${lines.length === 1 ? "rând" : "rânduri"} la Muzeu, ${meteo.length} verificări la Meteo.`, en: `Everything lives in your browser (localStorage), never on a server. ${lines.length} ${lines.length === 1 ? "line" : "lines"} in the Museum, ${meteo.length} weather check-ins.` }} />
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-dark btn-sm" onClick={exportJson}>⬇ <T value={{ ro: "Export JSON", en: "Export JSON" }} /></button>
            <button className="btn btn-sm border border-g-red/35 bg-g-red-tint text-g-red hover:bg-g-red-tint" onClick={reset}>🗑 <T value={{ ro: "Șterge atlasul", en: "Delete atlas" }} /></button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="animate-fade-up rounded-[24px] border border-g-line bg-white p-5">
      <p className="text-2xl" aria-hidden="true">{icon}</p>
      <p className="font-display mt-2 text-3xl font-extrabold text-g-ink">{value}</p>
      <p className="text-xs font-semibold text-g-sub">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-g-faint">{sub}</p>}
    </div>
  );
}
