// CARTOGRAF content — bundled from shared/*.json (single source of truth, works offline).
import taxonomyRaw from "../../shared/emotions-taxonomy.json";
import situationsRaw from "../../shared/emotions-situations.json";
import archetypesRaw from "../../shared/emotions-archetypes.json";

export type Lang = "ro" | "en";

export interface Bilingual {
  ro: string;
  en: string;
}

export interface Family {
  id: string;
  name: Bilingual;
  icon: string;
  color: string;
  rings: { ro: string[]; en: string[] };
}

export interface ResearchRef {
  title: string;
  year: number;
  source: string;
  status: "verified" | "to-verify";
}

export interface Emotion {
  id: string;
  family: string;
  level: 1 | 2 | 3;
  spectrumIndex: number;
  name: Bilingual;
  def: Bilingual;
  body: Bilingual;
  thoughts: { ro: string[]; en: string[] };
  impulse: Bilingual;
  function: Bilingual;
  usefulWhen: Bilingual;
  heavyWhen: Bilingual;
  near: string[];
  notSameAs: Bilingual;
  triggers: { ro: string[]; en: string[] };
  valence: number;
  arousal: number;
  microExercise: Bilingual;
  research: ResearchRef[];
  caveat: Bilingual;
  spectrum: Bilingual[];
}

export interface Blend {
  id: string;
  blendOf: [string, string];
  name: Bilingual;
  def: Bilingual;
  when: Bilingual;
  example: Bilingual;
  valence: number;
  arousal: number;
}

export interface Situation {
  id: string;
  category: string;
  text: Bilingual;
  heavy: boolean;
  debriefPrompts?: Bilingual[];
}

export interface Archetype {
  id: string;
  icon: string;
  color: string;
  name: Bilingual;
  system: Bilingual;
  claim: Bilingual;
  function: Bilingual;
  usefulWhen: Bilingual;
  overreachesWhen: Bilingual;
  itsFear: Bilingual;
  whatToSay: Bilingual;
  reflectionQuestion: Bilingual;
}

export const Taxonomy = taxonomyRaw as unknown as {
  meta: { name: Bilingual; model: Bilingual; families: Family[] };
  emotions: Emotion[];
  blends: Blend[];
};
export const Situations = situationsRaw as unknown as { solo: Situation[]; room: Situation[] };
export const Archetypes = archetypesRaw as unknown as { disclaimer: Bilingual; archetypes: Archetype[] };

const emotionById = new Map<string, Emotion | Blend>();
for (const e of Taxonomy.emotions) emotionById.set(e.id, e);
for (const b of Taxonomy.blends) emotionById.set(b.id, b);

export function emotionByIdOf(id: string): Emotion | Blend | undefined {
  return emotionById.get(id);
}

export function isBlend(item: Emotion | Blend): item is Blend {
  return "blendOf" in item;
}

export function familyOf(emotionId: string): Family | undefined {
  const e = emotionByIdOf(emotionId);
  if (!e) return undefined;
  const familyId = isBlend(e) ? e.blendOf[0] : e.family;
  return Taxonomy.meta.families.find((f) => f.id === familyId);
}

/** Family order on the wheel (Plutchik adjacency), clockwise from top. */
export const FAMILY_ORDER = ["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"] as const;

export function pickB(b: Bilingual | undefined, lang: Lang): string {
  if (!b) return "";
  return b[lang] || b.en || b.ro;
}

// ---------------------------------------------------------------------------
// Colour helpers (wheel rendering)
// ---------------------------------------------------------------------------

export function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

/** Ring shade for a family colour: level 1 = lighter, 2 = base, 3 = deeper. */
export function familyShade(hex: string, level: 1 | 2 | 3): string {
  const [h, s] = hexToHsl(hex);
  const l = level === 1 ? 66 : level === 2 ? 52 : 40;
  return `hsl(${Math.round(h)} ${Math.round(Math.min(85, s + 10))}% ${l}%)`;
}

export function familyShadeSoft(hex: string, level: 1 | 2 | 3): string {
  const [h, s] = hexToHsl(hex);
  const l = level === 1 ? 74 : level === 2 ? 58 : 45;
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${l}%)`;
}
