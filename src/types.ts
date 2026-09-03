export type RoomStage = "lobby" | "brief" | "play" | "reveal" | "debrief" | "harvest" | "closed";
export type PlayerRole = "host" | "player" | "spectator";

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
  heldBy?: string | null;
  /** Ranking destination, 1-based. Unlike expertRank, this is the team's choice. */
  placedOnSlot?: number | null;
  letter?: string;
  letterPoints?: number;
  letterColor?: string;
}

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  role: PlayerRole;
  joinedAt?: number;
  lastSeenAt?: number;
}

export interface WorkshopInsights {
  observed: string;
  learned: string;
  tryNext: string;
}

export interface ActionItem {
  id: string;
  text: string;
  ownerId: string;
  due: string;
  done: boolean;
}

export interface RoomView {
  id: string;
  code?: string;
  sessionName: string;
  hostId?: string | null;
  puzzleId: string;
  difficulty: string;
  total: number;
  maxPlayers: number;
  createdAt: number;
  startedAt: number | null;
  pausedAt: number | null;
  pausedDurationMs: number;
  stage: RoomStage;
  boardLocked: boolean;
  revealed: boolean;
  timerEndsAt: number | null;
  timerDurationMs: number | null;
  completed: boolean;
  completedAt: number | null;
  completedInMs: number | null;
  celebrationMode: "team" | "individual";
  insights: WorkshopInsights;
  debriefNotes: string[];
  actions: ActionItem[];
}

export interface Bilingual {
  ro: string;
  en: string;
}

export interface RankingSlot {
  rank: number;
  x: number;
  y: number;
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
  seed?: number;
  snapDistance: number;
  isCoaching?: boolean;
  mode?: "ranking" | "questionnaire";
  activityId?: string;
  activity?: CoachingActivity;
  rankingSlots?: RankingSlot[];
  wordModeNotice?: boolean;
}

export interface RankingItem {
  id: number;
  label: Bilingual;
  /** Hidden by the server until the facilitator reveals the expert answer. */
  expertRank?: number;
  rationale?: Bilingual;
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
  scenario?: { title: Bilingual; situation: Bilingual };
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

export interface ScoreView {
  playerId: string;
  name: string;
  color: string;
  placed: number;
}

export interface RatingView {
  playerId: string;
  /** Only sent to the player who owns these answers. */
  answers?: Record<string, "A" | "B">;
  done: boolean;
  profileCode?: string | null;
}

export interface CursorView { x: number; y: number; at: number }
export interface ChatEntry { id: string; playerId: string; name: string; color: string; text: string; at: number }
export interface Category { id: string; name: string; icon: string }
export interface Difficulty { id: string; name: string; pieces: number }
export interface PuzzleInfo { id: string; category: string; name: string; image: string; credit: string; license: string; source: string }
export interface CatalogData { categories: Category[]; difficulties: Difficulty[]; puzzles: PuzzleInfo[]; coaching: CoachingCatalog; maxPlayers: number }
export type JoinStatus = "idle" | "connecting" | "joined" | "denied" | "closed";
