import { useEffect, useState } from "react";
import type { RoomView } from "../types";

// Anchor to server elapsed time, then interpolate with a monotonic browser clock.
// Local wall-clock settings cannot give a participant a different round time.
export function useRoundClock(room: RoomView | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const base = room?.completedInMs ?? room?.elapsedMs ?? 0;
    const receivedAt = performance.now();
    const running = room?.stage === "play" && !room.pausedAt && !room.completed;
    const tick = () => setElapsed(base + (running ? performance.now() - receivedAt : 0));
    tick();
    if (!running) return;
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [room?.id, room?.stage, room?.startedAt, room?.pausedAt, room?.completed, room?.elapsedMs, room?.completedInMs]);
  return elapsed;
}
