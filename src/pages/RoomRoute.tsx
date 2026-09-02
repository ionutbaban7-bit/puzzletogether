import { useEffect, useRef, useState } from "react";
import GamePage from "./GamePage";
import { api } from "../lib/api";
import { extractRoomRef } from "../lib/format";
import { navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { store } from "../store";
import { Logo, Modal, Spinner } from "../components/ui";
import { T } from "../lib/i18n";

type Phase =
  | { kind: "fetching" }
  | { kind: "need_access" }
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
    let realRoomId: string | null = null;
    (async () => {
      try {
        const info = await api.getRoom(ref);
        realRoomId = info.room.id;
      } catch {
        // The room might still be reachable; the join call below will surface errors.
      }

      // Returning player from THIS room (same tab session): reconnect without
      // asking for the code again — their seat is verified server-side.
      if (
        session.name &&
        session.pid &&
        (session.roomId === realRoomId || session.roomId === ref)
      ) {
        try {
          const res = await api.joinRoom(ref, session.name, session.pid);
          if (res.returning) {
            start(session.name, session.pid);
            return;
          }
        } catch {
          // fall through to the access gate
        }
      }

      // Everyone else must pass the access gate: display name + room code.
      setPhase({ kind: "need_access" });
    })().catch(() => setPhase({ kind: "error", message: "Could not reach the room server.", full: true }));

    function start(name: string, pid: string) {
      if (startedRef.current) return;
      startedRef.current = true;
      saveSession({ name, pid, roomId: realRoomId || ref });
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

  if (phase.kind === "need_access") {
    return (
      <AccessGateModal
        onJoin={(name, pid, realRoomId) => {
          const ref = roomId || extractRoomRef(window.location.href) || "";
          if (startedRef.current) return;
          startedRef.current = true;
          saveSession({ name, pid, roomId: realRoomId || ref });
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

/**
 * Access gate for people arriving via a shared /room link: the display name
 * AND the room's access code are both mandatory before entering the game.
 */
function AccessGateModal({
  onJoin,
}: {
  onJoin: (name: string, pid: string, realRoomId?: string) => void;
}) {
  const [name, setName] = useState(() => getSession().name || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      setError("Te rugăm să introduci un nume. / Please enter a display name.");
      return;
    }
    if (!code.trim()) {
      setError("Codul de acces este obligatoriu. / The access code is required.");
      return;
    }
    setBusy(true);
    setError("");
    const ref = extractRoomRef(window.location.href);
    if (!ref) return;
    try {
      const { room, playerId } = await api.joinRoom(ref, name.trim(), undefined, code.trim());
      onJoin(name.trim(), playerId, room.id);
    } catch (e) {
      const errCode = (e as Error & { code?: string }).code;
      if (errCode === "bad_code") {
        setError("Cod de acces greșit — verifică-l cu gazda. / Wrong access code — check it with the host.");
      } else if (errCode === "code_required") {
        setError("Codul de acces este obligatoriu. / The access code is required.");
      } else if (errCode === "room_full") {
        setError((e as Error).message);
      } else if (errCode === "room_missing") {
        setError("Camera nu mai există. / This room no longer exists. Rooms expire after 24 hours of inactivity.");
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
            <T value={{ ro: "Intră în cameră", en: "Enter the room" }} />
          </h1>
          <p className="mt-1.5 text-center text-sm text-ink-300">
            <T
              value={{
                ro: "Ai nevoie de codul de acces primit de la gazdă.",
                en: "You need the access code shared by the host.",
              }}
            />
          </p>

          <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-ink-400">
            <T value={{ ro: "Numele tău", en: "Your name" }} />
          </label>
          <input
            className="input mt-1.5 !border-white/10 !bg-white/5 !text-white placeholder:!text-ink-500"
            placeholder="e.g. Maria"
            maxLength={24}
            value={name}
            autoFocus={!name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-400">
            <T value={{ ro: "Cod de acces", en: "Access code" }} />
          </label>
          <input
            className="input mt-1.5 !border-white/10 !bg-white/5 text-center font-mono text-lg font-bold uppercase tracking-[0.35em] !text-white placeholder:!text-ink-500 placeholder:tracking-normal"
            placeholder="K7F2MX"
            maxLength={12}
            value={code}
            autoFocus={!!name}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          {error && (
            <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
              {error}
            </div>
          )}
          <button className="btn-primary mt-5 w-full" disabled={busy} onClick={submit}>
            {busy ? <Spinner /> : <T value={{ ro: "Intră în joc", en: "Join the Puzzle" }} />}
          </button>
          <div className="mt-3 text-center text-[11px] text-ink-500">
            <T
              value={{
                ro: "Nu ai codul? Cere-l persoanei care a creat camera.",
                en: "No code? Ask the person who created the room.",
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
