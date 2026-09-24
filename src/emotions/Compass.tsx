import { T, useLang } from "../lib/i18n";
import { Taxonomy, familyShade, pickB, isBlend } from "./data";

/**
 * The compass — valence × arousal (Russell's circumplex). Every emotion and blend is
 * plotted; the selected one is highlighted. Orientation, not verdict.
 */
const W = 460;
const H = 460;
const PAD = 56;

function xOf(valence: number): number {
  return PAD + ((valence + 5) / 10) * (W - PAD * 2);
}
function yOf(arousal: number): number {
  return H - PAD - ((arousal + 5) / 10) * (H - PAD * 2);
}

export default function Compass({ selectedId }: { selectedId?: string | null }) {
  const { lang } = useLang();
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none">
        <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} rx={18} fill="#ffffff" stroke="#dadce0" strokeWidth="1.5" />
        {/* quadrants */}
        <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} stroke="#e8eaed" strokeWidth="1.5" />
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#e8eaed" strokeWidth="1.5" />
        {/* quadrant tints */}
        <rect x={W / 2} y={PAD} width={W / 2 - PAD} height={H / 2 - PAD} fill="#188038" opacity="0.05" />
        <rect x={PAD} y={PAD} width={W / 2 - PAD} height={H / 2 - PAD} fill="#d93025" opacity="0.05" />
        <rect x={W / 2} y={H / 2} width={W / 2 - PAD} height={H / 2 - PAD} fill="#1a73e8" opacity="0.06" />
        <rect x={PAD} y={H / 2} width={W / 2 - PAD} height={H / 2 - PAD} fill="#5f6368" opacity="0.05" />

        {/* axis labels */}
        <text x={PAD + 10} y={PAD - 10} fontSize="11" fill="#5f6368">{lang === "ro" ? "negativ" : "negative"}</text>
        <text x={W - PAD - 10} y={PAD - 10} fontSize="11" fill="#5f6368" textAnchor="end">{lang === "ro" ? "pozitiv" : "positive"}</text>
        <text x={W - PAD - 10} y={H - PAD + 22} fontSize="11" fill="#5f6368" textAnchor="end">{lang === "ro" ? "intens / tulbure" : "intense / turbulent"}</text>
        <text x={PAD + 10} y={H - PAD + 22} fontSize="11" fill="#5f6368">{lang === "ro" ? "calm" : "calm"}</text>
        <text x={W / 2} y={H - 12} fontSize="11" fill="#80868b" textAnchor="middle">{lang === "ro" ? "valență →" : "valence →"}</text>

        {/* blends (diamonds) */}
        {Taxonomy.blends.map((b) => {
          const sel = selectedId === b.id;
          return (
            <g key={b.id}>
              <rect
                x={xOf(b.valence) - 5} y={yOf(b.arousal) - 5} width={10} height={10}
                transform={`rotate(45 ${xOf(b.valence)} ${yOf(b.arousal)})`}
                fill="#80868b" opacity={sel ? 0.95 : 0.4} stroke={sel ? "#1a73e8" : "none"}
              >
                <title>{pickB(b.name, lang)}</title>
              </rect>
            </g>
          );
        })}

        {/* emotions (circles) */}
        {Taxonomy.emotions.map((e) => {
          const family = Taxonomy.meta.families.find((f) => f.id === e.family)!;
          const sel = selectedId === e.id;
          const r = e.level === 3 ? 9 : e.level === 2 ? 7.5 : 6.5;
          return (
            <g key={e.id}>
              {sel && <circle cx={xOf(e.valence)} cy={yOf(e.arousal)} r={r + 7} fill="none" stroke="#1a73e8" strokeWidth="2" opacity="0.55" />}
              <circle cx={xOf(e.valence)} cy={yOf(e.arousal)} r={r} fill={familyShade(family.color, e.level)} stroke={sel ? "#1a73e8" : "rgba(32,33,36,.2)"} strokeWidth={sel ? 2 : 1}>
                <title>{`${pickB(e.name, lang)} · ${family.icon}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-xs text-g-sub">
        <T value={{ ro: "Busola valență × intensitate (Russell). Orientare, nu verdict — fiecare hartă e a ta.", en: "Valence × arousal compass (Russell). Orientation, not verdict — every map is yours." }} />
      </p>
      <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-g-sub">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-[#80868b]" /> {lang === "ro" ? "emoție" : "emotion"}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#9aa0a6]" /> {lang === "ro" ? "amestec" : "blend"}</span>
      </div>
    </div>
  );
}
