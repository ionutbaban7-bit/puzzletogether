import type { PuzzleView } from "../types";

/**
 * Geometry for the optional ordered help tray. The server owns the actual
 * positions; this tiny mirror is retained for tests and any future preview.
 * A tray is always below the target, keeping the reference image unobscured.
 */
export function trayLayout(puzzle: PuzzleView, total: number) {
  const cellW = puzzle.pieceW + 24;
  const cellH = puzzle.pieceH + 24;
  const origin = { x: 0, y: puzzle.height + 80 };
  const cols = Math.max(1, Math.floor(puzzle.width / cellW));
  const rows = Math.max(1, Math.ceil(total / cols));
  const width = cols * cellW;
  const height = rows * cellH;
  return { cellW, cellH, origin, cols, rows, width, height, landscape: false };
}

export function traySlot(
  layout: ReturnType<typeof trayLayout>,
  index: number,
): { x: number; y: number } {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return { x: layout.origin.x + col * layout.cellW, y: layout.origin.y + row * layout.cellH };
}

export function isEdgePiece(id: number, cols: number, rows: number) {
  const col = id % cols;
  const row = Math.floor(id / cols);
  return col === 0 || col === cols - 1 || row === 0 || row === rows - 1;
}
