import type { ScoreView } from "../types";

export function Podium({ scores, ro }: { scores: ScoreView[]; ro: boolean }) {
  const winners = scores.filter((s) => s.rank !== null && s.rank <= 3);
  function table(rows: ScoreView[], label: string) {
    return (
      <table className="mt-3 w-full table-fixed text-sm" aria-label={label}>
        <thead><tr className="border-b border-ink-200 text-left">
          <th scope="col" className="w-12 py-2 pr-3">{ro ? "Loc" : "Rank"}</th>
          <th scope="col" className="py-2">{ro ? "Jucător" : "Player"}</th>
          <th scope="col" className="w-16 py-2 pl-3 text-right">{ro ? "Piese" : "Pieces"}</th>
        </tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.playerId} className="border-b border-ink-200">
            <td className="py-2 pr-3">{s.rank ?? "—"}</td>
            <th scope="row" className="max-w-40 break-words py-2 text-left font-semibold">{s.name}</th>
            <td className="py-2 pl-3 text-right tabular-nums">{s.placed}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  return (
    <div className="mt-4">
      <h2>Podium</h2>
      {table(winners, ro ? "Podium: piese plasate" : "Podium: placed pieces")}
      <p className="mt-2 text-xs">{ro ? "Egalitățile împart același loc. Scorul numără piesele plasate." : "Ties share the same rank. Scores count placed pieces."}</p>
      <details className="mt-3">
        <summary className="cursor-pointer py-2 font-semibold">{ro ? "Toate contribuțiile" : "All contributions"}</summary>
        {table(scores, ro ? "Contribuțiile tuturor" : "Everyone’s contributions")}
      </details>
    </div>
  );
}
