import { T, useLang } from "../lib/i18n";
import { store } from "../store";
import type { PlayerView, RoomView, TeamColor, TeamView } from "../types";

const TEAM_STYLE: Record<TeamColor, { hex: string; soft: string; label: { ro: string; en: string } }> = {
  red: { hex: "#f87171", soft: "rgba(248,113,113,.16)", label: { ro: "Roșu", en: "Red" } },
  yellow: { hex: "#facc15", soft: "rgba(250,204,21,.16)", label: { ro: "Galben", en: "Yellow" } },
  green: { hex: "#4ade80", soft: "rgba(74,222,128,.16)", label: { ro: "Verde", en: "Green" } },
  blue: { hex: "#60a5fa", soft: "rgba(96,165,250,.16)", label: { ro: "Albastru", en: "Blue" } },
  purple: { hex: "#c084fc", soft: "rgba(192,132,252,.16)", label: { ro: "Mov", en: "Purple" } },
  orange: { hex: "#fb923c", soft: "rgba(251,146,60,.16)", label: { ro: "Portocaliu", en: "Orange" } },
};

export function teamColorHex(color: TeamColor) {
  return TEAM_STYLE[color]?.hex || "#94a3b8";
}

export function teamLabel(team: Pick<TeamView, "name" | "color">, lang: "ro" | "en") {
  return TEAM_STYLE[team.color]?.label[lang] || team.name;
}

/** Compact marker + written label; colour is intentionally not the only cue. */
export function TeamBadge({ team, className = "" }: { team?: TeamView | null; className?: string }) {
  const { lang } = useLang();
  if (!team) return null;
  const label = teamLabel(team, lang);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold ${className}`} style={{ color: teamColorHex(team.color), backgroundColor: TEAM_STYLE[team.color]?.soft }}>
      <span aria-hidden>{team.marker}</span>
      <span>{label}</span>
    </span>
  );
}

interface TeamSetupProps {
  room: RoomView;
  players: PlayerView[];
  youId: string | null;
  isHost: boolean;
}

/**
 * Lobby-only team setup. The browser only asks for a change; membership and
 * the start lock are validated/serialized by src/server.js.
 */
export default function TeamSetup({ room, players, youId, isHost }: TeamSetupProps) {
  const { lang } = useLang();
  const teams = room.teams || [];
  const me = players.find((player) => player.id === youId);
  const selectablePlayers = players.filter((player) => player.role !== "spectator");

  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-4 text-left sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-300"><T value={{ ro: "Mod de colaborare", en: "Collaboration mode" }} /></div>
          <h2 className="font-display mt-1 text-base font-bold text-white"><T value={{ ro: "O echipă comună sau echipe colorate", en: "One shared group or colour teams" }} /></h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-300"><T value={{ ro: "Culoarea are mereu și un simbol/nume. Membrii aleg înainte de Start; facilitatorul poate reechilibra ulterior.", en: "Every colour also has a marker and name. Members choose before Start; the facilitator can rebalance later." }} /></p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${room.teamMode === "color-teams" ? "bg-cp-purple-500/25 text-cp-purple-100" : "bg-emerald-500/15 text-emerald-200"}`}>
          {room.teamMode === "color-teams" ? (lang === "ro" ? "Echipe colorate" : "Colour teams") : (lang === "ro" ? "Echipă comună" : "Shared group")}
        </span>
      </div>

      {isHost && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={lang === "ro" ? "Alege modul echipelor" : "Choose team mode"}>
          <button className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${room.teamMode !== "color-teams" ? "border-emerald-300/50 bg-emerald-500/20 text-emerald-100" : "border-white/10 bg-white/[.04] text-ink-300 hover:bg-white/[.08]"}`} onClick={() => store.sendControl("teams", { mode: "shared" })}>
            🤝 <T value={{ ro: "Comun", en: "Shared" }} />
          </button>
          {[2, 3, 4, 5, 6].map((count) => (
            <button key={count} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${room.teamMode === "color-teams" && teams.length === count ? "border-cp-purple-300/60 bg-cp-purple-500/25 text-white" : "border-white/10 bg-white/[.04] text-ink-300 hover:bg-white/[.08]"}`} onClick={() => store.sendControl("teams", { mode: "color-teams", count })}>
              {count} <T value={{ ro: "echipe", en: "teams" }} />
            </button>
          ))}
        </div>
      )}

      {room.teamMode === "color-teams" && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const selected = me?.teamId === team.id;
              const members = players.filter((player) => player.teamId === team.id && player.role !== "spectator");
              return (
                <button
                  key={team.id}
                  type="button"
                  disabled={!me || me.role === "spectator" || room.stage !== "lobby"}
                  onClick={() => store.sendTeam("select", team.id)}
                  className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-55 ${selected ? "ring-2" : "hover:bg-white/[.05]"}`}
                  style={{ borderColor: selected ? teamColorHex(team.color) : "rgba(255,255,255,.12)", backgroundColor: selected ? TEAM_STYLE[team.color]?.soft : "rgba(255,255,255,.025)" }}
                  aria-pressed={selected}
                >
                  <div className="flex items-center gap-2"><span aria-hidden className="text-lg" style={{ color: teamColorHex(team.color) }}>{team.marker}</span><b className="text-sm text-white">{teamLabel(team, lang)}</b>{selected && <span className="ml-auto text-[10px] font-bold text-white">✓ {lang === "ro" ? "A ta" : "Yours"}</span>}</div>
                  <p className="mt-1 text-[11px] text-ink-300">{members.length ? members.map((player) => player.name).join(", ") : (lang === "ro" ? "Disponibilă — alege-o" : "Open — choose it")}</p>
                </button>
              );
            })}
          </div>
          {!me?.teamId && me?.role !== "spectator" && <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"><T value={{ ro: "Alege o echipă colorată înainte de Start.", en: "Choose a colour team before Start." }} /></p>}

          {isHost && selectablePlayers.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-ink-400"><T value={{ ro: "Repartizare facilitator", en: "Facilitator assignment" }} /></div>
              <div className="mt-2 space-y-2">
                {selectablePlayers.map((player) => (
                  <label key={player.id} className="flex items-center gap-3 rounded-xl bg-white/[.035] px-3 py-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: player.color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-semibold text-white">{player.name}{player.id === youId ? ` (${lang === "ro" ? "tu" : "you"})` : ""}</span>
                    <select value={player.teamId || ""} onChange={(event) => event.target.value && store.sendControl("teamAssign", { playerId: player.id, teamId: event.target.value })} className="max-w-[132px] rounded-lg border border-white/10 bg-ink-800 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-300">
                      <option value="">{lang === "ro" ? "Nealocat" : "Unassigned"}</option>
                      {teams.map((team) => <option key={team.id} value={team.id}>{team.marker} {teamLabel(team, lang)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
