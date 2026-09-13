// Validates the CARTOGRAF content bundle: schema, completeness, bilingual coverage,
// referential integrity (near/blendOf ids, family ids, spectrum sizes).
// Run: npm run emotions:audit
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const taxonomy = read("shared/emotions-taxonomy.json");
const situations = read("shared/emotions-situations.json");
const archetypes = read("shared/emotions-archetypes.json");

const errors = [];
const warn = (msg) => errors.push(msg);
const bilingual = (value, where) => {
  if (typeof value !== "object" || value === null || typeof value.ro !== "string" || !value.ro.trim() || typeof value.en !== "string" || !value.en.trim()) {
    warn(`Missing/empty bilingual at ${where}`);
  }
};

const families = taxonomy.meta.families;
const familyIds = new Set(families.map((f) => f.id));
const expectedFamilyIds = new Set(["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"]);
for (const id of expectedFamilyIds) if (!familyIds.has(id)) warn(`Missing family: ${id}`);

const emotionIds = new Set();
const byFamilyLevel = new Map();
for (const e of taxonomy.emotions) {
  emotionIds.add(e.id);
  if (!/^[a-z0-9-]+$/.test(e.id)) warn(`Bad emotion id: ${e.id}`);
  if (!familyIds.has(e.family)) warn(`Unknown family on ${e.id}: ${e.family}`);
  if (![1, 2, 3].includes(e.level)) warn(`Bad level on ${e.id}`);
  const key = `${e.family}-${e.level}`;
  if (byFamilyLevel.has(key)) warn(`Duplicate family/level: ${key} (${e.id} vs ${byFamilyLevel.get(key)})`);
  byFamilyLevel.set(key, e.id);
  bilingual(e.name, e.id + ".name");
  bilingual(e.def, e.id + ".def");
  bilingual(e.body, e.id + ".body");
  bilingual(e.impulse, e.id + ".impulse");
  bilingual(e.function, e.id + ".function");
  bilingual(e.usefulWhen, e.id + ".usefulWhen");
  bilingual(e.heavyWhen, e.id + ".heavyWhen");
  bilingual(e.notSameAs, e.id + ".notSameAs");
  bilingual(e.microExercise, e.id + ".microExercise");
  bilingual(e.caveat, e.id + ".caveat");
  if (!e.thoughts || !Array.isArray(e.thoughts.ro) || !Array.isArray(e.thoughts.en) || e.thoughts.ro.length !== e.thoughts.en.length || e.thoughts.ro.some((t) => typeof t !== "string" || !t.trim())) warn(`thoughts invalid on ${e.id}`);
  if (!e.triggers || !Array.isArray(e.triggers.ro) || !Array.isArray(e.triggers.en) || e.triggers.ro.some((t) => typeof t !== "string" || !t.trim()) || e.triggers.en.some((t) => typeof t !== "string" || !t.trim())) warn(`triggers invalid on ${e.id}`);
  if (typeof e.valence !== "number" || e.valence < -5 || e.valence > 5) warn(`valence out of range on ${e.id}`);
  if (typeof e.arousal !== "number" || e.arousal < -5 || e.arousal > 5) warn(`arousal out of range on ${e.id}`);
  if (!Array.isArray(e.research) || e.research.length < 1) warn(`research missing on ${e.id}`);
  else for (const r of e.research) if (!r.title || !r.year || !r.source || !["verified", "to-verify"].includes(r.status)) warn(`research entry invalid on ${e.id}`);
  if (!Array.isArray(e.spectrum) || e.spectrum.length !== 8) warn(`spectrum must have 8 steps on ${e.id}`);
  else e.spectrum.forEach((s, i) => bilingual(s, `${e.id}.spectrum[${i}]`));
  if (typeof e.spectrumIndex !== "number" || e.spectrumIndex < 0 || e.spectrumIndex > 7) warn(`spectrumIndex out of range on ${e.id}`);
  if (!Array.isArray(e.near)) warn(`near missing on ${e.id}`);
}
// Every family must have exactly the 3 levels present.
for (const f of families) for (const level of [1, 2, 3]) if (!byFamilyLevel.has(`${f.id}-${level}`)) warn(`Missing ${f.id} level ${level}`);

