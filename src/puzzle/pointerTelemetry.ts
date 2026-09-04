export interface PointerTraceEntry {
  at: number;
  scope: string;
  event: "begin" | "fallback-move" | "terminate";
  pointerType: string;
  state?: string;
  capture?: "captured" | "fallback";
  reason?: string;
  durationMs?: number;
}

const TRACE_LIMIT = 200;

/**
 * Opt-in, client-only diagnostic trace for physical-device investigation.
 * It deliberately excludes coordinates, pointer ids, room/player ids, names,
 * chat text and every other user/content value. Enable with
 * `?ptPointerDebug=1`, then inspect `window.__ptPointerTrace` in Web Inspector.
 */
export function pointerTraceEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("ptPointerDebug") === "1"
      || window.sessionStorage.getItem("ptPointerDebug") === "1";
  } catch {
    return false;
  }
}

export function recordPointerTrace(entry: Omit<PointerTraceEntry, "at">) {
  if (!pointerTraceEnabled() || typeof window === "undefined") return;
  const target = window as Window & { __ptPointerTrace?: PointerTraceEntry[] };
  const trace = target.__ptPointerTrace || [];
  trace.push({ at: Date.now(), ...entry });
  if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
  target.__ptPointerTrace = trace;
}

declare global {
  interface Window {
    /** Opt-in privacy-safe trace; intended for Web Inspector only. */
    __ptPointerTrace?: PointerTraceEntry[];
  }
}
