import { useState } from "react";
import { api } from "../lib/api";
import { extractRoomRef } from "../lib/format";
import { joinQueryCode, navigate } from "../lib/router";
import { getSession, saveSession } from "../lib/session";
import { Logo, Spinner } from "../components/ui";

export default function JoinRoom() {
  const [ref, setRef] = useState(() => joinQueryCode() || "");
  const [name, setName] = useState(() => getSession().name || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A pasted /room link only contains the room id — the access code is still
  // required. Typing the code itself is enough (uuid refs contain dashes).
  const parsedRef = extractRoomRef(ref);
  const needsCode = !!parsedRef && parsedRef.includes("-");

  async function handleJoin() {
    const roomRef = extractRoomRef(ref);
    if (!roomRef) {
      setError("Enter a room code or a room link (e.g. K7F2MX or the URL a friend shared).");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your display name first.");
      return;
    }
    if (needsCode && !code.trim()) {
      setError("Room links also need the access code — ask the host for it.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const existing = getSession();
      const { room, playerId } = await api.joinRoom(
        roomRef,
        name.trim(),
        existing.pid || undefined,
        code.trim() || undefined,
      );
      saveSession({ name: name.trim(), pid: playerId, roomId: room.id });
      navigate(`/room/${room.id}`);
    } catch (e) {
      const errCode = (e as Error & { code?: string }).code;
      const message = e instanceof Error ? e.message : "Could not join this room.";
      if (errCode === "room_missing") {
        setError("We couldn't find a room with that code or link. Rooms expire after 24 hours of inactivity.");
      } else if (errCode === "bad_code") {
        setError("That access code is incorrect — double-check it with the host.");
      } else if (errCode === "code_required") {
        setError("This room requires an access code — ask the host for it.");
      } else {
        setError(message);
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <button onClick={() => navigate("/")} aria-label="PuzzleTogether home">
            <Logo size={38} />
          </button>
        </div>

        <div className="card p-8 animate-fade-up">
          <h1 className="font-display text-2xl font-bold text-ink-900">Join a room</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Paste the room link or code a friend shared with you, pick a nickname,
            and jump straight into the puzzle.
          </p>

          <label className="mt-6 block text-sm font-semibold text-ink-700" htmlFor="roomref">
            Room link or code
          </label>
          <input
            id="roomref"
            className="input mt-2 font-mono tracking-wide"
            placeholder="K7F2MX — or paste a link"
            value={ref}
            autoFocus
            onChange={(e) => setRef(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />

          {needsCode && (
            <>
              <label className="mt-4 block text-sm font-semibold text-ink-700" htmlFor="joincode">
                Access code
              </label>
              <input
                id="joincode"
                className="input mt-2 font-mono uppercase tracking-[0.25em]"
                placeholder="K7F2MX"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <div className="mt-1.5 text-xs text-ink-400">
                Room links require the access code shared by the host.
              </div>
            </>
          )}

          <label className="mt-4 block text-sm font-semibold text-ink-700" htmlFor="joinname">
            Display name
          </label>
          <input
            id="joinname"
            className="input mt-2"
            placeholder="e.g. Maria"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <button className="btn-primary mt-6 w-full" disabled={busy} onClick={handleJoin}>
            {busy ? <Spinner /> : "Join Room"}
          </button>

          <div className="mt-4 text-center text-xs text-ink-400">
            Up to 20 players per room · no sign-up needed
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/create")}
            className="text-sm font-semibold text-brand-600 transition hover:text-brand-700"
          >
            Or create a new room →
          </button>
        </div>
      </div>
    </div>
  );
}
