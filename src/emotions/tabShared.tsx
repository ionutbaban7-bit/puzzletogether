import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { Taxonomy, familyOf, familyShade, pickB } from "./data";

export function Card({ children, delay, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`animate-fade-up rounded-[28px] border border-white/8 bg-ink-900/60 p-6 ${className}`} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}

export function Title({ ro, en, sub }: { ro: string; en: string; sub?: { ro: string; en: string } }) {
  const { lang } = useLang();
  return (
    <header className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
        <T value={{ ro, en }} />
      </h1>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400"><T value={sub} /></p>}
    </header>
  );
}

/** Multi-select up to 3 emotions, grouped by the 8 families. */
export function EmotionPicker({ value, onChange, max = 3 }: { value: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const { lang } = useLang();
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (value.length < max) onChange([...value, id]);
  }
  return (
    <div className="space-y-2">
      {Taxonomy.meta.families.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-1.5">
          <span className="w-6 shrink-0 text-center text-base" aria-hidden="true">{f.icon}</span>
          {Taxonomy.emotions.filter((e) => e.family === f.id).map((e) => {
            const on = value.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggle(e.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? "border-white/70 text-white" : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10"}`}
                style={on ? { background: familyShade(f.color, e.level) } : undefined}
              >
                {pickB(e.name, lang)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function IntensitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { lang } = useLang();
  return (
    <div>
      <p className="text-xs font-bold text-ink-300">
        <T value={{ ro: "Intensitate: ", en: "Intensity: " }} /><b className="text-white">{value}/10</b>
      </p>
      <div className="mt-1.5 flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`h-7 flex-1 rounded-md text-[10px] font-bold transition ${i <= value ? "bg-sky-400/70 text-ink-950" : "bg-white/5 text-ink-500 hover:bg-white/10"}`}
            aria-label={`${i}/10`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

export function formatDate(ts: number, lang: "ro" | "en"): string {
  return new Date(ts).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function emotionChips(ids: string[]): React.ReactNode {
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const f = familyOf(id);
        return (
          <span key={id} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-ink-200">
            {f?.icon} <EmotionLabel id={id} />
          </span>
        );
      })}
    </span>
  );
}

export function EmotionLabel({ id }: { id: string }) {
  const { lang } = useLang();
  const e = Taxonomy.emotions.find((x) => x.id === id) || Taxonomy.blends.find((x) => x.id === id);
  return <>{e ? pickB(e.name, lang) : id}</>;
}

/** Small inline use of a controlled text input row. */
export function LineInput({ value, onChange, placeholder, maxLength = 200, autoFocus = false }: { value: string; onChange: (v: string) => void; placeholder: string; maxLength?: number; autoFocus?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      autoFocus={autoFocus}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
      placeholder={placeholder}
    />
  );
}

export function useDraft<T extends Record<string, unknown>>(initial: T): [T, (patch: Partial<T>) => void] {
  const [draft, setDraft] = useState<T>(initial);
  return [draft, (patch) => setDraft((d) => ({ ...d, ...patch }))];
}
