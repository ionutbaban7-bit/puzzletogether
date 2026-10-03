import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";
import { store } from "../store";
import type { Piece, PuzzleView } from "../types";
export function AccessiblePlay({
  puzzle,
  pieces,
  you,
  enabled,
}: {
  puzzle: PuzzleView;
  pieces: Record<number, Piece>;
  you: string | null;
  enabled: boolean;
}) {
  const { lang } = useLang();
  const ro = lang === "ro";
  const [selected, setSelected] = useState<number | null>(null);
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);
  const [pending, setPending] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const available = Object.values(pieces)
    .filter((p) => !p.locked)
    .sort((a, b) => ((a.id * 17 + 11) % 197) - ((b.id * 17 + 11) % 197));
  useEffect(() => {
    if (!pending) return;
    const piece = pieces[pending.id];
    if (
      piece?.locked ||
      (piece?.moved && piece.x === pending.x && piece.y === pending.y)
    ) {
      setMessage(
        piece.locked
          ? ro
            ? "Piesa s-a potrivit!"
            : "Piece fitted!"
          : ro
            ? "Piesa nu se potrivește aici."
            : "This piece does not fit here.",
      );
      setPending(null);
      if (piece.locked) setSelected(null);
    } else if (piece?.heldBy && piece.heldBy !== you) {
      setMessage(
        ro
          ? "Un coleg folosește această piesă."
          : "Someone else is using this piece.",
      );
      setPending(null);
    }
  }, [pieces, pending, ro, you]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(null);
      setMessage(
        ro
          ? "Mutarea nu este confirmată. Verifică legătura și încearcă din nou."
          : "Move not confirmed. Check your connection and retry.",
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [pending, ro]);
  function place() {
    const piece = selected === null ? null : pieces[selected];
    if (
      !enabled ||
      !piece ||
      piece.locked ||
      (piece.heldBy && piece.heldBy !== you)
    )
      return;
    const x = col * puzzle.pieceW,
      y = row * puzzle.pieceH;
    setPending({ id: piece.id, x, y });
    setMessage(ro ? "Se confirmă mutarea…" : "Confirming move…");
    store.sendPiece(piece.id, x, y, false);
  }
  return (
    <section>
      <h2>{ro ? "Joc fără tragere" : "Play without dragging"}</h2>
      <p className="my-2 text-sm">
        {ro
          ? "Alege piesa, rândul și coloana. Confirmă plasarea. Rândurile se numără de sus, coloanele din stânga."
          : "Choose a piece, row and column. Confirm placement. Rows start at the top; columns at the left."}
      </p>
      <div
        className="grid max-h-52 grid-cols-4 gap-2 overflow-auto p-1"
        role="group"
        aria-label={ro ? "Piese disponibile" : "Available pieces"}
      >
        {available.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`min-h-14 rounded border-2 p-1 ${selected === p.id ? "border-brand-600 bg-brand-50" : "border-ink-200"}`}
            disabled={!enabled || (!!p.heldBy && p.heldBy !== you)}
            aria-label={`${ro ? "Piesa" : "Piece"} ${p.id + 1}`}
            aria-pressed={selected === p.id}
            onClick={() => setSelected(p.id)}
          >
            <svg
              aria-hidden
              viewBox={`${p.correctX} ${p.correctY} ${puzzle.pieceW} ${puzzle.pieceH}`}
              className="h-12 w-full"
            >
              <image
                href={puzzle.image}
                width={puzzle.width}
                height={puzzle.height}
                preserveAspectRatio="xMidYMid meet"
              />
            </svg>
            <span className="text-xs">{p.id + 1}</span>
          </button>
        ))}
      </div>
      <div className="my-3 flex gap-3">
        <div>
          <label htmlFor="piece-row">{ro ? "Rând" : "Row"}</label>
          <select
            id="piece-row"
            className="input"
            value={row}
            onChange={(e) => setRow(Number(e.target.value))}
          >
            {Array.from({ length: puzzle.rows }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="piece-column">{ro ? "Coloană" : "Column"}</label>
          <select
            id="piece-column"
            className="input"
            value={col}
            onChange={(e) => setCol(Number(e.target.value))}
          >
            {Array.from({ length: puzzle.cols }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        className="btn-primary"
        disabled={
          !enabled ||
          selected === null ||
          !!pending ||
          !!pieces[selected]?.locked
        }
        onClick={place}
      >
        {ro ? "Plasează piesa" : "Place piece"}
      </button>
      <p className="mt-3 text-sm" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
