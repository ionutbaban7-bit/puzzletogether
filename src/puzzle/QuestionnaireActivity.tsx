import { useEffect, useMemo, useState } from "react";
import { pick, T, useLang } from "../lib/i18n";
import { store, useStore } from "../store";
import type { CoachingActivity, PlayerView, PuzzleView } from "../types";

interface Props {
  puzzle: PuzzleView;
  players: PlayerView[];
  youId: string | null;
}

type Phase = "intro" | "questions" | "results";

export default function QuestionnaireActivity({ puzzle, players, youId }: Props) {
  const activity = puzzle.activity as CoachingActivity;
  const { lang } = useLang();
  const questions = activity.questions || [];
  const dims = activity.dimensions || [];
  const types = activity.types || {};
  const isSpectator = players.find((player) => player.id === youId)?.role === "spectator";

  const ratings = useStore((s) => s.ratings);
  const roomStage = useStore((s) => s.room?.stage);
  const mine = youId ? ratings[youId] : undefined;

  const [phase, setPhase] = useState<Phase>(mine?.done ? "results" : "intro");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "A" | "B">>(() => mine?.answers || {});

  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    if (roomStage === "play" && phase === "intro" && !mine?.done && !isSpectator) setPhase("questions");
  }, [roomStage, phase, mine?.done, isSpectator]);

  function answer(pole: "A" | "B") {
    const q = questions[qIndex];
    if (!q) return;
    const next = { ...answers, [q.id]: pole };
    setAnswers(next);
    const done = Object.keys(next).length >= questions.length;
    store.sendRating(next, done);
    if (done) {
      setPhase("results");
    } else {
      setQIndex((i) => Math.min(i + 1, questions.length - 1));
    }
  }

  function goBack() {
    setQIndex((i) => Math.max(0, i - 1));
  }

  const profileDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(ratings).forEach((rating) => {
      if (rating.done && rating.profileCode) counts.set(rating.profileCode, (counts.get(rating.profileCode) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [ratings]);

  const profile = useMemo(() => {
    if (Object.keys(answers).length < questions.length) return null;
    const letters: string[] = [];
    for (const dim of dims) {
      const counts = new Map<string, number>();
      for (const q of questions.filter((x) => x.dim === dim.key)) {
        const agree = answers[q.id] === "A";
        const letter = agree
          ? q.pole === "A" ? dim.poleA.letter : dim.poleB.letter
          : q.pole === "A" ? dim.poleB.letter : dim.poleA.letter;
        counts.set(letter, (counts.get(letter) || 0) + 1);
      }
      let best = dim.poleA.letter;
      let bestN = -1;
      for (const [letter, n] of counts) {
        if (n > bestN) {
          bestN = n;
          best = letter;
        }
      }
      letters.push(best);
    }
    const code = letters.join("");
    return { code, type: types[code] || null, letters };
  }, [answers, questions, dims, types]);

  // --------------------------------------------------------------- screens
  if (phase === "intro") {
    return (
      <Center>
        <div className="overlay-card max-h-[calc(100dvh-1.5rem)] w-[560px] max-w-[92vw] overflow-y-auto p-8">
          <div className="text-4xl">🧭</div>
          <h1 className="font-display mt-3 text-2xl font-bold text-white">
            <T value={activity.name} />
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            <T value={activity.description} />
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {dims.map((d) => (
              <div key={d.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-300">{d.key}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-white">
                  <T value={d.name} />
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-400">
                  {pick(d.poleA.name, lang)} · {pick(d.poleB.name, lang)}
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-5 space-y-1.5 text-[13px] text-ink-300">
            <li>· {lang === "ro" ? "20 de afirmații, răspunsuri rapide din instinct" : "20 statements, answer quickly from instinct"}</li>
            <li>· {lang === "ro" ? "Fiecare răspunde individual; la final îți vezi profilul personal" : "Everyone answers individually; you see your own profile at the end"}</li>
            <li>· {lang === "ro" ? "Echipa vede un sumar al profilurilor tuturor" : "The team sees a summary of everyone's profiles"}</li>
          </ul>
          {isSpectator ? (
            <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
              {lang === "ro" ? "Ești facilitator-spectator. Urmărește progresul echipei din dashboard." : "You are facilitating as a spectator. Follow team progress from the dashboard."}
            </div>
          ) : (
            <button className="btn-primary mt-6 w-full" onClick={() => setPhase("questions")}>
              {lang === "ro" ? "Începe chestionarul" : "Start the questionnaire"} →
            </button>
          )}
        </div>
      </Center>
    );
  }

  if (phase === "questions") {
    const q = questions[qIndex];
    // Keep the measured dimension and poles hidden while answering to avoid
    // coaching participants toward a particular profile.
    return (
      <Center>
        <div className="overlay-card max-h-[calc(100dvh-1.5rem)] w-[640px] max-w-[92vw] overflow-y-auto p-8">
          {/* progress */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-400">
            <span>{lang === "ro" ? "Întrebarea" : "Question"} {qIndex + 1} / {questions.length}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-bold uppercase tracking-wider text-brand-300">
              {lang === "ro" ? "Răspuns privat" : "Private answer"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-300" style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }} />
          </div>

          <p className="mt-7 min-h-[72px] text-lg font-semibold leading-relaxed text-white">
            „<T value={q.text} />”
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-2xl border-2 border-brand-500/50 bg-brand-500/10 px-5 py-4 text-left transition hover:bg-brand-500/20 active:scale-[0.99]"
              onClick={() => answer("A")}
            >
              <div className="text-[13px] font-bold text-brand-300">
                {lang === "ro" ? "De acord" : "Agree"}
              </div>
              <div className="mt-0.5 text-[12px] text-ink-300">
                {lang === "ro" ? "Afirmația mă reprezintă în general" : "This statement generally describes me"}
              </div>
            </button>
            <button
              className="rounded-2xl border-2 border-ink-600/50 bg-white/5 px-5 py-4 text-left transition hover:bg-white/10 active:scale-[0.99]"
              onClick={() => answer("B")}
            >
              <div className="text-[13px] font-bold text-ink-200">
                {lang === "ro" ? "Mai puțin de acord" : "Disagree"}
              </div>
              <div className="mt-0.5 text-[12px] text-ink-400">
                {lang === "ro" ? "Afirmația mă reprezintă mai puțin" : "This statement describes me less often"}
              </div>
            </button>
          </div>

          {qIndex > 0 && (
            <button className="mt-5 text-xs font-semibold text-ink-400 transition hover:text-white" onClick={goBack}>
              ← {lang === "ro" ? "Înapoi" : "Back"}
            </button>
          )}
        </div>
      </Center>
    );
  }

  // results
  return (
    <Center>
      <div className="overlay-card max-h-[calc(100dvh-1.5rem)] w-[640px] max-w-[92vw] overflow-y-auto p-8">
        {profile ? (
          <>
            <div className="text-center">
              <div className="text-3xl">🎭</div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.25em] text-brand-300">
                {profile.code}
              </div>
              <h1 className="font-display mt-1 text-3xl font-extrabold text-white">
                <T value={profile.type?.name || { ro: "Profil necunoscut", en: "Unknown profile" }} />
              </h1>
              <p className="mt-1 text-sm italic text-ink-300">
                „<T value={profile.type?.tagline || { ro: "", en: "" }} />”
              </p>
            </div>

            {/* dimension bars */}
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {dims.map((d) => {
                const letter = profile.letters[dims.indexOf(d)];
                const isA = letter === d.poleA.letter;
                const countA = questions.filter((x) => x.dim === d.key).filter((x) => {
                  const agree = answers[x.id] === "A";
                  const l = agree ? (x.pole === "A" ? d.poleA.letter : d.poleB.letter) : (x.pole === "A" ? d.poleB.letter : d.poleA.letter);
                  return l === d.poleA.letter;
                }).length;
                const pct = (countA / 5) * 100;
                return (
                  <div key={d.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex justify-between text-[11px] font-bold text-ink-300">
                      <span>{d.poleA.letter}</span>
                      <span className="text-ink-500">{d.key}</span>
                      <span>{d.poleB.letter}</span>
                    </div>
                    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                      <div className="h-full flex-1 bg-emerald-500/60" />
                    </div>
                    <div className="mt-1 text-center text-[11px] font-semibold text-white">
                      {letter === d.poleA.letter ? pick(d.poleA.name, lang) : pick(d.poleB.name, lang)}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-ink-200">
              <T value={profile.type?.blurb || { ro: "", en: "" }} />
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCol title={lang === "ro" ? "💪 Puncte forte" : "💪 Strengths"} color="text-emerald-300" lines={profile.type?.strengths} lang={lang} />
              <InfoCol title={lang === "ro" ? "⚠️ Puncte slabe" : "⚠️ Watch out" } color="text-amber-300" lines={profile.type?.watchouts} lang={lang} />
            </div>

            <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-300">
                {lang === "ro" ? "🌱 Zona de creștere" : "🌱 Growth zone"}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-200">
                <T value={profile.type?.growth || { ro: "", en: "" }} />
              </p>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                {lang === "ro" ? "🤝 În echipă" : "🤝 In a team"}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-200">
                <T value={profile.type?.team || { ro: "", en: "" }} />
              </p>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-ink-300">
            {lang === "ro" ? "Răspunde la toate întrebările ca să-ți descoperi profilul." : "Answer all questions to discover your profile."}
          </p>
        )}

        {/* team summary */}
        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            👥 {lang === "ro" ? "Sumarul echipei" : "Team summary"}
          </div>
          {profileDistribution.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profileDistribution.map(([code, count]) => (
                <span key={code} className="rounded-full border border-brand-400/20 bg-brand-500/10 px-2.5 py-1 text-[11px] font-bold text-brand-200">
                  {code} × {count}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 space-y-2">
            {players.map((p) => {
              const r = ratings[p.id];
              const otherProfile = r?.done && r.profileCode
                ? { code: r.profileCode, type: types[r.profileCode] || null }
                : null;
              return (
                <div key={p.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/20" style={{ backgroundColor: p.color }} />
                  <span className="w-28 truncate font-semibold text-white">
                    {p.name}
                    {p.id === youId && <span className="text-ink-500"> (you)</span>}
                  </span>
                  {r?.done && otherProfile ? (
                    <>
                      <span className="rounded-md bg-brand-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-300">
                        {otherProfile.code}
                      </span>
                      <span className="truncate text-[12px] text-ink-300">
                        <T value={otherProfile.type?.name || { ro: "", en: "" }} />
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] italic text-ink-500">
                      {lang === "ro" ? "răspunde…" : "answering…"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-ink-400">
          {lang === "ro" ? "Facilitatorul controlează trecerea la debrief sau reluarea chestionarului pentru toată echipa." : "The facilitator controls the team debrief or a synchronized questionnaire restart."}
        </div>
      </div>
    </Center>
  );
}

function InfoCol({
  title,
  color,
  lines,
  lang,
}: {
  title: string;
  color: string;
  lines: { ro: string[]; en: string[] } | undefined;
  lang: "ro" | "en";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>{title}</div>
      <ul className="mt-2 space-y-1.5">
        {(lines?.[lang] || []).map((l, i) => (
          <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-ink-200">
            <span className="text-ink-500">•</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full items-center justify-center bg-ink-950 p-6">
      {children}
    </div>
  );
}
