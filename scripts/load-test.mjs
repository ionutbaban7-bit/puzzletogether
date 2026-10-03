// Authenticated local protocol load, not production throughput certification.
import assert from "node:assert/strict";
import { BASE, post, connect, send, until, barrier, close, delay } from "./realtime-client.mjs";

const clients = [];
const ready = async (room, identity, options) => { const c = await connect(room.id, identity, options); clients.push(c); return c; };
try {
  const created = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "master", name: "Facilitator", role: "spectator", podiumEnabled: true });
  assert.equal(created.status, 200);
  const { room } = created.data;
  const host = await ready(room, created.data);
  const identities = await Promise.all(Array.from({ length: 25 }, (_, i) => post(`/api/rooms/${room.id}/join`, { name: `Player ${i + 1}`, code: room.code }).then(result => {
    assert.equal(result.status, 200); return result.data;
  })));
  const people = await Promise.all(identities.map(id => ready(room, id)));
  const all = [host, ...people];
  await Promise.all(all.map(c => until(c, c => c.players.length === 26)));
  assert.ok(all.every(c => c.pieces.size === 192));
  assert.equal((await post(`/api/rooms/${room.id}/join`, { name: "Overflow", code: room.code })).status, 409);
  send(host, { t: "control", action: "start" });
  await Promise.all(all.map(c => until(c, c => c.room.stage === "play")));

  const piece = people[0].pieces.get(0);
  send(people[0], { t: "piece", id: 0, x: -1000, y: -1000, drag: true });
  await until(host, c => c.pieces.get(0).heldBy === people[0].id);
  send(people[1], { t: "piece", id: 0, x: piece.correctX, y: piece.correctY, drag: false });
  await until(people[1], c => c.events.some(m => m.t === "pieceRejected" && m.reason === "held"));
  assert.equal(host.scores.reduce((sum, s) => sum + s.placed, 0), 0);
  send(people[0], { t: "piece", id: 0, x: -1000, y: -1000, drag: false, cancel: true });
  await until(host, c => !c.pieces.get(0).heldBy);

  const latency = [];
  const movementStarted = performance.now();
  for (let round = 0; round < 20; round++) {
    const began = performance.now();
    const x = -2000 - round;
    const delivery = all.map(async c => {
      await until(c, c => people.every((_, id) => {
        const p = c.pieces.get(id); return p.x === x && p.y === -1000 - id && !p.drag && !p.heldBy;
      }), "25 concurrent moves converge");
      latency.push(performance.now() - began);
    });
    people.forEach((c, id) => {
      send(c, { t: "cursor", x: round * 20, y: id * 20 });
      send(c, { t: "piece", id, x: x + 10, y: -1000 - id, drag: true });
      send(c, { t: "piece", id, x: x + 5, y: -1000 - id, drag: true });
      send(c, { t: "piece", id, x, y: -1000 - id, drag: false });
    });
    await Promise.all(delivery);
    await delay(50);
  }
  await until(host, c => people.every(p => c.cursors.has(p.id)), "all player cursors relayed");
  const canonical = JSON.stringify([...host.pieces.values()].map(p => [p.id, p.x, p.y, p.locked, p.heldBy]));
  assert.ok(people.every(c => JSON.stringify([...c.pieces.values()].map(p => [p.id, p.x, p.y, p.locked, p.heldBy])) === canonical));
  assert.ok(all.every(c => c.scores.reduce((sum, s) => sum + s.placed, 0) === 0), "Dragging earns no points");
  latency.sort((a, b) => a - b);
  const p95 = Math.round(latency[Math.floor(latency.length * .95)]);
  assert.ok(p95 < 1000, `Local broadcast p95 must stay below 1s: ${p95}ms`);
  const moveMs = Math.round(performance.now() - movementStarted);

  send(host, { t: "control", action: "lock", locked: true });
  await Promise.all(all.map(c => until(c, c => c.room.boardLocked)));
  const pause = (await fetch(BASE + `/api/rooms/${room.id}`).then(r => r.json())).room.elapsedMs;
  await delay(120);
  assert.equal((await fetch(BASE + `/api/rooms/${room.id}`).then(r => r.json())).room.elapsedMs, pause);
  send(host, { t: "control", action: "lock", locked: false });
  await Promise.all(all.map(c => until(c, c => !c.room.boardLocked)));
  for (const p of host.pieces.values()) {
    const c = people[p.id % people.length];
    send(c, { t: "piece", id: p.id, x: p.correctX, y: p.correctY, drag: false });
  }
  await Promise.all(all.map(c => until(c, c => c.room.completed)));
  await Promise.all(all.map(c => until(c, c => [...c.pieces.values()].every(p => p.locked))));
  const scores = JSON.stringify(host.scores);
  assert.ok(all.every(c => JSON.stringify(c.scores) === scores));
  assert.equal(host.scores.length, 25);
  assert.equal(host.scores.reduce((sum, s) => sum + s.placed, 0), 192);
  assert.equal(host.scores.filter(s => s.placed === 8 && s.rank === 1).length, 17, "Shared first place is preserved for every tied player");
  assert.equal(host.scores.filter(s => s.placed === 7 && s.rank === 18).length, 8, "Competition ranks skip the occupied tied places");
  assert.equal(host.room.completionPlayers.length, 25);
  assert.ok(all.every(c => c.room.completedInMs === host.room.completedInMs));
  const health = await fetch(BASE + "/api/health").then(r => r.json());
  assert.equal(health.wsConnections, 26);

  await close(people[24]);
  await until(host, c => c.players.length === 25);
  const replacement = await post(`/api/rooms/${room.id}/join`, { name: "Replacement", code: room.code });
  assert.equal(replacement.status, 200);
  const returned = await post(`/api/rooms/${room.id}/join`, { pid: identities[24].playerId, name: "Returning" }, identities[24].credential);
  assert.equal(returned.status, 409);
  const blocked = await ready(room, identities[24], { denied: true });
  assert.equal(blocked.events.find(m => m.t === "deny")?.code, "room_full");
  await ready(room, replacement.data);

  // Playing host consumes one of 25 seats; pending joins also reserve capacity.
  const playingHost = await post("/api/rooms", { puzzleId: "starry-night", difficulty: "kids", name: "Playing host" });
  assert.equal(playingHost.status, 200);
  const reserved = await Promise.all(Array.from({ length: 26 }, (_, i) => post(`/api/rooms/${playingHost.data.room.id}/join`, { name: `Reserved ${i}`, code: playingHost.data.room.code })));
  assert.equal(reserved.filter(r => r.status === 200).length, 24);
  assert.equal(reserved.filter(r => r.status === 409).length, 2);
  await Promise.all(all.filter(c => c.ws.readyState === 1).map(barrier));
  assert.ok(clients.every(c => !c.events.some(m => m.t === "error")), "No protocol errors under load");
  console.log(`PASS 25 authenticated players + facilitator, 192 pieces, 1500 movement frames + 500 cursors, ${moveMs}ms, local broadcast p95=${p95}ms`);
  console.log(`PASS identical boards, final scores/time, collisions, pause, capacity and reconnect denial; heap=${health.heapUsedMb}MB`);
} finally { await Promise.all(clients.map(close)); }
