import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, T, type Bilingual } from "../lib/i18n";

const FEATURES: Array<{ icon: string; title: Bilingual; text: Bilingual }> = [
  { icon: "🧩", title: { ro: "Jucați", en: "Play" }, text: { ro: "Puzzle-uri împreună.", en: "Solve together." } },
  { icon: "🎛", title: { ro: "Facilitați", en: "Facilitate" }, text: { ro: "Lobby, Start, timer.", en: "Lobby, Start, timer." } },
  { icon: "📝", title: { ro: "Notați", en: "Capture" }, text: { ro: "Idei și acțiuni.", en: "Ideas and actions." } },
];

export default function LandingPage() {
  return (
    <div className="marketing-page">
      <div aria-hidden className="marketing-orb -left-24 top-24 h-72 w-72 bg-cp-pink-300/45" />
      <div aria-hidden className="marketing-orb -right-24 top-12 h-80 w-80 bg-cp-purple-300/45" />
      <div aria-hidden className="marketing-orb bottom-12 left-[42%] h-32 w-32 bg-brand-300/35" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex items-start justify-between py-5 sm:py-7">
          <div>
            <button onClick={() => navigate("/")} aria-label="PuzzleTogether home"><Logo /></button>
            <div className="ml-[45px] mt-0.5 text-[9px] font-bold uppercase tracking-[0.21em] text-brand-700">by Coaching Partners</div>
          </div>
          <div className="flex items-center gap-2"><LangToggle /><button className="btn-secondary btn-sm" onClick={() => navigate("/join")}><T value={{ ro: "Intră", en: "Join" }} /></button></div>
        </header>

        <main className="pb-16 pt-10 sm:pb-24 sm:pt-16">
          <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
            <div className="animate-fade-up">
              <div className="inline-flex rounded-full bg-brand-700 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-white"><T value={{ ro: "Joc de echipă", en: "Team activity" }} /></div>
              <h1 className="font-display mt-6 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight text-ink-900 sm:text-7xl"><T value={{ ro: "Jucați. Vorbiți. Decideți.", en: "Play. Talk. Decide." }} /></h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600 sm:text-xl"><T value={{ ro: "Puzzle-uri și exerciții pentru echipe.", en: "Puzzles and exercises for teams." }} /></p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button className="btn-primary w-full sm:w-auto" onClick={() => navigate("/create")}><T value={{ ro: "Creează sesiunea", en: "Create session" }} /> →</button><button className="btn-secondary w-full sm:w-auto" onClick={() => navigate("/join")}><T value={{ ro: "Intră cu un cod", en: "Join with code" }} /></button></div>
              <div className="mt-7 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-ink-600"><span>✓ <T value={{ ro: "Fără cont", en: "No account" }} /></span><span>✓ <T value={{ ro: "Lobby controlat", en: "Controlled lobby" }} /></span><span>✓ <T value={{ ro: "Camere 24 h", en: "24h rooms" }} /></span></div>
            </div>

            <section className="relative animate-fade-up rounded-[34px] border border-brand-100 bg-white p-4 shadow-pop sm:p-6">
              <div aria-hidden className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-cp-pink-500/80" />
              <div aria-hidden className="absolute -bottom-4 left-10 h-10 w-10 rounded-full bg-cp-purple-500/75" />
              <div className="relative rounded-[26px] bg-ink-950 p-5 text-white sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-300"><T value={{ ro: "Sesiune", en: "Session" }} /></div><h2 className="font-display mt-1 text-lg font-bold"><T value={{ ro: "Echipa de azi", en: "Today’s team" }} /></h2></div><span className="rounded-full bg-brand-500/20 px-3 py-1 text-xs font-bold text-brand-200">● 6 <T value={{ ro: "conectați", en: "joined" }} /></span></div>
                <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/5 px-3 py-3"><div className="text-[10px] uppercase tracking-wide text-ink-400"><T value={{ ro: "Etapă", en: "Stage" }} /></div><b className="mt-1 block text-brand-200"><T value={{ ro: "Joc", en: "Play" }} /></b></div><div className="rounded-2xl bg-white/5 px-3 py-3"><div className="text-[10px] uppercase tracking-wide text-ink-400"><T value={{ ro: "Piese", en: "Pieces" }} /></div><b className="mt-1 block">42 / 64</b></div><div className="rounded-2xl bg-white/5 px-3 py-3"><div className="text-[10px] uppercase tracking-wide text-ink-400"><T value={{ ro: "Timp", en: "Time" }} /></div><b className="mt-1 block">04:32</b></div></div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-cp-pink-500" /></div>
                <div className="mt-4 rounded-2xl bg-cp-purple-500/20 px-4 py-3 text-sm text-purple-100"><T value={{ ro: "Un rezultat comun.", en: "One shared result." }} /></div>
              </div>
            </section>
          </section>

          <section className="mt-20"><div className="text-center"><div className="text-xs font-bold uppercase tracking-[.22em] text-brand-700"><T value={{ ro: "Simplu", en: "Simple" }} /></div><h2 className="font-display mt-2 text-3xl font-extrabold text-ink-900"><T value={{ ro: "Un flow scurt", en: "One short flow" }} /></h2></div><div className="mt-7 grid gap-4 md:grid-cols-3">{FEATURES.map((feature) => <article key={feature.title.en} className="rounded-[28px] border border-brand-100 bg-white p-6 shadow-card"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-cp-purple-50 text-2xl">{feature.icon}</div><h3 className="font-display mt-4 text-lg font-bold text-ink-900"><T value={feature.title} /></h3><p className="mt-1 text-sm text-ink-600"><T value={feature.text} /></p></article>)}</div></section>

          <section className="mt-16 rounded-[30px] border border-cp-purple-100 bg-cp-purple-50 px-6 py-5 sm:px-8"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-display text-lg font-bold text-cp-purple-700"><T value={{ ro: "Canvas de litere", en: "Letter canvas" }} /></h2><p className="mt-1 text-sm text-ink-700"><T value={{ ro: "Este în lucru; arătăm doar funcțiile gata.", en: "In progress; we show only what is ready." }} /></p></div><span className="rounded-full border border-cp-purple-300 bg-white px-3 py-1.5 text-xs font-bold text-cp-purple-700">Roadmap</span></div></section>

          <section id="privacy" className="mt-16 grid gap-4 text-sm text-ink-700 sm:grid-cols-2"><div className="rounded-[26px] border border-brand-100 bg-white p-5"><b className="text-ink-900"><T value={{ ro: "Confidențialitate", en: "Privacy" }} /></b><p className="mt-2 leading-relaxed"><T value={{ ro: "Fără cont. Răspunsurile Compass rămân private. Camerele expiră după 24 h.", en: "No account. Compass answers stay private. Rooms expire after 24h." }} /></p></div><div id="terms" className="rounded-[26px] border border-brand-100 bg-white p-5"><b className="text-ink-900"><T value={{ ro: "Utilizare", en: "Use" }} /></b><p className="mt-2 leading-relaxed"><T value={{ ro: "Compass este un exercițiu educațional, nu o evaluare medicală.", en: "Compass is an educational exercise, not a medical assessment." }} /></p></div></section>
        </main>
        <footer className="flex flex-col items-center justify-between gap-3 border-t border-brand-100 py-7 text-xs text-ink-500 sm:flex-row"><span>© 2026 PuzzleTogether <span className="ml-1 font-bold uppercase tracking-[.15em] text-brand-700">by Coaching Partners</span></span><div className="flex gap-4"><a href="#privacy" className="hover:text-brand-700">Privacy</a><a href="#terms" className="hover:text-brand-700">Terms</a><a href="mailto:hello@puzzletogether.app" className="hover:text-brand-700">Contact</a></div></footer>
      </div>
    </div>
  );
}
