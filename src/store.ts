import { useSyncExternalStore } from "react";
import { RoomSocket } from "./lib/ws";
import type { ActionItem, ChatEntry, CursorView, JoinStatus, Piece, PlayerView, PuzzleView, RatingView, RoomView, ScoreView, WorkshopInsights } from "./types";

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
  completion: { players: string[]; scores: ScoreView[] } | null;
  ratings: Record<string, RatingView>;
  scores: ScoreView[];
  chat: ChatEntry[];
  facilitatorNotes: string;
  epoch: number;
}

const initialState: StoreState = {
  status: "idle", connected: false, reconnectAttempt: 0, reconnectExhausted: false,
  you: null, room: null, puzzle: null, players: [], pieces: {}, cursors: {},
  completion: null, ratings: {}, scores: [], chat: [], facilitatorNotes: "", epoch: 0,
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

function handleMessage(msg: { t: string; [key: string]: unknown }) {
  switch (msg.t) {
    case "init": {
      const room = msg.room as RoomView;
      const players = (msg.players as PlayerView[]) || [];
      const ratings = (msg.ratings as RatingView[]) || [];
      const now = Date.now();
      const cursors: Record<string, CursorView> = {};
      for (const cursor of (msg.cursors as { id: string; x: number; y: number }[]) || []) cursors[cursor.id] = { x: cursor.x, y: cursor.y, at: now };
      set({
        status: "joined", connected: true, reconnectAttempt: 0, reconnectExhausted: false,
        you: msg.you as string, room, puzzle: msg.puzzle as PuzzleView, players,
        pieces: indexPieces((msg.pieces as Piece[]) || []), ratings: Object.fromEntries(ratings.map((rating) => [rating.playerId, rating])),
        scores: (msg.scores as ScoreView[]) || [], chat: (msg.chat as ChatEntry[]) || [], cursors,
        facilitatorNotes: ((msg.facilitator as { notes?: string } | undefined)?.notes || ""), protocolError: undefined,
        completion: room.completed ? { players: players.map((player) => player.name), scores: (msg.scores as ScoreView[]) || [] } : null,
      });
      break;
    }
    case "players": set({ players: (msg.list as PlayerView[]) || [] }); break;
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
      set({ room: msg.room as RoomView, completion: { players: (msg.players as string[]) || [], scores }, scores });
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
    case "chat": set({ chat: [...state.chat.slice(-49), msg.entry as ChatEntry] }); break;
    case "reset": {
      set({ room: msg.room as RoomView, puzzle: (msg.puzzle as PuzzleView) || state.puzzle, pieces: indexPieces((msg.pieces as Piece[]) || []), completion: null, ratings: {}, scores: [], epoch: state.epoch + 1 });
      break;
    }
    case "puzzle": {
      set({ room: msg.room as RoomView, puzzle: msg.puzzle as PuzzleView, pieces: indexPieces((msg.pieces as Piece[]) || []), completion: null, ratings: {}, scores: [], epoch: state.epoch + 1 });
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
  sendPiece(id: number, x: number, y: number, drag: boolean) {
    if (!state.connected) return;
    socket.send({ t: "piece", id, x: Math.round(x), y: Math.round(y), drag });
  },
  sendCursor(x: number, y: number) { if (state.connected) socket.send({ t: "cursor", x: Math.round(x), y: Math.round(y) }); },
  sendRating(answers: Record<string, "A" | "B">, done: boolean) { if (state.connected) socket.send({ t: "rating", answers, done }); },
  sendControl(action: string, data: Record<string, unknown> = {}) { if (state.connected) socket.send({ t: "control", action, ...data }); },
  saveInsights(value: WorkshopInsights) { if (state.connected) socket.send({ t: "harvest", kind: "insights", value }); },
  saveDebrief(value: string[]) { if (state.connected) socket.send({ t: "harvest", kind: "debrief", value }); },
  saveActions(value: ActionItem[]) { if (state.connected) socket.send({ t: "harvest", kind: "actions", value }); },
  sendChat(text: string) { if (state.connected) socket.send({ t: "chat", text }); },
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
