import { useState } from "react";
import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, T, type Bilingual, useLang } from "../lib/i18n";

const CLARITY_EXPRESS_URL = "https://coaching-hub-1.onrender.com/";

const FEATURES: Array<{ icon: string; title: Bilingual; text: Bilingual; tint: string }> = [
  {
    icon: "🧩",
    title: { ro: "Jucați", en: "Play" },
    text: {
      ro: "Puzzle-uri fotografice și jocuri de cuvinte, împreună.",
      en: "Photo puzzles and word games, together.",
    },
    tint: "from-brand-400/25 to-brand-400/0",
  },
  {
    icon: "🎛",
    title: { ro: "Facilitați", en: "Facilitate" },
    text: {
      ro: "Lobby ghidat, Start sincron, timer și blocare.",
      en: "Guided lobby, synced Start, timer and lock.",
    },
    tint: "from-emerald-400/20 to-emerald-400/0",
  },
  {
    icon: "📝",
    title: { ro: "Capturați", en: "Capture" },
    text: {
      ro: "Insight-uri și acțiuni cu responsabil și termen.",
      en: "Insights and owned actions with a due date.",
    },
    tint: "from-sky-300/20 to-sky-300/0",
  },
];

const SHOWCASE = [
  { image: "/images/thumbs/ice-cave.webp", label: { ro: "Natură", en: "Nature" } },
  { image: "/images/thumbs/cluj-unirii-square.webp", label: { ro: "Orașe", en: "Cities" } },
  { image: "/images/thumbs/starry-night.webp", label: { ro: "Picturi", en: "Paintings" } },
  { image: "/images/thumbs/matterhorn.webp", label: { ro: "Peisaje", en: "Landscapes" } },
  { image: "/images/thumbs/machu-picchu.webp", label: { ro: "Repere", en: "Landmarks" } },
];

/**
 * Showcase tiles are tiny (≤75 KB) and sit in the hero, so they load eagerly:
 * lazy-loading gives no bandwidth win here and has mis-fired on some mobile
 * browsers (iOS Safari + WebP + off-screen mosaics), leaving broken-image
 * icons. Real dimensions also reserve the correct box before the bytes arrive.
 * If a tile still fails (offline, blocked, unsupported codec), the fallback
 * shows a labelled gradient tile instead of a broken-image icon.
 */
const SHOWCASE_THUMB_W = 480;
const SHOWCASE_THUMB_H = 360;

