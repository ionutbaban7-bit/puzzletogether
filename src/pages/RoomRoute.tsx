import { useEffect, useRef, useState } from "react";
import GamePage from "./GamePage";
import { api } from "../lib/api";
import { extractRoomRef } from "../lib/format";
import { navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { store } from "../store";
import { Logo, Modal, Spinner } from "../components/ui";

type Phase =
  | { kind: "fetching" }
  | { kind: "need_name" }
  | { kind: "playing" }
  | { kind: "error"; message: string; full?: boolean };

export default function RoomRoute({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "fetching" });
  const startedRef = useRef(false);

  useEffect(() => {
    const session = getSession();
    const ref = roomId || extractRoomRef(window.location.href) || "";
    if (!ref) {
      setPhase({ kind: "error", message: "Invalid room link.", full: true });
      return;
    }
    (async () => {
      try {
        await api.getRoom(ref);
      } catch {
        // The room might still be fine via websocket; handle below if needed.
      }
      if (!session.name || !session.pid) {
        setPhase({ kind: "need_name" });
        return;
      }
      start(session.name, session.pid);
    })().catch(() => setPhase({ kind: "error", message: "Could not reach the room server.", full: true }));

    function start(name: string, pid: string) {
      if (startedRef.current) return;
      startedRef.current = true;
      saveSession({ name, pid, roomId: ref });
      store.joinRoom(ref, pid);
      setPhase({ kind: "playing" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (phase.kind === "fetching") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-center">
          <Spinner className="mx-auto h-8 w-8 text-brand-500" />
          <div className="mt-4 text-sm text-ink-400">Finding the room…</div>
        </div>
      </div>
    );
  }

  if (phase.kind === "need_name") {
    return (
      <NeedNameModal
        onJoin={(name, pid) => {
          const ref = roomId || extractRoomRef(window.location.href) || "";
          if (startedRef.current) return;
          startedRef.current = true;
          saveSession({ name, pid, roomId: ref });
          store.joinRoom(ref, pid);
          setPhase({ kind: "playing" });
        }}
      />
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
        <div className="card mx-auto w-full max-w-md p-8 text-center">
          <div className="text-4xl">🧩</div>
          <h1 className="font-display mt-4 text-xl font-bold text-ink-900">Room not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            {phase.message} Rooms expire after 24 hours of inactivity.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn-secondary btn-sm" onClick={() => navigate("/")}>
              Back home
            </button>
            <button className="btn-primary btn-sm" onClick={() => navigate("/create")}>
              Create a new room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <GamePage />;
}

function NeedNameModal({ onJoin }: { onJoin: (name: string, pid: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      setError("Please enter a display name.");
      return;
    }
    setBusy(true);
    setError("");
    const ref = extractRoomRef(window.location.href);
    if (!ref) return;
    try {
      const { playerId } = await api.joinRoom(ref, name.trim());
      onJoin(name.trim(), playerId);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "room_full") {
        setError((e as Error).message);
      } else if (code === "room_missing") {
        setError("This room no longer exists. Rooms expire after 24 hours of inactivity.");
      } else {
        setError(e instanceof Error ? e.message : "Could not join this room.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
      <Modal dismissable={false}>
        <div className="overlay-card w-[400px] max-w-full p-7">
          <div className="mb-5 flex justify-center">
            <Logo dark size={32} />
          </div>
          <h1 className="font-display text-center text-xl font-bold text-white">
            What's your name?
          </h1>
          <p className="mt-1.5 text-center text-sm text-ink-300">
            Your teammates will see it next to your cursor.
          </p>
          <input
            className="input mt-5 !border-white/10 !bg-white/5 !text-white placeholder:!text-ink-500"
            placeholder="e.g. Maria"
            maxLength={24}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && (
            <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
              {error}
            </div>
          )}
          <button className="btn-primary mt-5 w-full" disabled={busy} onClick={submit}>
            {busy ? <Spinner /> : "Join the Puzzle"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
