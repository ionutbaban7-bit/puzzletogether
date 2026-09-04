import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, T, type Bilingual, useLang } from "../lib/i18n";

const FEATURES: Array<{ icon: string; title: Bilingual; text: Bilingual; tint: string }> = [
  { icon: "🧩", title: { ro: "Jucați", en: "Play" }, text: { ro: "Puzzle-uri fotografice și jocuri de cuvinte, împreună.", en: "Photo puzzles and word games, together." }, tint: "from-cp-pink-500/20 to-cp-pink-500/0" },
  { icon: "🎛", title: { ro: "Facilitați", en: "Facilitate" }, text: { ro: "Lobby ghidat, Start sincron, timer și blocare.", en: "Guided lobby, synced Start, timer and lock." }, tint: "from-cp-purple-500/20 to-cp-purple-500/0" },
  { icon: "📝", title: { ro: "Capturați", en: "Capture" }, text: { ro: "Insight-uri și acțiuni cu responsabil și termen.", en: "Insights and owned actions with a due date." }, tint: "from-brand-500/20 to-brand-500/0" },
];

const SHOWCASE = [
  { image: "/images/thumbs/ice-cave.webp", label: { ro: "Natură", en: "Nature" } },
  { image: "/images/thumbs/cluj-unirii-square.webp", label: { ro: "Orașe", en: "Cities" } },
  { image: "/images/thumbs/starry-night.webp", label: { ro: "Picturi", en: "Paintings" } },
  { image: "/images/thumbs/matterhorn.webp", label: { ro: "Peisaje", en: "Landscapes" } },
  { image: "/images/thumbs/machu-picchu.webp", label: { ro: "Repere", en: "Landmarks" } },
];

