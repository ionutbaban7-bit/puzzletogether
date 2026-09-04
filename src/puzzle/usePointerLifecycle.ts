import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

/**
 * A compact, shared Pointer Events lifecycle for board-like interactions.
 *
 * Safari can cancel a captured touch without delivering a normal pointerup.
 * Components using this hook deliberately distinguish a committed pointerup
 * from cancellation, capture loss, window interruption and unmount. The
 * callback receives only client coordinates so a canvas/div can map them to
 * its own local coordinate system consistently for React and window fallback
 * events.
 */
export type PointerTerminationReason =
  | "up"
  | "cancel"
  | "lostcapture"
  | "blur"
  | "visibilitychange"
  | "pagehide"
  | "resize"
  | "escape"
  | "unmount";

export interface PointerSample {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  buttons?: number;
}

type PointerLike = Pick<PointerEvent, "pointerId" | "pointerType" | "clientX" | "clientY" | "buttons">;

interface PointerLifecycleCallbacks {
  /** Called for tracked movement, including the window fallback when capture fails. */
  onMove?: (sample: PointerSample) => void;
  /** Called exactly once per active pointer on every terminal path. */
  onTerminate: (sample: PointerSample, reason: PointerTerminationReason) => void;
}

function sampleOf(event: PointerLike): PointerSample {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType || "mouse",
    clientX: event.clientX,
    clientY: event.clientY,
    buttons: event.buttons,
  };
}

/** Safari may throw when an element becomes detached during a gesture. */
export function safelySetPointerCapture(element: Element | null, pointerId: number): boolean {
  if (!element || typeof (element as HTMLElement).setPointerCapture !== "function") return false;
  try {
    (element as HTMLElement).setPointerCapture(pointerId);
    // `hasPointerCapture` is optional in older WebKit. If it exists, respect
    // the answer and activate the window fallback when capture was rejected.
    return typeof (element as HTMLElement).hasPointerCapture !== "function"
      || (element as HTMLElement).hasPointerCapture(pointerId);
  } catch {
    return false;
  }
}

/** Never call release with an unknown pointer id or a detached element. */
export function safelyReleasePointerCapture(element: Element | null, pointerId: number): void {
  if (!element || typeof (element as HTMLElement).releasePointerCapture !== "function") return;
  try {
    const hasCapture = typeof (element as HTMLElement).hasPointerCapture !== "function"
      || (element as HTMLElement).hasPointerCapture(pointerId);
    if (hasCapture) (element as HTMLElement).releasePointerCapture(pointerId);
  } catch {
    // A late lostpointercapture is a normal browser race, not an app error.
  }
}

/**
 * Keep Pointer Events resilient across canvas, freeform canvas and ranking.
 * `pointers` is caller-owned so the interaction can use the same live map for
 * pinch calculations without rendering on every finger move.
 */
export function usePointerLifecycle<T extends HTMLElement>(
  targetRef: RefObject<T | null>,
  pointers: MutableRefObject<Map<number, PointerSample>>,
  callbacks: PointerLifecycleCallbacks,
) {
  const captured = useRef(new Set<number>());
  // React forwards the browser's native PointerEvent to the element handler;
  // the same event may then bubble to our window fallback. WeakSet keeps a
  // capture failure from applying one physical movement twice.
  const processedMoves = useRef(new WeakSet<object>());
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const release = useCallback((pointerId: number) => {
    captured.current.delete(pointerId);
    safelyReleasePointerCapture(targetRef.current, pointerId);
  }, [targetRef]);

  const terminate = useCallback((pointerId: number, reason: PointerTerminationReason, fallback?: PointerSample) => {
    const current = pointers.current.get(pointerId) || fallback;
    if (!current) return null;
    // Delete before release: releasePointerCapture itself may synchronously
    // emit lostpointercapture, which then becomes a harmless duplicate.
    pointers.current.delete(pointerId);
    release(pointerId);
    callbacksRef.current.onTerminate(current, reason);
    return current;
  }, [pointers, release]);

  const begin = useCallback((event: PointerLike) => {
    const next = sampleOf(event);
    pointers.current.set(next.pointerId, next);
    if (safelySetPointerCapture(targetRef.current, next.pointerId)) captured.current.add(next.pointerId);
    else captured.current.delete(next.pointerId);
    return next;
  }, [pointers, targetRef]);

  const move = useCallback((event: PointerLike) => {
    const current = pointers.current.get(event.pointerId);
    if (!current) return null;
    if (typeof event === "object") {
      if (processedMoves.current.has(event)) return current;
      processedMoves.current.add(event);
    }
    const next = sampleOf(event);
    pointers.current.set(next.pointerId, next);
    callbacksRef.current.onMove?.(next);
    return next;
  }, [pointers]);

  const finish = useCallback((event: PointerLike, reason: Extract<PointerTerminationReason, "up" | "cancel" | "lostcapture">) => {
    const next = sampleOf(event);
    if (pointers.current.has(next.pointerId)) pointers.current.set(next.pointerId, next);
    return terminate(next.pointerId, reason, next);
  }, [pointers, terminate]);

  const cancelAll = useCallback((reason: Exclude<PointerTerminationReason, "up" | "cancel" | "lostcapture">) => {
    for (const pointerId of [...pointers.current.keys()]) terminate(pointerId, reason);
  }, [pointers, terminate]);

  useEffect(() => {
    const onWindowMove = (event: PointerEvent) => {
      // The element gets the normal path when capture succeeded. Listen at the
      // window only for a capture failure, avoiding duplicate movement frames.
      if (!pointers.current.has(event.pointerId) || captured.current.has(event.pointerId)) return;
      move(event);
    };
    const onWindowUp = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId) || captured.current.has(event.pointerId)) return;
      finish(event, "up");
    };
    const onWindowCancel = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId) || captured.current.has(event.pointerId)) return;
      finish(event, "cancel");
    };
    const onBlur = () => cancelAll("blur");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancelAll("visibilitychange");
    };
    const onPageHide = () => cancelAll("pagehide");
    const onResize = () => cancelAll("resize");
    const viewport = window.visualViewport;

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    viewport?.addEventListener("resize", onResize);
    viewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowCancel);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      viewport?.removeEventListener("resize", onResize);
      viewport?.removeEventListener("scroll", onResize);
      cancelAll("unmount");
    };
  }, [cancelAll, finish, move, pointers]);

  return { begin, move, finish, cancelAll, release };
}
