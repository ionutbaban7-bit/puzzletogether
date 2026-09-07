import { useCallback, useRef, useState } from "react";
import type { PuzzleView } from "../types";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface WorldBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const MIN_SCALE = 0.1; // 10% — large puzzles fit fully even on small phone screens
export const MAX_SCALE = 3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Device-pixel-ratio cap for the board canvases. Capping on high-density phones
 * cuts the number of physical pixels the renderer has to fill by a meaningful
 * amount (a 2x iPhone drops ~44% of its fill area) which is the single cheapest
 * win for keeping the canvas smooth. Desktop stays at 2x for crispness.
 * The value is computed once per call so it reflects the current pointer type /
 * viewport without needing a state subscription.
 */
export function canvasRenderScale(): number {
  if (typeof window === "undefined") return 1;
  const coarse =
    (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) ||
    window.innerWidth < 768;
  return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
}

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

  /** Fit the target plus caller-supplied authoritative piece bounds. */
  const fit = useCallback(
    (puzzle: PuzzleView | null, bounds?: WorldBounds, opts?: { minScale?: number; inset?: { top?: number; bottom?: number; left?: number; right?: number } }) => {
      if (!puzzle) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 640;
      const b = bounds || { x0: 0, y0: 0, x1: puzzle.width, y1: puzzle.height };
      // Screen-pixel insets reserve room for the HUD chrome (top session bar,
      // bottom camera/zoom controls) so a fitted view lands inside the visible
      // safe area instead of sliding under the overlays — same rule the canvas
      // sheet fit follows. The world-unit padding below only adds breathing
      // room around the framed bounds.
      const inset = opts?.inset ?? {};
      const inTop = inset.top ?? 0;
      const inBottom = inset.bottom ?? 0;
      const inLeft = inset.left ?? 0;
      const inRight = inset.right ?? 0;
      const availW = Math.max(1, vw - inLeft - inRight);
      const availH = Math.max(1, vh - inTop - inBottom);
      const padX = mobile ? 64 : 140;
      const padY = mobile ? 64 : 110;
      const bw = Math.max(1, b.x1 - b.x0) + padX * 2;
      const bh = Math.max(1, b.y1 - b.y0) + padY * 2;
      // The readable minimum keeps ordinary fits legible. Callers framing an
      // overview (the compact initial board view) may relax it: double-tap
      // provides the readable working zoom on phones.
      const readableMinimum = opts?.minScale ?? (mobile ? 0.22 : 0.26);
      const scale = clamp(Math.max(readableMinimum, Math.min(availW / bw, availH / bh)), MIN_SCALE, 1.05);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      setCamera({
        x: inLeft + availW / 2 - cx * scale,
        y: inTop + availH / 2 - cy * scale,
        scale,
      });
    },
    [setCamera],
  );

  return { camera, cameraRef, setCamera, zoomAt, zoomBy, fit };
}
