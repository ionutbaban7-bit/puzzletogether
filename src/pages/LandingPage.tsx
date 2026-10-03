import { Logo } from "../components/ui";
import { LangToggle, useLang } from "../lib/i18n";
import { navigate } from "../lib/router";
export default function LandingPage() {
  const { lang } = useLang();
  const ro = lang === "ro";
  return (
    <main className="marketing-page min-h-dvh px-5">
      <header className="mx-auto flex max-w-5xl items-center justify-between py-6">
        <Logo />
        <LangToggle />
      </header>
      <section className="mx-auto max-w-3xl py-16 text-center sm:py-24">
        <span className="text-6xl" aria-hidden>
          🧩
        </span>
        <h1 className="font-display mt-6 text-4xl font-extrabold text-ink-900 sm:text-6xl">
          {ro ? "Un puzzle. Împreună." : "One puzzle. Together."}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-600">
          {ro
            ? "Alege imaginea. Trimite linkul. Jucați împreună."
            : "Choose a picture. Share the link. Play together."}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <button
            className="btn-primary min-h-12"
            onClick={() => navigate("/create")}
          >
            {ro ? "Creează un puzzle" : "Create a puzzle"}
          </button>
          <button
            className="btn-secondary min-h-12"
            onClick={() => navigate("/join")}
          >
            {ro ? "Intră într-un joc" : "Join a game"}
          </button>
        </div>
        <p className="mt-6 text-sm text-ink-500">
          {ro
            ? "Fără cont · Telefon și desktop"
            : "No account · Phone and desktop"}
        </p>
      </section>
      <footer className="mx-auto max-w-3xl border-t border-ink-200 py-6 text-sm text-ink-600">
        <details>
          <summary className="cursor-pointer">
            {ro ? "Confidențialitate" : "Privacy"}
          </summary>
          <p className="mt-3">
            {ro
              ? "Salvăm numele ales și progresul jocului. Distribuie invitația doar grupului tău. Camerele inactive expiră în 24 de ore; cele goale, în 30 de minute."
              : "We save your display name and game progress. Share the invitation only with your group. Inactive rooms expire in 24 hours; empty rooms in 30 minutes."}
          </p>
        </details>
      </footer>
    </main>
  );
}
