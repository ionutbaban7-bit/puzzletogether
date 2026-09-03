import { navigate } from "../lib/router";
import { Logo, LogoMark } from "../components/ui";
import { LangToggle, T, type Bilingual } from "../lib/i18n";

const FEATURES: Array<{ title: Bilingual; text: Bilingual; accent: string }> = [
  {
    title: {
      ro: "Word World & Brainstorming",
      en: "Word World & Brainstorming",
    },
    text: {
      ro: "Puzzle-uri de cuvinte pentru workshop-uri, ideare și facilitare vizuală în echipe de 3–5 persoane.",
      en: "Word-tile puzzles built for workshops, ideation sessions and visual facilitation across 3–5 person teams.",
    },
    accent: "from-cyan-400 to-blue-500",
  },
  {
    title: {
      ro: "Sincronizare în Timp Real & Gamificare",
      en: "Real-Time Sync & Gamification",
    },
    text: {
      ro: "Colaborare live, scoring transparent și podium final pentru sesiuni competitive și energizante.",
      en: "Live collaboration, transparent scoring and an end-game podium for energizing, competitive sessions.",
    },
    accent: "from-violet-400 to-fuchsia-500",
  },
  {
    title: {
      ro: "Ateliere de Team Coaching",
      en: "Team Coaching Workshops",
    },
    text: {
      ro: "Activități pentru aliniere, reflecție și dezvoltarea culturii de echipă într-un format elegant și ușor de facilitat.",
      en: "Activities for alignment, reflection and team culture work in a polished format that is easy to facilitate.",
    },
    accent: "from-emerald-400 to-teal-500",
  },
];

const STATS: Array<{ value: string; label: Bilingual }> = [
  { value: "40", label: { ro: "puzzle-uri profesionale", en: "professional puzzles" } },
  { value: "6", label: { ro: "categorii B2B", en: "B2B categories" } },
  { value: "RT", label: { ro: "sincronizare live", en: "live synchronization" } },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ backgroundColor: "#0a0d1a" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(48rem 28rem at 14% 12%, rgba(14,165,233,0.18), transparent 65%), radial-gradient(42rem 26rem at 88% 10%, rgba(168,85,247,0.16), transparent 60%), radial-gradient(44rem 28rem at 50% 100%, rgba(16,185,129,0.14), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(circle at center, black 42%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 42%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        <header className="flex items-center justify-between py-6 animate-fade-up">
          <Logo dark />
          <div className="flex items-center gap-3">
            <LangToggle dark />
            <button onClick={() => navigate("/join")} className="btn btn-dark btn-sm">
              <T value={{ ro: "Intră în Cameră", en: "Join Room" }} />
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-center py-10 sm:py-14">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="animate-fade-up" style={{ animationDelay: "80ms" }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200 backdrop-blur">
                <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-100">B2B</span>
                Team Collaboration &amp; Workshop Suite
              </div>

              <div className="mt-7 flex items-center gap-4">
                <LogoMark size={64} />
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">PuzzleTogether</div>
                  <div className="mt-1 text-sm text-ink-200">
                    <T
                      value={{
                        ro: "Platformă pentru facilitatori, echipe agile și workshop-uri colaborative.",
                        en: "A collaboration platform for facilitators, agile teams and workshop-led sessions.",
                      }}
                    />
                  </div>
                </div>
              </div>

              <h1 className="font-display mt-8 max-w-3xl text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
                <T
                  value={{
                    ro: "Experiențe de puzzle colaborativ, redesenate pentru echipe moderne.",
                    en: "Collaborative puzzle experiences, redesigned for modern teams.",
                  }}
                />
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-300 sm:text-xl">
                <T
                  value={{
                    ro: "Lansează camere instant, alege puzzle-uri vizuale sau Word World și transformă fiecare sesiune într-un workshop elegant, sincronizat live.",
                    en: "Launch rooms instantly, choose visual puzzles or Word World, and turn every session into a polished live workshop.",
                  }}
                />
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => navigate("/create")} className="btn-primary w-full sm:w-auto">
                  <T value={{ ro: "Creează Cameră B2B", en: "Create B2B Room" }} />
                  <span aria-hidden>→</span>
                </button>
                <button
                  onClick={() => navigate("/join")}
                  className="btn w-full border border-white/12 bg-white/[0.04] px-6 py-3.5 text-[15px] text-white backdrop-blur hover:bg-white/[0.08] sm:w-auto"
                >
                  <T value={{ ro: "Intră într-un workshop", en: "Join a workshop" }} />
                </button>
              </div>

              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                {STATS.map((stat) => (
                  <div key={stat.value + stat.label.en} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                    <div className="font-display text-2xl font-extrabold text-white">{stat.value}</div>
                    <div className="mt-1 text-sm text-ink-300">
                      <T value={stat.label} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="animate-fade-up" style={{ animationDelay: "160ms" }}>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-pop backdrop-blur-xl sm:p-5">
                <div className="rounded-[24px] border border-white/8 bg-[#0f1529]/90 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-ink-400">Workshop Modules</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        <T value={{ ro: "Pachet profesional pentru facilitare", en: "Professional facilitation suite" }} />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200">Live</div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {FEATURES.map((feature) => (
                      <div key={feature.title.en} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/14 hover:bg-white/[0.05]">
                        <div className={`h-1.5 w-14 rounded-full bg-gradient-to-r ${feature.accent}`} />
                        <div className="mt-4 text-lg font-semibold text-white">
                          <T value={feature.title} />
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-ink-300">
                          <T value={feature.text} />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="pb-7 text-center text-xs text-ink-500 animate-fade-in">
          <T
            value={{
              ro: "PuzzleTogether · B2B collaboration suite pentru workshop-uri, team coaching și gamificare live",
              en: "PuzzleTogether · B2B collaboration suite for workshops, team coaching and live gamification",
            }}
          />
        </footer>
      </div>
    </div>
  );
}
