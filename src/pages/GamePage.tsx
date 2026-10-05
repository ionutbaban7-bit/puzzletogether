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

type Panel = "invite" | "chat" | "gallery" | "host" | "help" | null;

function RoundTimer({ room, ro }: { room: RoomView; ro: boolean }) {
  const elapsed = useRoundClock(room);
  return (
    <span className="tabular-nums" role="timer" aria-label={ro ? "Timpul echipei" : "Team time"} aria-live="off">
      {formatClock(elapsed)}
    </span>
  );
}

export default function GamePage() {
  const s = useStore((state) => state);
  const { room, puzzle, pieces, players, you, connected } = s;
  const { lang } = useLang();
  const ro = lang === "ro";
  const [panel, setPanel] = useState<Panel>(null);
  const [accessible, setAccessible] = useState(false);
  const [message, setMessage] = useState("");
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [nextPuzzle, setNextPuzzle] = useState("");
  const [nextPhoto, setNextPhoto] = useState<File | null>(null);
  const [nextBusy, setNextBusy] = useState(false);
  const [galleryCategory, setGalleryCategory] = useState("anchors");
  const [chatDraft, setChatDraft] = useState("");
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api.fetchCatalog()
      .then((value) => {
        if (!active) return;
        setCatalog(value);
        setNextPuzzle((current) => current || value.puzzles[0]?.id || "");
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!room?.completed) return;
    setPanel(null);
    const frame = window.requestAnimationFrame(() => {
      completionHeading.current?.focus({ preventScroll: true });
      completionHeading.current?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [room?.completed]);

  useEffect(() => {
    if (panel !== "chat") return;
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [panel, s.chat.length]);

  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((current) => current === next ? null : next);
  }

  if (s.status === "denied" || s.status === "closed") {
    return (
      <main className="p-8">
        <h1>{ro ? "Sesiunea s-a încheiat" : "Session ended"}</h1>
        <p role="alert">{s.denyMessage || s.closedMessage}</p>
        <button className="btn-primary mt-4" onClick={() => { store.leaveRoom(); navigate("/join"); }}>
          {ro ? "Înapoi" : "Back"}
        </button>
      </main>
    );
  }

  if (!room || !puzzle) {
    return <main className="p-8" role="status">{ro ? "Se conectează…" : "Connecting…"}</main>;
  }

  const puzzleName = puzzle.category === "custom"
    ? (ro ? "Fotografia ta" : "Your photo")
    : typeof puzzle.name === "string"
      ? (ro ? puzzle.nameRo || puzzle.name : puzzle.name)
      : puzzle.name[lang];
  const host = room.hostId === you;
  const me = players.find((player) => player.id === you);
  const count = Object.values(pieces).filter((piece) => piece.locked).length;
  const enabled = connected && room.stage === "play" && !room.completed && !room.boardLocked && me?.role !== "spectator";
  const currentDifficulty = catalog?.difficulties.find((difficulty) => difficulty.id === room.difficulty);
  const nextDifficulty = catalog?.difficulties
    .filter((difficulty) => difficulty.pieces > (currentDifficulty?.pieces || room.total))
    .sort((a, b) => a.pieces - b.pieces)[0];
  const galleryPuzzles = catalog?.puzzles.filter((item) => {
    if (galleryCategory === "all") return true;
    if (galleryCategory === "anchors") return item.anchor === true;
    return item.category === galleryCategory;
  }) || [];
  const panelVisible = panel !== null || room.stage === "lobby" || room.completed || accessible;

  async function share() {
    setMessage(
      (await copyToClipboard(inviteUrl(room)))
        ? (ro ? "Link copiat." : "Link copied.")
        : (ro ? "Selectează și copiază linkul de mai jos." : "Select and copy the link below."),
    );
  }

  async function changeImage() {
    if (!you || nextBusy || !nextPuzzle) return;
    if (!room.completed && room.stage === "play" && count > 0) {
      const confirmed = window.confirm(ro
        ? "Schimbi imaginea? Progresul puzzle-ului curent va fi înlocuit, dar grupul rămâne în cameră."
        : "Change the picture? Current puzzle progress will be replaced, but the group stays in the room.");
      if (!confirmed) return;
    }
    setNextBusy(true);
    await action(async () => {
      const photo = nextPuzzle === "custom-upload" && nextPhoto ? await api.uploadImage(nextPhoto) : undefined;
      await api.changePuzzle(room.id, nextPuzzle, room.difficulty, you, undefined, undefined, photo);
      setPanel(null);
      setNextPhoto(null);
    });
    setNextBusy(false);
  }

  async function changeDifficulty(difficulty: string) {
    if (!you || nextBusy || difficulty === room.difficulty) return;
    const target = catalog?.difficulties.find((item) => item.id === difficulty);
    const confirmed = room.completed || count === 0 || window.confirm(ro
      ? "Schimbi nivelul? Tabla se reconstruiește, dar invitația și grupul rămân aceleași."
      : "Change level? The board will rebuild, but the invitation and group stay the same.");
    if (!confirmed) return;
    setNextBusy(true);
    await action(async () => {
      await api.changePuzzle(room.id, room.puzzleId, difficulty, you);
      setMessage(target
        ? (ro ? "Nivel schimbat la " + target.pieces + " piese." : "Level changed to " + target.pieces + " pieces.")
        : (ro ? "Nivel schimbat." : "Level changed."));
      setPanel(null);
    });
    setNextBusy(false);
  }

  async function resetPuzzle() {
    if (!you || nextBusy) return;
    const confirmed = window.confirm(ro
      ? "Rearanjezi toate piesele? Timpul rundei rămâne în continuare."
      : "Reset all pieces? The round timer will keep its current time.");
    if (!confirmed) return;
    setNextBusy(true);
    await action(async () => {
      await api.resetPuzzle(room.id, you);
      setMessage(ro ? "Puzzle resetat. Timpul a fost păstrat." : "Puzzle reset. The timer was preserved.");
      setPanel(null);
    });
    setNextBusy(false);
  }

  async function resetSession() {
    if (!you || nextBusy) return;
    const confirmed = window.confirm(ro
      ? "Resetezi runda și revii în lobby? Oamenii rămân în aceeași cameră."
      : "Reset the round and return to the lobby? People stay in the same room.");
    if (!confirmed) return;
    setNextBusy(true);
    await action(async () => {
      await api.resetRoom(room.id, you);
      setMessage(ro ? "Runda a fost resetată." : "Round reset.");
      setPanel(null);
    });
    setNextBusy(false);
  }

  function sendChat() {
    const text = chatDraft.trim();
    if (!text) return;
    store.sendChat(text);
    setChatDraft("");
  }

  return (
    <main className="game-v2">
      <header className="game-v2-header">
        <button className="game-v2-brand" onClick={() => { store.leaveRoom(); navigate("/"); }} aria-label={ro ? "Ieși din joc" : "Leave game"}>
          <span aria-hidden>🧩</span><span className="hidden sm:inline">PuzzleTogether</span>
        </button>

        <div className="game-v2-progress min-w-24">
          <span role="status" aria-live="polite">{count}/{room.total} {ro ? "piese" : "pieces"}</span>
          <progress aria-label={ro ? "Progres comun" : "Shared progress"} value={count} max={room.total} />
        </div>

        <div className="game-v2-clock"><RoundTimer room={room} ro={ro} /></div>

        <div className="game-v2-toolbar">
          {host && room.stage === "play" && !room.completed && (
            <button className="btn-dark btn-sm" disabled={!connected} onClick={() => store.sendControl("lock", { locked: !room.boardLocked })}>
              {room.boardLocked ? (ro ? "Continuă" : "Resume") : (ro ? "Pauză" : "Pause")}
            </button>
          )}
          <button className="btn-dark btn-sm" onClick={() => togglePanel("invite")} aria-expanded={panel === "invite"}>
            👥 {players.filter((player) => player.role !== "spectator").length}/{room.maxPlayers} · {ro ? "Invită" : "Invite"}
          </button>
          <button className="btn-dark btn-sm" onClick={() => togglePanel("chat")} aria-expanded={panel === "chat"}>
            💬 {ro ? "Chat" : "Chat"}{s.chat.length ? " · " + s.chat.length : ""}
          </button>
          {host && (
            <button className="btn-dark btn-sm" onClick={() => togglePanel("gallery")} aria-expanded={panel === "gallery"}>
              ▦ {ro ? "Galerie" : "Gallery"}
            </button>
          )}
          {host && (
            <button className="btn-dark btn-sm" onClick={() => togglePanel("host")} aria-expanded={panel === "host"}>
              ⚙ {ro ? "Opțiuni" : "Host options"}
            </button>
          )}
          <button className="btn-dark btn-sm" onClick={() => togglePanel("help")} aria-expanded={panel === "help"}>
            {ro ? "Ajutor" : "Help"}
          </button>
        </div>
      </header>

      {room.stage === "play" && !room.completed && room.boardLocked && (
        <p role="status" className="game-v2-notice">
          <span>{ro ? "Pauză pentru toți. Timpul este oprit." : "Paused for everyone. The clock is stopped."}</span>
        </p>
      )}
      {room.podiumEnabled && !room.completed && (
        <p className="game-v2-meta">{ro ? "Podium la final · 1 piesă = 1 punct" : "Podium at the end · 1 piece = 1 point"}</p>
      )}
      {room.photoExpiresAt && (
        <p className="game-v2-notice text-sm">
          <span>
            {ro ? "Fotografia se șterge la " : "Photo deleted at "}
            <time dateTime={new Date(room.photoExpiresAt).toISOString()}>
              {new Date(room.photoExpiresAt).toLocaleTimeString(ro ? "ro-RO" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
            </time>.
          </span>
        </p>
      )}
      {room.photoExpiredAt && (
        <p role="status" className="game-v2-notice">
          {ro ? "Fotografia a fost ștearsă după 1h. Puteți continua cu un puzzle din bibliotecă." : "The photo was deleted after 1h. You can continue with a library puzzle."}
        </p>
      )}
      {!connected && (
        <div role="status" className="game-v2-notice">
          <span>{ro ? "Conexiune întreruptă. Reconectăm…" : "Disconnected. Reconnecting…"}</span>
          {s.reconnectExhausted && <button onClick={() => location.reload()}>{ro ? "Reîncarcă" : "Reload"}</button>}
        </div>
      )}
      {(message || s.protocolError) && (
        <div role="status" className="game-v2-notice">
          <span>{message || s.protocolError}</span>
          <button aria-label={ro ? "Închide mesajul" : "Dismiss message"} onClick={() => { setMessage(""); store.clearError(); }}>×</button>
        </div>
      )}

      <div className={"game-v2-content " + ((room.stage === "lobby" || room.completed) ? "game-v2-priority-panel" : "")}>
        <section className="game-v2-board" aria-label={ro ? "Tabla de joc" : "Game board"}>
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
            toolsOpen={panel === "help"}
          />
        </section>

        {panelVisible && (
          <aside className="game-v2-panel">
            <div className="game-v2-panel-top">
              <div>
                <span className="game-v2-panel-eyebrow">{puzzleName}</span>
                <strong>{room.total} {ro ? "piese" : "pieces"}</strong>
              </div>
              {panel && (
                <button className="game-v2-panel-close" aria-label={ro ? "Închide panoul" : "Close panel"} onClick={() => setPanel(null)}>×</button>
              )}
            </div>

            {panel === "invite" && (
              <section>
                <h2>{ro ? "Invită în cameră" : "Invite to the room"}</h2>
                <button className="btn-primary my-3" onClick={share}>{ro ? "Copiază invitația" : "Copy invitation"}</button>
                <label className="block text-sm">
                  {ro ? "Link privat" : "Private link"}
                  <input aria-label={ro ? "Link privat" : "Private link"} className="input mt-2" readOnly value={inviteUrl(room)} onFocus={(event) => event.target.select()} />
                </label>
                <p className="my-3">{ro ? "Cod:" : "Code:"} <strong>{room.code}</strong></p>
                <p className="text-sm">{ro ? "Distribuie doar grupului tău." : "Share only with your group."}</p>
                <ul className="game-v2-people">
                  {players.map((player) => (
                    <li key={player.id}>
                      <span><i style={{ background: player.color }} />{player.name}{player.role === "spectator" ? (ro ? " · facilitator" : " · facilitator") : ""}</span>
                      {host && player.id !== you && (
                        <button
                          className="text-sm underline"
                          onClick={() => {
                            const confirmed = window.confirm(ro ? "Elimini " + player.name + "? Invitația veche va fi revocată." : "Remove " + player.name + "? The old invitation will be revoked.");
                            if (confirmed) store.sendControl("kick", { playerId: player.id });
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
                    onClick={() => action(async () => {
                      const session = (await import("../lib/session")).getSession();
                      const response = await fetch("/api/rooms/" + room.id + "/invite", {
                        method: "POST",
                        headers: { Authorization: "Bearer " + session.credential },
                      });
                      if (!response.ok) throw new Error(ro ? "Invitația nu a putut fi schimbată." : "Could not renew invitation.");
                      setMessage(ro ? "Invitație nouă creată. Copiază linkul din nou." : "New invitation created. Copy the link again.");
                    })}
                  >
                    {ro ? "Schimbă invitația" : "Renew invitation"}
                  </button>
                )}
              </section>
            )}

            {panel === "chat" && (
              <section className="game-v2-chat">
                <div className="game-v2-section-title">
                  <div><h2>Chat</h2><p>{ro ? "Mesajele rămân lângă joc." : "Messages stay next to the game."}</p></div>
                </div>
                <div className="game-v2-chat-log" aria-live="polite">
                  {s.chat.length === 0 && <p className="game-v2-empty">{ro ? "Încă nu sunt mesaje." : "No messages yet."}</p>}
                  {s.chat.map((entry) => (
                    <div key={entry.id} className={"game-v2-chat-message " + (entry.playerId === you ? "is-mine" : "")}>
                      <div><strong style={{ color: entry.color }}>{entry.name}</strong><time>{new Date(entry.at).toLocaleTimeString(ro ? "ro-RO" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</time></div>
                      <p>{entry.text}</p>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form className="game-v2-chat-form" onSubmit={(event) => { event.preventDefault(); sendChat(); }}>
                  <label className="sr-only" htmlFor="room-chat">{ro ? "Mesaj" : "Message"}</label>
                  <input id="room-chat" className="input" maxLength={500} placeholder={ro ? "Scrie un mesaj…" : "Write a message…"} value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} />
                  <button className="btn-primary" disabled={!connected || !chatDraft.trim()}>{ro ? "Trimite" : "Send"}</button>
                </form>
              </section>
            )}

            {panel === "gallery" && host && (
              <section>
                <div className="game-v2-section-title">
                  <div><h2>{ro ? "Galerie" : "Gallery"}</h2><p>{ro ? "Schimbi imaginea fără să pierzi grupul." : "Change the picture without losing the group."}</p></div>
                </div>
                <div className="game-v2-category-row">
                  <button className={galleryCategory === "anchors" ? "is-active" : ""} onClick={() => setGalleryCategory("anchors")}>{ro ? "Repere" : "Icons"}</button>
                  <button className={galleryCategory === "all" ? "is-active" : ""} onClick={() => setGalleryCategory("all")}>{ro ? "Toate" : "All"}</button>
                  {catalog?.categories.map((category) => (
                    <button key={category.id} className={galleryCategory === category.id ? "is-active" : ""} onClick={() => setGalleryCategory(category.id)}>
                      {category.name}
                    </button>
                  ))}
                </div>
                <div className="game-v2-gallery-grid">
                  {galleryPuzzles.map((item) => (
                    <button
                      key={item.id}
                      className={nextPuzzle === item.id ? "is-selected" : ""}
                      onClick={() => setNextPuzzle(item.id)}
                      aria-pressed={nextPuzzle === item.id}
                    >
                      <img src={item.thumbnail || item.image} alt="" loading="lazy" />
                      <span>{ro ? item.nameRo || item.name : item.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <PhotoPicker file={nextPhoto} selected={nextPuzzle === "custom-upload"} onChange={setNextPhoto} onSelect={() => setNextPuzzle("custom-upload")} onError={setMessage} disabled={nextBusy} />
                </div>
                <button className="btn-primary w-full" disabled={!nextPuzzle || nextBusy} onClick={changeImage}>
                  {nextBusy ? "…" : ro ? "Schimbă imaginea" : "Change picture"}
                </button>
              </section>
            )}

            {panel === "host" && host && (
              <section>
                <div className="game-v2-section-title">
                  <div><h2>{ro ? "Opțiunile gazdei" : "Host options"}</h2><p>{ro ? "Control asupra rundei, nu asupra oamenilor." : "Control the round, not the people."}</p></div>
                </div>
                {room.stage === "play" && !room.completed && (
                  <button className="btn-secondary w-full" disabled={!connected} onClick={() => store.sendControl("lock", { locked: !room.boardLocked })}>
                    {room.boardLocked ? (ro ? "Continuă pentru toți" : "Resume for everyone") : (ro ? "Pauză pentru toți" : "Pause for everyone")}
                  </button>
                )}
                <label className="mt-4 block text-sm font-semibold" htmlFor="room-difficulty">{ro ? "Nivel / număr de piese" : "Level / piece count"}</label>
                <select id="room-difficulty" className="input mt-2" value={room.difficulty} disabled={nextBusy || !catalog} onChange={(event) => changeDifficulty(event.target.value)}>
                  {catalog?.difficulties.map((difficulty) => <option key={difficulty.id} value={difficulty.id}>{difficulty.pieces} {ro ? "piese" : "pieces"}</option>)}
                </select>
                {nextDifficulty && (
                  <button className="btn-primary mt-3 w-full" disabled={nextBusy} onClick={() => changeDifficulty(nextDifficulty.id)}>
                    {ro ? "Nivelul următor · " + nextDifficulty.pieces + " piese" : "Next level · " + nextDifficulty.pieces + " pieces"}
                  </button>
                )}
                {room.stage === "play" && !room.completed && (
                  <button className="btn-secondary mt-3 w-full" disabled={nextBusy} onClick={resetPuzzle}>
                    {ro ? "Rearanjează puzzle-ul" : "Reset puzzle"}
                  </button>
                )}
                <button className="game-v2-danger mt-3 w-full" disabled={nextBusy} onClick={resetSession}>
                  {ro ? "Resetează runda și revino în lobby" : "Reset round and return to lobby"}
                </button>
              </section>
            )}

            {panel === "help" && (
              <section>
                <h2>{ro ? "Cum jucăm" : "How to play"}</h2>
                <p className="my-3">
                  {ro ? "Trage piesele pe imagine. Mișcă tabla din spațiul liber. Folosește +/− pentru zoom." : "Drag pieces onto the picture. Pan from empty space. Use +/− to zoom."}
                </p>
                <button className="btn-secondary" aria-expanded={accessible} onClick={() => setAccessible(!accessible)}>
                  {ro ? "Joc fără tragere" : "Play without dragging"}
                </button>
                <p className="mt-4 text-xs">{puzzle.attribution || ((puzzle.credit || "") + (puzzle.license ? " · " + puzzle.license : ""))}</p>
                <div className="mt-4"><LangToggle /></div>
                {!players.some((player) => player.id === room.hostId) && !host && (
                  <button className="btn-secondary mt-3" onClick={() => action(() => api.takeover(room.id, you!))}>
                    {ro ? "Preia rolul gazdei" : "Become host"}
                  </button>
                )}
              </section>
            )}

            {accessible && !room.completed && (
              <section>
                <AccessiblePlay key={s.epoch} puzzle={puzzle} pieces={pieces} you={you} enabled={enabled} />
              </section>
            )}

            {room.stage === "lobby" && (
              <section className="game-v2-lobby">
                <span className="game-v2-panel-eyebrow">{ro ? "CAMERA ESTE GATA" : "ROOM READY"}</span>
                <h1>{puzzleName}</h1>
                <p>{room.total} {ro ? "piese" : "pieces"} · {players.filter((player) => player.role !== "spectator").length} {ro ? "jucători conectați" : "players connected"}</p>
                {me?.role === "spectator" && <p className="text-sm">{ro ? "Facilitezi sesiunea fără să muți piese." : "You facilitate the session without moving pieces."}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => { setPanel("invite"); share(); }}>
                    {ro ? "Invită un prieten" : "Invite a friend"}
                  </button>
                  {host ? (
                    <button className="btn-primary" disabled={!connected} onClick={() => store.sendControl("start")}>
                      {ro ? "Începe jocul" : "Start game"}
                    </button>
                  ) : (
                    <p role="status" className="game-v2-waiting">{ro ? "Gazda va porni jocul." : "The host will start the game."}</p>
                  )}
                </div>
              </section>
            )}

            {room.completed && (
              <section role="status" className="game-v2-result">
                <span className="game-v2-panel-eyebrow">{ro ? "PUZZLE FINALIZAT" : "PUZZLE COMPLETE"}</span>
                <h1 ref={completionHeading} tabIndex={-1}>{ro ? "L-am construit împreună!" : "We built it together!"} 🎉</h1>
                <img src={puzzle.image} alt={puzzleName} className="game-v2-result-image" />
                {room.completionPlayers.length > 6 ? (
                  <details className="mt-3"><summary className="cursor-pointer py-2">{room.completionPlayers.length} {ro ? "jucători · Arată echipa" : "players · Show team"}</summary><p className="break-words">{room.completionPlayers.join(" · ")}</p></details>
                ) : <p className="break-words">{room.completionPlayers.join(" · ")}</p>}
                <p className="mt-3 font-semibold">{ro ? "Timpul echipei:" : "Team time:"} {formatDuration(room.completedInMs ?? 0)}</p>
                {room.podiumEnabled && <Podium scores={s.scores} ro={ro} />}

                {host && (
                  <div className="game-v2-result-actions">
                    <button className="btn-primary" onClick={() => action(() => api.replay(room.id))}>
                      {ro ? "Joacă din nou" : "Play again"}
                    </button>
                    {nextDifficulty && (
                      <button className="btn-secondary" disabled={nextBusy} onClick={() => changeDifficulty(nextDifficulty.id)}>
                        {ro ? "Nivelul următor · " + nextDifficulty.pieces : "Next level · " + nextDifficulty.pieces + " pieces"}
                      </button>
                    )}
                    <label className="block text-sm font-semibold" htmlFor="next-puzzle">{ro ? "Alt puzzle" : "Another puzzle"}</label>
                    <select id="next-puzzle" className="input" aria-label={ro ? "Alt puzzle" : "Another puzzle"} value={nextPuzzle} disabled={nextBusy} onChange={(event) => setNextPuzzle(event.target.value)}>
                      {nextPhoto && <option value="custom-upload">{ro ? "Fotografia ta" : "Your photo"}</option>}
                      {catalog?.puzzles.map((item) => <option key={item.id} value={item.id}>{ro ? item.nameRo || item.name : item.name}</option>)}
                    </select>
                    <PhotoPicker file={nextPhoto} selected={nextPuzzle === "custom-upload"} onChange={setNextPhoto} onSelect={() => setNextPuzzle("custom-upload")} onError={setMessage} disabled={nextBusy} />
                    <button className="btn-secondary" disabled={!nextPuzzle || nextBusy} onClick={changeImage}>
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