export default function LandingPage() {
  const { lang } = useLang();
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set());

  return (
    <div className="marketing-page landing-page">
      {/* The landing page shares the dark navy, translucent surfaces and cyan
          accents used by the live puzzle board. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="marketing-orb -left-36 -top-40 h-[32rem] w-[32rem] bg-brand-700/20 blur-3xl" />
        <div className="marketing-orb -right-40 top-24 h-[30rem] w-[30rem] bg-cp-purple-700/15 blur-3xl" />
        <div className="marketing-orb bottom-20 left-[38%] h-72 w-72 bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex items-center justify-between border-b border-white/10 py-5 sm:py-7">
          <button
            onClick={() => navigate("/")}
            aria-label="PuzzleTogether home"
            className="transition hover:opacity-80"
          >
            <Logo dark />
          </button>
          <div className="flex items-center gap-2">
            <LangToggle dark />
            <button className="btn btn-dark btn-sm" onClick={() => navigate("/join")}>
              <T value={{ ro: "Intră", en: "Join" }} />
            </button>
          </div>
        </header>

        <main className="pb-16 pt-10 sm:pb-24 sm:pt-16">
          {/* Hero */}
          <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
            <div className="animate-fade-up">
              <h1 className="font-display mt-0 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-7xl">
                <T value={{ ro: "Jucați.", en: "Play." }} />{" "}
                <span className="bg-gradient-to-r from-brand-200 via-brand-300 to-white bg-clip-text text-transparent">
                  <T value={{ ro: "Vorbiți.", en: "Talk." }} />{" "}
                  <T value={{ ro: "Alegeți.", en: "Choose." }} />
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300 sm:text-xl">
                <T
                  value={{
                    ro: "Puzzle-uri foto și exerciții ghidate de echipă, dintr-o singură sesiune live.",
                    en: "Photo puzzles and guided team exercises — one live session.",
                  }}
                />
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  className="btn w-full bg-brand-600 px-6 py-3 text-[15px] text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500 active:scale-[0.98] sm:w-auto"
                  onClick={() => navigate("/create")}
                >
                  <T value={{ ro: "Creează sesiunea", en: "Create session" }} /> →
                </button>
                <button
                  className="btn btn-dark w-full px-6 py-3 text-[15px] sm:w-auto"
                  onClick={() => navigate("/join")}
                >
                  <T value={{ ro: "Intră cu un cod", en: "Join with code" }} />
                </button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-ink-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-brand-300">✓</span>
                  <T value={{ ro: "Fără cont", en: "No account" }} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-brand-300">✓</span>
                  <T value={{ ro: "Lobby controlat", en: "Controlled lobby" }} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-brand-300">✓</span>
                  <T value={{ ro: "Camere 24 h", en: "24h rooms" }} />
                </span>
              </div>
            </div>

            {/* Showcase mosaic */}
            <section className="relative animate-fade-up rounded-[34px] border border-white/10 bg-white/[.04] p-3 shadow-pop backdrop-blur sm:p-4">
              <div className="relative grid grid-cols-3 gap-2 rounded-[26px] border border-white/10 bg-ink-950 p-2 sm:gap-3 sm:p-3">
                {SHOWCASE.map((item, i) => (
                  <div
                    key={item.image}
                    className={`relative overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                  >
                    {failedImages.has(item.image) ? (
                      <div className="flex h-full min-h-24 w-full items-center justify-center bg-gradient-to-br from-brand-700/60 via-ink-900 to-cp-purple-700/40">
                        <span className="text-xl" aria-hidden>
                          🧩
                        </span>
                      </div>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.label[lang]}
                        width={SHOWCASE_THUMB_W}
                        height={SHOWCASE_THUMB_H}
                        decoding="async"
                        onError={() =>
                          setFailedImages((prev) =>
                            prev.has(item.image) ? prev : new Set(prev).add(item.image),
                          )
                        }
                        className="h-full w-full object-cover opacity-90 transition duration-700 hover:scale-105 hover:opacity-100"
                      />
                    )}
                    <span className="absolute bottom-1.5 left-1.5 rounded-full border border-white/10 bg-ink-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                      {item.label[lang]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 rounded-full border border-brand-300/30 bg-brand-500/40 shadow-lg shadow-brand-500/20" />
              <div className="pointer-events-none absolute -bottom-3 left-8 h-9 w-9 rounded-full border border-emerald-300/25 bg-emerald-500/35 shadow-lg shadow-emerald-500/15" />
            </section>
          </section>

          <section className="mx-auto mt-16 max-w-4xl border-y border-white/10 px-4 py-10 text-center sm:mt-20 sm:px-8 sm:py-12">
            <blockquote className="font-display text-xl font-medium italic leading-relaxed tracking-tight text-white sm:text-2xl">
              <T
                value={{
                  ro: '"Nu mai căutăm oameni perfecți. Construim un spațiu unde oameni imperfecți pot face împreună lucruri perfecte. Asta am exersat azi. Asta ducem cu noi mai departe."',
                  en: '"We are no longer looking for perfect people. We are building a space where imperfect people can create perfect things together. That is what we practiced today. That is what we carry forward."',
                }}
              />
            </blockquote>
          </section>

          {/* External coaching companion */}
          <section className="relative mt-16 overflow-hidden rounded-[32px] border border-brand-400/25 bg-gradient-to-br from-brand-500/15 via-ink-900 to-ink-900 shadow-pop">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-brand-300/10 bg-brand-400/10 blur-2xl" />
            <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:p-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-300/25 bg-brand-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.18em] text-brand-200">
                  <span className="text-brand-300">✦</span>
                  <T value={{ ro: "Clarity Express · conversații care contează", en: "Clarity Express · conversations that matter" }} />
                </div>
                <h2 className="font-display mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  <T value={{ ro: "Întrebări cu impact pentru echipa ta.", en: "High-impact questions for your team." }} />
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-200 sm:text-base">
                  <T
                    value={{
                      ro: "Clarity Express este un spațiu de reflecție pentru echipe: alegeți o categorie, parcurgeți cardurile sau lăsați Jokerul să aleagă întrebarea și păstrați ideile care merită continuate.",
                      en: "Clarity Express is a reflection space for teams: choose a category, browse the cards or let the Joker pick a question, then keep the ideas worth carrying forward.",
                    }}
                  />
                </p>
                <div className="mt-5 grid gap-2 text-sm text-ink-300 sm:grid-cols-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand-300">✓</span>
                    <span><T value={{ ro: "1.100+ întrebări", en: "1,100+ questions" }} /></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand-300">✓</span>
                    <span><T value={{ ro: "14 categorii", en: "14 categories" }} /></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand-300">✓</span>
                    <span><T value={{ ro: "Fără cont sau instalare", en: "No account or install" }} /></span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-ink-950/55 p-5 sm:p-6">
                <div className="text-[11px] font-bold uppercase tracking-[.2em] text-ink-400">Clarity Express</div>
                <p className="mt-3 text-sm leading-relaxed text-ink-300">
                  <T
                    value={{
                      ro: "Un exercițiu separat de PuzzleTogether, din același univers de coaching de echipă. Deschide-l când vreți să încetiniți, să ascultați și să formulați ce contează.",
                      en: "A companion experience to PuzzleTogether, from the same team-coaching universe. Open it when you want to slow down, listen and name what matters.",
                    }}
                  />
                </p>
                {/*
                  Same-tab navigation: the external Clarity Express app has its
                  own way back (in-app Back + the browser Back button), so the
                  CTA deliberately keeps the user in this tab instead of
                  spawning a new one per click.
                */}
                <a
                  className="btn mt-5 w-full bg-brand-600 px-5 py-3 text-[15px] text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500 active:scale-[0.98]"
                  href={CLARITY_EXPRESS_URL}
                >
                  <T value={{ ro: "Testează cu echipa", en: "Try it with your team" }} /> <span aria-hidden>→</span>
                </a>
                <div className="mt-3 text-center text-[11px] text-ink-500">
                  <T
                    value={{
                      ro: "Se deschide în aceeași filă — „Înapoi” te aduce aici",
                      en: "Opens in this tab — “Back” brings you here",
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="mt-20">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[.22em] text-brand-300">
                <T value={{ ro: "Flow", en: "Flow" }} />
              </div>
              <h2 className="font-display mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                <T value={{ ro: "Un parcurs scurt, trei pași", en: "One short journey, three steps" }} />
              </h2>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {FEATURES.map((feature, i) => (
                <article
                  key={feature.title.en}
                  className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[.035] p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.055] hover:shadow-pop"
                >
                  <div
                    className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${feature.tint} blur-xl transition duration-300 group-hover:scale-125`}
                    aria-hidden
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl shadow-sm">
                    {feature.icon}
                  </div>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-[.18em] text-brand-300">0{i + 1}</div>
                  <h3 className="font-display mt-1 text-lg font-bold text-white"><T value={feature.title} /></h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-300"><T value={feature.text} /></p>
                </article>
              ))}
            </div>
          </section>

          <section id="privacy" className="mt-16 grid gap-4 text-sm text-ink-300 sm:grid-cols-2">
            <div className="rounded-[26px] border border-white/10 bg-white/[.035] p-5">
              <b className="text-white"><T value={{ ro: "Confidențialitate", en: "Privacy" }} /></b>
              <p className="mt-2 leading-relaxed">
                <T value={{ ro: "Fără cont. Răspunsurile Compass rămân private. Camerele expiră după 24 h.", en: "No account. Compass answers stay private. Rooms expire after 24h." }} />
              </p>
            </div>
            <div id="terms" className="rounded-[26px] border border-white/10 bg-white/[.035] p-5">
              <b className="text-white"><T value={{ ro: "Utilizare", en: "Use" }} /></b>
              <p className="mt-2 leading-relaxed">
                <T value={{ ro: "Compass este un exercițiu educațional, nu o evaluare medicală.", en: "Compass is an educational exercise, not a medical assessment." }} />
              </p>
            </div>
          </section>
        </main>

        <footer className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-7 text-xs text-ink-400 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
            <span>© 2026 PuzzleTogether</span>
            <span className="footer-signature" aria-label="by Ionut Baban">
              <span className="signature-script">by Ionut Baban</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#privacy" className="transition hover:text-brand-200">Privacy</a>
            <a href="#terms" className="transition hover:text-brand-200">Terms</a>
            <a
              href="https://www.linkedin.com/in/ionut-baban-004489127/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-brand-200"
            >
              Contact · LinkedIn ↗
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
