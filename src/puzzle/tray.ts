import type { PuzzleView } from "../types";

/**
 * Deterministic tray for unplaced jigsaw pieces: a non-overlapping grid
 * anchored to the puzzle's target area (right of it for landscape puzzles,
 * below it for portrait ones). Every client computes the same slots from
 * puzzle geometry, so no extra protocol is needed for multi-player
 * consistency.
 */
export function trayLayout(puzzle: PuzzleView, total: number) {
  const cellW = puzzle.pieceW + 24;
  const cellH = puzzle.pieceH + 24;
  const landscape = puzzle.width >= puzzle.height;
  let origin: { x: number; y: number };
  let cols: number;
  if (landscape) {
    origin = { x: puzzle.width + 80, y: 0 };
    const rows = Math.max(1, Math.floor(puzzle.height / cellH));
    cols = Math.max(1, Math.ceil(total / rows));
  } else {
    origin = { x: 0, y: puzzle.height + 80 };
    cols = Math.max(1, Math.floor(puzzle.width / cellW));
  }
  const rows = Math.max(1, Math.ceil(total / cols));
  const width = cols * cellW;
  const height = rows * cellH;
  return { cellW, cellH, origin, cols, rows, width, height, landscape };
}

export function traySlot(
  layout: ReturnType<typeof trayLayout>,
  id: number,
): { x: number; y: number } {
  const col = id % layout.cols;
  const row = Math.floor(id / layout.cols);
  return { x: layout.origin.x + col * layout.cellW, y: layout.origin.y + row * layout.cellH };
}

export function isEdgePiece(id: number, cols: number, rows: number) {
  const col = id % cols;
  const row = Math.floor(id / cols);
  return col === 0 || col === cols - 1 || row === 0 || row === rows - 1;
}

/** World bounds of target area + tray (used by camera fit). */
export function trayBounds(puzzle: PuzzleView, total: number) {
  const t = trayLayout(puzzle, total);
  return {
    x0: 0,
    y0: 0,
    x1: Math.max(puzzle.width, t.origin.x + t.width),
    y1: Math.max(puzzle.height, t.origin.y + t.height),
  };
}
