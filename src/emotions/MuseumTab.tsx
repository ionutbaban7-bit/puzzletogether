import { useState } from "react";
import { T, useLang } from "../lib/i18n";
import { addMuseumLine, museumLines, removeMuseumLine, type MuseumLine } from "./store";
import { Card, LineInput, Title, formatDate } from "./tabShared";

/**
 * Muzeul — the anonymous museum, solo edition: a private collection of
 * lines about times you acted despite the fear. No names, no context needed.
 */
export default function MuseumTab() {
  const { lang } = useLang();
  const [lines, setLines] = useState<MuseumLine[]>(museumLines());
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    setLines(addMuseumLine(text));
    setDraft("");
  }

  return (
    <div className="space-y-6">
      <Title
        ro="Muzeul"
        en="The Museum"
        sub={{
          ro: "Muzeul anonim, în varianta ta personală: o colecție de rânduri despre momentele în care ai acționat deși ți-a fost frică. Fără nume, fără context — doar rândul, pe un perete.",
          en: "The anonymous museum, in your personal edition: a collection of lines about the moments you acted despite the fear. No names, no context — just the line, on a wall.",
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-display text-lg font-bold text-white">
            <T value={{ ro: "Lasă un rând pe perete", en: "Leave a line on the wall" }} />
          </h2>
          <p className="mt-1 text-xs text-ink-400">
            <T value={{ ro: "ex. «O dată am…», «Deși era frică, am…»", en: "e.g. “Once I…”, “Even though I was scared, I…”" }} />
          </p>
          <div className="mt-3">
            <LineInput value={draft} onChange={setDraft} maxLength={140} placeholder={lang === "ro" ? "O dată am…" : "Once I…"} />
          </div>
          <button className="btn-primary mt-3" onClick={add} disabled={!draft.trim()}>
            <T value={{ ro: "Spune rândul", en: "Speak the line" }} />
          </button>
        </Card>

        <Card delay={0.1}>
          <h2 className="font-display text-lg font-bold text-white">
            <T value={{ ro: "Peretele", en: "The wall" }} />
          </h2>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              <T value={{ ro: "Peretele e gol — prima expoziție așteaptă. Nu trebuie să fie ceva mare. Poate fi și un mic «am spus nu».", en: "The wall is empty — the first exhibition is waiting. It does not have to be big. It can be a small “I said no”." }} />
            </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lines.map((l) => (
                  <li key={l.at} className="group rounded-xl border border-white/8 bg-white/[.03] px-4 py-2.5">
                    <p className="text-sm italic leading-relaxed text-ink-100">„{l.text}"</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-ink-500">{formatDate(l.at, lang)}</span>
                      <button className="text-[10px] text-ink-500 opacity-0 transition hover:text-rose-300 group-hover:opacity-100" onClick={() => setLines(removeMuseumLine(l.text))}>
                        <T value={{ ro: "ia de pe perete", en: "take down" }} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-500">
        <T value={{ ro: "Rândurile sunt ale tale, rămân în browserul tău. În varianta de echipă, rândurile tuturor sunt amestecate și anonime.", en: "The lines are yours, they stay in your browser. In the team edition, everyone's lines are shuffled and anonymous." }} />
      </p>
    </div>
  );
}
