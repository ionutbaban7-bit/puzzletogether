import { useEffect, useRef, useState, type ReactNode } from "react";
import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, T, type Bilingual, useLang } from "../lib/i18n";

const CLARITY_EXPRESS_URL = "https://coaching-hub-1.onrender.com/";

type Zone = {
  id: string;
  image: string;
  alt: string;
  title: Bilingual;
  tagline: Bilingual;
  text: Bilingual;
  cta: Bilingual;
  href: string;
  external?: boolean;
  accent: string; // text color for tagline/CTA
  glow: string; // radial glow on hover
  floatStyle: string; // hue for floating accent dot
};

const ZONES: Zone[] = [
  {
    id: "puzzle",
    image: "/images/landing/puzzle.webp",
    alt: "",
    title: { ro: "Puzzle", en: "Puzzle" },
    tagline: { ro: "Joacă-te. Conectează-te. Construiește împreună.", en: "Play. Connect. Build together." },
    text: {
      ro: "Jocuri de puzzle, imagini și provocări pentru echipe care vor să gândească împreună, nu doar să lucreze împreună.",
      en: "Puzzle games, images and challenges for teams that want to think together — not just work together.",
    },
    cta: { ro: "Pornește jocul", en: "Start the game" },
    href: "/create",
    accent: "text-[#1a73e8]",
    glow: "rgba(26,115,232,0.13)",
    floatStyle: "rgba(26,115,232,0.35)",
  },
  {
    id: "emotions",
    image: "/images/landing/emotions.webp",
    alt: "",
    title: { ro: "Emoții", en: "Emotions" },
    tagline: { ro: "Vezi ce se întâmplă în interior.", en: "See what's happening inside." },
    text: {
      ro: "Explorează emoții, stări, nevoi și experiențe prin hărți interactive care transformă lucrurile greu de spus în conversații ușor de început.",
      en: "Explore emotions, moods, needs and experiences through interactive maps that turn hard-to-say things into easy-to-start conversations.",
    },
    cta: { ro: "Explorează harta", en: "Explore the map" },
    href: "/emotii",
    accent: "text-[#8b5cf6]",
    glow: "rgba(139,92,246,0.13)",
    floatStyle: "rgba(139,92,246,0.35)",
  },
  {
    id: "clarity",
    image: "/images/landing/clarity.webp",
    alt: "",
    title: { ro: "Clarity Express", en: "Clarity Express" },
    tagline: { ro: "O întrebare bună poate schimba o conversație.", en: "A good question can change a conversation." },
    text: {
      ro: "Peste 1.100 de întrebări pentru echipe, conversații profunde, reflecție și momente în care vrei să ajungi direct la ce contează.",
      en: "1,100+ questions for teams — deep conversations, reflection, and moments when you want to get straight to what matters.",
    },
    cta: { ro: "Descoperă întrebarea", en: "Discover the question" },
    href: CLARITY_EXPRESS_URL,
    external: true,
    accent: "text-[#4f46e5]",
    glow: "rgba(79,70,229,0.13)",
    floatStyle: "rgba(79,70,229,0.35)",
  },
];

const FLOW: Array<{ key: string; word: string; sub: Bilingual; color: string }> = [
  { key: "play", word: "PLAY", sub: { ro: "Joacă", en: "Play" }, color: "#1a73e8" },
  { key: "connect", word: "CONNECT", sub: { ro: "Conectează", en: "Connect" }, color: "#4f46e5" },
  { key: "reflect", word: "REFLECT", sub: { ro: "Reflecție", en: "Reflect" }, color: "#8b5cf6" },
  { key: "act", word: "ACT", sub: { ro: "Acțiune", en: "Act" }, color: "#a855f7" },
];

