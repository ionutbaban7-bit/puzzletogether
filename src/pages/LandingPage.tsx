import { navigate } from "../lib/router";
import { Logo, LogoMark } from "../components/ui";
import { LangToggle, T, type Bilingual } from "../lib/i18n";

const FEATURES: Array<{ title: Bilingual; text: Bilingual }> = [
  {
    title: { ro: "Zona Kids & Magie 🪄", en: "Kids & Magic Zone 🪄" },
    text: { ro: "Puzzle-uri speciale pentru copii și familie (12–144 piese) cu inorogi, dragoni și aventuri spațiale.", en: "Special family & child-friendly puzzles (12–144 pieces) featuring unicorns, dragons & space adventures." },
  },
  {
    title: { ro: "Sincronizare în timp real", en: "Real-time sync" },
    text: { ro: "Fiecare mișcare se propagă instant. Urmărește colegii plasând piese simultan.", en: "Every move propagates instantly across all players. See teammates place pieces in real-time." },
  },
  {
    title: { ro: "Ateliere de Team Coaching 🧭", en: "Team Coaching Workshops 🧭" },
    text: { ro: "Simulări de supraviețuire de grup și chestionare de rol pentru echipe agile.", en: "Group survival simulations & role discovery questionnaires for agile teams." },
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      {/* Background decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 50% -8%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(40rem 24rem at 88% 108%, rgba(14,165,233,0.12), transparent 60%), radial-gradient(36rem 20rem at 15% 60%, rgba(99,102,241,0.1), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(60rem 32rem at 50% 20%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(60rem 32rem at 50% 20%, black, transparent 75%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6">
        <header className="flex items-center justify-between py-6 animate-fade-up">
          <div className="flex items-center gap-4">
            <Logo dark />
          </div>
          <div className="flex items-center gap-3">
            <LangToggle dark />
            <button
              onClick={() => navigate("/join")}
              className="btn btn-dark btn-sm"
            >
              <T value={{ ro: "Intră în Cameră", en: "Join a Room" }} />
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center pb-16 pt-10 text-center">
          <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
            <LogoMark size={72} />
          </div>
          <h1
            className="font-display mt-7 max-w-3xl text-5xl font-extrabold leading-[1.06] tracking-tight sm:text-6xl animate-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            <T value={{ 
              ro: "Puzzle-uri colaborative pentru echipe și prieteni.",
              en: "Collaborative puzzles for teams & friends."
            }} />
          </h1>
          <p
            className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300 animate-fade-up"
            style={{ animationDelay: "180ms" }}
          >
            <T value={{ 
              ro: "Deschide o cameră, invită instant, rezolvă în timp real. Fără cont, fără așteptări.",
              en: "Open a room, invite instantly, solve in real-time. No accounts, no waiting."
            }} />
          </p>

          <div
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <button onClick={() => navigate("/create")} className="btn-primary w-56 sm:w-auto">
              <T value={{ ro: "Creează Cameră", en: "Create Room" }} />
              <span aria-hidden>→</span>
            </button>
            <button
              onClick={() => navigate("/join")}
              className="btn w-56 border border-white/15 bg-white/5 px-6 py-3.5 text-[15px] text-white backdrop-blur hover:bg-white/10 active:scale-[0.98] sm:w-auto"
            >
              <T value={{ ro: "Intră în Cameră", en: "Join a Room" }} />
            </button>
          </div>

          <div
            className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3 animate-fade-up"
            style={{ animationDelay: "300ms" }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title.en}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left backdrop-blur transition hover:border-brand-500/30 hover:bg-white/[0.06]"
              >
                <div className="h-1 w-12 rounded-full bg-gradient-to-r from-brand-500 to-sky-400"></div>
                <div className="mt-4 font-display text-[15px] font-semibold text-white">
                  <T value={f.title} />
                </div>
                <div className="mt-2 text-sm leading-relaxed text-ink-300">
                  <T value={f.text} />
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer className="pb-6 text-center text-xs text-ink-500 animate-fade-in">
          <T value={{ 
            ro: "PuzzleTogether · Puzzle-uri colaborative în timp real",
            en: "PuzzleTogether · Collaborative puzzles in real-time"
          }} />
          <br />
          <T value={{
            ro: "Imagini din Wikimedia Commons (domeniu public & CC BY-SA)",
            en: "Images via Wikimedia Commons (public domain & CC BY-SA)"
          }} />
        </footer>
      </div>
    </div>
  );
}
