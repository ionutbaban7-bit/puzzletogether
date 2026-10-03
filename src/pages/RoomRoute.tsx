import { useEffect, useRef, useState } from "react";
import GamePage from "./GamePage";
import { api } from "../lib/api";
import { extractRoomRef, extractInvite } from "../lib/format";
import { navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { store } from "../store";
import { Logo, Spinner } from "../components/ui";
import { useLang } from "../lib/i18n";

type Phase =
  | { kind: "fetching" }
  | { kind: "need_access" }
  | { kind: "playing" }
  | { kind: "error"; message: string; full?: boolean };

export default function RoomRoute({ roomId }: { roomId: string }) {
  const { lang } = useLang();
  const ro = lang === "ro";
  const [phase, setPhase] = useState<Phase>({ kind: "fetching" });
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    startedRef.current = false;
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

      if (cancelled) return;
      // Returning player from THIS room (same tab session): reconnect without
      // asking for the code again — their seat is verified server-side.
      if (
        session.name &&
        session.pid &&
        session.credential &&
        (session.roomId === realRoomId || session.roomId === ref)
      ) {
        try {
          const res = await api.joinRoom(ref, session.name, session.pid);
          if (res.returning) {
            start(session.name, session.pid, session.credential);
            return;
          }
        } catch {
          // fall through to the access gate
        }
      }

      // Everyone else must pass the access gate: display name + room code.
      if (!cancelled) setPhase({ kind: "need_access" });
    })().catch(() =>
      setPhase({
        kind: "error",
        message: "Could not reach the room server.",
        full: true,
      }),
    );

    function start(name: string, pid: string, credential: string) {
      if (cancelled || startedRef.current) return;
      startedRef.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      saveSession({ name, pid, roomId: realRoomId || ref, credential });
      store.joinRoom(ref, pid, credential);
      setPhase({ kind: "playing" });
    }
    return () => {
      cancelled = true;
      store.leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (phase.kind === "fetching") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-center">
          <Spinner className="mx-auto h-8 w-8 text-brand-500" />
          <div className="mt-4 text-sm text-ink-400">
            {ro ? "Se conectează…" : "Connecting…"}
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "need_access") {
    return (
      <AccessGateModal
        onJoin={(name, pid, credential, realRoomId) => {
          const ref = roomId || extractRoomRef(window.location.href) || "";
          if (startedRef.current) return;
          startedRef.current = true;
          window.history.replaceState({}, "", window.location.pathname);
      saveSession({ name, pid, roomId: realRoomId || ref, credential });
          store.joinRoom(ref, pid, credential);
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
          <h1 className="font-display mt-4 text-xl font-bold text-ink-900">
            {ro ? "Joc indisponibil" : "Game unavailable"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            {phase.message}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              className="btn-secondary btn-sm"
              onClick={() => navigate("/")}
            >
              {ro ? "Acasă" : "Home"}
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={() => navigate("/create")}
            >
              {ro ? "Creează un puzzle" : "Create a puzzle"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <GamePage />;
}

/** Join with a separate invitation capability or the manual room code. */
function AccessGateModal({
  onJoin,
}: {
  onJoin: (
    name: string,
    pid: string,
    credential: string,
    realRoomId?: string,
  ) => void;
}) {
  const { lang } = useLang();
  const ro = lang === "ro";
  const [name, setName] = useState(() => getSession().name || "");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState(() =>
    extractInvite(window.location.href),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    if (!name.trim())
      return setError(ro ? "Introdu numele tău." : "Enter your name.");
    if (!code.trim() && !invite)
      return setError(ro ? "Introdu codul jocului." : "Enter the game code.");
    const ref = extractRoomRef(window.location.href);
    if (!ref) return setError(ro ? "Link invalid." : "Invalid link.");
    setBusy(true);
    setError("");
    try {
      const result = await api.joinRoom(
        ref,
        name.trim(),
        undefined,
        code.trim(),
        invite,
      );
      if (!result.credential)
        throw new Error(ro ? "Încearcă din nou." : "Please retry.");
      window.history.replaceState({}, "", window.location.pathname);
      onJoin(name.trim(), result.playerId, result.credential, result.room.id);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (invite && ["bad_code", "code_required"].includes(err.code || "")) {
        setInvite("");
        setError(
          ro
            ? "Invitația a expirat. Cere un link nou sau codul jocului."
            : "Invitation expired. Ask for a new link or the game code.",
        );
      } else if (err.code === "room_missing")
        setError(ro ? "Jocul a expirat." : "Game expired.");
      else setError(err.message);
      setBusy(false);
    }
  }
  return (
    <main className="marketing-page setup-page flex min-h-dvh items-center justify-center p-4">
      <form
        className="card w-full max-w-sm p-7"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="PuzzleTogether"
        >
          <Logo />
        </button>
        <h1 className="mt-6 text-2xl font-bold">
          {ro ? "Intră în joc" : "Join game"}
        </h1>
        <label
          htmlFor="invite-name"
          className="mt-5 block text-sm font-semibold"
        >
          {ro ? "Numele tău" : "Your name"}
        </label>
        <input
          id="invite-name"
          className="input mt-2"
          maxLength={24}
          required
          value={name}
          autoComplete="nickname"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        {!invite && (
          <>
            <label
              htmlFor="invite-code"
              className="mt-4 block text-sm font-semibold"
            >
              {ro ? "Codul jocului" : "Game code"}
            </label>
            <input
              id="invite-code"
              className="input mt-2 font-mono uppercase"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? <Spinner /> : ro ? "Intră în joc" : "Join game"}
        </button>
      </form>
    </main>
  );
}
