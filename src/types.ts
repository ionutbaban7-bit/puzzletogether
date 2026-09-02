export interface Piece {
  id: number;
  x: number;
  y: number;
  correctX: number;
  correctY: number;
  rotation: number;
  drag: boolean;
  moved: boolean;
  locked: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  color: string;
}

export interface RoomView {
  id: string;
  code: string;
  puzzleId: string;
  difficulty: string;
  total: number;
  maxPlayers: number;
  createdAt: number;
  completed: boolean;
  completedAt: number | null;
  completedInMs: number | null;
}

export interface PuzzleView {
  image: string;
  name: string;
  category: string;
  credit: string;
  license: string;
  source: string;
  width: number;
  height: number;
  cols: number;
  rows: number;
  pieceW: number;
  pieceH: number;
  snapDistance: number;
}

export interface CursorView {
  x: number;
  y: number;
  at: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Difficulty {
  id: string;
  name: string;
  pieces: number;
}

export interface PuzzleInfo {
  id: string;
  category: string;
  name: string;
  image: string;
  credit: string;
  license: string;
  source: string;
}

export interface CatalogData {
  categories: Category[];
  difficulties: Difficulty[];
  puzzles: PuzzleInfo[];
  maxPlayers: number;
}

export type JoinStatus = "idle" | "connecting" | "joined" | "denied" | "closed";