const STEPS: Array<{ n: string; label: Bilingual; title: Bilingual; text: Bilingual; icon: ReactNode; color: string }> = [
  {
    n: "01",
    label: { ro: "INTRĂ", en: "JOIN" },
    title: { ro: "Alege experiența.", en: "Choose the experience." },
    text: {
      ro: "Deschide un joc, o hartă emoțională sau o conversație și invită echipa să intre în experiență.",
      en: "Open a game, an emotion map or a conversation, and invite your team into the experience.",
    },
    color: "#1a73e8",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
        <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    n: "02",
    label: { ro: "EXPLOREAZĂ", en: "EXPLORE" },
    title: { ro: "Lasă conversația să curgă.", en: "Let the conversation flow." },
    text: {
      ro: "Joacă, discută, descoperă. Timer, lobby și instrumente de facilitare țin experiența simplă și sincronizată.",
      en: "Play, discuss, discover. Timers, lobby and facilitation tools keep the experience simple and in sync.",
    },
    color: "#4f46e5",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1.2L3 20l1.2-5.3A8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.5" cy="11.5" r="1" fill="currentColor" />
        <circle cx="12.5" cy="11.5" r="1" fill="currentColor" />
        <circle cx="16.5" cy="11.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    n: "03",
    label: { ro: "CAPTUREAZĂ", en: "CAPTURE" },
    title: { ro: "Transformă momentul în acțiune.", en: "Turn the moment into action." },
    text: {
      ro: "La final, extrage ideile importante, insight-urile și următorii pași.",
      en: "At the end, extract the key ideas, the insights and the next steps.",
    },
    color: "#8b5cf6",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
        <path d="M5 21V4m0 0 4 3 4-3 4 3 2-1.5M5 8h6M5 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect(); }
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`pt-reveal ${visible ? "is-visible" : ""} ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/** Small floating hero accents — subtle, slow, premium. */
function FloatDot({ className = "", color, size = 10, delay = "0s", duration = "7s" }: { className?: string; color: string; size?: number; delay?: string; duration?: string }) {
  return (
    <span
      aria-hidden
      className={`pt-float absolute rounded-full ${className}`}
      style={{ width: size, height: size, background: color, animationDelay: delay, animationDuration: duration }}
    />
  );
}

function FlowGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 44 44" fill="none" className="h-9 w-9 transition-transform duration-500 group-hover:scale-110" aria-hidden>
      {color === "#1a73e8" && (
        <>
          <circle cx="22" cy="22" r="15" stroke={color} strokeWidth="2.5" opacity="0.35" />
          <path d="M18.5 15.5 30 22l-11.5 6.5v-13Z" fill={color} />
        </>
      )}
      {color === "#4f46e5" && (
        <>
          <circle cx="14" cy="22" r="7.5" stroke={color} strokeWidth="2.5" />
          <circle cx="31" cy="22" r="7.5" stroke={color} strokeWidth="2.5" opacity="0.45" />
          <path d="M19.5 22h9" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 5" />
        </>
      )}
      {color === "#8b5cf6" && (
        <>
          <path d="M8 22c3.5-6 8-9 14-9s10.5 3 14 9c-3.5 6-8 9-14 9s-10.5-3-14-9Z" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="22" cy="22" r="4" fill={color} />
        </>
      )}
      {color === "#a855f7" && (
        <>
          <path d="M17 36V9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M17 9h14l-3.5 5 3.5 5H17" fill={color} />
          <circle cx="12" cy="36" r="1.8" fill={color} opacity="0.5" />
        </>
      )}
    </svg>
  );
}

export default function LandingPage() {
  const { lang } = useLang();

  return (
    <div className="marketing-page landing-page">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-g-line/70 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <button onClick={() => navigate("/")} aria-label="PuzzleTogether home" className="transition hover:opacity-80">
            <Logo />
          </button>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              onClick={() => navigate("/join")}
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-g-sub transition hover:bg-g-soft hover:text-g-ink sm:block"
            >
              <T value={{ ro: "Intră", en: "Join" }} />
            </button>
            <button
              onClick={() => navigate("/create")}
              className="pt-btn-primary rounded-full px-4 py-2 text-sm font-semibold"
            >
              <T value={{ ro: "Creează sesiunea", en: "Create session" }} />
            </button>
          </div>
        </div>
      </header>

      <main className="overflow-x-clip">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
            style={{
              background:
                "radial-gradient(52rem 26rem at 18% -8%, rgba(26,115,232,0.075), transparent 62%), radial-gradient(46rem 24rem at 88% 4%, rgba(139,92,246,0.07), transparent 62%)",
            }}
          />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6 lg:pb-20">
            <Reveal>
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-g-line/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-g-sub shadow-[0_1px_2px_rgba(30,41,59,0.05)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#1a73e8] to-[#8b5cf6]" aria-hidden />
                  <T value={{ ro: "Experiențe interactive pentru echipe", en: "Interactive experiences for teams" }} />
                </span>
                <h1 className="font-display mt-5 text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-g-ink sm:text-6xl">
                  <T value={{ ro: "Conectează oamenii.", en: "Connect people." }} />
                  <br />
                  <T value={{ ro: "Pornește conversația.", en: "Start the conversation." }} />
                  <br />
                  <span className="pt-gradient-text">
                    <T value={{ ro: "Descoperă ce se întâmplă între voi.", en: "Discover what's happening between you." }} />
                  </span>
                </h1>
                <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-g-sub">
                  <T
                    value={{
                      ro: "PuzzleTogether transformă sesiunile de echipă în experiențe interactive — jocuri, conversații, reflecție și momente care chiar rămân cu tine.",
                      en: "PuzzleTogether turns team sessions into interactive experiences — games, conversations, reflection, and moments that actually stay with you.",
                    }}
                  />
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button onClick={() => navigate("/create")} className="pt-btn-primary group rounded-full px-7 py-3.5 text-[15px] font-semibold">
                    <T value={{ ro: "Începe o experiență", en: "Start an experience" }} />
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </button>
                  <a
                    href="#experiente"
                    className="rounded-full border border-g-line bg-white px-7 py-3.5 text-center text-[15px] font-semibold text-g-ink shadow-[0_1px_2px_rgba(30,41,59,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-g-faint hover:shadow-[0_6px_18px_-8px_rgba(30,41,59,0.25)]"
                  >
                    <T value={{ ro: "Explorează zonele", en: "Explore the zones" }} />
                  </a>
                </div>
                <p className="mt-5 text-sm text-g-faint">
                  <T value={{ ro: "Fără cont. Fără instalări. Intră, joacă-te și începe conversația.", en: "No account. No installs. Jump in, play, and start the conversation." }} />
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] font-medium text-g-sub">
                  <span className="rounded-full bg-g-soft px-3 py-1">
                    <T value={{ ro: "Echipe de 2–20", en: "Teams of 2–20" }} />
                  </span>
                  <span className="rounded-full bg-g-soft px-3 py-1">
                    <T value={{ ro: "15–45 minute", en: "15–45 minutes" }} />
                  </span>
                  <span className="rounded-full bg-g-soft px-3 py-1">RO / EN</span>
                  <span className="rounded-full bg-g-soft px-3 py-1">
                    <T value={{ ro: "din browser, pe telefon", en: "in the browser, on phones" }} />
                  </span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="relative">
                <FloatDot className="-top-4 left-[12%]" color="rgba(26,115,232,0.35)" size={12} duration="8s" />
                <FloatDot className="right-[8%] top-[14%]" color="rgba(139,92,246,0.3)" size={9} delay="1.2s" duration="9s" />
                <FloatDot className="bottom-[18%] left-[4%]" color="rgba(79,70,229,0.25)" size={7} delay="2.1s" duration="7.5s" />
                <div
                  aria-hidden
                  className="pt-float-slow absolute -bottom-6 -right-4 hidden rounded-2xl border border-g-line/70 bg-white/90 p-3 shadow-[0_10px_30px_-12px_rgba(30,41,59,0.25)] backdrop-blur sm:block"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#eef4ff] to-[#f3eeff] text-base" aria-hidden>💬</span>
                    <div className="pr-1">
                      <p className="text-[11px] font-bold text-g-ink">
                        <T value={{ ro: "Conversație pornită", en: "Conversation started" }} />
                      </p>
                      <p className="text-[10px] text-g-faint">
                        <T value={{ ro: "4 oameni · 1 experiență", en: "4 people · 1 experience" }} />
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  aria-hidden
                  className="pt-float-slow absolute -left-3 -top-5 hidden rounded-2xl border border-g-line/70 bg-white/90 px-3 py-2 shadow-[0_10px_30px_-12px_rgba(30,41,59,0.25)] backdrop-blur md:block"
                  style={{ animationDelay: "1.6s" }}
                >
                  <p className="text-[11px] font-bold text-g-ink">
                    <T value={{ ro: "Insight nou", en: "New insight" }} />
                  </p>
                  <div className="mt-1 flex gap-1" aria-hidden>
                    <span className="h-1.5 w-5 rounded-full bg-[#1a73e8]" />
                    <span className="h-1.5 w-3.5 rounded-full bg-[#4f46e5]" />
                    <span className="h-1.5 w-2 rounded-full bg-[#8b5cf6]" />
                  </div>
                </div>
                <div className="overflow-hidden rounded-[32px] bg-[#f4f6f8] shadow-[0_30px_70px_-32px_rgba(30,41,59,0.3)] ring-1 ring-black/[0.04]">
                  <img
                    src="/images/landing/hero.webp"
                    alt=""
                    width={1408}
                    height={768}
                    loading="eager"
                    fetchPriority="high"
                    className="w-full select-none"
                    draggable={false}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Zones ───────────────────────────────────────────── */}
        <section id="experiente" className="relative scroll-mt-20 px-5 pb-8 pt-6 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-g-ink sm:text-[2.6rem] sm:leading-[1.1]">
                <T value={{ ro: "Alege cum vrei să înceapă conversația.", en: "Choose how you want the conversation to begin." }} />
              </h2>
              <p className="mt-4 text-base leading-relaxed text-g-sub">
                <T
                  value={{
                    ro: "Fiecare experiență deschide o altă ușă. Alege una sau combină-le într-o sesiune completă.",
                    en: "Every experience opens a different door. Pick one — or combine them into a full session.",
                  }}
                />
              </p>
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-6">
              {ZONES.map((z, i) => (
                <Reveal key={z.id} delay={i * 90}>
                  <a
                    href={z.external ? z.href : undefined}
                    onClick={z.external ? undefined : (e) => { e.preventDefault(); navigate(z.href); }}
                    target={z.external ? "_blank" : undefined}
                    rel={z.external ? "noopener noreferrer" : undefined}
                    className="pt-card group block"
                    style={{ ["--pt-glow" as string]: z.glow }}
                  >
                    <div className="relative overflow-hidden rounded-t-[28px]">
                      <div className="pt-img-fade relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-b from-[#f3f5fa] to-white">
                        <img
                          src={z.image}
                          alt=""
                          loading="lazy"
                          className="pt-card-img h-full w-full object-cover object-top"
                          draggable={false}
                        />
                      </div>
                    </div>
                    <div className="px-6 pb-6 pt-2">
                      <p className={`text-[13px] font-bold uppercase tracking-[0.1em] ${z.accent}`}>
                        <T value={z.tagline} />
                      </p>
                      <h3 className="font-display mt-1.5 text-[1.55rem] font-extrabold tracking-[-0.02em] text-g-ink">
                        <T value={z.title} />
                      </h3>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-g-sub">
                        <T value={z.text} />
                      </p>
                      <span className={`mt-5 inline-flex items-center gap-1.5 text-[15px] font-bold ${z.accent}`}>
                        <T value={z.cta} />
                        <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
                          {z.external ? "↗" : "→"}
                        </span>
                      </span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Play → conversation ──────────────────────────────── */}
        <section id="despre" className="scroll-mt-20 px-5 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-g-ink sm:text-[2.5rem] sm:leading-[1.12]">
                  <T value={{ ro: "Începe cu joaca.", en: "Start with play." }} />{" "}
                  <span className="pt-gradient-text">
                    <T value={{ ro: "Ajungi la conversație.", en: "Arrive at conversation." }} />
                  </span>
                </h2>
                <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-g-sub">
                  <p>
                    <T
                      value={{
                        ro: "Uneori e greu să pornești direct o conversație importantă.",
                        en: "Sometimes it's hard to start an important conversation directly.",
                      }}
                    />
                  </p>
                  <p>
                    <T value={{ ro: "Un joc schimbă energia.", en: "A game changes the energy." }} />
                  </p>
                  <p>
                    <T value={{ ro: "O întrebare creează spațiu.", en: "A question creates space." }} />
                  </p>
                  <p>
                    <T value={{ ro: "O experiență comună îi face pe oameni să vorbească altfel.", en: "A shared experience makes people talk differently." }} />
                  </p>
                  <p className="font-semibold text-g-ink">
                    <T value={{ ro: "Și de aici începe partea interesantă.", en: "And that's where the interesting part begins." }} />
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
                {FLOW.map((f, i) => (
                  <div key={f.key} className="group relative flex flex-col items-center rounded-3xl border border-g-line/70 bg-white px-3 py-6 text-center shadow-[0_1px_2px_rgba(30,41,59,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_-14px_rgba(30,41,59,0.2)]">
                    {i < FLOW.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute -right-[13px] top-1/2 z-10 hidden h-px w-4 bg-gradient-to-r from-[#c7d2fe] to-transparent sm:block"
                      />
                    )}
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-105"
                      style={{ background: `${f.color}12`, color: f.color }}
                    >
                      <FlowGlyph color={f.color} />
                    </span>
                    <p className="font-display mt-3.5 text-[13px] font-extrabold tracking-[0.14em]" style={{ color: f.color }}>
                      {f.word}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-g-faint">
                      <T value={f.sub} />
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Steps ────────────────────────────────────────────── */}
        <section className="px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-g-ink sm:text-[2.5rem]">
                <T value={{ ro: "De la primul click la un insight real.", en: "From the first click to a real insight." }} />
              </h2>
              <p className="mt-4 text-base leading-relaxed text-g-sub">
                <T
                  value={{
                    ro: "PuzzleTogether face experiența simplă pentru participanți și ușor de facilitat pentru traineri și lideri.",
                    en: "PuzzleTogether keeps the experience simple for participants and easy to facilitate for trainers and leaders.",
                  }}
                />
              </p>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-6">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 90}>
                  <article className="pt-card group relative overflow-hidden px-6 py-7" style={{ ["--pt-glow" as string]: "rgba(79,70,229,0.08)" }}>
                    <span
                      aria-hidden
                      className="font-display pointer-events-none absolute -top-3 right-4 text-[4.5rem] font-extrabold tracking-tight opacity-[0.055] transition-opacity duration-500 group-hover:opacity-[0.1]"
                      style={{ color: s.color }}
                    >
                      {s.n}
                    </span>
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-105"
                      style={{ background: `${s.color}12`, color: s.color }}
                    >
                      {s.icon}
                    </span>
                    <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-g-faint">
                      {s.n} · <T value={s.label} />
                    </p>
                    <h3 className="font-display mt-1.5 text-xl font-extrabold tracking-[-0.015em] text-g-ink">
                      <T value={s.title} />
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-g-sub">
                      <T value={s.text} />
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust ────────────────────────────────────────────── */}
        <section id="confidentialitate" className="scroll-mt-20 px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-g-ink sm:text-[2.4rem]">
                <T value={{ ro: "Creat pentru oameni. Gândit cu grijă.", en: "Made for people. Crafted with care." }} />
              </h2>
            </Reveal>
            <div className="mx-auto mt-9 grid max-w-4xl gap-5 sm:grid-cols-2">
              <Reveal>
                <div id="privacy" className="pt-card h-full px-6 py-6" style={{ ["--pt-glow" as string]: "rgba(26,115,232,0.08)" }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a73e8]12 text-[#1a73e8]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                      <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.6 4-1.2 7-5.2 7-9.6V6l-7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="m9.5 12 1.8 1.8L15 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h3 className="font-display mt-4 text-lg font-bold text-g-ink">
                    <T value={{ ro: "Confidențialitate", en: "Privacy" }} />
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-g-sub">
                    <T
                      value={{
                        ro: "Răspunsurile participanților rămân în sesiune. Nu transformăm reflecția personală în profiluri.",
                        en: "Participants' answers stay in the session. We don't turn personal reflection into profiles.",
                      }}
                    />
                  </p>
                </div>
              </Reveal>
              <Reveal delay={90}>
                <div id="utilizare" className="pt-card h-full px-6 py-6" style={{ ["--pt-glow" as string]: "rgba(139,92,246,0.08)" }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8b5cf6]12 text-[#8b5cf6]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                      <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.5 5.4 5.4 0 0 1 21.3 12c-2.3 4.4-9.3 9-9.3 9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h3 className="font-display mt-4 text-lg font-bold text-g-ink">
                    <T value={{ ro: "Utilizare", en: "Use" }} />
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-g-sub">
                    <T
                      value={{
                        ro: "PuzzleTogether este un spațiu pentru conversație, reflecție și joc de echipă — nu un instrument de diagnostic sau evaluare psihologică.",
                        en: "PuzzleTogether is a space for conversation, reflection and team play — not a diagnostic tool or a psychological assessment.",
                      }}
                    />
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-g-line/70 bg-white/60 px-5 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
          <div>
            <Logo />
            <p className="mt-1.5 text-sm font-medium text-g-faint">Play. Connect. Reflect. Act.</p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm font-medium text-g-sub">
            <a href="#experiente" className="transition hover:text-g-ink">
              <T value={{ ro: "Experiențe", en: "Experiences" }} />
            </a>
            <a href="#confidentialitate" className="transition hover:text-g-ink">
              <T value={{ ro: "Confidențialitate", en: "Privacy" }} />
            </a>
            <a href="#utilizare" className="transition hover:text-g-ink">
              <T value={{ ro: "Utilizare", en: "Use" }} />
            </a>
            <a href="#despre" className="transition hover:text-g-ink">
              <T value={{ ro: "Despre", en: "About" }} />
            </a>
          </nav>
          <p className="text-xs text-g-faint">
            © 2026 PuzzleTogether {lang === "ro" ? "· Un loc pentru conversații care contează." : "· A place for conversations that matter."}
          </p>
        </div>
      </footer>
    </div>
  );
}
