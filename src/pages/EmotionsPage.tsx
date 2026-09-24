import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { navigate } from "../lib/router";
import { Taxonomy, familyShade, isBlend, pickB, type Blend } from "../emotions/data";
import Wheel from "../emotions/Wheel";
import Compass from "../emotions/Compass";
import EmotionCard from "../emotions/EmotionCard";
import CalmScreen from "../emotions/CalmScreen";
import { FirstRunCoach, useFirstRun } from "../emotions/FirstRun";
import MeteoTab from "../emotions/MeteoTab";
import ExpeditionsTab from "../emotions/ExpeditionsTab";
import FrontierTab from "../emotions/FrontierTab";
import MuseumTab from "../emotions/MuseumTab";
import InhabitantsTab from "../emotions/InhabitantsTab";
import AtlasTab from "../emotions/AtlasTab";

type Tab = "mapa" | "meteo" | "expeditions" | "frontier" | "museum" | "inhabitants" | "atlas";

const TABS: { id: Tab; icon: string; ro: string; en: string }[] = [
  { id: "mapa", icon: "🗺️", ro: "Harta", en: "Map" },
  { id: "meteo", icon: "🌦️", ro: "Meteo", en: "Weather" },
  { id: "expeditions", icon: "🧭", ro: "Expediții", en: "Expeditions" },
  { id: "frontier", icon: "⛰️", ro: "Frontiera", en: "Frontier" },
  { id: "museum", icon: "🏛️", ro: "Muzeul", en: "Museum" },
  { id: "inhabitants", icon: "🎨", ro: "Locuitorii", en: "Inhabitants" },
  { id: "atlas", icon: "📜", ro: "Atlasul", en: "Atlas" },
];

