/*
 * Team Canvas v2 contract: lobby setup, team selection/start guard, isolated
 * inventories/lanes, foreign tile rejection, and semantic export ordering.
 * Run against the normal app server: BASE=http://127.0.0.1:3000 npm run test:teams
 */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const checks = [];
function ok(name, pass, detail = "") {
  checks.push(!!pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

function connect(roomId, playerId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${BASE.replace(/^http/, "ws")}/ws`);
    const queue = [];
    const waiters = [];
    const seen = [];
    socket.on("open", () => socket.send(JSON.stringify({ t: "hello", v: 2, roomId, playerId })));
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      seen.push(message);
      const index = waiters.findIndex((waiter) => waiter.type === message.t && waiter.predicate(message));
      if (index >= 0) {
        const waiter = waiters.splice(index, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      } else queue.push(message);
    });
    socket.on("error", reject);
    socket.waitFor = (type, predicate = () => true, timeout = 5000) => new Promise((resolveWait, rejectWait) => {
      const index = queue.findIndex((message) => message.t === type && predicate(message));
      if (index >= 0) return resolveWait(queue.splice(index, 1)[0]);
      const timer = setTimeout(() => rejectWait(new Error(`timeout waiting for ${type}`)), timeout);
      waiters.push({ type, predicate, resolve: resolveWait, timer });
    });
    socket.seen = seen;
    resolve(socket);
  });
}

const send = (socket, message) => socket.send(JSON.stringify(message));
const canvas = (socket, op, data = {}) => send(socket, { t: "canvas", op, ...data });

// Colour-team mutation is deliberately a Canvas-only contract. A direct
// WebSocket request cannot make a jigsaw room acquire team state.
const nonCanvas = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "easy", name: "No Canvas Host", sessionName: "No canvas team guard" });
const nonCanvasHost = await connect(nonCanvas.data.room.id, nonCanvas.data.playerId);
await nonCanvasHost.waitFor("init");
send(nonCanvasHost, { t: "control", action: "teamAssign", playerId: nonCanvas.data.playerId, teamId: "team-red" });
const nonCanvasTeamError = await nonCanvasHost.waitFor("error", (message) => message.code === "team_mode_unavailable");
ok("non-Canvas team assignment is rejected by the server", nonCanvasTeamError.code === "team_mode_unavailable");
nonCanvasHost.close();

const created = await post("/api/rooms", {
  puzzleId: "agile-words", difficulty: "quick", name: "Ana", sessionName: "Colour team contract", contentLanguage: "en", teamMode: "color-teams", teamCount: 2,
});
const { room, playerId: hostId } = created.data;
ok("colour-team room is created with two named marker teams", created.status === 200 && room.teamMode === "color-teams" && room.teams?.length === 2 && room.teams.every((team) => team.marker && team.color));
ok("new canvas rooms advertise v2", room.canvasVersion === 2);

const join = await post(`/api/rooms/${room.id}/join`, { name: "Ben", code: room.code });
ok("participant can reserve a colour-team room", join.status === 200);
const guestId = join.data.playerId;
const host = await connect(room.id, hostId);
const guest = await connect(room.id, guestId);
const hostInit = await host.waitFor("init");
const guestInit = await guest.waitFor("init");
const red = hostInit.room.teams.find((team) => team.color === "red");
const yellow = hostInit.room.teams.find((team) => team.color === "yellow");
ok("v2 init carries per-team banks and team-specific semantic lanes", !!hostInit.canvas?.teamInventory?.[red?.id] && hostInit.canvas.lanes?.filter((lane) => lane.teamId === red?.id).length === 3 && hostInit.canvas.lanes?.filter((lane) => lane.teamId === yellow?.id).length === 3);

// A host cannot start until every connected, non-spectator participant selected a team.
send(host, { t: "control", action: "start" });
const earlyStart = await host.waitFor("error", (message) => message.code === "teams_incomplete");
ok("server rejects Start while team assignments are incomplete", earlyStart.code === "teams_incomplete");

send(host, { t: "team", action: "select", teamId: red.id });
await host.waitFor("players", (message) => message.list?.some((player) => player.id === hostId && player.teamId === red.id));
send(guest, { t: "team", action: "select", teamId: yellow.id });
await host.waitFor("players", (message) => message.list?.some((player) => player.id === guestId && player.teamId === yellow.id));
ok("members select their own team through the participant-safe protocol", true);

send(host, { t: "control", action: "start" });
await host.waitFor("room", (message) => message.room?.stage === "play");
await guest.waitFor("room", (message) => message.room?.stage === "play");

const redIdea = hostInit.canvas.lanes.find((lane) => lane.teamId === red.id && lane.kind === "word");
const yellowIdea = hostInit.canvas.lanes.find((lane) => lane.teamId === yellow.id && lane.kind === "word");
const startRedA = hostInit.canvas.teamInventory[red.id].A;
const startYellowA = hostInit.canvas.teamInventory[yellow.id].A;
canvas(host, "spawn", { text: "A", laneId: redIdea.id });
const hostAEvent = await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.text === "A" && tile.teamId === red.id && tile.laneId === redIdea.id));
const aTile = hostAEvent.list.find((tile) => tile.text === "A" && tile.teamId === red.id);
ok("spawning into a lane assigns team ownership and an explicit composition index", !!aTile && aTile.laneIndex === 0 && aTile.heldBy === null);
ok("only the active team's bank is consumed", hostAEvent.teamInventory?.[red.id]?.A === startRedA - 1 && hostAEvent.teamInventory?.[yellow.id]?.A === startYellowA);

// Mobile Safari can terminate after one or more live drag frames. A cancelled
// lane drag must restore its semantic/original position rather than leaving a
// visually free tile with stale lane metadata.
const origin = { x: aTile.x, y: aTile.y, laneId: aTile.laneId, laneIndex: aTile.laneIndex };
canvas(host, "move", { id: aTile.id, x: 700, y: 780, drag: true });
await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.id === aTile.id && tile.heldBy === hostId));
canvas(host, "move", { id: aTile.id, x: 700, y: 780, drag: false, cancel: true, cancelReason: "lostcapture" });
const cancelled = await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.id === aTile.id && !tile.heldBy));
const cancelledTile = cancelled.list.find((tile) => tile.id === aTile.id);
ok("cancelled lane drag restores the original composition position", cancelledTile?.laneId === origin.laneId && cancelledTile?.laneIndex === origin.laneIndex && cancelledTile?.x === origin.x && cancelledTile?.y === origin.y);

// A normal freeform drop intentionally leaves the lane; undo must restore the
// first pre-drag state rather than the final throttled drag frame.
canvas(host, "move", { id: aTile.id, x: 1100, y: 900, drag: true });
await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.id === aTile.id && tile.heldBy === hostId));
canvas(host, "move", { id: aTile.id, x: 1100, y: 900, drag: false });
const freeDrop = await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.id === aTile.id && !tile.heldBy && !tile.laneId));
ok("freeform drop explicitly leaves the lane", freeDrop.list.some((tile) => tile.id === aTile.id && !tile.laneId));
canvas(host, "undo");
const undoneDrop = await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.id === aTile.id && tile.laneId === origin.laneId && tile.laneIndex === origin.laneIndex));
const undoneTile = undoneDrop.list.find((tile) => tile.id === aTile.id);
ok("undo restores the pre-drag lane position", undoneTile?.x === origin.x && undoneTile?.y === origin.y);

canvas(guest, "spawn", { text: "A", laneId: redIdea.id });
const foreignLane = await guest.waitFor("error", (message) => message.code === "lane_unavailable");
ok("a participant cannot spend their bank into another team's lane", foreignLane.code === "lane_unavailable");
canvas(guest, "move", { id: aTile.id, x: 200, y: 200, drag: false });
const foreignTile = await guest.waitFor("error", (message) => message.code === "team_tile_locked");
ok("a participant cannot move another team's tile", foreignTile.code === "team_tile_locked");

canvas(guest, "spawn", { text: "B", laneId: yellowIdea.id });
const guestTile = await guest.waitFor("canvas", (message) => message.list?.some((tile) => tile.text === "B" && tile.teamId === yellow.id));
ok("each team can build in its own lane", !!guestTile);
canvas(host, "spawn", { text: "B", laneId: redIdea.id });
await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.text === "B" && tile.teamId === red.id));
canvas(host, "spawn", { text: "C", laneId: redIdea.id });
await host.waitFor("canvas", (message) => message.list?.some((tile) => tile.text === "C" && tile.teamId === red.id));

const exported = await fetch(`${BASE}/api/rooms/${encodeURIComponent(room.id)}/export?pid=${encodeURIComponent(hostId)}`).then((response) => response.json());
ok("export includes an auditable team model and lane metadata", exported.teams?.mode === "color-teams" && exported.canvas?.version === 2 && Array.isArray(exported.canvas?.lanes));
ok("a fully lane-based letter composition exports as words, not space-separated tiles", exported.canvas?.text?.includes("ABC"), JSON.stringify(exported.canvas?.text));

send(guest, { t: "team", action: "select", teamId: red.id });
const lockedSelect = await guest.waitFor("error", (message) => message.code === "team_selection_locked");
ok("self-service team selection locks after Start", lockedSelect.code === "team_selection_locked");

host.close();
guest.close();
const failed = checks.filter((value) => !value).length;
console.log(`\n${failed === 0 ? "🎉" : "⚠️"} team-canvas protocol: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
