import { useCallback, useRef, useState } from "react";
import type { PuzzleView } from "../types";
import { trayBounds } from "./tray";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.1; // 10% — large puzzles fit fully even on small phone screens
export const MAX_SCALE = 3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function useViewport() {
  const [camera, setCameraState] = useState<Camera>({ x: 0, y: 0, scale: 0.55 });
  const cameraRef = useRef(camera);

  const setCamera = useCallback((next: Camera | ((prev: Camera) => Camera)) => {
    const resolved = typeof next === "function" ? next(cameraRef.current) : next;
    cameraRef.current = resolved;
    setCameraState(resolved);
  }, []);

  const zoomAt = useCallback(
    (screenX: number, screenY: number, factor: number) => {
      setCamera((prev) => {
        const scale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
        const k = scale / prev.scale;
        return {
          x: screenX - (screenX - prev.x) * k,
          y: screenY - (screenY - prev.y) * k,
          scale,
        };
      });
    },
    [setCamera],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      zoomAt(window.innerWidth / 2, window.innerHeight / 2, factor);
    },
    [zoomAt],
  );

  /**
   * Fit the target area + the unplaced-piece tray into view, keeping the whole
   * board (pieces included) readable. The tray sits to the right of the target
   * for landscape puzzles and below it for portrait ones, so the content
   * bounds are computed from the puzzle geometry rather than fixed padding —
   * this is the portrait/landscape camera optimization.
   */
  const fit = useCallback(
    (puzzle: PuzzleView | null) => {
      if (!puzzle) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 640;
      const total = (puzzle.cols || 1) * (puzzle.rows || 1);
      const b = trayBounds(puzzle, total);
      const padX = mobile ? 64 : 140;
      const padY = mobile ? 64 : 110;
      const bw = b.x1 - b.x0 + padX * 2;
      const bh = b.y1 - b.y0 + padY * 2;
      const readableMinimum = mobile ? 0.22 : 0.26;
      const scale = clamp(Math.max(readableMinimum, Math.min(vw / bw, vh / bh)), MIN_SCALE, 1.05);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      setCamera({
        x: vw / 2 - cx * scale,
        y: vh / 2 - cy * scale,
        scale,
      });
    },
    [setCamera],
  );

  return { camera, cameraRef, setCamera, zoomAt, zoomBy, fit };
}
