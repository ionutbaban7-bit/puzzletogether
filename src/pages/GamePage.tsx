import { useEffect, useRef, useState } from "react";
import Board from "../puzzle/Board";
import { store, useStore } from "../store";
import { api } from "../lib/api";
import { copyToClipboard, formatClock, formatDuration, inviteUrl } from "../lib/format";
import { useRoundClock } from "../lib/useRoundClock";
import { navigate } from "../lib/router";
import { LangToggle, useLang } from "../lib/i18n";
import { AccessiblePlay } from "../components/AccessiblePlay";
import { PhotoPicker } from "../components/PhotoPicker";
import { Podium } from "../components/Podium";
import type { CatalogData, RoomView } from "../types";

function RoundTimer({ room, ro }: { room: RoomView; ro: boolean }) {
  const elapsed = useRoundClock(room);
  return <span className="tabular-nums" role="timer" aria-label={ro ? "Timpul echipei" : "Team time"} aria-live="off">{formatClock(elapsed)}</span>;
}

export default function GamePage() {
  const s = useStore((s) => s);
  const { room, puzzle, pieces, players, you, connected } = s;
  const { lang } = useLang();
  const ro = lang === "ro";
  const [help, setHelp] = useState(false);
  const [invite, setInvite] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [message, setMessage] = useState("");
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [nextPuzzle, setNextPuzzle] = useState("");
  const [nextPhoto, setNextPhoto] = useState<File | null>(null);
  const [nextBusy, setNextBusy] = useState(false);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!room?.completed) return;
    setHelp(false);
    setInvite(false);
    const frame = window.requestAnimationFrame(() => {
      completionHeading.current?.focus({ preventScroll: true });
      completionHeading.current?.scrollIntoView({ block: "start" });
    });
    api
        .fetchCatalog()
        .then((c) => {
          setCatalog(c);
          setNextPuzzle(c.puzzles[0]?.id || "");
        })
        .catch((e) => setMessage(e.message));
    return () => window.cancelAnimationFrame(frame);
  }, [room?.completed]);
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function changeImage() {
    if (!room || !you || nextBusy) return;
    setNextBusy(true);
    await action(async () => {
      const photo = nextPuzzle === "custom-upload" && nextPhoto ? await api.uploadImage(nextPhoto) : undefined;
      await api.changePuzzle(room.id, nextPuzzle, room.difficulty, you, undefined, undefined, photo);
    });
    setNextBusy(false);
  }
  if (s.status === "denied" || s.status === "closed")
    return (
      <main className="p-8">
        <h1>{ro ? "Sesiunea s-a încheiat" : "Session ended"}</h1>
        <p role="alert">{s.denyMessage || s.closedMessage}</p>
        <button
          className="btn-primary mt-4"
          onClick={() => {
            store.leaveRoom();
            navigate("/join");
          }}
        >
          {ro ? "Înapoi" : "Back"}
        </button>
      </main>
    );
  if (!room || !puzzle)
    return (
      <main className="p-8" role="status">
        {ro ? "Se conectează…" : "Connecting…"}
      </main>
    );
  const puzzleName =
    puzzle.category === "custom" ? (ro ? "Fotografia ta" : "Your photo") : typeof puzzle.name === "string" ? (ro ? puzzle.nameRo || puzzle.name : puzzle.name) : puzzle.name[lang];
  const host = room.hostId === you;
  const me = players.find((p) => p.id === you);
  const count = Object.values(pieces).filter((p) => p.locked).length;
  const enabled =
    connected &&
    room.stage === "play" &&
    !room.completed &&
    !room.boardLocked &&
    me?.role !== "spectator";
  const share = async () => {
    setMessage(
      (await copyToClipboard(inviteUrl(room)))
        ? ro
          ? "Link copiat."
          : "Link copied."
        : ro
          ? "Selectează și copiază linkul de mai jos."
          : "Select and copy the link below.",
    );
  };
  return (
    <main className="game-v2">
      <header className="game-v2-header">
        <button
          className="font-bold"
          onClick={() => {
            store.leaveRoom();
            navigate("/");
          }}
          aria-label={ro ? "Ieși din joc" : "Leave game"}
        >
          🧩 <span className="hidden sm:inline">PuzzleTogether</span>
        </button>
        <div className="min-w-24">
          <span role="status" aria-live="polite">{count}/{room.total} {ro ? "piese" : "pieces"}</span>
          <progress className="block h-1 w-full accent-emerald-400" aria-label={ro ? "Progres comun" : "Shared progress"} value={count} max={room.total} />
        </div>
        <RoundTimer room={room} ro={ro} />
        {host && room.stage === "play" && !room.completed && (
          <button className="btn-dark btn-sm" disabled={!connected} onClick={() => store.sendControl("lock", { locked: !room.boardLocked })}>
            {room.boardLocked ? (ro ? "Continuă jocul" : "Resume game") : (ro ? "Pauză pentru toți" : "Pause for everyone")}
          </button>
        )}
        <button
          className="btn-dark btn-sm"
          onClick={() => setInvite(!invite)}
          aria-expanded={invite}
        >
          👥 {players.filter((p) => p.role !== "spectator").length}/{room.maxPlayers} · {ro ? "Invită" : "Invite"}
        </button>
        <button
          className="btn-dark btn-sm"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          {ro ? "Ajutor" : "Help"}
        </button>
      </header>
      {room.stage === "play" && !room.completed && room.boardLocked && <p role="status" className="game-v2-notice">{ro ? "Pauză pentru toți. Timpul este oprit." : "Paused for everyone. The clock is stopped."}</p>}
      {room.podiumEnabled && !room.completed && <p className="px-3 pb-2 text-sm">{ro ? "Podium la final · 1 piesă = 1 punct" : "Podium at the end · 1 piece = 1 point"}</p>}
      {room.photoExpiresAt && (
        <p className="game-v2-notice text-sm">
          <span>{ro ? "Fotografia se șterge la " : "Photo deleted at "}
          <time dateTime={new Date(room.photoExpiresAt).toISOString()}>{new Date(room.photoExpiresAt).toLocaleTimeString(ro ? "ro-RO" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</time>.</span>
        </p>
      )}
      {room.photoExpiredAt && <p role="status" className="game-v2-notice">{ro ? "Fotografia a fost ștearsă după 1h. Puteți continua cu acest puzzle." : "The photo was deleted after 1h. You can continue with this puzzle."}</p>}
      {!connected && (
        <div role="status" className="game-v2-notice">
          {ro
            ? "Conexiune întreruptă. Reconectăm…"
            : "Disconnected. Reconnecting…"}
          {s.reconnectExhausted && (
            <button onClick={() => location.reload()}>
              {ro ? "Reîncarcă" : "Reload"}
            </button>
          )}
        </div>
      )}
      {(message || s.protocolError) && (
        <div role="status" className="game-v2-notice">
          <span>{message || s.protocolError}</span>
          <button
            aria-label={ro ? "Închide mesajul" : "Dismiss message"}
            onClick={() => {
              setMessage("");
              store.clearError();
            }}
          >
            ×
          </button>
        </div>
      )}
      <div className="game-v2-content">
        <section
          className="game-v2-board"
          aria-label={ro ? "Tabla de joc" : "Game board"}
        >
          <Board
            puzzle={puzzle}
            pieces={pieces}
            players={players}
            cursors={s.cursors}
            youId={you}
            onPieceDrop={store.applyLocalDrop}
            onResetRequest={() => {}}
            allowReset={false}
            resetSignal={s.epoch}
            inputEnabled={enabled}
            layoutMode={room.jigsawLayout}
            toolsOpen={help}
          />
        </section>
        {(help ||
          invite ||
          accessible ||
          room.stage === "lobby" ||
          room.completed) && (
          <aside className="game-v2-panel">
            {invite && (
              <section>
                <h2>{ro ? "Invită" : "Invite"}</h2>
                <button className="btn-primary my-3" onClick={share}>
                  {ro ? "Copiază invitația" : "Copy invitation"}
                </button>
                <label className="block text-sm">
                  {ro ? "Link privat" : "Private link"}
                  <input
                    aria-label={ro ? "Link privat" : "Private link"}
                    className="input mt-2"
                    readOnly
                    value={inviteUrl(room)}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <p className="my-3">
                  {ro ? "Cod:" : "Code:"} <strong>{room.code}</strong>
                </p>
                <p className="text-sm">
                  {ro
                    ? "Distribuie doar grupului tău."
                    : "Share only with your group."}
                </p>
                <ul className="my-3 max-h-64 overflow-auto break-words">
                  {players.map((p) => (
                    <li key={p.id}>
                      {p.name}
                      {p.role === "spectator"
                        ? ro
                          ? " · facilitator, observă"
                          : " · facilitator, observing"
                        : ""}
                      {host && p.id !== you && (
                        <button
                          className="ml-3 text-sm underline"
                          onClick={() => {
                            if (
                              confirm(
                                ro
                                  ? `Elimini ${p.name}? Invitația veche va fi revocată.`
                                  : `Remove ${p.name}? The old invitation will be revoked.`,
                              )
                            )
                              store.sendControl("kick", { playerId: p.id });
                          }}
                        >
                          {ro ? "Elimină" : "Remove"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {host && (
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      action(async () => {
                        const session = (
                          await import("../lib/session")
                        ).getSession();
                        const r = await fetch(`/api/rooms/${room.id}/invite`, {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${session.credential}`,
                          },
                        });
                        if (!r.ok)
                          throw new Error(
                            ro
                              ? "Invitația nu a putut fi schimbată."
                              : "Could not renew invitation.",
                          );
                        setMessage(
                          ro
                            ? "Copiază invitația nouă."
                            : "Copy the new invitation.",
                        );
                      })
                    }
                  >
                    {ro ? "Schimbă invitația" : "Renew invitation"}
                  </button>
                )}
              </section>
            )}
            {room.stage === "lobby" && (
              <section>
                <h1 className="text-2xl font-bold">{puzzleName}</h1>
                <p className="my-3 text-sm">
                  {room.total} {ro ? "piese" : "pieces"}
                </p>
                {me?.role === "spectator" && <p className="mb-3 text-sm">{ro ? "Facilitezi sesiunea fără să muți piese." : "You facilitate the session without moving pieces."}</p>}
                <button
                  className="btn-secondary mb-3"
                  onClick={() => {
                    setInvite(true);
                    share();
                  }}
                >
                  {ro ? "Invită un prieten" : "Invite a friend"}
                </button>
                {host ? (
                  <button
                    className="btn-primary block"
                    disabled={!connected}
                    onClick={() => store.sendControl("start")}
                  >
                    {ro ? "Începe jocul" : "Start game"}
                  </button>
                ) : (
                  <p role="status">
                    {ro
                      ? "Gazda va porni jocul."
                      : "The host will start the game."}
                  </p>
                )}
              </section>
            )}
            {help && (
              <section>
                <h2>{ro ? "Cum jucăm" : "How to play"}</h2>
                <p className="my-3">
                  {ro
                    ? "Trage piesele pe imagine. Mișcă tabla din spațiul liber. +/− pentru zoom."
                    : "Drag pieces onto the picture. Pan from empty space. +/− to zoom."}
                </p>
                <button
                  className="btn-secondary"
                  aria-expanded={accessible}
                  onClick={() => setAccessible(!accessible)}
                >
                  {ro ? "Joc fără tragere" : "Play without dragging"}
                </button>
                <p className="mt-4 text-xs">
                  {puzzle.attribution || `${puzzle.credit || ""}${puzzle.license ? ` · ${puzzle.license}` : ""}`}
                </p>
                <LangToggle />
                {!players.some((p) => p.id === room.hostId) && !host && (
                  <button
                    className="btn-secondary mt-3"
                    onClick={() => action(() => api.takeover(room.id, you!))}
                  >
                    {ro ? "Preia rolul gazdei" : "Become host"}
                  </button>
                )}
              </section>
            )}
            {accessible && !room.completed && (
              <AccessiblePlay
                key={s.epoch}
                puzzle={puzzle}
                pieces={pieces}
                you={you}
                enabled={enabled}
              />
            )}
            {room.completed && (
              <section role="status">
                <h1 ref={completionHeading} tabIndex={-1} className="text-3xl font-bold">
                  {ro ? "L-am construit împreună!" : "We built it together!"} 🎉
                </h1>
                <img
                  src={puzzle.image}
                  alt={puzzleName}
                  className="my-4 max-h-64 w-full rounded-xl object-contain"
                />
                {room.completionPlayers.length > 6 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer py-2">{room.completionPlayers.length} {ro ? "jucători · Arată echipa" : "players · Show team"}</summary>
                    <p className="break-words">{room.completionPlayers.join(" · ")}</p>
                  </details>
                ) : <p className="break-words">{room.completionPlayers.join(" · ")}</p>}
                <p className="mt-3 font-semibold">{ro ? "Timpul echipei:" : "Team time:"} {formatDuration(room.completedInMs ?? 0)}</p>
                {room.podiumEnabled && <Podium scores={s.scores} ro={ro} />}
                {host && (
                  <div className="mt-4 space-y-3">
                    <button
                      className="btn-primary"
                      onClick={() =>
                        action(() => api.replay(room.id))
                      }
                    >
                      {ro ? "Joacă din nou" : "Play again"}
                    </button>
                    <label className="block">
                      {ro ? "Alt puzzle" : "Another puzzle"}
                      <select
                        className="input mt-2"
                        aria-label={ro ? "Alt puzzle" : "Another puzzle"}
                        value={nextPuzzle}
                        disabled={nextBusy}
                        onChange={(e) => setNextPuzzle(e.target.value)}
                      >
                        {nextPhoto && <option value="custom-upload">{ro ? "Fotografia ta" : "Your photo"}</option>}
                        {catalog?.puzzles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {ro ? p.nameRo || p.name : p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PhotoPicker file={nextPhoto} selected={nextPuzzle === "custom-upload"} onChange={setNextPhoto} onSelect={() => setNextPuzzle("custom-upload")} onError={setMessage} disabled={nextBusy} />
                    <button
                      className="btn-secondary"
                      disabled={!nextPuzzle || nextBusy}
                      onClick={changeImage}
                    >
                      {ro ? "Alege imaginea" : "Choose picture"}
                    </button>
                  </div>
                )}
              </section>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
