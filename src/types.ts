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

export interface Bilingual {
  ro: string;
  en: string;
}

export interface PuzzleView {
  image: string;
  name: string | Bilingual;
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
  isCoaching?: boolean;
  mode?: "ranking" | "questionnaire";
  activityId?: string;
  activity?: CoachingActivity;
}

export interface RankingItem {
  id: number;
  label: Bilingual;
  expertRank: number;
  rationale: Bilingual;
}

export interface DimensionPole {
  letter: string;
  name: Bilingual;
  desc: Bilingual;
}

export interface Dimension {
  key: string;
  name: Bilingual;
  poleA: DimensionPole;
  poleB: DimensionPole;
}

export interface Question {
  id: number;
  dim: string;
  pole: "A" | "B";
  text: Bilingual;
}

export interface ProfileType {
  name: Bilingual;
  tagline: Bilingual;
  blurb: Bilingual;
  strengths: { ro: string[]; en: string[] };
  watchouts: { ro: string[]; en: string[] };
  growth: Bilingual;
  team: Bilingual;
}

export interface CoachingActivity {
  id: string;
  mode: "ranking" | "questionnaire";
  name: Bilingual;
  description: Bilingual;
  duration: string;
  cover: string;
  scenario?: {
    title: Bilingual;
    situation: Bilingual;
  };
  instructions?: Bilingual;
  items?: RankingItem[];
  debrief?: Bilingual[];
  layout?: { cols: number; rows: number; padX: number; padY: number; slotW: number; slotH: number; gapX: number; gapY: number };
  dimensions?: Dimension[];
  questions?: Question[];
  types?: Record<string, ProfileType>;
}

export interface CoachingCatalog {
  category: Category;
  activities: CoachingActivity[];
}

export interface RatingView {
  playerId: string;
  answers: Record<string, "A" | "B">;
  done: boolean;
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
  coaching: CoachingCatalog;
  maxPlayers: number;
}

export type JoinStatus = "idle" | "connecting" | "joined" | "denied" | "closed";
