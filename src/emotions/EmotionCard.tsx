import { useEffect } from "react";
import { T, useLang } from "../lib/i18n";
import { Taxonomy, emotionByIdOf, familyOf, isBlend, pickB, type Emotion, type Blend } from "./data";

/**
 * The Emotion Book — 12 sections, research-anchored, ends with the fixed
 * "map, not territory" line. Opens from the wheel or from blend cards.
 */
export default function EmotionCard({ emotionId, onClose, onNavigate }: {
  emotionId: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const { lang } = useLang();
  const item = emotionByIdOf(emotionId);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  if (!item) return null;
  const blend = isBlend(item) ? item as Blend : null;
  const emotion = blend ? null : (item as Emotion);
  const family = familyOf(emotionId);


  const levelLabel = lang === "ro" ? ["nuanță", "emoție de bază", "extrem"] : ["nuance", "base emotion", "extreme"];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-ink-950/70 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-label={pickB(item.name, lang)}>
      <div
        className="h-full w-full max-w-[560px] overflow-y-auto border-l border-white/10 bg-ink-900 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/8 bg-ink-900/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">{family?.icon}</div>
              <div>
                <h2 className="font-display text-xl font-extrabold leading-tight text-white">{pickB(item.name, lang)}</h2>
                <p className="mt-0.5 text-xs text-ink-400">
                  {blend
                    ? (lang === "ro" ? "amestec de emoții" : "emotion blend")
                    : (lang === "ro" ? `${pickB(family?.name, lang) ?? ""} · nivel ${emotion!.level} — ${levelLabel[emotion!.level - 1]}` : `${pickB(family?.name, lang) ?? ""} · level ${emotion!.level} — ${levelLabel[emotion!.level - 1]}`)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-ink-200 transition hover:bg-white/10" aria-label={lang === "ro" ? "Închide cartea" : "Close the book"}>✕</button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5 pb-24">
          {/* Definition */}
          <section>
            <p className="rounded-2xl border border-white/8 bg-white/[.03] p-4 text-[15px] leading-relaxed text-white">
              {pickB(item.def, lang)}
            </p>
          </section>

          {blend ? (
            <>
              <Section icon="🧩" title={lang === "ro" ? "Ce se amestecă" : "What mixes"}>
                <div className="flex flex-wrap gap-2">
                  {blend.blendOf.map((emotionId) => {
                    const b = emotionByIdOf(emotionId);
                    if (!b) return null;
                    return (
                      <button key={emotionId} onClick={() => onNavigate(emotionId)} className="chip chip-hover flex items-center gap-1.5">
                        <span>{familyOf(emotionId)?.icon}</span> {pickB(b.name, lang)}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section icon="🕰️" title={lang === "ro" ? "Când stau alături" : "When they stand together"}>{pickB(blend.when, lang)}</Section>
              <Section icon="💡" title={lang === "ro" ? "Exemplu" : "Example"}>{pickB(blend.example, lang)}</Section>
            </>
          ) : (
            <EmotionSections emotion={item as Emotion} lang={lang} onNavigate={onNavigate} />
          )}

          {/* Research */}
          <Section icon="🔬" title={lang === "ro" ? "Cercetarea din spate" : "The research behind it"}>
            <ul className="space-y-1.5">
              {emotion?.research.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-300">
                  <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${r.status === "verified" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
                    {r.status === "verified" ? (lang === "ro" ? "verificat" : "verified") : (lang === "ro" ? "de verificat" : "to verify")}
                  </span>
                  <span>{r.title} ({r.year}) — {r.source}</span>
                </li>
              ))}
              {blend && <li className="text-xs text-ink-400">{lang === "ro" ? "amestecurile urmează structura roții lui Plutchik (1980/2001)" : "blends follow Plutchik's wheel structure (1980/2001)"}</li>}
            </ul>
            {emotion && <p className="mt-2 text-xs leading-relaxed text-ink-400">{pickB(emotion.caveat, lang)}</p>}
          </Section>

          <p className="pt-2 text-center text-xs italic text-ink-500">
            {lang === "ro" ? "Aceasta e o hartă a teritoriului, nu teritoriul însuși." : "This is a map of the territory, not the territory itself."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/8 pt-4">
      <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-ink-300">
        <span aria-hidden="true">{icon}</span> {title}
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-ink-100">{children}</div>
    </section>
  );
}

function EmotionSections({ emotion, lang, onNavigate }: { emotion: Emotion; lang: "ro" | "en"; onNavigate: (id: string) => void }) {
  return (
    <>
              {/* Intensity spectrum */}
              <Section icon="〰️" title={lang === "ro" ? "Spectrul intensității (8 trepte)" : "Intensity spectrum (8 steps)"}>
                <div className="mt-1 flex gap-1">
                  {emotion.spectrum.map((step, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div
                        className={`h-2 rounded-full ${i === emotion.spectrumIndex ? "bg-white" : i < emotion.spectrumIndex ? "bg-white/50" : "bg-white/15"}`}
                        title={pickB(step, lang)}
                      />
                      <p className={`mt-1 truncate text-[9px] leading-tight ${i === emotion.spectrumIndex ? "font-bold text-white" : "text-ink-400"}`}>
                        {pickB(step, lang)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-400">{lang === "ro" ? "de la nuanță la extrem — Plutchik" : "from nuance to extreme — Plutchik"}</p>
              </Section>

              <Section icon="🫀" title={lang === "ro" ? "Cum se anunță în corp?" : "How does it announce itself in the body?"}>
                <p>{pickB(emotion.body, lang)}</p>
                <p className="mt-1.5 text-xs text-ink-400">{lang === "ro" ? "model tipic raportat — corpul tău are dreptul la propria hartă (Nummenmaa 2014)" : "typical reported pattern — your body has the right to its own map (Nummenmaa 2014)"}</p>
              </Section>

              <Section icon="💭" title={lang === "ro" ? "Ce gânduri vin cu ea" : "Thoughts that come with it"}>
                <div className="flex flex-wrap gap-2">
                  {emotion.thoughts[lang].map((t, i) => (
                    <span key={i} className="chip">{t}</span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-400">{lang === "ro" ? "exemple, nu diagnoze" : "examples, not diagnoses"}</p>
              </Section>

              <Section icon="" title={lang === "ro" ? "Ce impuls apare" : "The impulse that appears"}>{pickB(emotion.impulse, lang)}</Section>
              <Section icon="🛠️" title={lang === "ro" ? "Ce încearcă să facă pentru tine" : "What it's trying to do for you"}>{pickB(emotion.function, lang)}</Section>
              <Section icon="🌿" title={lang === "ro" ? "Când e aliată" : "When it's an ally"}>{pickB(emotion.usefulWhen, lang)}</Section>
              <Section icon="⚠️" title={lang === "ro" ? "Când devine prea grea" : "When it gets too heavy"}>{pickB(emotion.heavyWhen, lang)}</Section>

              <Section icon="🫂" title={lang === "ro" ? "Emoții vecine" : "Neighbouring emotions"}>
                <div className="flex flex-wrap gap-2">
                  {emotion.near.map((id) => {
                    const n = emotionByIdOf(id);
                    if (!n) return null;
                    return (
                      <button key={id} onClick={() => onNavigate(id)} className="chip chip-hover flex items-center gap-1.5">
                        <span>{familyOf(id)?.icon}</span> {pickB(n.name, lang)}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section icon="⚖️" title={lang === "ro" ? "Nu e același lucru cu" : "It is not the same as"}>{pickB(emotion.notSameAs, lang)}</Section>

              <Section icon="⚡" title={lang === "ro" ? "Declanșatoare frecvente" : "Frequent triggers"}>
                <div className="flex flex-wrap gap-2">
                  {emotion.triggers[lang].map((t, i) => (
                    <span key={i} className="chip">{t}</span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-400">{lang === "ro" ? "frecvent raportat" : "frequently reported"}</p>
              </Section>

              <Section icon="⏱️" title={lang === "ro" ? "Exercițiu de 60 de secunde" : "A 60-second exercise"}>
                <p className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-sky-100">{pickB(emotion.microExercise, lang)}</p>
              </Section>
    </>
  );
}
