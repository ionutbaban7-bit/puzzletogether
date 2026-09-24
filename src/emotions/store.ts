// CARTOGRAF solo — local-only persistence (browser storage, never sent anywhere).
import { emotionByIdOf, isBlend, type Bilingual } from "./data";

export interface MeteoEntry {
  emotions: string[];
  intensity: number;
  archetype: string | null;
  at: number;
}
export interface ExpeditionEntry {
  situationId: string;
  situationText: Bilingual;
  heavy: boolean;
  emotions: string[];
  intensity: number;
  archetype: string | null;
  note: string;
  at: number;
}
export interface Prediction {
  situation: string;
  expect: string;
  expectEmotion: string | null;
  expectIntensity: number;
  resolved: null | "confirmed" | "partial" | "violated";
  actual: string;
  at: number;
  resolvedAt: number | null;
}
export interface MuseumLine {
  text: string;
  at: number;
}
export interface InhabitantsEntry {
  archetypes: string[];
  note: string;
  at: number;
}

const PREFIX = "cartograf.";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full/blocked — the tool keeps working in-memory */
  }
}
export function clearAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// Meteo
export function meteoHistory(): MeteoEntry[] {
  return load<MeteoEntry[]>("meteo", []);
}
export function logMeteo(entry: MeteoEntry): MeteoEntry[] {
  const next = [entry, ...meteoHistory()].slice(0, 200);
  save("meteo", next);
  return next;
}

// Expeditions
export function expeditions(): ExpeditionEntry[] {
  return load<ExpeditionEntry[]>("expeditions", []);
}
export function logExpedition(entry: ExpeditionEntry): ExpeditionEntry[] {
  const next = [entry, ...expeditions()].slice(0, 200);
  save("expeditions", next);
  return next;
}

// Frontier (prediction tracker)
export function predictions(): Prediction[] {
  return load<Prediction[]>("frontier", []);
}
export function addPrediction(p: Omit<Prediction, "at" | "resolvedAt">): Prediction[] {
  const next: Prediction[] = [{ ...p, at: Date.now(), resolvedAt: null }, ...predictions()];
  save("frontier", next);
  return next;
}
export function resolvePrediction(situation: string, outcome: "confirmed" | "partial" | "violated", actual: string): Prediction[] {
  const list = predictions();
  const open = list.find((p) => p.resolved === null && p.situation === situation);
  if (open) {
    open.resolved = outcome;
    open.actual = actual;
    open.resolvedAt = Date.now();
  }
  save("frontier", list);
  return list;
}
export function removePrediction(situation: string): Prediction[] {
  const next = predictions().filter((p) => !(p.situation === situation && p.resolved === null));
  save("frontier", next);
  return next;
}

// Museum
export function museumLines(): MuseumLine[] {
  return load<MuseumLine[]>("museum", []);
}
export function addMuseumLine(text: string): MuseumLine[] {
  const next: MuseumLine[] = [{ text, at: Date.now() }, ...museumLines()].slice(0, 200);
  save("museum", next);
  return next;
}
export function removeMuseumLine(text: string): MuseumLine[] {
  const next = museumLines().filter((l) => l.text !== text);
  save("museum", next);
  return next;
}

// Inhabitants
export function inhabitantsLog(): InhabitantsEntry[] {
  return load<InhabitantsEntry[]>("inhabitants", []);
}
export function logInhabitants(entry: InhabitantsEntry): InhabitantsEntry[] {
  const next = [entry, ...inhabitantsLog()].slice(0, 100);
  save("inhabitants", next);
  return next;
}

/** Total number of distinct emotion ids ever named across all solo logs. */
export function namedCount(): { total: number; byFamily: Record<string, number> } {
  const ids = new Set<string>();
  for (const m of meteoHistory()) m.emotions.forEach((id) => ids.add(id));
  for (const e of expeditions()) e.emotions.forEach((id) => ids.add(id));
  for (const p of predictions()) if (p.expectEmotion) ids.add(p.expectEmotion);
  const byFamily: Record<string, number> = {};
  for (const id of ids) {
    const e = emotionByIdOf(id);
    if (!e) continue;
    const familyId = isBlend(e) ? e.blendOf[0] : e.family;
    byFamily[familyId] = (byFamily[familyId] || 0) + 1;
  }
  return { total: ids.size, byFamily };
}
