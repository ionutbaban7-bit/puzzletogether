import { type MouseEvent } from "react";
import { navigate } from "../lib/router";
import { Logo } from "../components/ui";
import { LangToggle, useLang } from "../lib/i18n";

const HUB = "https://coaching-path.onrender.com";
function follow(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.pathname + event.currentTarget.search);
}

export default function LandingPage() {
  const { lang } = useLang();
  const ro = lang === "ro";
  const hub = (page = "") => `${HUB}/${page}?lang=${lang}`;
  const activities = [
    { n: "01", title: ro ? "Construim împreună" : "Build together", tag: ro ? "PUZZLE · ECHIPĂ" : "PUZZLE · TEAM", text: ro ? "Picturi celebre, peisaje și locuri cunoscute. Alegeți imaginea și numărul de piese, apoi jucați în aceeași cameră." : "Famous paintings, landscapes and landmarks. Choose a picture and piece count, then play in the same room.", href: "/create?activity=puzzle", cta: ro ? "Alege un puzzle" : "Choose a puzzle" },
    { n: "02", title: ro ? "Luăm o decizie" : "Make a decision", tag: ro ? "SCENARII · ECHIPĂ" : "SCENARIOS · TEAM", text: ro ? "Comparați perspective, negociați priorități și discutați cum ați ajuns la alegerea comună." : "Compare perspectives, negotiate priorities and discuss how you reached your shared choice.", href: "/create?activity=coaching", cta: ro ? "Explorează scenariile" : "Explore scenarios" },
    { n: "03", title: ro ? "Cum suntem azi?" : "How are we today?", tag: ro ? "EMOȚII · ECHIPĂ" : "EMOTIONS · TEAM", text: ro ? "Un check-in ghidat în Camera Mare. Fiecare alege cât împărtășește și poate spune «pas»." : "A guided check-in in the Great Room. Everyone chooses how much to share and may pass.", href: "/create?activity=emotions", cta: ro ? "Pregătește check-in-ul" : "Set up a check-in" },
    { n: "04", title: ro ? "Un moment pentru mine" : "A moment for myself", tag: ro ? "REFLECȚIE · INDIVIDUAL" : "REFLECTION · SOLO", text: ro ? "Explorează harta emoțiilor, numește ce simți și alege un pas potrivit pentru tine." : "Explore the emotion map, name what you feel and choose a next step that fits.", href: "/emotii", cta: ro ? "Deschide harta" : "Open the map" },
  ];
  return (
    <div className="landing-page min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">{ro ? "Sari la conținut" : "Skip to content"}</a>
      <header className="studio-wrap flex flex-wrap items-center justify-between gap-4 border-b border-g-line py-5">
        <a href="/" onClick={follow} aria-label="PuzzleTogether"><Logo dark size={36} /></a>
        <nav aria-label={ro ? "Navigare principală" : "Main navigation"} className="flex flex-wrap items-center gap-5 text-sm text-g-sub">
          <a href="/create?activity=puzzle" onClick={follow} className="hidden hover:text-brand-600 sm:inline">{ro ? "Puzzle-uri" : "Puzzles"}</a>
          <a href="#how-to-play" className="hidden font-semibold text-brand-600 sm:inline">{ro ? "Cum jucăm" : "How to play"}</a>
          <LangToggle />
        </nav>
      </header>
      <main id="main">
        <section className="studio-wrap grid items-center gap-10 py-12 md:grid-cols-[1.15fr_1fr] md:gap-16 md:py-20">
          <div>
            <p className="studio-kicker mb-7">{ro ? "PUZZLE ONLINE · PRIETENI ȘI ECHIPE" : "ONLINE PUZZLES · FRIENDS AND TEAMS"}</p>
            <h1 className="studio-heading text-[48px] sm:text-[64px] lg:text-[76px]">{ro ? "Piesă cu piesă." : "Piece by piece."}<br /><span className="text-brand-600">{ro ? "Împreună." : "Together."}</span></h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-g-sub sm:text-lg">{ro ? "Alegeți o imagine, trimiteți linkul și construiți împreună. Cu prietenii, cu familia sau cu echipa." : "Choose a picture, share the link and build it together. With friends, family or your team."}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/create?activity=puzzle" onClick={follow} className="btn-primary">{ro ? "Alege un puzzle" : "Choose a puzzle"}<span aria-hidden>→</span></a>
              <a href="/join" onClick={follow} className="btn-secondary">{ro ? "Intră cu un cod" : "Join with a code"}</a>
            </div>
            <p className="mt-5 text-xs text-g-faint">{ro ? "Fără cont · Până la 20 de persoane · RO / EN" : "No account · Up to 20 people · RO / EN"}</p>
          </div>
          <figure className="relative">
            <img src="/images/full/great-wave.webp" alt={ro ? "Marele val de la Kanagawa, de Katsushika Hokusai" : "The Great Wave off Kanagawa, by Katsushika Hokusai"} className="studio-hero-image" />
            <figcaption className="mt-4 border-l border-brand-300 pl-4 text-white"><p className="font-display text-2xl">{ro ? "Fiecare vede o piesă. Împreună, imaginea." : "Each sees a piece. Together, the picture."}</p><p className="mt-2 text-xs text-ink-200">{ro ? "Hokusai · Marele val de la Kanagawa · Domeniu public" : "Hokusai · The Great Wave off Kanagawa · Public domain"}</p></figcaption>
          </figure>
        </section>
        <section className="studio-wrap border-t border-g-line py-12 sm:py-16" aria-labelledby="activities-title">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="studio-kicker mb-3">{ro ? "ALEGE INTENȚIA" : "CHOOSE YOUR INTENTION"}</p><h2 id="activities-title" className="studio-heading text-4xl sm:text-5xl">{ro ? "De unde începem?" : "Where do we begin?"}</h2></div><a href="/create" onClick={follow} className="text-sm font-semibold text-brand-600">{ro ? "Toate activitățile →" : "All activities →"}</a></div>
          <div className="grid gap-4 sm:grid-cols-2">{activities.map(a => <a key={a.n} href={a.href} onClick={follow} className="studio-activity"><div className="flex justify-between gap-4"><span className="studio-kicker">{a.tag}</span><span className="font-display text-xl text-g-faint">{a.n}</span></div><h3 className="font-display mt-5 text-3xl tracking-tight">{a.title}</h3><p className="mb-7 mt-3 max-w-lg text-sm leading-relaxed text-g-sub">{a.text}</p><span className="mt-auto text-sm font-semibold text-brand-600">{a.cta} <span aria-hidden>→</span></span></a>)}</div>
        </section>
        <section id="how-to-play" className="studio-wrap border-t border-g-line py-12 sm:py-16" aria-labelledby="how-title">
          <p className="studio-kicker">{ro ? "TREI PAȘI SIMPLI" : "THREE SIMPLE STEPS"}</p>
          <h2 id="how-title" className="studio-heading mt-4 text-4xl">{ro ? "O cameră. Toți la aceeași masă." : "One room. Everyone at the same table."}</h2>
          <div className="mt-9 grid gap-7 md:grid-cols-3">{[
            [ro ? "01 / Alege" : "01 / Choose", ro ? "Imaginea, dificultatea și un nume pentru cameră. Poți schimba alegerea înainte de Start." : "The picture, difficulty and a room name. You can change your choices before Start."],
            [ro ? "02 / Invită" : "02 / Invite", ro ? "Trimite linkul sau codul. Prietenii intră cu un nume, fără cont." : "Share the link or code. Friends join with a name, without an account."],
            [ro ? "03 / Joacă" : "03 / Play", ro ? "Gazda apasă Start când sunteți gata. Mutați piesele împreună, în timp real." : "The host presses Start when everyone is ready. Move pieces together, in real time."],
          ].map(([title,description]) => <div key={title} className="border-t border-g-line pt-5"><h3 className="font-display text-2xl">{title}</h3><p className="mt-3 text-sm leading-relaxed text-g-sub">{description}</p></div>)}</div>
        </section>
      </main>
      <footer className="studio-wrap flex flex-wrap items-start justify-between gap-6 py-9 text-sm text-g-sub">
        <div><Logo /><p className="mt-2 text-xs">{ro ? "Puzzle-uri și activități de jucat împreună." : "Puzzles and activities to play together."}</p></div>
        <div className="flex flex-wrap gap-x-6 gap-y-3"><a href={hub()}>{ro ? "Explorează CoachingHub" : "Explore CoachingHub"}</a><a href={hub("legal.html")}>{ro ? "Confidențialitate" : "Privacy"}</a></div>
      </footer>
    </div>
  );
}
