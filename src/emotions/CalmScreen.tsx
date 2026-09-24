import { useEffect, useState } from "react";
import { T, useLang } from "../lib/i18n";

/**
 * The permanent safety surface: reachable in 1 tap from anywhere in the zone.
 * Breathing guide + "you can close anytime" + real resources. No judgment, no scoring.
 */
export default function CalmScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!open) return;
    setPhase("in");
    const t = setInterval(() => setPhase((p) => (p === "in" ? "out" : "in")), 4000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={lang === "ro" ? "Ecran de calm" : "Calm screen"}>
      <div className="relative w-full max-w-lg rounded-[28px] border border-g-line bg-white p-8 text-center shadow-pop">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-g-line bg-g-soft text-lg text-g-sub transition hover:bg-g-soft"
          aria-label={lang === "ro" ? "Închide" : "Close"}
        >
          ✕
        </button>
        <div className="text-3xl">🌙</div>
        <h2 className="font-display mt-2 text-xl font-bold text-g-ink">
          <T value={{ ro: "Calm", en: "Calm" }} />
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-g-sub">
          <T value={{ ro: "Poți închide oricând. Nu există scoruri aici, nu există răspuns greșit.", en: "You can close this anytime. There are no scores here, no wrong answer." }} />
        </p>

        {/* Breathing guide — 4s in / 4s out */}
        <div className="mt-6 flex flex-col items-center">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border border-sky-300/30 bg-g-blue-tint transition-transform duration-[4000ms] ease-in-out"
              style={{ transform: phase === "in" ? "scale(1)" : "scale(0.62)" }}
            />
            <div
              className="absolute inset-4 rounded-full border border-sky-300/20 bg-g-blue-tint transition-transform duration-[4000ms] ease-in-out"
              style={{ transform: phase === "in" ? "scale(0.92)" : "scale(0.5)" }}
            />
            <div className="relative text-sm font-semibold text-g-blue-dark">
              <T value={phase === "in" ? { ro: "inspirați", en: "breathe in" } : { ro: "expirați", en: "breathe out" }} />
            </div>
          </div>
          <p className="mt-3 text-xs text-g-sub">
            <T value={{ ro: "3–5 cicluri. Respirație 4 în, 4 din.", en: "3–5 cycles. 4 in, 4 out." }} />
          </p>
        </div>

        <div className="mt-6 space-y-2 rounded-2xl border border-g-line bg-g-soft p-4 text-left text-sm text-g-sub">
          <p>
            🫶 <T value={{ ro: "Vorbește cu cineva de încredere — un prieten, un membru de familie.", en: "Talk to someone you trust — a friend, a family member." }} />
          </p>
          <p>
            🧑‍⚕️ <T value={{ ro: "Un psiholog / psihoterapeut e un partener, nu un verdict.", en: "A psychologist / psychotherapist is a partner, not a verdict." }} />
          </p>
          <p>
            📞 <T value={{ ro: "Urgență: 112 · TelVerde anti-suicid ARPS: 0800 801 200 (vin–dum, 19:00–07:00 — verifică numărul actual pe antisuicid.ro)", en: "Emergency: 112 · ARPS anti-suicide TelVerde: 0800 801 200 (Fri–Sun, 19:00–07:00 — verify the current number at antisuicid.ro)" }} />
          </p>
        </div>

        <button onClick={onClose} className="btn-primary mt-6 w-full">
          <T value={{ ro: "Înțeles, înapoi", en: "Understood, back" }} />
        </button>
      </div>
    </div>
  );
}
