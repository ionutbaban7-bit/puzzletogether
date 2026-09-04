import { useEffect, useState } from "react";

export interface VisualViewportState {
  /** Width/height of the actually visible visual viewport. */
  width: number;
  height: number;
  /** Offset inside the layout viewport (notably when Safari chrome moves). */
  offsetTop: number;
  offsetLeft: number;
  layoutHeight: number;
  layoutWidth: number;
}

function readViewport(): VisualViewportState {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, offsetTop: 0, offsetLeft: 0, layoutHeight: 0, layoutWidth: 0 };
  }
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width || window.innerWidth),
    height: Math.round(viewport?.height || window.innerHeight),
    offsetTop: Math.round(viewport?.offsetTop || 0),
    offsetLeft: Math.round(viewport?.offsetLeft || 0),
    layoutHeight: window.innerHeight,
    layoutWidth: window.innerWidth,
  };
}

/**
 * React state for browser chrome, dynamic viewport and iOS keyboard changes.
 * `visualViewport` is optional, so older browsers retain a safe innerWidth /
 * innerHeight fallback rather than receiving a one-time mobile decision.
 */
export function useVisualViewport(): VisualViewportState {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    update();
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return viewport;
}
