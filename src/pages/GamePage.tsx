import { useEffect, useState } from "react";
import Board from "../puzzle/Board";
import { store, useStore } from "../store";
import { api } from "../lib/api";
import { copyToClipboard, inviteUrl } from "../lib/format";
import { navigate } from "../lib/router";
import { LangToggle, useLang } from "../lib/i18n";
import { AccessiblePlay } from "../components/AccessiblePlay";
import type { CatalogData } from "../types";
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
  useEffect(() => {
    if (room?.completed)
      api
        .fetchCatalog()
        .then((c) => {
          setCatalog(c);
          setNextPuzzle(c.puzzles[0]?.id || "");
        })
        .catch((e) => setMessage(e.message));
  }, [room?.completed]);
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
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
    typeof puzzle.name === "string" ? puzzle.name : puzzle.name[lang];
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
        <span role="status" aria-live="polite">
          {count}/{room.total} {ro ? "piese" : "pieces"}
        </span>
        <button
          className="btn-dark btn-sm"
          onClick={() => setInvite(!invite)}
          aria-expanded={invite}
        >
          👥 {players.length} · {ro ? "Invită" : "Invite"}
        </button>
        <button
          className="btn-dark btn-sm"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          {ro ? "Ajutor" : "Help"}
        </button>
      </header>
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
                <ul className="my-3">
                  {players.map((p) => (
                    <li key={p.id}>
                      {p.name}
                      {p.role === "spectator"
                        ? ro
                          ? " · observă"
                          : " · observing"
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
                {host && room.stage === "play" && !room.completed && (
                  <button
                    className="btn-secondary mt-3"
                    disabled={!connected}
                    onClick={() =>
                      store.sendControl("lock", { locked: !room.boardLocked })
                    }
                  >
                    {room.boardLocked
                      ? ro
                        ? "Continuă jocul"
                        : "Resume game"
                      : ro
                        ? "Pauză pentru toți"
                        : "Pause for everyone"}
                  </button>
                )}
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
            {accessible && (
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
                <h1 className="text-3xl font-bold">
                  {ro ? "L-am construit împreună!" : "We built it together!"} 🎉
                </h1>
                <img
                  src={puzzle.image}
                  alt={puzzleName}
                  className="my-4 max-h-64 w-full rounded-xl object-contain"
                />
                <p>{room.completionPlayers.join(" · ")}</p>
                {host && (
                  <div className="mt-4 space-y-3">
                    <button
                      className="btn-primary"
                      onClick={() =>
                        action(() => api.resetPuzzle(room.id, you!))
                      }
                    >
                      {ro ? "Joacă din nou" : "Play again"}
                    </button>
                    <label className="block">
                      {ro ? "Alt puzzle" : "Another puzzle"}
                      <select
                        className="input mt-2"
                        value={nextPuzzle}
                        onChange={(e) => setNextPuzzle(e.target.value)}
                      >
                        {catalog?.puzzles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn-secondary"
                      disabled={!nextPuzzle}
                      onClick={() =>
                        action(() =>
                          api.changePuzzle(
                            room.id,
                            nextPuzzle,
                            room.difficulty,
                            you!,
                          ),
                        )
                      }
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