export default function LandingPage() {
  const { lang } = useLang();

  return (
    <div className="marketing-page">
      {/* Ambient gradient mesh background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="marketing-orb -left-28 -top-24 h-[28rem] w-[28rem] rounded-full bg-cp-purple-300/50 blur-3xl" />
        <div className="marketing-orb -right-24 top-24 h-[30rem] w-[30rem] rounded-full bg-cp-pink-300/45 blur-3xl" />
        <div className="marketing-orb bottom-16 left-[38%] h-64 w-64 rounded-full bg-brand-300/40 blur-3xl" />
        <div className="marketing-orb -bottom-24 right-1/4 h-80 w-80 rounded-full bg-cp-azure-300/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex items-start justify-between py-5 sm:py-7">
          <div>
            <button onClick={() => navigate("/")} aria-label="PuzzleTogether home" className="transition hover:opacity-80"><Logo /></button>
            <div className="ml-[45px] mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-brand-700">by Coaching Partners</div>
          </div>
          <div className="flex items-center gap-2"><LangToggle /><button className="btn-secondary btn-sm shadow-sm" onClick={() => navigate("/join")}><T value={{ ro: "Intră", en: "Join" }} /></button></div>
        </header>

        <main className="pb-16 pt-8 sm:pb-24 sm:pt-10">
          {/* Hero */}
          <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-brand-700 backdrop-blur">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cp-pink-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-cp-pink-500" /></span>
                <T value={{ ro: "Joc de echipă", en: "Team activity" }} />
              </div>
              <h1 className="font-display mt-6 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight text-ink-900 sm:text-7xl">
                <T value={{ ro: "Jucați.", en: "Play." }} />{" "}
                <span className="bg-gradient-to-r from-cp-pink-600 via-cp-purple-600 to-brand-600 bg-clip-text text-transparent"><T value={{ ro: "Decideți.", en: "Decide." }} /></span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600 sm:text-xl">
                <T value={{ ro: "Puzzle-uri foto și exerciții ghidate de echipă, dintr-o singură sesiune live.", en: "Photo puzzles and guided team exercises — one live session." }} />
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button className="btn-primary w-full sm:w-auto" onClick={() => navigate("/create")}><T value={{ ro: "Creează sesiunea", en: "Create session" }} /> →</button>
                <button className="btn-secondary w-full sm:w-auto" onClick={() => navigate("/join")}><T value={{ ro: "Intră cu un cod", en: "Join with code" }} /></button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-ink-600">
                <span className="inline-flex items-center gap-1.5">✓ <T value={{ ro: "Fără cont", en: "No account" }} /></span>
                <span className="inline-flex items-center gap-1.5">✓ <T value={{ ro: "Lobby controlat", en: "Controlled lobby" }} /></span>
                <span className="inline-flex items-center gap-1.5">✓ <T value={{ ro: "Camere 24 h", en: "24h rooms" }} /></span>
              </div>
            </div>

            {/* Showcase mosaic */}
            <section className="relative animate-fade-up rounded-[34px] border border-brand-100 bg-white/80 p-3 shadow-pop backdrop-blur sm:p-4">
              <div className="relative grid grid-cols-3 gap-2 rounded-[26px] bg-ink-950 p-2 sm:gap-3 sm:p-3">
                {SHOWCASE.map((item, i) => (
                  <div key={item.image} className={`relative overflow-hidden rounded-2xl ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                    <img src={item.image} alt={item.label[lang]} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 hover:scale-105" />
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink-950/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">{item.label[lang]}</span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 rounded-full bg-cp-pink-500/80 shadow-lg shadow-cp-pink-500/30" />
              <div className="pointer-events-none absolute -bottom-3 left-8 h-9 w-9 rounded-full bg-cp-purple-500/75 shadow-lg shadow-cp-purple-500/30" />
            </section>
          </section>

          {/* Trust / stat strip */}
          <section className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-brand-100 bg-brand-100/60 sm:grid-cols-4">
            {[
              { big: "73+", label: { ro: "imagini licențiate", en: "licensed photos" } },
              { big: "5", label: { ro: "dificultăți", en: "difficulty levels" } },
              { big: "6", label: { ro: "echipe colorate", en: "colour teams" } },
              { big: "24h", label: { ro: "camere active", en: "room lifetime" } },
            ].map((s) => (
              <div key={s.big} className="bg-white px-5 py-5 text-center">
                <div className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">{s.big}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><T value={s.label as Bilingual} /></div>
              </div>
            ))}
          </section>

          {/* Features */}
          <section className="mt-20">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[.22em] text-brand-700"><T value={{ ro: "Flow", en: "Flow" }} /></div>
              <h2 className="font-display mt-2 text-3xl font-extrabold text-ink-900 sm:text-4xl"><T value={{ ro: "Un parcurs scurt, trei pași", en: "One short journey, three steps" }} /></h2>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {FEATURES.map((feature, i) => (
                <article key={feature.title.en} className="group relative overflow-hidden rounded-[28px] border border-brand-100 bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pop">
                  <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${feature.tint} blur-xl transition duration-300 group-hover:scale-125`} aria-hidden />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl shadow-sm">{feature.icon}</div>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-[.18em] text-brand-400">0{i + 1}</div>
                  <h3 className="font-display mt-1 text-lg font-bold text-ink-900"><T value={feature.title} /></h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600"><T value={feature.text} /></p>
                </article>
              ))}
            </div>
          </section>

          {/* Letter canvas showcase */}
          <section className="mt-16 overflow-hidden rounded-[30px] border border-cp-purple-200 bg-gradient-to-br from-cp-purple-50 via-white to-cp-pink-50 px-6 py-7 sm:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-extrabold text-cp-purple-700"><T value={{ ro: "Canvas de litere cu Joker", en: "Letter Canvas with a Joker" }} /></h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-700">
                  <T value={{ ro: "Litere împrăștiate jos, câte o bancă per echipă și un Joker surpriză pentru fiecare echipă.", en: "Scattered letters below, a bank per team, plus a surprise Joker for each team." }} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-cp-purple-200 bg-white px-3 py-1.5 text-xs font-bold text-cp-purple-700 shadow-sm">🃏 Joker</span>
                <span className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm">✍️ Litere</span>
              </div>
            </div>
          </section>

          <section id="privacy" className="mt-16 grid gap-4 text-sm text-ink-700 sm:grid-cols-2">
            <div className="rounded-[26px] border border-brand-100 bg-white p-5">
              <b className="text-ink-900"><T value={{ ro: "Confidențialitate", en: "Privacy" }} /></b>
              <p className="mt-2 leading-relaxed"><T value={{ ro: "Fără cont. Răspunsurile Compass rămân private. Camerele expiră după 24 h.", en: "No account. Compass answers stay private. Rooms expire after 24h." }} /></p>
            </div>
            <div id="terms" className="rounded-[26px] border border-brand-100 bg-white p-5">
              <b className="text-ink-900"><T value={{ ro: "Utilizare", en: "Use" }} /></b>
              <p className="mt-2 leading-relaxed"><T value={{ ro: "Compass este un exercițiu educațional, nu o evaluare medicală.", en: "Compass is an educational exercise, not a medical assessment." }} /></p>
            </div>
          </section>
        </main>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-brand-100 py-7 text-xs text-ink-500 sm:flex-row">
          <span>© 2026 PuzzleTogether <span className="ml-1 font-bold uppercase tracking-[.15em] text-brand-700">by Coaching Partners</span></span>
          <div className="flex gap-4">
            <a href="#privacy" className="hover:text-brand-700">Privacy</a>
            <a href="#terms" className="hover:text-brand-700">Terms</a>
            <a href="mailto:hello@puzzletogether.app" className="hover:text-brand-700">Contact</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
