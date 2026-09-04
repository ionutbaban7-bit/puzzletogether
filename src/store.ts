import { useSyncExternalStore } from "react";
import { RoomSocket } from "./lib/ws";
import type { ActionItem, CanvasState, CanvasTile, ChatEntry, CursorView, JoinStatus, Piece, PlayerView, PuzzleView, RatingView, RoomView, ScoreView, WorkshopInsights } from "./types";

export interface StoreState {
  status: JoinStatus;
  denyCode?: string;
  denyMessage?: string;
  closedMessage?: string;
  protocolError?: string;
  connected: boolean;
  reconnectAttempt: number;
  reconnectExhausted: boolean;
  you: string | null;
  room: RoomView | null;
  puzzle: PuzzleView | null;
  players: PlayerView[];
  pieces: Record<number, Piece>;
  cursors: Record<string, CursorView>;
  completion: { players: string[]; scores: ScoreView[]; canvasText?: string; canvasTiles?: CanvasTile[] } | null;
  ratings: Record<string, RatingView>;
  scores: ScoreView[];
  chat: ChatEntry[];
  facilitatorNotes: string;
  epoch: number;
  canvas: CanvasState | null;
  canvasTiles: Record<number, CanvasTile>;
}

const initialState: StoreState = {
  status: "idle", connected: false, reconnectAttempt: 0, reconnectExhausted: false,
  you: null, room: null, puzzle: null, players: [], pieces: {}, cursors: {},
  completion: null, ratings: {}, scores: [], chat: [], facilitatorNotes: "", epoch: 0,
  canvas: null, canvasTiles: {},
};