export default function EmotionsPage() {
  const { lang } = useLang();
  const [tab, setTab] = useState<Tab>("mapa");
  const [selected, setSelected] = useState<string | null>(null);
  const [calm, setCalm] = useState(false);

  // First-run coach: 0 = wheel hint, 1 = book hint, 2 = weather invite.
  const firstRun = useFirstRun();
  const [frStep, setFrStep] = useState<0 | 1 | 2>(0);
  const selectEmotion = (id: string) => {
    setSelected(id);
    if (firstRun.active && frStep === 0) setFrStep(1);
  };
  const closeBook = () => {
    setSelected(null);
    if (firstRun.active && frStep === 1) setFrStep(2);
  };
  const frNext = () => {
    if (frStep === 1 && selected) setSelected(null);
    setFrStep((s) => (s === 1 ? 2 : s));
  };
  const frFinish = () => firstRun.finish();

  return (
    <div className="min-h-screen bg-white text-g-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-g-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="flex h-9 w-9 items-center justify-center rounded-full border border-g-line bg-white text-g-sub transition hover:bg-g-soft" aria-label={lang === "ro" ? "Înapoi la PuzzleTogether" : "Back to PuzzleTogether"}>←</button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-extrabold tracking-[.18em] text-g-ink">CARTOGRAF</span>
                <span className="rounded-full border border-g-blue/25 bg-g-blue-tint px-2 py-0.5 text-[10px] font-semibold text-g-blue">
                  {lang === "ro" ? "zona de emoții" : "emotions zone"}
                </span>
              </div>
              <p className="text-[11px] text-g-sub">
                <T value={{ ro: "Simte. Numește. Alege.", en: "Feel it. Name it. Choose." }} />
              </p>
            </div>
          </div>
          <button
            onClick={() => setCalm(true)}
            className="flex items-center gap-2 rounded-full border border-g-blue/25 bg-g-blue-tint px-4 py-2 text-sm font-semibold text-g-blue transition hover:bg-brand-100"
          >
            🌙 <T value={{ ro: "Calm", en: "Calm" }} />
          </button>
        </div>
        {/* Tabs — scroll-snap + right-edge fade signal that more sections exist */}
        <nav
          className="mx-auto flex max-w-6xl snap-x snap-proximity gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [mask-image:linear-gradient(90deg,black_94%,transparent)]"
          aria-label={lang === "ro" ? "Secțiuni" : "Sections"}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                tab === t.id ? "bg-g-blue-tint text-g-blue-dark" : "text-g-sub hover:bg-g-soft hover:text-g-ink"
              }`}
            >
              <span aria-hidden="true">{t.icon}</span>
              <T value={{ ro: t.ro, en: t.en }} />
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-20">
        {tab === "mapa" && <MapTab selectedId={selected} onSelect={selectEmotion} />}
        {tab === "meteo" && <MeteoTab />}
        {tab === "expeditions" && <ExpeditionsTab />}
        {tab === "frontier" && <FrontierTab />}
        {tab === "museum" && <MuseumTab />}
        {tab === "inhabitants" && <InhabitantsTab />}
        {tab === "atlas" && <AtlasTab />}
      </main>

      {/* Non-therapy statement */}
      <footer className="border-t border-g-line px-4 py-6 text-center text-xs leading-relaxed text-g-sub">
        <T value={{
          ro: "CARTOGRAF e un instrument de reflecție, nu un test psihologic. Nu diagnostichează, nu tratează și nu înlocuiește psihoterapia. Pentru frici intense sau suferință persistentă, lucrul cu un psiholog/psihoterapeut e calea. Datele tale rămân în browserul tău.",
          en: "CARTOGRAF is a reflection instrument, not a psychological test. It does not diagnose, treat, or replace psychotherapy. For intense fears or persistent suffering, working with a psychologist/psychotherapist is the way. Your data stays in your browser.",
        }} />
      </footer>

      {selected && <EmotionCard emotionId={selected} onClose={closeBook} onNavigate={selectEmotion} />}
      <CalmScreen open={calm} onClose={() => setCalm(false)} />
      {firstRun.active && tab === "mapa" && !calm && (
        <FirstRunCoach
          step={frStep}
          bookOpen={!!selected}
          onSkip={frFinish}
          onNext={frNext}
          onGoMeteo={() => {
            frFinish();
            setTab("meteo");
          }}
        />
      )}
    </div>
  );
}

function MapTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { lang } = useLang();
  return (
    <div className="space-y-8">
      <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <div className="animate-fade-up">
          <Wheel onSelect={onSelect} selectedId={selectedId} />
          <p className="mt-3 text-center text-xs text-g-sub">
            <T value={{ ro: "8 teritorii (Plutchik) × 3 niveluri de intensitate · amestecurile stau la graniță", en: "8 territories (Plutchik) × 3 intensity levels · blends live at the borders" }} />
          </p>
        </div>
        <div className="animate-fade-up rounded-[28px] border border-g-line bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)]" style={{ animationDelay: ".1s" }}>
          <h2 className="font-display text-lg font-bold text-g-ink">
            <T value={{ ro: "Busola lumii tale", en: "Your world's compass" }} />
          </h2>
          <p className="mb-3 mt-1 text-xs text-g-sub">
            <T value={{ ro: "unde stă fiecare emoție: valență (negativ ↔ pozitiv) × intensitate (calm ↔ tulbure)", en: "where each emotion sits: valence (negative ↔ positive) × arousal (calm ↔ turbulent)" }} />
          </p>
          <Compass selectedId={selectedId} />
        </div>
      </div>

      {/* Family legend */}
      <section className="animate-fade-up" style={{ animationDelay: ".15s" }}>
        <h2 className="font-display text-lg font-bold text-g-ink">
          <T value={{ ro: "Cele 8 teritorii", en: "The 8 territories" }} />
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Taxonomy.meta.families.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-g-line bg-white p-3 shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: familyShade(f.color, 2), boxShadow: `0 4px 14px -4px ${f.color}55` }}>
                {f.icon}
              </span>
              <div>
                <p className="text-sm font-bold text-g-ink"><T value={f.name} /></p>
                <p className="text-[11px] text-g-sub">{f.rings[lang].join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Blends */}
      <section className="animate-fade-up" style={{ animationDelay: ".2s" }}>
        <h2 className="font-display text-lg font-bold text-g-ink">
          <T value={{ ro: "Amestecurile — emoțiile mixte", en: "The blends — mixed emotions" }} />
        </h2>
        <p className="mt-1 text-sm text-g-sub">
          <T value={{ ro: "Viața rar stă pe o singură emoție. Când doi vecini de pe roată stau alături, apare un al treilea cer.", en: "Life rarely sits on a single emotion. When two neighbours on the wheel stand together, a third sky appears." }} />
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Taxonomy.blends.map((b: Blend) => {
            return (
              <button key={b.id} onClick={() => onSelect(b.id)} className="group rounded-2xl border border-g-line bg-white p-4 text-left shadow-[0_1px_2px_rgba(60,64,67,0.06)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_4px_12px_rgba(60,64,67,0.12)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-g-ink group-hover:text-g-blue">
                    <T value={b.name} />
                  </p>
                  <span className="text-lg">{isBlend(b) ? `${familyIconOf(b.blendOf[0])}${familyIconOf(b.blendOf[1])}` : ""}</span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-g-sub">{pickB(b.def, lang)}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function familyIconOf(emotionId: string): string {
  const e = Taxonomy.emotions.find((x) => x.id === emotionId);
  if (!e) return "✦";
  return Taxonomy.meta.families.find((f) => f.id === e.family)?.icon ?? "✦";
}
