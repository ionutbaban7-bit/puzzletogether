import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, T, type Bilingual, useLang } from "../lib/i18n";

const CLARITY_EXPRESS_URL = "https://coaching-hub-1.onrender.com/";

const CATEGORIES: Array<{
  icon: string;
  tile: string;
  title: Bilingual;
  text: Bilingual;
  cta: Bilingual;
  href: string;
  external?: boolean;
}> = [
  {
    icon: "🧩",
    tile: "bg-g-blue-tint text-g-blue",
    title: { ro: "Puzzle", en: "Puzzle" },
    text: {
      ro: "Puzzle-uri foto și jocuri de cuvinte, într-o sesiune live — lobby, timer, reveal împreună.",
      en: "Photo puzzles and word games in one live session — lobby, timer, reveal together.",
    },
    cta: { ro: "Începe un joc", en: "Start a game" },
    href: "/create",
  },
  {
    icon: "🗺️",
    tile: "bg-[#f3e8fd] text-[#8430ce]",
    title: { ro: "Emoții", en: "Emotions" },
    text: {
      ro: "CARTOGRAF — harta lumii interioare: roata emoțiilor, meteo, expediții, frontiera fricilor. Solo sau în cameră.",
      en: "CARTOGRAF — the map of the inner world: the emotion wheel, weather, expeditions, the frontier of fears. Solo or in the room.",
    },
    cta: { ro: "Deschide harta", en: "Open the map" },
    href: "/emotii",
  },
  {
    icon: "💬",
    tile: "bg-g-green-tint text-g-green",
    title: { ro: "Clarity Express", en: "Clarity Express" },
    text: {
      ro: "Conversații care contează: 1.100+ de întrebări pentru echipe, fără cont și fără instalare.",
      en: "Conversations that matter: 1,100+ questions for teams, no account, no install.",
    },
    cta: { ro: "Explorează", en: "Explore" },
    href: CLARITY_EXPRESS_URL,
    external: true,
  },
];

const STEPS: Array<{ icon: string; title: Bilingual; text: Bilingual }> = [
  {
    icon: "🧩",
    title: { ro: "Jucați", en: "Play" },
    text: {
      ro: "Puzzle-uri și exerciții ghidate, împreună, din aceeași cameră.",
      en: "Puzzles and guided exercises, together, in the same room.",
    },
  },
  {
    icon: "🎛️",
    title: { ro: "Facilitați", en: "Facilitate" },
    text: {
      ro: "Lobby ghidat, Start sincron, timer, blocare și control al turului.",
      en: "Guided lobby, synced Start, timer, lock and round control.",
    },
  },
  {
    icon: "📝",
    title: { ro: "Capturați", en: "Capture" },
    text: {
      ro: "Insight-uri și acțiuni cu responsabil și termen — la finalul sesiunii.",
      en: "Insights and owned actions with a due date — at the end of the session.",
    },
  },
];

