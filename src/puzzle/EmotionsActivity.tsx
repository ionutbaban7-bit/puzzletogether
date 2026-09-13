import { useMemo, useState } from "react";
import { pick, T, useLang } from "../lib/i18n";
import { store, useStore } from "../store";
import type { CoachingActivity, EmotionsAgg, PlayerView, PuzzleView } from "../types";
import { Archetypes, Taxonomy, emotionByIdOf, familyOf, familyShade, pickB } from "../emotions/data";

/**
 * The Big Room (Camera Mare) — in-room activity.
 * Participants vote privately (1–3 emotions + intensity + optional archetype, or Pass);
 * the host reveals the anonymous aggregate; the museum round collects anonymous lines.
 * No vote ever shows a name.
 */
interface Props {
  puzzle: PuzzleView;
  players: PlayerView[];
  youId: string | null;
}

const ROUND_LABELS: Record<string, { ro: string; en: string; icon: string }> = {
  "weather-start": { ro: "Meteo de pornire", en: "Starting weather", icon: "🌤️" },
  situation: { ro: "Situație", en: "Situation", icon: "📋" },
  museum: { ro: "Muzeul anonim", en: "Anonymous museum", icon: "🏛️" },
  "weather-end": { ro: "Meteo de final", en: "Final weather", icon: "🌙" },
};

