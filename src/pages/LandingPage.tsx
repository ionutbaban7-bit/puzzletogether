import { Logo } from "../components/ui";
import { LangToggle, useLang } from "../lib/i18n";
import { navigate } from "../lib/router";

const GALLERY = [
  { src: "/images/thumbs/great-wave.webp", ro: "Marele Val", en: "The Great Wave" },
  { src: "/images/thumbs/starry-night.webp", ro: "Noapte înstelată", en: "The Starry Night" },
  { src: "/images/thumbs/mona-lisa.webp", ro: "Mona Lisa", en: "Mona Lisa" },
  { src: "/images/thumbs/colosseum.webp", ro: "Colosseum", en: "Colosseum" },
  { src: "/images/thumbs/machu-picchu.webp", ro: "Machu Picchu", en: "Machu Picchu" },
  { src: "/images/thumbs/bucharest-calea-victoriei.webp", ro: "Calea Victoriei", en: "Calea Victoriei" },
];

export default function LandingPage() {
  const { lang } = useLang();
  const ro = lang === "ro";

  return (
    <div className="landing-page pt-home min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3 focus:text-black">
        {ro ? "Sari la conținut" : "Skip to content"}
      </a>

      <header className="pt-home-nav">
        <div className="pt-home-wrap flex items-center justify-between gap-4 py-4">
          <button onClick={() => navigate("/")} aria-label="PuzzleTogether" className="pt-home-logo">
            <Logo dark size={36} />
          </button>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label={ro ? "Navigare principală" : "Main navigation"}>
            <button className="pt-home-navlink hidden sm:inline-flex" onClick={() => document.getElementById("colectie")?.scrollIntoView()}>
              {ro ? "Colecție" : "Collection"}
            </button>
            <button className="pt-home-navlink hidden md:inline-flex" onClick={() => document.getElementById("cum-jucam")?.scrollIntoView()}>
              {ro ? "Cum jucăm" : "How it works"}
            </button>
            <LangToggle />
            <button className="pt-home-nav-cta" onClick={() => navigate("/join")}>
              {ro ? "Intră în joc" : "Join a game"}
            </button>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="pt-home-hero">
          <div className="pt-home-wrap grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:py-24">
            <div className="pt-home-copy">
              <p className="pt-home-kicker">{ro ? "PUZZLE ONLINE · ÎMPREUNĂ, ÎN TIMP REAL" : "ONLINE PUZZLES · TOGETHER, IN REAL TIME"}</p>
              <h1 className="pt-home-title">
                {ro ? "Piesă cu piesă." : "Piece by piece."}
                <br />
                <span>{ro ? "Împreună." : "Together."}</span>
              </h1>
              <p className="pt-home-lead">
                {ro
                  ? "Alege o imagine, invită oamenii tăi și construiți același puzzle de pe telefon sau desktop. Simplu pentru familie și prieteni, suficient de bine gândit pentru echipe."
                  : "Choose a picture, invite your people and build the same puzzle from phone or desktop. Simple for family and friends, polished enough for teams."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn-primary pt-home-main-cta" onClick={() => navigate("/create")}>
                  {ro ? "Creează un puzzle" : "Create a puzzle"}
                  <span aria-hidden>→</span>
                </button>
                <button className="btn-secondary" onClick={() => navigate("/join")}>
                  {ro ? "Am deja un cod" : "I have a code"}
                </button>
              </div>
              <div className="pt-home-trust mt-7">
                <span>{ro ? "Fără cont" : "No account"}</span>
                <span>{ro ? "Până la 25 jucători" : "Up to 25 players"}</span>
                <span>{ro ? "Telefon + desktop" : "Phone + desktop"}</span>
                <span>RO / EN</span>
              </div>
            </div>

            <div className="pt-home-stage" aria-label={ro ? "Exemplu de puzzle colaborativ" : "Collaborative puzzle preview"}>
              <div className="pt-home-stage-glow" aria-hidden />
              <figure className="pt-home-main-image">
                <img src="/images/full/great-wave.webp" alt={ro ? "Marele Val de la Kanagawa" : "The Great Wave off Kanagawa"} />
              </figure>
              <div className="pt-home-floating-card pt-home-floating-card-a" aria-hidden>
                <span className="pt-home-avatar">IB</span>
                <span><strong>+1</strong><small>{ro ? "piesă așezată" : "piece placed"}</small></span>
              </div>
              <div className="pt-home-floating-card pt-home-floating-card-b" aria-hidden>
                <span className="pt-home-live-dot" />
                <span><strong>{ro ? "4 conectați" : "4 connected"}</strong><small>02:18</small></span>
              </div>
              <div className="pt-home-piece pt-home-piece-1" aria-hidden />
              <div className="pt-home-piece pt-home-piece-2" aria-hidden />
              <div className="pt-home-piece pt-home-piece-3" aria-hidden />
            </div>
          </div>
        </section>

        <section id="colectie" className="pt-home-section scroll-mt-24">
          <div className="pt-home-wrap">
            <div className="pt-home-section-head">
              <div>
                <p className="pt-home-kicker">{ro ? "COLECȚIE CURATĂ" : "CURATED COLLECTION"}</p>
                <h2>{ro ? "Imagini pe care le recunoști instant." : "Pictures you recognize instantly."}</h2>
              </div>
              <p>
                {ro
                  ? "Artă, locuri iconice, natură și repere culturale. Plus fotografia ta, dacă vrei ceva personal."
                  : "Art, iconic places, nature and cultural landmarks. Or use your own photo when you want something personal."}
              </p>
            </div>

            <div className="pt-home-gallery">
              {GALLERY.map((item, index) => (
                <button key={item.src} className="pt-home-gallery-card" onClick={() => navigate("/create")} aria-label={(ro ? "Alege " : "Choose ") + (ro ? item.ro : item.en)}>
                  <img src={item.src} alt="" loading={index < 2 ? "eager" : "lazy"} />
                  <span>{ro ? item.ro : item.en}</span>
                </button>
              ))}
            </div>
            <div className="pt-home-gallery-foot">
              <span>{ro ? "48 de imagini în bibliotecă" : "48 images in the library"}</span>
              <button onClick={() => navigate("/create")}>{ro ? "Vezi toate imaginile" : "See all pictures"} →</button>
            </div>
          </div>
        </section>

        <section id="cum-jucam" className="pt-home-section pt-home-section-soft scroll-mt-24">
          <div className="pt-home-wrap">
            <div className="mx-auto max-w-2xl text-center">
              <p className="pt-home-kicker">{ro ? "FĂRĂ SETUP COMPLICAT" : "NO COMPLICATED SETUP"}</p>
              <h2 className="pt-home-center-title">{ro ? "De la link la joc în trei pași." : "From link to game in three steps."}</h2>
            </div>
            <div className="pt-home-steps">
              {[
                {
                  n: "01",
                  title: ro ? "Alegi imaginea" : "Choose the picture",
                  text: ro ? "Selectezi puzzle-ul, numărul de piese sau încarci o fotografie personală." : "Pick a puzzle, piece count or upload a personal photo.",
                },
                {
                  n: "02",
                  title: ro ? "Trimiți invitația" : "Share the invite",
                  text: ro ? "Prietenii sau colegii intră cu un nume. Fără cont și fără instalare." : "Friends or colleagues join with a display name. No account or install.",
                },
                {
                  n: "03",
                  title: ro ? "Construiți împreună" : "Build together",
                  text: ro ? "Aceeași tablă, progres comun, timer, chat și rezultat vizibil pentru toată lumea." : "One board, shared progress, timer, chat and a finish everyone sees.",
                },
              ].map((step) => (
                <article key={step.n} className="pt-home-step">
                  <span>{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pt-home-section">
          <div className="pt-home-wrap grid gap-8 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:gap-16">
            <div>
              <p className="pt-home-kicker">{ro ? "PENTRU GRUPURI REALE" : "FOR REAL GROUPS"}</p>
              <h2>{ro ? "Jocul rămâne simplu. Gazda primește controlul de care are nevoie." : "The game stays simple. The host gets the controls that matter."}</h2>
              <p className="pt-home-section-copy">
                {ro
                  ? "Poți opri jocul pentru toți, reporni tabla, schimba imaginea sau nivelul și păstra același grup în cameră. Chatul rămâne lângă joc, nu într-o aplicație separată."
                  : "Pause everyone, reset the board, change the picture or level and keep the same group in the room. Chat stays next to the game instead of living in another app."}
              </p>
              <button className="pt-home-text-cta" onClick={() => navigate("/create")}>
                {ro ? "Pornește o cameră" : "Start a room"} <span aria-hidden>→</span>
              </button>
            </div>
            <div className="pt-home-features">
              {[
                ["💬", ro ? "Chat în cameră" : "Room chat", ro ? "Conversația rămâne în contextul jocului." : "Conversation stays in the context of the game."],
                ["⏱", ro ? "Timer comun" : "Shared timer", ro ? "Pauza oprește timpul pentru toată lumea." : "Pause stops the clock for everyone."],
                ["↻", ro ? "Reset și nivel următor" : "Reset and next level", ro ? "Continui cu același grup, fără link nou." : "Keep the same group without a new link."],
                ["🏆", ro ? "Podium opțional" : "Optional podium", ro ? "Activezi competiția doar când se potrivește grupului." : "Turn competition on only when it fits the group."],
              ].map(([icon, title, text]) => (
                <article className="pt-home-feature" key={title}>
                  <span aria-hidden>{icon}</span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pt-home-section pt-home-privacy">
          <div className="pt-home-wrap grid gap-7 md:grid-cols-2">
            <div>
              <p className="pt-home-kicker">{ro ? "FOTOGRAFII PERSONALE" : "PERSONAL PHOTOS"}</p>
              <h2>{ro ? "Ce e personal rămâne temporar." : "Personal stays temporary."}</h2>
            </div>
            <div className="pt-home-privacy-copy">
              <p>
                {ro
                  ? "Fotografia încărcată este privată și are termen fix de ștergere: o oră de la upload. Schimbarea dificultății sau reluarea jocului nu pornește cronometrul de la zero."
                  : "Your uploaded photo is private and has a fixed deletion deadline: one hour from upload. Changing difficulty or replaying does not restart that clock."}
              </p>
              <p>
                {ro
                  ? "Camerele folosesc invitații private, iar participanții intră fără cont."
                  : "Rooms use private invitations and participants join without an account."}
              </p>
            </div>
          </div>
        </section>

        <section className="pt-home-final">
          <div className="pt-home-wrap text-center">
            <p className="pt-home-kicker">{ro ? "GATA DE O PRIMĂ RUNDĂ?" : "READY FOR A FIRST ROUND?"}</p>
            <h2>{ro ? "Alege imaginea. Trimite linkul. Restul se întâmplă împreună." : "Choose the picture. Share the link. The rest happens together."}</h2>
            <button className="btn-primary mt-7" onClick={() => navigate("/create")}>
              {ro ? "Pornește acum" : "Start now"} <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="pt-home-footer">
        <div className="pt-home-wrap flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div><Logo dark size={34} /><p>{ro ? "Un puzzle. O cameră. Împreună." : "One puzzle. One room. Together."}</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button onClick={() => document.getElementById("colectie")?.scrollIntoView()}>{ro ? "Colecție" : "Collection"}</button>
            <button onClick={() => document.getElementById("cum-jucam")?.scrollIntoView()}>{ro ? "Cum jucăm" : "How it works"}</button>
            <button onClick={() => navigate("/join")}>{ro ? "Intră în joc" : "Join"}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
