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
    { n: "01", title: ro ? "Construim împreună" : "Build together", tag: ro ? "PUZZLE · ECHIPĂ" : "PUZZLE · TEAM", text: ro ? "O imagine comună. Observați cum cereți ajutor, împărțiți sarcinile și vă coordonați." : "One shared picture. Notice how you ask for help, share tasks and coordinate.", href: "/create?activity=puzzle", cta: ro ? "Alege un puzzle" : "Choose a puzzle" },
    { n: "02", title: ro ? "Luăm o decizie" : "Make a decision", tag: ro ? "SCENARII · ECHIPĂ" : "SCENARIOS · TEAM", text: ro ? "Comparați perspective, negociați priorități și discutați cum ați ajuns la alegerea comună." : "Compare perspectives, negotiate priorities and discuss how you reached your shared choice.", href: "/create?activity=coaching", cta: ro ? "Explorează scenariile" : "Explore scenarios" },
    { n: "03", title: ro ? "Cum suntem azi?" : "How are we today?", tag: ro ? "EMOȚII · ECHIPĂ" : "EMOTIONS · TEAM", text: ro ? "Un check-in ghidat în Camera Mare. Fiecare alege cât împărtășește și poate spune «pas»." : "A guided check-in in the Great Room. Everyone chooses how much to share and may pass.", href: "/create?activity=emotions", cta: ro ? "Pregătește check-in-ul" : "Set up a check-in" },
    { n: "04", title: ro ? "Un moment pentru mine" : "A moment for myself", tag: ro ? "REFLECȚIE · INDIVIDUAL" : "REFLECTION · SOLO", text: ro ? "Explorează harta emoțiilor, numește ce simți și alege un pas potrivit pentru tine." : "Explore the emotion map, name what you feel and choose a next step that fits.", href: "/emotii", cta: ro ? "Deschide harta" : "Open the map" },
  ];
  return (
    <div className="landing-page min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">{ro ? "Sari la conținut" : "Skip to content"}</a>
      <header className="studio-wrap flex flex-wrap items-center justify-between gap-4 border-b border-g-line py-5">
        <a href={hub()} aria-label="CoachingHub"><span className="font-display text-2xl font-bold tracking-tight">coaching<span className="font-normal">hub.ro</span></span></a>
        <nav aria-label={ro ? "Navigare principală" : "Main navigation"} className="flex flex-wrap items-center gap-5 text-sm text-g-sub">
          <a href={hub("invata.html")} className="hover:text-brand-600">{ro ? "Practică" : "Practice"}</a>
          <a href="/" onClick={follow} aria-current="page" className="font-semibold text-brand-600">{ro ? "Ateliere" : "Workshops"}</a>
          <a href={hub("resurse.html")} className="hidden hover:text-brand-600 sm:inline">{ro ? "Bibliotecă" : "Library"}</a>
          <LangToggle />
        </nav>
      </header>
      <main id="main">
        <section className="studio-wrap grid items-center gap-10 py-12 md:grid-cols-[1.15fr_1fr] md:gap-16 md:py-20">
          <div>
            <p className="studio-kicker mb-7">PuzzleTogether · {ro ? "Ateliere CoachingHub" : "CoachingHub workshops"}</p>
            <h1 className="studio-heading text-[48px] sm:text-[64px] lg:text-[76px]">{ro ? "Un joc împreună." : "A game together."}<br /><span className="text-brand-600">{ro ? "O conversație utilă." : "A useful conversation."}</span></h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-g-sub sm:text-lg">{ro ? "Jocuri colaborative și exerciții ghidate pentru echipe. Creezi o sesiune, trimiți codul și începeți." : "Collaborative games and guided exercises for teams. Create a session, share the code and begin."}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/create" onClick={follow} className="btn-primary">{ro ? "Creează o sesiune" : "Create a session"}<span aria-hidden>→</span></a>
              <a href="/join" onClick={follow} className="btn-secondary">{ro ? "Am un cod" : "I have a code"}</a>
            </div>
            <p className="mt-5 text-xs text-g-faint">{ro ? "Fără cont · Până la 20 de persoane · RO / EN" : "No account · Up to 20 people · RO / EN"}</p>
          </div>
          <figure className="relative">
            <img src="/images/full/carpathian-beech-forest.webp" alt={ro ? "Pădure de fag din Carpați, din colecția de puzzle-uri" : "Carpathian beech forest from the puzzle collection"} className="studio-hero-image" fetchPriority="high" />
            <figcaption className="absolute bottom-5 left-5 right-5 border border-white/20 bg-ink-950/90 px-5 py-4 text-white backdrop-blur-sm"><p className="font-display text-2xl">{ro ? "Fiecare vede o piesă. Împreună, imaginea." : "Each sees a piece. Together, the picture."}</p><p className="mt-2 text-xs text-ink-200">{ro ? "Din colecția de puzzle-uri pentru echipe" : "From the team puzzle collection"}</p></figcaption>
          </figure>
        </section>
        <section className="studio-wrap border-t border-g-line py-12 sm:py-16" aria-labelledby="activities-title">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="studio-kicker mb-3">{ro ? "ALEGE INTENȚIA" : "CHOOSE YOUR INTENTION"}</p><h2 id="activities-title" className="studio-heading text-4xl sm:text-5xl">{ro ? "De unde începem?" : "Where do we begin?"}</h2></div><a href="/create" onClick={follow} className="text-sm font-semibold text-brand-600">{ro ? "Toate activitățile →" : "All activities →"}</a></div>
          <div className="grid gap-4 sm:grid-cols-2">{activities.map(a => <a key={a.n} href={a.href} onClick={follow} className="studio-activity"><div className="flex justify-between gap-4"><span className="studio-kicker">{a.tag}</span><span className="font-display text-xl text-g-faint">{a.n}</span></div><h3 className="font-display mt-5 text-3xl tracking-tight">{a.title}</h3><p className="mb-7 mt-3 max-w-lg text-sm leading-relaxed text-g-sub">{a.text}</p><span className="mt-auto text-sm font-semibold text-brand-600">{a.cta} <span aria-hidden>→</span></span></a>)}</div>
        </section>
        <section className="bg-ink-950 py-12 text-white sm:py-16" aria-labelledby="facilitation-title"><div className="studio-wrap">
          <p className="text-xs uppercase tracking-[.16em] text-brand-300">{ro ? "PENTRU FACILITATOR" : "FOR THE FACILITATOR"}</p><h2 id="facilitation-title" className="studio-heading mt-4 max-w-2xl text-4xl sm:text-5xl">{ro ? "Jocul deschide conversația. Tu îi dai sens." : "The game starts a conversation. You give it meaning."}</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">{[
            [ro ? "01 / Intenție" : "01 / Intention", ro ? "Ce vrem să observăm la felul în care lucrăm împreună?" : "What do we want to notice about how we work together?"],
            [ro ? "02 / Experiență" : "02 / Experience", ro ? "Cine nu s-a auzit încă? Invită o perspectivă, fără să forțezi participarea." : "Whose voice have we not heard yet? Invite a perspective without forcing participation."],
            [ro ? "03 / Transfer" : "03 / Transfer", ro ? "Ce încercăm la următoarea întâlnire? Notați o acțiune, un responsabil și un termen." : "What will we try at our next meeting? Record an action, an owner and a date."],
          ].map(([title,text]) => <div key={title} className="border-t border-white/20 pt-5"><h3 className="font-display text-2xl">{title}</h3><p className="mt-3 text-sm leading-relaxed text-ink-200">{text}</p></div>)}</div>
          <p className="mt-8 text-xs leading-relaxed text-ink-300">{ro ? "Exerciții pentru conversație și învățare. Nu sunt evaluări psihologice; rezultatele jocului nu măsoară performanța profesională." : "Exercises for conversation and learning. They are not psychological assessments; game results do not measure job performance."}</p>
        </div></section>
      </main>
      <footer className="studio-wrap flex flex-wrap items-start justify-between gap-6 py-9 text-sm text-g-sub">
        <div><Logo /><p className="mt-2 text-xs">{ro ? "Un spațiu de practică din CoachingHub." : "A practice space within CoachingHub."}</p></div>
        <div className="flex flex-wrap gap-x-6 gap-y-3"><a href={hub()}>{ro ? "Înapoi la CoachingHub" : "Back to CoachingHub"}</a><a href="https://coaching-hub-1.onrender.com/">Clarity Express</a><a href={hub("legal.html")}>{ro ? "Confidențialitate" : "Privacy"}</a></div>
      </footer>
    </div>
  );
}
