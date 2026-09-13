import { useState } from "react";
import { T, useLang } from "../lib/i18n";

/**
 * First-run coach for the CARTOGRAF zone: three gentle steps that turn the
 * rich wheel into an onboarding moment. Shown once (localStorage flag),
 * always skippable, never blocking — the wheel stays fully clickable.
 */
const KEY = "pt.cartograf.firstRun";

export function useFirstRun(): { active: boolean; finish: () => void } {
  const [active, setActive] = useState(() => {
    try {
      return !localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });
  const finish = () => {
    setActive(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode etc. — the tour simply won't persist */
    }
  };
  return { active, finish };
}

export function FirstRunCoach({
  step,
  bookOpen,
  onSkip,
  onNext,
  onGoMeteo,
}: {
  step: 0 | 1 | 2;
  bookOpen: boolean;
  onSkip: () => void;
  onNext: () => void;
  onGoMeteo: () => void;
}) {
  const { lang } = useLang();
  const dot = (i: number) => (
    <span key={i} aria-hidden className={`h-1.5 w-1.5 rounded-full ${i <= step ? "bg-g-blue" : "bg-g-line"}`} />
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[75] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-g-line bg-white/95 p-4 shadow-[0_18px_44px_-18px_rgba(30,41,59,0.4)] backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5" aria-hidden>{dot(0)}{dot(1)}{dot(2)}</span>
          <span className="text-[11px] font-bold text-g-faint">
            {lang === "ro" ? "Pasul" : "Step"} {step + 1}/3
          </span>
        </div>
        {step === 0 && (
          <>
            <p className="mt-2 text-sm font-bold text-g-ink">
              <T value={{ ro: "Asta e harta lumii tale.", en: "This is your world's map." }} />
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-g-sub">
              <T value={{ ro: "Atinge orice teritoriu de pe roată ca să deschizi pagina acelei emoții.", en: "Tap any territory on the wheel to open that emotion's page." }} />
            </p>
            <div className="mt-3 flex justify-between">
              <button onClick={onSkip} className="text-[13px] font-semibold text-g-faint transition hover:text-g-ink">
                <T value={{ ro: "Sari turul", en: "Skip tour" }} />
              </button>
              <button onClick={onNext} className="rounded-full bg-g-blue px-4 py-2 text-[13px] font-bold text-white transition hover:bg-g-blue-dark">
                <T value={{ ro: "Înțeles", en: "Got it" }} />
              </button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="mt-2 text-sm font-bold text-g-ink">
              <T value={{ ro: "Fiecare emoție are pagina ei.", en: "Every emotion has its own page." }} />
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-g-sub">
              <T
                value={{
                  ro: "Corp, gânduri, un exemplu din viață reală și un exercițiu de 60 de secunde. E o hartă, nu un diagnostic.",
                  en: "Body, thoughts, a real-life example and a 60-second exercise. It is a map, not a diagnosis.",
                }}
              />
            </p>
            <div className="mt-3 flex justify-end">
              <button onClick={onNext} className="rounded-full bg-g-blue px-4 py-2 text-[13px] font-bold text-white transition hover:bg-g-blue-dark">
                {bookOpen ? (
                  <T value={{ ro: "Închide cartea și continuă", en: "Close the book and continue" }} />
                ) : (
                  <T value={{ ro: "Continuă", en: "Continue" }} />
                )}
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="mt-2 text-sm font-bold text-g-ink">
              <T value={{ ro: "O dată pe zi, notează meteoul.", en: "Once a day, log the weather." }} />
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-g-sub">
              <T value={{ ro: "Ce cer e în tine azi? Lucrează ~20 de secunde. Fără scoruri, fără comentarii.", en: "What's the sky inside you today? Takes ~20 seconds. No scores, no commentary." }} />
            </p>
            <div className="mt-3 flex justify-between">
              <button onClick={onSkip} className="text-[13px] font-semibold text-g-faint transition hover:text-g-ink">
                <T value={{ ro: "Gata", en: "Done" }} />
              </button>
              <button onClick={onGoMeteo} className="rounded-full bg-g-blue px-4 py-2 text-[13px] font-bold text-white transition hover:bg-g-blue-dark">
                <T value={{ ro: "Meteoul de azi →", en: "Today's weather →" }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
