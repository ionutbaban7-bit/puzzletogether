import { useSyncExternalStore } from "react";
import { RoomSocket } from "./lib/ws";
import type {
  CursorView,
  JoinStatus,
  Piece,
  PlayerView,
  PuzzleView,
  RatingView,
  RoomView,
  ScoreView,
} from "./types";

export interface StoreState {
  status: JoinStatus;
  denyCode?: string;
  denyMessage?: string;
  closedMessage?: string;
  connected: boolean;
  you: string | null;
  room: RoomView | null;
  puzzle: PuzzleView | null;
  players: PlayerView[];
  pieces: Record<number, Piece>;
  cursors: Record<string, CursorView>;
  completion: { players: string[]; scores: ScoreView[] } | null;
  ratings: Record<string, RatingView>;
  /** Placed-piece leaderboard for the current game (sorted desc). */
  scores: ScoreView[];
  /** Bumped whenever the board is rebuilt (reset or new puzzle) so views can re-fit. */
  epoch: number;
}

const initialState: StoreState = {
  status: "idle",
  connected: false,
  you: null,
  room: null,
  puzzle: null,
  players: [],
  pieces: {},
  cursors: {},
  completion: null,
  ratings: {},
  scores: [],
  epoch: 0,
};

let state: StoreState = initialState;
const listeners = new Set<() => void>();
const socket = new RoomSocket({
  onMessage: handleMessage,
  onStatus: (connected) => {
    if (state.connected !== connected) {
      set({ connected });
      if (connected && state.status === "closed") set({ status: "connecting" });
    }
  },
});

function set(partial: Partial<StoreState>) {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

function handleMessage(msg: { t: string; [k: string]: unknown }) {
  switch (msg.t) {
    case "init": {
      const room = msg.room as RoomView;
      const puzzle = msg.puzzle as PuzzleView;
      const players = (msg.players as PlayerView[]) || [];
      const pieces = (msg.pieces as Piece[]) || [];
      const ratingsRaw = (msg.ratings as RatingView[]) || [];
      const cursorsRaw = (msg.cursors as { id: string; x: number; y: number }[]) || [];
      const now = Date.now();
      const cursors: Record<string, CursorView> = {};
      for (const c of cursorsRaw) cursors[c.id] = { x: c.x, y: c.y, at: now };
      set({
        status: "joined",
        connected: true,
        you: msg.you as string,
        room,
        puzzle,
        players,
        pieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
        ratings: Object.fromEntries(ratingsRaw.map((r) => [r.playerId, r])),
        scores: (msg.scores as ScoreView[]) || [],
        cursors,
        completion: room.completed
          ? {
              players: (msg.completionPlayers as string[]) || players.map((p) => p.name),
              scores: (msg.scores as ScoreView[]) || [],
            }
          : null,
      });
      break;
    }
    case "players": {
      const players = (msg.list as PlayerView[]) || [];
      set({ players });
      break;
    }
    case "pieces": {
      const list = (msg.list as Piece[]) || [];
      if (!list.length) break;
      const pieces = { ...state.pieces };
      for (const p of list) pieces[p.id] = p;
      set({ pieces });
      break;
    }
    case "cursors": {
      const list = (msg.list as { id: string; x: number; y: number }[]) || [];
      if (!list.length) break;
      const cursors = { ...state.cursors };
      const now = Date.now();
      for (const c of list) cursors[c.id] = { x: c.x, y: c.y, at: now };
      set({ cursors });
      break;
    }
    case "completion": {
      const scores = (msg.scores as ScoreView[]) || [];
      set({
        room: msg.room as RoomView,
        completion: { players: (msg.players as string[]) || [], scores },
        scores,
      });
      break;
    }
    case "scores": {
      set({ scores: (msg.list as ScoreView[]) || [] });
      break;
    }
    case "ratings": {
      const list = (msg.list as RatingView[]) || [];
      const ratings = { ...state.ratings };
      for (const r of list) ratings[r.playerId] = r;
      set({ ratings });
      break;
    }
    case "reset": {
      const room = msg.room as RoomView;
      const pieces = (msg.pieces as Piece[]) || [];
      set({
        room,
        pieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
        completion: null,
        ratings: {},
        scores: [],
        epoch: state.epoch + 1,
      });
      break;
    }
    case "puzzle": {
      // The host switched the room to a different puzzle/activity.
      const room = msg.room as RoomView;
      const puzzle = msg.puzzle as PuzzleView;
      const pieces = (msg.pieces as Piece[]) || [];
      set({
        room,
        puzzle,
        pieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
        completion: null,
        ratings: {},
        scores: [],
        epoch: state.epoch + 1,
      });
      break;
    }
    case "deny": {
      set({
        status: "denied",
        denyCode: msg.code as string,
        denyMessage: msg.message as string,
        connected: false,
      });
      break;
    }
    case "closed": {
      set({
        status: "closed",
        closedMessage: (msg.message as string) || "This room has closed.",
        connected: false,
      });
      break;
    }
    default:
      break;
  }
}

export const store = {
  getState(): StoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  joinRoom(roomId: string, playerId: string) {
    set({ status: "connecting", connected: false, room: null, puzzle: null, players: [], pieces: {}, cursors: {}, completion: null, scores: [] });
    socket.connect(roomId, playerId);
  },

  sendPiece(id: number, x: number, y: number, drag: boolean) {
    socket.send({ t: "piece", id, x: Math.round(x), y: Math.round(y), drag });
  },

  sendCursor(x: number, y: number) {
    socket.send({ t: "cursor", x: Math.round(x), y: Math.round(y) });
  },

  sendRating(answers: Record<string, "A" | "B">, done: boolean) {
    socket.send({ t: "rating", answers, done });
  },

  /** Optimistic local update for the piece I just dropped (server confirms shortly). */
  applyLocalDrop(id: number, x: number, y: number, snapped: boolean) {
    const piece = state.pieces[id];
    if (!piece) return;
    const pieces = { ...state.pieces };
    pieces[id] = {
      ...piece,
      x: snapped ? piece.correctX : x,
      y: snapped ? piece.correctY : y,
      drag: false,
      moved: true,
      locked: snapped,
    };
    set({ pieces });
  },

  leaveRoom() {
    socket.close();
    set({ ...initialState });
  },
};

export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

// Debug/testing hook (harmless in production).
declare global {
  interface Window {
    __ptStore?: typeof store;
  }
}
window.__ptStore = store;

export function lockedCountOf(pieces: Record<number, Piece>): number {
  let n = 0;
  for (const k in pieces) if (pieces[k].locked) n += 1;
  return n;
}