export default function EmotionsActivity({ puzzle, players, youId }: Props) {
  const { lang } = useLang();
  const room = useStore((s) => s.room);
  const emotions = room?.emotions ?? null;
  const mine = useStore((s) => s.emotionsMine);
  const agg = useStore((s) => s.emotionsAgg);
  const safetyPaused = useStore((s) => s.safetyPaused);
  const isHost = !!youId && room?.hostId === youId;
  const isSpectator = players.find((p) => p.id === youId)?.role === "spectator";
  const activity = puzzle.activity as CoachingActivity | undefined;
  const situations = activity?.situations || [];
  const [situationId, setSituationId] = useState<string>(situations[0]?.id || "");
  const [safetyInput, setSafetyInput] = useState(false);
  const [safetyWord, setSafetyWord] = useState("");

  const currentSituation = emotions?.situationId ? situations.find((s) => s.id === emotions.situationId) : null;
  const votedCount = emotions?.votedCount ?? 0;
  const totalPlayers = Math.max(1, emotions?.totalPlayers ?? players.length);

  const kindLabel = emotions?.kind ? ROUND_LABELS[emotions.kind] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-start overflow-y-auto bg-ink-950 px-4 py-5">
      <div className="w-full max-w-2xl">
        {/* Round header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cp-purple-300/30 bg-cp-purple-500/10 px-3 py-1 text-xs font-bold text-cp-purple-300">
              🗺️ {lang === "ro" ? "Camera Mare" : "The Big Room"}
            </span>
            {kindLabel && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-ink-200">
                {kindLabel.icon} {pick(kindLabel, lang)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {emotions && !emotions.revealed && emotions.kind && (
              <span className="text-xs text-ink-400">
                {votedCount}/{totalPlayers} {lang === "ro" ? "au votat" : "voted"}
              </span>
            )}
            <button
              onClick={() => setSafetyInput((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/20"
              title={lang === "ro" ? "Cuvânt de siguranță" : "Safety word"}
            >
              🌙
            </button>
          </div>
        </div>
        {safetyInput && (
          <div className="mt-3 flex gap-2">
            <input
              value={safetyWord}
              onChange={(e) => setSafetyWord(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder={lang === "ro" ? "Tastează cuvântul de siguranță…" : "Type the safety word…"}
              aria-label={lang === "ro" ? "Cuvânt de siguranță" : "Safety word"}
            />
            <button className="btn btn-dark btn-sm" onClick={() => { if (safetyWord.trim()) { store.sendSafetyWord(safetyWord.trim()); setSafetyWord(""); setSafetyInput(false); } }}>
              {lang === "ro" ? "Trimite" : "Send"}
            </button>
          </div>
        )}

        {/* Host controls */}
        {isHost && room?.stage === "play" && (
          <div className="mt-4 rounded-2xl border border-cp-purple-300/25 bg-cp-purple-500/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-cp-purple-300">
              {lang === "ro" ? "Controale facilitator" : "Facilitator controls"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["weather-start", "situation", "museum", "weather-end"].map((kind) => (
                <button
                  key={kind}
                  className="btn btn-dark btn-sm"
                  onClick={() => kind === "situation" ? store.sendControl("emotionsRound", { kind, situationId }) : store.sendControl("emotionsRound", { kind })}
                >
                  {ROUND_LABELS[kind].icon} {pick(ROUND_LABELS[kind], lang)}
                </button>
              ))}
              <button
                className="btn-primary btn-sm"
                disabled={!emotions?.kind || emotions?.revealed}
                onClick={() => store.sendControl("emotionsReveal")}
              >
                ✨ {lang === "ro" ? "Reveal (anonim)" : "Reveal (anonymous)"}
              </button>
            </div>
            {emotions?.kind === "situation" && (
              <p className="mt-2 text-xs text-ink-300">
                {lang === "ro" ? "Situația activă:" : "Active situation:"}{" "}
                <b className="text-white">{currentSituation ? pick(currentSituation.text, lang) : "—"}</b>
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={emotions?.safetyWordActive ? (lang === "ro" ? "activ" : "active") : ""}
                readOnly
                className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink-300 outline-none"
                aria-hidden="true"
              />
              <input
                key={String(emotions?.safetyWordActive)}
                defaultValue={""}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
                placeholder={lang === "ro" ? "Setează un cuvânt de siguranță (se spune în cameră)…" : "Set a safety word (said out loud in the room)…"}
                onBlur={(e) => { if (e.target.value.trim()) store.sendControl("emotionsSafetyWord", { text: e.target.value.trim() }); }}
                aria-label={lang === "ro" ? "Cuvânt de siguranță" : "Safety word"}
              />
            </div>
          </div>
        )}

        {/* Main area */}
        <div className="mt-5">
          {!emotions?.kind && (
            <WaitingCard isSpectator={isSpectator} />
          )}
          {emotions?.kind && !emotions.revealed && (
            <VotePanel
              key={`${emotions.round}:${emotions.kind}:${emotions.situationId || ""}`}
              kind={emotions.kind}
              situationText={currentSituation ? currentSituation.text : null}
              situationHeavy={currentSituation?.heavy}
              mine={mine}
            />
          )}
          {emotions?.kind && emotions.revealed && agg && (
            <RevealPanel agg={agg} debriefPrompts={currentSituation?.debriefPrompts} totalPlayers={totalPlayers} />
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-500">
          <T value={{ ro: "Voturi private până la reveal · fiecare emoție e validă · «Pas» e o mișcare legală · ce se spune în cameră rămâne în cameră", en: "Private votes until reveal · every emotion is valid · “Pass” is a legal move · what is said in the room stays in the room" }} />
        </p>
      </div>

      {/* Safety pause overlay */}
      {safetyPaused && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-sky-400/25 bg-ink-900 p-8 text-center">
            <div className="text-3xl">🌙</div>
            <h2 className="font-display mt-2 text-xl font-bold text-white">
              <T value={{ ro: "Pauză de siguranță", en: "Safety pause" }} />
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              <T value={{ ro: "Cuvântul de siguranță a fost activat. Facilitatorul ia o pauză. Respiră: 4 în, 4 din.", en: "The safety word was triggered. The facilitator is taking a pause. Breathe: 4 in, 4 out." }} />
            </p>
            <div className="mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-left text-sm text-ink-200">
              <p>🫶 <T value={{ ro: "Vorbește cu cineva de încredere.", en: "Talk to someone you trust." }} /></p>
              <p>📞 <T value={{ ro: "Urgență: 112 · TelVerde anti-suicid ARPS: 0800 801 200 (vin–dum 19:00–07:00)", en: "Emergency: 112 · ARPS anti-suicide TelVerde: 0800 801 200 (Fri–Sun 19:00–07:00)" }} /></p>
            </div>
            <button className="btn-primary mt-5 w-full" onClick={() => store.dismissSafetyPause()}>
              <T value={{ ro: "Înțeles", en: "Understood" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WaitingCard({ isSpectator }: { isSpectator: boolean }) {
  const { lang } = useLang();
  return (
    <div className="rounded-[28px] border border-white/10 bg-ink-900/60 p-8 text-center">
      <div className="text-4xl">🗺️</div>
      <h2 className="font-display mt-3 text-xl font-bold text-white">
        <T value={{ ro: "Facilitatorul va porni un tur", en: "The facilitator will start a round" }} />
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-300">
        <T value={{ ro: "Regulile camerei: voturile sunt private până la reveal; fiecare emoție e validă — nu există răspuns corect; «Pas» e o mișcare legală și anonimă; nimeni nu e obligat să explice alegerea.", en: "The room's rules: votes are private until the reveal; every emotion is valid — there is no right answer; “Pass” is a legal, anonymous move; nobody has to explain their choice." }} />
      </p>
      {isSpectator && (
        <p className="mt-3 text-xs text-ink-500">
          <T value={{ ro: "Ești spectator — poți urmări reveal-urile agregate.", en: "You are a spectator — you can watch the aggregate reveals." }} />
        </p>
      )}
    </div>
  );
}

function VotePanel({ kind, situationText, situationHeavy, mine }: {
  kind: string;
  situationText: { ro: string; en: string } | null;
  situationHeavy: boolean | undefined;
  mine: { emotions: string[]; intensity: number; archetype: string | null; passed: boolean; line: string | null } | null;
}) {
  const { lang } = useLang();
  const [selected, setSelected] = useState<string[]>(mine?.emotions || []);
  const [intensity, setIntensity] = useState<number>(mine?.intensity ?? 5);
  const [archetype, setArchetype] = useState<string | null>(mine?.archetype ?? null);
  const [line, setLine] = useState<string>(mine?.line || "");
  const [sent, setSent] = useState<boolean>(!!mine);

  const isMuseum = kind === "museum";
  const question = kind === "situation"
    ? (lang === "ro" ? "Ce simți în această situație?" : "What do you feel in this situation?")
    : kind === "weather-start"
      ? (lang === "ro" ? "Ce cer e în tine chiar acum?" : "What sky is in you right now?")
      : kind === "weather-end"
        ? (lang === "ro" ? "Ce cer e în tine acum, la final?" : "What sky is in you now, at the end?")
        : "";

  function toggle(id: string) {
    setSent(false);
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]);
  }

  function submit(passed = false) {
    if (isMuseum) {
      if (!line.trim()) return;
      store.sendEmotionsVote({ line: line.trim(), passed: false });
    } else {
      if (!passed && !selected.length) return;
      store.sendEmotionsVote({ emotions: selected, intensity, archetype, passed });
    }
    setSent(true);
  }

  return (
    <div className="space-y-4">
      {situationText && (
        <div className="rounded-[24px] border border-white/10 bg-ink-900/80 p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-ink-400">{lang === "ro" ? "Situația" : "The situation"}</p>
          <p className="font-display mt-2 text-xl font-bold leading-snug text-white">{pick(situationText, lang)}</p>
          {situationHeavy && (
            <p className="mt-3 text-xs text-ink-400">
              <T value={{ ro: "Această situație poate activa. Poți alege «Pas» oricând.", en: "This situation may activate. You can choose “Pass” at any time." }} />
            </p>
          )}
        </div>
      )}

      {!isMuseum && (
        <div className="rounded-[24px] border border-white/10 bg-ink-900/60 p-5">
          <p className="text-sm font-bold text-white">{question}</p>
          <p className="mt-1 text-xs text-ink-400">
            <T value={{ ro: "1–3 emoții · mixtele sunt valide", en: "1–3 emotions · mixes are valid" }} />
          </p>
          <div className="mt-3 space-y-2">
            {Taxonomy.meta.families.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-6 text-center text-base" aria-hidden="true">{f.icon}</span>
                {Taxonomy.emotions.filter((e) => e.family === f.id).map((e) => {
                  const on = selected.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggle(e.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? "border-white/70 text-white" : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10"}`}
                      style={on ? { background: familyShade(f.color, e.level) } : undefined}
                    >
                      {pick(e.name, lang)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-ink-300">
              <T value={{ ro: "Intensitatea: ", en: "Intensity: " }} /><b className="text-white">{intensity}/10</b>
            </p>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => { setIntensity(i); setSent(false); }}
                  className={`h-7 flex-1 rounded-md text-[10px] font-bold transition ${i <= intensity ? "bg-sky-400/70 text-ink-950" : "bg-white/5 text-ink-500 hover:bg-white/10"}`}
                  aria-label={`${i}/10`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-ink-300">
              <T value={{ ro: "Cine vorbește în tine? (opțional)", en: "Who is speaking in you? (optional)" }} />
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Archetypes.archetypes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setArchetype((cur) => (cur === a.id ? null : a.id)); setSent(false); }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${archetype === a.id ? "border-white/70 bg-white/10 text-white" : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10"}`}
                >
                  {a.icon} {pick(a.name, lang)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isMuseum && (
        <div className="rounded-[24px] border border-white/10 bg-ink-900/60 p-5">
          <p className="text-sm font-bold text-white">
            <T value={{ ro: "Muzeul anonim: lasă un singur rând", en: "Anonymous museum: leave one line" }} />
          </p>
          <p className="mt-1 text-xs text-ink-400">
            <T value={{ ro: "Ceva ce ai făcut deși ți-a fost greu. Fără nume, fără context — doar rândul tău, amestecat cu al tuturor.", en: "Something you did even though it was hard. No names, no context — just your line, shuffled with everyone else's." }} />
          </p>
          <input
            value={line}
            onChange={(e) => { setLine(e.target.value); setSent(false); }}
            maxLength={140}
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
            placeholder={lang === "ro" ? "O dată am…" : "Once I…"}
            aria-label={lang === "ro" ? "Rândul tău anonim" : "Your anonymous line"}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => submit(false)} disabled={!isMuseum && (!selected.length || sent)}>
          {isMuseum ? (lang === "ro" ? "Lasă rândul" : "Leave the line") : (lang === "ro" ? "Trimite votul privat" : "Send my private vote")}
        </button>
        {!isMuseum && (
          <button className="btn btn-dark" onClick={() => submit(true)} disabled={sent}>
            ⏭ {lang === "ro" ? "Pas" : "Pass"}
          </button>
        )}
        {sent && (
          <span className="text-xs text-emerald-300">
            ✓ {mine?.passed
              ? (lang === "ro" ? "ai ales «Pas» — e o mișcare legală" : "you chose “Pass” — it is a legal move")
              : (lang === "ro" ? "votul tău e salvat privat · poți schimba" : "your vote is saved privately · you can change it")}
          </span>
        )}
      </div>
    </div>
  );
}

function RevealPanel({ agg, debriefPrompts, totalPlayers }: { agg: EmotionsAgg; debriefPrompts?: { ro: string; en: string }[]; totalPlayers: number }) {
  const { lang } = useLang();
  const bars = useMemo(() => Object.entries(agg.counts).sort((a, b) => b[1] - a[1]), [agg.counts]);
  const max = Math.max(1, ...bars.map(([, n]) => n));
  const distinct = bars.length;
  const archetypes = useMemo(() => Object.entries(agg.archetypeCounts).sort((a, b) => b[1] - a[1]), [agg.archetypeCounts]);
  const isMuseum = agg.kind === "museum";
  const isWeather = agg.kind === "weather-start" || agg.kind === "weather-end";

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-cp-purple-300/25 bg-gradient-to-br from-cp-purple-500/15 to-ink-900 p-6 text-center">
        {agg.situation && <p className="mx-auto max-w-xl text-sm leading-relaxed text-ink-300">{pick(agg.situation.text, lang)}</p>}
        <h2 className="font-display mt-2 text-2xl font-extrabold text-white">
          {isMuseum
            ? (lang === "ro" ? "Muzeul camerei" : "The room's museum")
            : (lang === "ro" ? `Aceeași situație. ${distinct} ${distinct === 1 ? "cer diferit" : "ceruri diferite"}.` : `Same situation. ${distinct} different ${distinct === 1 ? "sky" : "skies"}.`)}
        </h2>
        {agg.intensityAvg != null && (
          <p className="mt-2 text-xs text-ink-300">
            {lang === "ro" ? `intensitate medie ${agg.intensityAvg}/10` : `average intensity ${agg.intensityAvg}/10`}
            {agg.passed > 0 && <> · {agg.passed} × «Pas»</>}
          </p>
        )}
      </div>

      {!isMuseum && bars.length > 0 && (
        <div className="rounded-[24px] border border-white/10 bg-ink-900/60 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-ink-400">
            {lang === "ro" ? "Distribuția anonimă" : "The anonymous distribution"}
          </p>
          <div className="mt-3 space-y-2">
            {bars.map(([id, n]) => {
              const em = emotionByIdOf(id);
              if (!em) return null;
              const family = familyOf(id);
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm" aria-hidden="true">{family?.icon}</span>
                  <span className="w-32 shrink-0 truncate text-xs font-semibold text-ink-200">{pickB(em.name, lang)}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/5">
                    <div className="h-full rounded-md transition-all duration-700" style={{ width: `${(n / max) * 100}%`, background: family ? familyShade(family.color, 2) : "#97a0ba" }} />
                  </div>
                  <span className="w-6 text-right text-sm font-bold text-white">{n}</span>
                </div>
              );
            })}
          </div>
          {archetypes.length > 0 && (
            <div className="mt-4 border-t border-white/8 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-ink-400">
                {lang === "ro" ? "Cine vorbea în cameră" : "Who was speaking in the room"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {archetypes.map(([id, n]) => {
                  const a = Archetypes.archetypes.find((x) => x.id === id);
                  if (!a) return null;
                  return (
                    <span key={id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-200">
                      {a.icon} {pick(a.name, lang)} ×{n}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isMuseum && (
        <div className="rounded-[24px] border border-white/10 bg-ink-900/60 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-ink-400">
            {lang === "ro" ? "Rânduri anonime" : "Anonymous lines"}
          </p>
          <ul className="mt-3 space-y-2">
            {agg.lines.map((l, i) => (
              <li key={i} className="rounded-xl border border-white/8 bg-white/[.03] px-4 py-2.5 text-sm italic text-ink-100">„{l}"</li>
            ))}
            {agg.lines.length === 0 && <li className="text-sm text-ink-500">{lang === "ro" ? "Nimeni nu a lăsat un rând — și asta e un rezultat." : "Nobody left a line — and that is a result."}</li>}
          </ul>
        </div>
      )}

      {debriefPrompts && debriefPrompts.length > 0 && (
        <div className="rounded-[24px] border border-sky-400/20 bg-sky-400/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-sky-300">
            {lang === "ro" ? "Întrebări pentru discuție" : "Questions for the discussion"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {debriefPrompts.map((q, i) => (
              <li key={i} className="text-sm leading-relaxed text-ink-100">
                {isWeather ? "" : "• "} {pick(q, lang)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-[11px] text-ink-500">
        <T value={{ ro: `Agregat anonim — ${totalPlayers} participanți. Numele nu apar niciodată.`, en: `Anonymous aggregate — ${totalPlayers} participants. Names never appear.` }} />
      </p>
    </div>
  );
}
