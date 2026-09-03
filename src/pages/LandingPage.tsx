import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, T, type Bilingual } from "../lib/i18n";

const FEATURES: Array<{ icon: string; title: Bilingual; text: Bilingual }> = [
  { icon: "🧩", title: { ro: "Joacă pe bune", en: "Play for real" }, text: { ro: "Jigsaw multiplayer cu claim pe piesă și ranking-uri unde echipa își construiește propria ordine.", en: "Multiplayer jigsaws with piece claiming, plus rankings where the team builds its own order." } },
  { icon: "🎛", title: { ro: "Facilitează discret", en: "Facilitate quietly" }, text: { ro: "Lobby, Start, lock, timer, reveal, rol spectator și control al participanților — toate în aceeași cameră.", en: "Lobby, Start, lock, timer, reveal, spectator role and people controls — all in the same room." } },
  { icon: "🌾", title: { ro: "Pleacă cu o decizie", en: "Leave with a decision" }, text: { ro: "Debrief capturat, trei insight-uri, acțiuni cu owner și recapitulare JSON sau PDF printabilă.", en: "Captured debrief, three insights, owned actions, and a JSON or print-ready PDF recap." } },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0d1a] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(48rem 28rem at 14% 12%,rgba(14,165,233,.18),transparent 65%),radial-gradient(42rem 26rem at 88% 10%,rgba(168,85,247,.16),transparent 60%),radial-gradient(44rem 28rem at 50% 100%,rgba(16,185,129,.14),transparent 65%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(148,163,184,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.08) 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex items-center justify-between py-5"><Logo dark /><div className="flex items-center gap-2"><LangToggle dark /><button className="btn btn-dark btn-sm" onClick={() => navigate("/join")}><T value={{ ro: "Intră", en: "Join" }} /></button></div></header>
        <main className="py-12 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <section className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-200">Team workshop game · no participant accounts</div>
              <h1 className="font-display mt-7 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl"><T value={{ ro: "Jucați împreună. Plecați cu o decizie.", en: "Play together. Leave with a decision." }} /></h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-300 sm:text-xl"><T value={{ ro: "Încălzește echipa cu un puzzle sau ranking, blochează jocul la momentul potrivit, apoi transformă discuția în insight-uri și acțiuni exportabile.", en: "Warm up with a puzzle or team ranking, freeze play at the right moment, then turn the conversation into exportable insights and actions." }} /></p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button className="btn-primary w-full sm:w-auto" onClick={() => navigate("/create")}><T value={{ ro: "Creează o sesiune", en: "Create a session" }} /> →</button><button className="btn w-full border border-white/15 bg-white/5 px-6 py-3.5 text-white hover:bg-white/10 sm:w-auto" onClick={() => navigate("/join")}><T value={{ ro: "Intră cu un cod", en: "Join with a code" }} /></button></div>
              <div className="mt-8 flex flex-wrap gap-4 text-xs text-ink-400"><span>✓ <T value={{ ro: "Lobby controlat", en: "Controlled lobby" }} /></span><span>✓ <T value={{ ro: "3–8 pentru coaching", en: "3–8 for coaching" }} /></span><span>✓ <T value={{ ro: "Camere recuperabile 24h", en: "24h recoverable rooms" }} /></span></div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[.04] p-4 shadow-pop backdrop-blur animate-fade-up">
              <div className="rounded-[24px] border border-white/10 bg-ink-900/90 p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">Live facilitator view</div><h2 className="font-display mt-1 text-lg font-bold">Team alignment workshop</h2></div><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">● 6 connected</span></div>
                <div className="mt-5 grid grid-cols-5 gap-2">{["Lobby", "Brief", "Play", "Reveal", "Harvest"].map((stage, index) => <div key={stage} className={`rounded-xl px-2 py-2 text-center text-[10px] font-bold ${index === 2 ? "bg-brand-500 text-white" : "bg-white/5 text-ink-400"}`}>{stage}</div>)}</div>
                <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-xs text-ink-400">Board</div><div className="mt-2 text-lg font-bold text-emerald-200">🔓 Open</div></div><div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-xs text-ink-400">Round timer</div><div className="mt-2 font-mono text-lg font-bold">04:32</div></div></div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-gradient-to-r from-brand-500/15 to-emerald-500/10 p-4"><div className="text-xs font-bold text-white">🌾 Harvest after play</div><div className="mt-2 grid grid-cols-3 gap-2">{["Observed", "Learned", "Try next"].map((label) => <div key={label} className="rounded-lg bg-white/5 px-2 py-3 text-center text-[10px] text-ink-300">{label}</div>)}</div></div>
              </div>
            </section>
          </div>

          <section className="mt-20"><div className="text-center"><div className="text-xs font-bold uppercase tracking-[.25em] text-brand-300">Play → Freeze → Debrief → Paper</div><h2 className="font-display mt-3 text-3xl font-extrabold"><T value={{ ro: "Un singur flow, nu încă un whiteboard gol", en: "One guided flow, not another empty whiteboard" }} /></h2></div><div className="mt-8 grid gap-4 md:grid-cols-3">{FEATURES.map((feature) => <article key={feature.title.en} className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><div className="text-3xl">{feature.icon}</div><h3 className="font-display mt-4 text-lg font-bold"><T value={feature.title} /></h3><p className="mt-2 text-sm leading-relaxed text-ink-300"><T value={feature.text} /></p></article>)}</div></section>

          <section className="mt-16 rounded-3xl border border-cyan-300/15 bg-cyan-400/[.06] p-6 sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><h2 className="font-display text-xl font-bold"><T value={{ ro: "Despre puzzle-urile cu litere", en: "About letter-tile puzzles" }} /></h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300"><T value={{ ro: "Modul actual este un jigsaw cu piese-literă. Grila liberă, validarea cuvintelor și misiunile de echipă nu sunt încă disponibile — nu le prezentăm ca funcții existente.", en: "The current mode is a letter-tile jigsaw. Free word-building, dictionary validation and team missions are not available yet — we do not present them as shipped features." }} /></p></div><span className="shrink-0 rounded-full border border-cyan-200/20 px-3 py-1.5 text-xs text-cyan-200">Roadmap, not promise</span></div></section>

          <section id="privacy" className="mt-16 grid gap-4 text-sm text-ink-400 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 p-5"><b className="text-white"><T value={{ ro: "Confidențialitate", en: "Privacy" }} /></b><p className="mt-2 leading-relaxed"><T value={{ ro: "Participanții nu au cont. Răspunsurile brute din Team Compass sunt vizibile doar persoanei care le-a dat; echipa primește doar statusul și codul profilului final. Camerele expiră după 24h de inactivitate.", en: "Participants need no account. Raw Team Compass answers are visible only to their owner; the team receives completion status and final profile code. Rooms expire after 24 hours of inactivity." }} /></p></div><div id="terms" className="rounded-2xl border border-white/10 p-5"><b className="text-white"><T value={{ ro: "Utilizare și contact", en: "Use & contact" }} /></b><p className="mt-2 leading-relaxed"><T value={{ ro: "Conținutul Compass este un instrument educațional, nu o evaluare psihometrică sau medicală. Pentru licențiere comercială, suport sau ștergerea unei sesiuni, contactați administratorul proiectului.", en: "Compass content is an educational reflection tool, not a psychometric or medical assessment. For commercial licensing, support or session deletion, contact the project administrator." }} /></p></div></section>
        </main>
        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-7 text-xs text-ink-500 sm:flex-row"><span>© 2026 PuzzleTogether</span><div className="flex gap-4"><a href="#privacy" className="hover:text-white">Privacy</a><a href="#terms" className="hover:text-white">Terms</a><a href="mailto:hello@puzzletogether.app" className="hover:text-white">Contact</a></div></footer>
      </div>
    </div>
  );
}
