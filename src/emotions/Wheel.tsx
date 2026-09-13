import { useMemo, useRef, useState } from "react";
import { T, useLang } from "../lib/i18n";
import { FAMILY_ORDER, Taxonomy, familyOf, familyShade, familyShadeSoft, pickB, type Emotion } from "./data";

/**
 * The Emotion Wheel — 8 territories (Plutchik families) × 3 intensity rings.
 * Hand-drawn SVG: staggered mount animation, hover glow, keyboard navigation
 * (arrows move sector/ring, Enter opens the emotion book), hub with live preview.
 */

const W = 800;
const H = 720;
const CX = 400;
const CY = 360;
const RINGS = [
  { level: 1 as const, r0: 118, r1: 178 },
  { level: 2 as const, r0: 182, r1: 240 },
  { level: 3 as const, r0: 244, r1: 302 },
];
const FAMILY_LABEL_R = 338;

const SECTORS = FAMILY_ORDER.length; // 8
const STEP = (Math.PI * 2) / SECTORS;

function polar(r: number, a: number): [number, number] {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function annularSector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Split an emotion name into at most 2 lines for tight wheel labels. */
function wrapLabel(name: string): string[] {
  if (name.length <= 11 || !name.includes(" ")) return [name];
  const mid = Math.ceil(name.length / 2);
  let best = mid;
  for (let i = 2; i < name.length - 1; i++) {
    if (name[i] === " " && Math.abs(i - mid) < Math.abs(best - mid)) best = i;
  }
  return [name.slice(0, best).trim(), name.slice(best).trim()];
}

interface Props {
  onSelect: (emotionId: string) => void;
  selectedId?: string | null;
}

export default function Wheel({ onSelect, selectedId }: Props) {
  const { lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focusCell, setFocusCell] = useState<{ sector: number; ring: number } | null>(null);

  const emotions = useMemo(() => {
    // index: [sectorIdx][ringIdx] -> Emotion
    const grid: (Emotion | undefined)[][] = Array.from({ length: SECTORS }, () => [undefined, undefined, undefined]);
    Taxonomy.emotions.forEach((e) => {
      const sector = FAMILY_ORDER.indexOf(e.family as (typeof FAMILY_ORDER)[number]);
      if (sector >= 0) grid[sector][e.level - 1] = e;
    });
    return grid;
  }, []);

  const previewId = hover ?? selectedId;
  const previewEmotion = previewId ? emotions.flatMap((row) => row).find((e) => e?.id === previewId) ?? undefined : undefined;
  const previewFamily = previewEmotion ? familyOf(previewEmotion.id) : undefined;

  function moveFocus(ds: number, dr: number) {
    const current = focusCell ?? { sector: 0, ring: 1 };
    setFocusCell({
      sector: (current.sector + ds + SECTORS) % SECTORS,
      ring: Math.max(0, Math.min(2, current.ring + dr)),
    });
  }

  function onKey(e: React.KeyboardEvent) {
    const k = e.key;
    if (k === "ArrowRight") { e.preventDefault(); moveFocus(1, 0); }
    else if (k === "ArrowLeft") { e.preventDefault(); moveFocus(-1, 0); }
    else if (k === "ArrowDown") { e.preventDefault(); moveFocus(0, 1); }
    else if (k === "ArrowUp") { e.preventDefault(); moveFocus(0, -1); }
    else if (k === "Enter" || k === " ") {
      e.preventDefault();
      const c = focusCell;
      if (c) {
        const em = emotions[c.sector]?.[c.ring];
        if (em) onSelect(em.id);
      }
    } else return;
    const next = emotions[focusCell?.sector ?? 0]?.[focusCell?.ring ?? 1];
    if (next) containerRef.current?.focus?.();
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label={lang === "ro" ? "Roata emoțiilor — 8 teritorii, 3 niveluri de intensitate" : "Emotion wheel — 8 territories, 3 intensity levels"}
      onKeyDown={onKey}
      className="relative mx-auto w-full max-w-[720px] outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 rounded-3xl"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" aria-hidden="true">
        <defs>
          <radialGradient id="wheel-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="78%" stopColor="#f8f9fa" />
            <stop offset="100%" stopColor="#f1f3f4" />
          </radialGradient>
          <radialGradient id="wheel-hub" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8f9fa" />
          </radialGradient>
          {Taxonomy.meta.families.map((f) => (
            <radialGradient key={f.id} id={`grad-${f.id}`} cx="50%" cy="50%" r="75%">
              <stop offset="30%" stopColor={familyShadeSoft(f.color, 2)} stopOpacity="0.35" />
              <stop offset="100%" stopColor={f.color} stopOpacity="0.08" />
            </radialGradient>
          ))}
        </defs>

        <circle cx={CX} cy={CY} r={316} fill="url(#wheel-bg)" />
        {/* slow decorative tick ring */}
        <g className="origin-center" style={{ animation: "spin 90s linear infinite" }}>
          <circle cx={CX} cy={CY} r={310} fill="none" stroke="#dadce0" strokeWidth="1" strokeDasharray="2 10" opacity="0.9" />
        </g>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } .wheel-cell { transition: filter .18s ease, opacity .18s ease; } .wheel-cell:hover { filter: brightness(1.06) drop-shadow(0 2px 10px rgba(26,115,232,0.28)); }`}</style>

        {/* Sectors */}
        {FAMILY_ORDER.map((familyId, si) => {
          const family = Taxonomy.meta.families.find((f) => f.id === familyId)!;
          const a0 = -Math.PI / 2 - STEP / 2 + si * STEP;
          const a1 = a0 + STEP;
          return (
            <g key={familyId} style={{ animation: `wheel-in .5s ${si * 0.06}s cubic-bezier(.16,1,.3,1) both` }}>
              <circle cx={CX} cy={CY} r={302} fill="none" />
              {/* soft glow layer for the whole sector */}
              <path d={annularSector(118, 302, a0, a1)} fill={`url(#grad-${familyId})`} opacity={0.5} />
              {RINGS.map((ring, ri) => {
                const emotion = emotions[si]?.[ri];
                if (!emotion) return null;
                const isHover = hover === emotion.id;
                const isSelected = selectedId === emotion.id;
                const isFocused = focusCell?.sector === si && focusCell?.ring === ri;
                const [lx, ly] = polar((ring.r0 + ring.r1) / 2, (a0 + a1) / 2);
                const lines = wrapLabel(pickB(emotion.name, lang));
                return (
                  <g key={ring.level} className="wheel-cell cursor-pointer" style={{ transformOrigin: `${lx}px ${ly}px` }}>
                    <path
                      d={annularSector(ring.r0 + 2, ring.r1 - 2, a0 + 0.008, a1 - 0.008)}
                      fill={familyShade(family.color, ring.level)}
                      stroke={isSelected ? "#1a73e8" : isFocused ? "#8ab4f8" : "#ffffff"}
                      strokeWidth={isSelected ? 3 : isFocused ? 2.5 : 2}
                      strokeDasharray={isFocused && !isSelected ? "5 4" : undefined}
                      style={{ transform: isHover ? "scale(1.035)" : undefined }}
                      onMouseEnter={() => setHover(emotion.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onSelect(emotion.id)}
                    >
                      <title>{`${pickB(emotion.name, lang)} — ${pickB(family.name, lang)}`}</title>
                    </path>
                    {/* emotion label */}
                    <text x={lx} y={ly - (lines.length > 1 ? 6 : 0)} textAnchor="middle" fill="#ffffff" fontSize={ring.level === 2 ? 12.5 : 10.5} fontWeight={ring.level === 2 ? 700 : 600} opacity={0.95} style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "rgba(0,0,0,.35)", strokeWidth: 2 }}>
                      {lines.map((line, i) => (
                        <tspan key={i} x={lx} dy={i === 0 ? 0 : 12}>{line}</tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
              {/* family label outside the ring: icon + name */}
              {(() => {
                const [fx, fy] = polar(FAMILY_LABEL_R, (a0 + a1) / 2);
                const below = fy >= CY - 10;
                return (
                  <g style={{ pointerEvents: "none" }}>
                    <text x={fx} y={below ? fy - 16 : fy + 8} textAnchor="middle" fontSize={21}>
                      {family.icon}
                    </text>
                    <text x={fx} y={below ? fy - 30 : fy + 26} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#202124">
                      {pickB(family.name, lang)}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Hub */}
        <circle cx={CX} cy={CY} r={112} fill="url(#wheel-hub)" stroke="#dadce0" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r={104} fill="none" stroke="#e8eaed" strokeWidth="1" strokeDasharray="3 6" />
        {previewEmotion && previewFamily ? (
          <g style={{ pointerEvents: "none" }}>
            <text x={CX} y={CY - 44} textAnchor="middle" fontSize={34}>{previewFamily.icon}</text>
            {wrapLabel(pickB(previewEmotion.name, lang)).map((line, i) => (
              <text key={i} x={CX} y={CY - 4 + i * 20} textAnchor="middle" fontSize={20} fontWeight={800} fill="#202124">
                {line}
              </text>
            ))}
            <text x={CX} y={CY + 34 + (wrapLabel(pickB(previewEmotion.name, lang)).length > 1 ? 18 : 0)} textAnchor="middle" fontSize={11.5} fill="#5f6368">
              {lang === "ro"
                ? `nivel ${previewEmotion.level} · ${Taxonomy.meta.families.find((f) => f.id === (previewEmotion as Emotion).family)?.rings[lang]?.[previewEmotion.level - 1] ?? ""}`
                : `level ${previewEmotion.level} · ${Taxonomy.meta.families.find((f) => f.id === (previewEmotion as Emotion).family)?.rings[lang]?.[previewEmotion.level - 1] ?? ""}`}
            </text>
            <text x={CX} y={CY + 58 + (wrapLabel(pickB(previewEmotion.name, lang)).length > 1 ? 18 : 0)} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1a73e8">
              {lang === "ro" ? "deschide cartea →" : "open the book →"}
            </text>
          </g>
        ) : (
          <g style={{ pointerEvents: "none" }}>
            <text x={CX} y={CY - 26} textAnchor="middle" fontSize={21} fontWeight={800} letterSpacing="4" fill="#202124">CARTOGRAF</text>
            <text x={CX} y={CY + 2} textAnchor="middle" fontSize={12} fill="#5f6368">
              {lang === "ro" ? "alege o emoție de pe roată" : "pick an emotion from the wheel"}
            </text>
            <text x={CX} y={CY + 22} textAnchor="middle" fontSize={10.5} fill="#80868b">
              {lang === "ro" ? "8 teritorii · 3 niveluri · 11 amestecuri" : "8 territories · 3 levels · 11 blends"}
            </text>
            <text x={CX} y={CY + 44} textAnchor="middle" fontSize={10} fill="#9aa0a6">
              {lang === "ro" ? "săgeți = navighezi · Enter = deschide" : "arrows = navigate · Enter = open"}
            </text>
          </g>
        )}
      </svg>
      <style>{`@keyframes wheel-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