const blendIds = new Set();
for (const b of taxonomy.blends) {
  blendIds.add(b.id);
  if (!b.id.startsWith("blend-")) warn(`Blend id must start with blend-: ${b.id}`);
  if (!Array.isArray(b.blendOf) || b.blendOf.length !== 2 || b.blendOf.some((id) => !emotionIds.has(id))) warn(`blendOf invalid on ${b.id}`);
  bilingual(b.name, b.id + ".name");
  bilingual(b.def, b.id + ".def");
  bilingual(b.when, b.id + ".when");
  bilingual(b.example, b.id + ".example");
  if (typeof b.valence !== "number" || typeof b.arousal !== "number") warn(`valence/arousal missing on ${b.id}`);
}
const catCounts = new Map();
for (const s of situations.solo) {
  if (!s.id || !s.text || !s.category) warn(`Solo situation invalid: ${JSON.stringify(s).slice(0, 80)}`);
  bilingual(s.text, s.id + ".text");
  if (typeof s.heavy !== "boolean") warn(`heavy flag invalid on ${s.id}`);
  catCounts.set(s.category, (catCounts.get(s.category) || 0) + 1);
}
if (situations.solo.length < 60) warn(`Expected 60+ solo situations, got ${situations.solo.length}`);
for (const [cat, n] of catCounts) if (n < 6) warn(`Category ${cat} has only ${n} solo situations`);

for (const s of situations.room) {
  if (!s.id || !s.text) warn(`Room situation invalid: ${s.id}`);
  bilingual(s.text, s.id + ".text");
  if (!Array.isArray(s.debriefPrompts) || s.debriefPrompts.length < 1) warn(`debriefPrompts missing on ${s.id}`);
  else for (const p of s.debriefPrompts) bilingual(p, s.id + ".prompt");
}
if (situations.room.length < 30) warn(`Expected 30+ room situations, got ${situations.room.length}`);

if (archetypes.archetypes.length !== 8) warn(`Expected 8 archetypes, got ${archetypes.archetypes.length}`);
for (const a of archetypes.archetypes) {
  bilingual(a.name, a.id + ".name");
  bilingual(a.claim, a.id + ".claim");
  bilingual(a.function, a.id + ".function");
  bilingual(a.usefulWhen, a.id + ".usefulWhen");
  bilingual(a.overreachesWhen, a.id + ".overreachesWhen");
  bilingual(a.itsFear, a.id + ".itsFear");
  bilingual(a.whatToSay, a.id + ".whatToSay");
  bilingual(a.reflectionQuestion, a.id + ".reflectionQuestion");
}
bilingual(archetypes.disclaimer, "archetypes.disclaimer");

const allIds = new Set([...emotionIds, ...blendIds]);
for (const e of taxonomy.emotions) for (const n of e.near) if (!allIds.has(n)) warn(`near reference unknown on ${e.id}: ${n}`);
const ids = [...emotionIds, ...blendIds, ...situations.solo.map((s) => s.id), ...situations.room.map((s) => s.id)];
const seen = new Set();
for (const id of ids) {
  if (seen.has(id)) warn(`Duplicate id: ${id}`);
  seen.add(id);
}

if (errors.length) {
  console.error(`emotions-audit: ${errors.length} error(s)`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `emotions-audit: OK — ${taxonomy.emotions.length} emotions, ${taxonomy.blends.length} blends, ` +
    `${situations.solo.length} solo situations (${[...catCounts.keys()].length} categories), ` +
    `${situations.room.length} room situations, ${archetypes.archetypes.length} archetypes`
);
