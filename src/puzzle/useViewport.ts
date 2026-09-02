import { useCallback, useRef, useState } from "react";
import type { PuzzleView } from "../types";

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

  /** Fit the puzzle rect + the scattered-piece area into view. */
  const fit = useCallback(
    (puzzle: PuzzleView | null) => {
      if (!puzzle) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const padX = 260;
      const padTop = 90;
      const padBottom = 880;
      const bw = puzzle.width + padX * 2;
      const bh = puzzle.height + padTop + padBottom;
      const scale = clamp(Math.min(vw / bw, vh / bh), MIN_SCALE, 1.05);
      const boundsX = -padX;
      const boundsY = -padTop;
      setCamera({
        x: (vw - bw * scale) / 2 - boundsX * scale,
        y: (vh - bh * scale) / 2 - boundsY * scale,
        scale,
      });
    },
    [setCamera],
  );

  return { camera, cameraRef, setCamera, zoomAt, zoomBy, fit };
}