let state: StoreState = initialState;
const listeners = new Set<() => void>();
function set(partial: Partial<StoreState>) {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

const socket = new RoomSocket({
  onMessage: handleMessage,
  onStatus: (connected, attempt) => {
    set({ connected, reconnectAttempt: attempt, reconnectExhausted: !connected && attempt > 15 });
  },
});

function indexPieces(pieces: Piece[]) {
  return Object.fromEntries(pieces.map((piece) => [piece.id, piece]));
}

function indexTiles(tiles: CanvasTile[]) {
  return Object.fromEntries(tiles.map((tile) => [tile.id, tile]));
}

function canvasFromMessage(msg: Record<string, unknown>): CanvasState | null {
  const canvas = msg.canvas as (CanvasState & { tiles: CanvasTile[] }) | undefined;
  if (!canvas) return null;
  return {
    version: canvas.version,
    mode: canvas.mode,
    contentLanguage: canvas.contentLanguage,
    sheetW: canvas.sheetW,
    sheetH: canvas.sheetH,
    tileW: canvas.tileW,
    tileH: canvas.tileH,
    wordGap: canvas.wordGap,
    inventory: canvas.inventory,
    teamInventory: canvas.teamInventory,
    lanes: canvas.lanes,
  };
}

function handleMessage(msg: { t: string; [key: string]: unknown }) {
  switch (msg.t) {
    case "init": {
      const room = msg.room as RoomView;
      const players = (msg.players as PlayerView[]) || [];
      const ratings = (msg.ratings as RatingView[]) || [];
      const now = Date.now();
      const cursors: Record<string, CursorView> = {};
      for (const cursor of (msg.cursors as { id: string; x: number; y: number }[]) || []) cursors[cursor.id] = { x: cursor.x, y: cursor.y, at: now };
      const canvas = canvasFromMessage(msg);
      set({
        status: "joined", connected: true, reconnectAttempt: 0, reconnectExhausted: false,
        you: msg.you as string, room, puzzle: msg.puzzle as PuzzleView, players,
        pieces: indexPieces((msg.pieces as Piece[]) || []), ratings: Object.fromEntries(ratings.map((rating) => [rating.playerId, rating])),
        scores: (msg.scores as ScoreView[]) || [], chat: (msg.chat as ChatEntry[]) || [], cursors,
        facilitatorNotes: ((msg.facilitator as { notes?: string } | undefined)?.notes || ""), protocolError: undefined,
        completion: room.completed ? { players: players.map((player) => player.name), scores: (msg.scores as ScoreView[]) || [] } : null,
        canvas, canvasTiles: indexTiles(((msg.canvas as { tiles?: CanvasTile[] } | undefined)?.tiles) || []),
      });
      break;
    }
    case "players": set({ players: (msg.list as PlayerView[]) || [] }); break;
    case "canvas": {
      const list = (msg.list as CanvasTile[]) || [];
      const removed = (msg.removed as number[]) || [];
      const tiles = { ...state.canvasTiles };
      for (const tile of list) tiles[tile.id] = tile;
      for (const id of removed) delete tiles[id];
      const patch: Partial<StoreState> = { canvasTiles: tiles };
      if (msg.inventory !== undefined || msg.teamInventory !== undefined) {
        patch.canvas = state.canvas ? {
          ...state.canvas,
          ...(msg.inventory !== undefined ? { inventory: msg.inventory as Record<string, number> | null } : {}),
          ...(msg.teamInventory !== undefined ? { teamInventory: msg.teamInventory as CanvasState["teamInventory"] } : {}),
        } : state.canvas;
      }
      set(patch);
      break;
    }
    case "canvasRejected": {
      const tile = msg.tile as CanvasTile | undefined;
      if (tile) set({ canvasTiles: { ...state.canvasTiles, [tile.id]: tile } });
      break;
    }
    case "pieces": {
      const list = (msg.list as Piece[]) || [];
      if (!list.length) break;
      const pieces = { ...state.pieces };
      for (const piece of list) pieces[piece.id] = piece;
      set({ pieces });
      break;
    }
    case "pieceRejected": {
      const piece = msg.piece as Piece | undefined;
      if (piece) set({ pieces: { ...state.pieces, [piece.id]: piece } });
      break;
    }
    case "cursors": {
      const list = (msg.list as { id: string; x: number; y: number }[]) || [];
      const cursors = { ...state.cursors };
      const now = Date.now();
      for (const cursor of list) cursors[cursor.id] = { x: cursor.x, y: cursor.y, at: now };
      set({ cursors });
      break;
    }
    case "completion": {
      const scores = (msg.scores as ScoreView[]) || [];
      set({
        room: msg.room as RoomView,
        completion: {
          players: (msg.players as string[]) || [],
          scores,
          canvasText: (msg.canvasText as string) || undefined,
          canvasTiles: (msg.canvasTiles as CanvasTile[]) || undefined,
        },
        scores,
      });
      break;
    }
    case "scores": set({ scores: (msg.list as ScoreView[]) || [] }); break;
    case "ratings": {
      const list = (msg.list as RatingView[]) || [];
      set({ ratings: Object.fromEntries(list.map((rating) => [rating.playerId, rating])) });
      break;
    }
    case "room": set({ room: msg.room as RoomView }); break;
    case "puzzleMeta": set({ puzzle: msg.puzzle as PuzzleView }); break;
    case "facilitator": set({ facilitatorNotes: String(msg.notes || "") }); break;
    case "chat": {
      const entry = msg.entry as ChatEntry;
      // A reconnect/retry can replay the same server entry. Never render it
      // twice or inflate the participant-visible unread count.
      if (!entry?.id || state.chat.some((current) => current.id === entry.id)) break;
      set({ chat: [...state.chat.slice(-49), entry] });
      break;
    }
    case "reset": {
      const canvas = canvasFromMessage(msg) || null;
      set({
        room: msg.room as RoomView, puzzle: (msg.puzzle as PuzzleView) || state.puzzle,
        pieces: indexPieces((msg.pieces as Piece[]) || []), completion: null, ratings: {}, scores: [],
        epoch: state.epoch + 1, canvas, canvasTiles: indexTiles(((msg.canvas as { tiles?: CanvasTile[] } | undefined)?.tiles) || []),
      });
      break;
    }
    case "puzzle": {
      const canvas = canvasFromMessage(msg);
      set({
        room: msg.room as RoomView, puzzle: msg.puzzle as PuzzleView,
        pieces: indexPieces((msg.pieces as Piece[]) || []), completion: null, ratings: {}, scores: [],
        epoch: state.epoch + 1, canvas, canvasTiles: indexTiles(((msg.canvas as { tiles?: CanvasTile[] } | undefined)?.tiles) || []),
      });
      break;
    }
    case "puzzleReset": {
      // Unlike the workshop reset, this keeps the current in-play room and
      // timer. A new epoch makes Board clear cached sprites and re-fit.
      set({
        room: msg.room as RoomView,
        puzzle: (msg.puzzle as PuzzleView) || state.puzzle,
        pieces: indexPieces((msg.pieces as Piece[]) || []),
        completion: null,
        scores: (msg.scores as ScoreView[]) || [],
        epoch: state.epoch + 1,
      });
      break;
    }
    case "error": set({ protocolError: String(msg.message || "Realtime action failed.") }); break;
    case "deny": set({ status: "denied", denyCode: msg.code as string, denyMessage: msg.message as string, connected: false }); break;
    case "closed": set({ status: "closed", closedMessage: String(msg.message || "This room has closed."), connected: false }); break;
  }
}

export const store = {
  getState: (): StoreState => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  joinRoom(roomId: string, playerId: string) {
    set({ ...initialState, status: "connecting" });
    socket.connect(roomId, playerId);
  },
  /**
   * Commit a normal piece frame, or explicitly release a claimed piece after
   * a browser interruption. `cancel` is never treated as a snap/drop by the
   * server, so an iOS pointercancel cannot accidentally score a piece.
   */
  sendPiece(
    id: number,
    x: number,
    y: number,
    drag: boolean,
    options: { cancel?: boolean; reason?: string } = {},
  ) {
    if (!state.connected) return;
    socket.send({
      t: "piece",
      id,
      x: Math.round(x),
      y: Math.round(y),
      drag,
      ...(options.cancel ? { cancel: true, cancelReason: options.reason } : {}),
    });
  },
  /** Ask the server to rearrange only untouched jigsaw pieces. */
  sendLayout(mode: "scatter" | "tray") {
    if (!state.connected) return;
    socket.send({ t: "layout", mode });
  },
  sendCanvas(op: string, data: Record<string, unknown> = {}) {
    if (!state.connected) return;
    socket.send({ t: "canvas", op, ...data });
  },
  sendCursor(x: number, y: number) { if (state.connected) socket.send({ t: "cursor", x: Math.round(x), y: Math.round(y) }); },
  sendRating(answers: Record<string, "A" | "B">, done: boolean) { if (state.connected) socket.send({ t: "rating", answers, done }); },
  sendControl(action: string, data: Record<string, unknown> = {}) { if (state.connected) socket.send({ t: "control", action, ...data }); },
  /** Participant-safe lobby team selection; host configuration uses sendControl. */
  sendTeam(action: "select", teamId: string) { if (state.connected) socket.send({ t: "team", action, teamId }); },
  saveInsights(value: WorkshopInsights) { if (state.connected) socket.send({ t: "harvest", kind: "insights", value }); },
  saveDebrief(value: string[]) { if (state.connected) socket.send({ t: "harvest", kind: "debrief", value }); },
  saveActions(value: ActionItem[]) { if (state.connected) socket.send({ t: "harvest", kind: "actions", value }); },
  sendChat(text: string) {
    if (!state.connected) return;
    const clientMessageId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    socket.send({ t: "chat", text, clientMessageId });
  },
  clearError() { set({ protocolError: undefined }); },
  /** Optimistic drop is used only for classic jigsaw pieces; ranking stays server-authoritative. */
  applyLocalDrop(id: number, x: number, y: number, snapped: boolean) {
    const piece = state.pieces[id];
    if (!piece) return;
    set({ pieces: { ...state.pieces, [id]: { ...piece, x: snapped ? piece.correctX : x, y: snapped ? piece.correctY : y, drag: false, moved: true, locked: snapped, heldBy: null } } });
  },
  leaveRoom() { socket.close(); set({ ...initialState }); },
};

export function useStore<T>(selector: (state: StoreState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

declare global { interface Window { __ptStore?: typeof store } }
window.__ptStore = store;
export function lockedCountOf(pieces: Record<number, Piece>) { return Object.values(pieces).filter((piece) => piece.locked).length; }