export default function LandingPage() {
  const { lang } = useLang();

  return (
    <div className="marketing-page landing-page">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <button
            onClick={() => navigate("/")}
            aria-label="PuzzleTogether home"
            className="transition hover:opacity-80"
          >
            <Logo />
          </button>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button className="btn btn-sm px-4 py-2 text-sm font-semibold text-g-sub transition hover:bg-g-soft hover:text-g-ink" onClick={() => navigate("/join")}>
              <T value={{ ro: "Intră", en: "Join" }} />
            </button>
            <button className="btn btn-sm bg-g-blue px-4 py-2 text-sm font-semibold text-white shadow-none transition hover:bg-g-blue-dark" onClick={() => navigate("/create")}>
              <T value={{ ro: "Creează sesiunea", en: "Create session" }} />
            </button>
          </div>
        </header>

        <main className="pb-16 pt-10 sm:pb-24 sm:pt-14">
          {/* Hero — centered, quiet, one idea */}
          <section className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-5xl font-extrabold leading-[1.04] tracking-tight text-g-ink sm:text-6xl">
              <T value={{ ro: "Jucați.", en: "Play." }} />{" "}
              <span className="text-g-blue">
                <T value={{ ro: "Vorbiți.", en: "Talk." }} />{" "}
                <T value={{ ro: "Alegeți.", en: "Choose." }} />
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-g-sub">
              <T
                value={{
                  ro: "Trei moduri de a face echipă: puzzle-uri live, harta emoțiilor și conversații cu impact. Fără cont, dintr-o singură sesiune.",
                  en: "Three ways to build a team: live puzzles, the map of emotions, and conversations that matter. No account, one live session.",
                }}
              />
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                className="btn w-full bg-g-blue px-7 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-g-blue-dark sm:w-auto"
                onClick={() => navigate("/create")}
              >
                <T value={{ ro: "Creează sesiunea", en: "Create session" }} /> →
              </button>
              <button
                className="btn w-full border border-g-line bg-white px-7 py-3 text-[15px] font-semibold text-g-blue hover:bg-g-blue-tint sm:w-auto"
                onClick={() => navigate("/join")}
              >
                <T value={{ ro: "Intră cu un cod", en: "Join with code" }} />
              </button>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-g-sub">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-g-green">✓</span>
                <T value={{ ro: "Fără cont", en: "No account" }} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-g-green">✓</span>
                <T value={{ ro: "Lobby controlat", en: "Controlled lobby" }} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-g-green">✓</span>
                <T value={{ ro: "Camere 24 h", en: "24h rooms" }} />
              </span>
            </div>
          </section>

          {/* The three categories — the heart of the page */}
          <section className="mt-16 sm:mt-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-g-ink sm:text-4xl">
                <T value={{ ro: "Alege zona ta", en: "Choose your zone" }} />
              </h2>
              <p className="mt-3 text-base leading-relaxed text-g-sub">
                <T
                  value={{
                    ro: "Fiecare zonă funcționează singură și se completează cu celelalte într-o sesiune de echipă.",
                    en: "Each zone works on its own and completes the others in a team session.",
                  }}
                />
              </p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {CATEGORIES.map((c) => (
                <a
                  key={c.title.en}
                  href={c.external ? c.href : undefined}
                  onClick={c.external ? undefined : (e) => { e.preventDefault(); navigate(c.href); }}
                  target={c.external ? "_blank" : undefined}
                  rel={c.external ? "noopener noreferrer" : undefined}
                  className="group flex flex-col rounded-3xl border border-g-line bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(60,64,67,0.14)]"
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${c.tile}`} aria-hidden="true">
                    {c.icon}
                  </span>
                  <h3 className="font-display mt-4 text-xl font-bold text-g-ink">
                    <T value={c.title} />
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-g-sub">
                    <T value={c.text} />
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-g-blue transition group-hover:gap-2">
                    <T value={c.cta} /> {c.external ? "↗" : "→"}
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="mt-16 sm:mt-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-g-ink sm:text-4xl">
                <T value={{ ro: "Un parcurs scurt, trei pași", en: "One short journey, three steps" }} />
              </h2>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <article key={step.title.en} className="rounded-3xl border border-g-line bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-g-soft text-lg" aria-hidden="true">
                      {step.icon}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-g-faint">
                      {lang === "ro" ? `Pasul 0${i + 1}` : `Step 0${i + 1}`}
                    </span>
                  </div>
                  <h3 className="font-display mt-4 text-lg font-bold text-g-ink"><T value={step.title} /></h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-g-sub"><T value={step.text} /></p>
                </article>
              ))}
            </div>
          </section>

          {/* Privacy + use */}
          <section id="privacy" className="mt-16 grid gap-5 text-sm text-g-sub sm:mt-20 sm:grid-cols-2">
            <div className="rounded-3xl border border-g-line bg-white p-5">
              <b className="text-g-ink"><T value={{ ro: "Confidențialitate", en: "Privacy" }} /></b>
              <p className="mt-2 leading-relaxed">
                <T value={{ ro: "Fără cont. Răspunsurile rămân private în sesiune. Camerele expiră după 24 h, datele CARTOGRAF rămân în browserul tău.", en: "No account. Answers stay private in the session. Rooms expire after 24h; CARTOGRAF data stays in your browser." }} />
              </p>
            </div>
            <div id="terms" className="rounded-3xl border border-g-line bg-white p-5">
              <b className="text-g-ink"><T value={{ ro: "Utilizare", en: "Use" }} /></b>
              <p className="mt-2 leading-relaxed">
                <T value={{ ro: "Instrumente de reflecție și joc de echipă, nu evaluări medicale sau psihologice.", en: "Reflection and team-play instruments, not medical or psychological assessments." }} />
              </p>
            </div>
          </section>
        </main>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-g-line py-7 text-sm text-g-sub sm:flex-row">
          <span>© 2026 PuzzleTogether</span>
          <div className="flex flex-wrap justify-center gap-5">
            <a href="#privacy" className="transition hover:text-g-ink">
              <T value={{ ro: "Confidențialitate", en: "Privacy" }} />
            </a>
            <a href="#terms" className="transition hover:text-g-ink">
              <T value={{ ro: "Utilizare", en: "Terms" }} />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
