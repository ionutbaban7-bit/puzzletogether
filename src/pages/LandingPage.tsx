import { navigate } from "../lib/router";
import { Logo, LogoMark } from "../components/ui";
import { LangToggle } from "../lib/i18n";

const FEATURES = [
  {
    icon: "⚡",
    title: "Real-time together",
    text: "Every move syncs instantly — watch friends place pieces live.",
  },
  {
    icon: "🖼️",
    title: "Curated masterpieces",
    text: "Van Gogh, Hokusai, Monet and more — public-domain images, properly credited.",
  },
  {
    icon: "🔓",
    title: "No sign-up",
    text: "Pick a name, create a room, share the link. That's it.",
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
            "radial-gradient(60rem 30rem at 50% -8%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(40rem 24rem at 88% 108%, rgba(14,165,233,0.12), transparent 60%), radial-gradient(36rem 20rem at 16% -2%, rgba(167,139,250,0.14), transparent 40%)",
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
              Join a Room
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
            Solve beautiful puzzles{" "}
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-sky-400 bg-clip-text text-transparent">
              together
            </span>
            , in real time.
          </h1>
          <p
            className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300 animate-fade-up"
            style={{ animationDelay: "180ms" }}
          >
            Open a room, share the link, and assemble a masterpiece with up to 20
            friends.
          </p>

          <div
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <button onClick={() => navigate("/create")} className="btn-primary w-56 sm:w-auto">
              Create a Room
              <span aria-hidden>→</span>
            </button>
            <button
              onClick={() => navigate("/join")}
              className="btn w-56 border border-white/15 bg-white/5 px-6 py-3.5 text-[15px] text-white backdrop-blur hover:bg-white/10 active:scale-[0.98] sm:w-auto"
            >
              Join a Room
            </button>
          </div>

          <div
            className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3 animate-fade-up"
            style={{ animationDelay: "300ms" }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur"
              >
                <div className="text-2xl">{f.icon}</div>
                <div className="mt-3 font-display text-[15px] font-semibold text-white">
                  {f.title}
                </div>
                <div className="mt-1.5 text-[13px] leading-relaxed text-ink-300">{f.text}</div>
              </div>
            ))}
          </div>
        </main>

        <footer className="pb-6 text-center text-xs text-ink-500 animate-fade-in">
          PuzzleTogether · Miro, but everyone solves the same beautiful puzzle ·
          Images via Wikimedia Commons (public domain &amp; CC BY-SA)
        </footer>
      </div>
    </div>
  );
}
