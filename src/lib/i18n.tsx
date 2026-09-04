import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "ro" | "en";

export interface Bilingual {
  ro: string;
  en: string;
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

const LANG_KEY = "pt.lang";

function initialLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  let selected: Lang = navigator.language.toLowerCase().startsWith("ro") ? "ro" : "en";
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ro" || saved === "en") selected = saved;
  } catch {
    // Storage can be unavailable in strict private mode.
  }
  document.documentElement.lang = selected;
  return selected;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<Lang>(initialLanguage);
  const setLang = (next: Lang) => {
    setLanguage(next);
    document.documentElement.lang = next;
    try { localStorage.setItem(LANG_KEY, next); } catch { /* private mode */ }
  };
  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Picks the current-language string from a bilingual object (or returns as-is). */
export function pick(b: Bilingual | string, lang: Lang): string {
  if (typeof b === "string") return b;
  return b[lang] || b.en || b.ro;
}

/** Tiny component that renders a bilingual value in the current language. */
export function T({ value, className }: { value: Bilingual | string; className?: string }) {
  const { lang } = useLang();
  return <span className={className}>{pick(value, lang)}</span>;
}

export function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded-full border text-[11px] font-bold ${
        dark ? "border-white/15 bg-white/5 text-white" : "border-ink-200 bg-white text-ink-600"
      }`}
    >
      {(["en", "ro"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 uppercase transition ${
            lang === l
              ? dark
                ? "bg-white/20 text-white"
                : "bg-ink-900 text-white"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
