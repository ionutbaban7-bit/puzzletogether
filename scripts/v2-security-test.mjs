import assert from "node:assert/strict";
import WebSocket from "ws";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const sockets = [];
async function post(path, body = {}, credential, origin) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function connect(room, pid, credential, origin = BASE) {
  const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws", { origin });
  sockets.push(ws);
  const queue = [],
    waiters = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    const i = waiters.findIndex((w) => w.match(m));
    if (i >= 0) {
      const w = waiters.splice(i, 1)[0];
      clearTimeout(w.timer);
      w.resolve(m);
    } else queue.push(m);
  });
  ws.wait = (match) =>
    new Promise((resolve, reject) => {
      const i = queue.findIndex(match);
      if (i >= 0) return resolve(queue.splice(i, 1)[0]);
      const timer = setTimeout(() => reject(new Error("WS timeout")), 3000);
      waiters.push({ match, resolve, timer });
    });
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.send(
    JSON.stringify({ t: "hello", roomId: room, playerId: pid, credential }),
  );
  ws.init = await ws.wait((m) => ["init", "deny"].includes(m.t));
  return ws;
}
let passed = 0;
function ok(name) {
  console.log("PASS", name);
  passed++;
}
try {
  const c = await post("/api/rooms", {
    puzzleId: "starry-night",
    difficulty: "kids",
    name: "Host",
  });
  assert.equal(c.status, 200);
  const id = c.data.room.id,
    h = c.data;
  const host = await connect(id, h.playerId, h.credential);
  assert.equal(host.init.pieces.length, 12);
  ok("12-piece room with authentic host");
  const pub = await fetch(BASE + `/api/rooms/${id}`);
  assert.equal(pub.headers.get("cache-control"), "no-store");
  const data = await pub.json();
  for (const key of ["inviteToken", "code", "hostId", "completionPlayers"])
    assert.equal(data.room[key], undefined);
  assert.ok(!JSON.stringify(data).includes(h.credential));
  ok("anonymous projection and no-store cache");
  const invitation = h.room.inviteToken;
  assert.match(invitation, /^[\w-]{43}$/);
  assert.notEqual(invitation, h.credential);
  assert.equal(
    (
      await post(`/api/rooms/${id}/join`, {
        name: "Bad",
        invite: "é".repeat(43),
      })
    ).status,
    403,
  );
  const g = (
    await post(`/api/rooms/${id}/join`, { name: "Guest", invite: invitation })
  ).data;
  assert.ok(g.credential);
  const guest = await connect(id, g.playerId, g.credential);
  ok("one-link admission, malformed Unicode invitation rejected");
  const room2 = (
    await post("/api/rooms", {
      puzzleId: "mona-lisa",
      difficulty: "kids",
      name: "Other",
    })
  ).data;
  assert.equal(
    (
      await post(`/api/rooms/${room2.room.id}/join`, {
        name: "Cross",
        invite: invitation,
      })
    ).status,
    403,
  );
  assert.equal(
    (await post(`/api/rooms/${room2.room.id}/reset`, {}, g.credential)).status,
    403,
  );
  ok("invitation and player credential are room-scoped");
  assert.equal(
    (
      await post(
        `/api/rooms/${id}/reset`,
        {},
        h.credential,
        "https://attacker.example",
      )
    ).status,
    403,
  );
  await assert.rejects(
    connect(id, h.playerId, h.credential, "https://attacker.example"),
    /40[13]/,
  );
  ok("cross-origin HTTP and WebSocket rejected");
  assert.equal(
    (await post(`/api/rooms/${id}/takeover`, {}, g.credential)).status,
    409,
  );
  const forged = await connect(id, h.playerId, g.credential);
  assert.equal(forged.init.t, "deny");
  assert.equal(host.readyState, WebSocket.OPEN);
  ok("forged hello cannot evict host; active host takeover denied");
  host.send(JSON.stringify({ t: "control", action: "start" }));
  await guest.wait((m) => m.t === "room" && m.room.stage === "play");
  guest.send(JSON.stringify({ t: "control", action: "close" }));
  assert.equal((await guest.wait((m) => m.t === "error")).code, "not_host");
  ok("guest host controls denied");
  host.send(
    JSON.stringify({ t: "control", action: "kick", playerId: g.playerId }),
  );
  await guest.wait((m) => m.t === "closed");
  assert.equal(
    (
      await post(
        `/api/rooms/${id}/join`,
        { name: "Guest", pid: g.playerId },
        g.credential,
      )
    ).status,
    403,
  );
  assert.equal(
    (await post(`/api/rooms/${id}/join`, { name: "Again", invite: invitation }))
      .status,
    403,
  );
  assert.equal(
    (await post(`/api/rooms/${id}/join`, { name: "Again", code: h.room.code }))
      .status,
    403,
  );
  ok("kick revokes player credential, invitation and fallback code");
  const newer = await host.wait(
    (m) => m.t === "room" && m.room.inviteToken !== invitation,
  );
  const guest2 = (
    await post(`/api/rooms/${id}/join`, {
      name: "Guest2",
      invite: newer.room.inviteToken,
    })
  ).data;
  const g2 = await connect(id, guest2.playerId, guest2.credential);
  const rotated = await post(
    `/api/rooms/${id}/session/rotate`,
    {},
    guest2.credential,
  );
  assert.equal(rotated.status, 200);
  assert.equal(
    (
      await post(
        `/api/rooms/${id}/join`,
        { name: "Guest2", pid: guest2.playerId },
        guest2.credential,
      )
    ).status,
    403,
  );
  const fresh = await connect(id, guest2.playerId, rotated.data.credential);
  assert.equal(fresh.init.t, "init");
  ok("session rotation rejects old credential and accepts new credential");
  const closed = new Promise((resolve) => fresh.once("close", resolve));
  fresh.send(
    JSON.stringify({
      t: "hello",
      roomId: room2.room.id,
      playerId: room2.playerId,
      credential: room2.credential,
    }),
  );
  await closed;
  ok("second hello cannot bind one connection to multiple identities");
  const guest3 = await connect(id, guest2.playerId, rotated.data.credential);
  host.close();
  await guest3.wait(
    (m) => m.t === "players" && !m.list.some((p) => p.id === h.playerId),
  );
  assert.equal(
    (await post(`/api/rooms/${id}/takeover`, {}, rotated.data.credential))
      .status,
    200,
  );
  assert.equal(
    (await post(`/api/rooms/${id}/reset`, {}, h.credential)).status,
    403,
  );
  ok("connected member takeover after departure removes old host privileges");
  for (const puzzleId of [
    "team-compass",
    "letter-anagrams",
    "emotions-big-room",
  ])
    assert.equal(
      (
        await post("/api/rooms", {
          puzzleId,
          name: "Legacy",
          difficulty: "easy",
        })
      ).status,
      400,
    );
  for (const route of ["/api/coaching", "/api/emotions"])
    assert.equal((await fetch(BASE + route)).status, 410);
  assert.equal(
    (
      await post("/api/rooms", {
        puzzleId: "starry-night",
        name: "Upload",
        customImage: { url: "/uploads/forged.webp" },
      })
    ).status,
    400,
  );
  for (const route of ["/api/uploads", "/uploads/example.webp"])
    assert.equal(
      (
        await fetch(BASE + route, {
          method: route === "/api/uploads" ? "POST" : "GET",
          body: route === "/api/uploads" ? "junk" : undefined,
        })
      ).status,
      403,
    );
  ok("legacy activities and all upload access disabled");
  guest3.send(JSON.stringify({ t: "control", action: "close" }));
  await guest3.wait((m) => m.t === "room" && m.room.stage === "closed");
  assert.equal(
    (
      await post(
        `/api/rooms/${id}/join`,
        { name: "Guest2", pid: guest2.playerId },
        rotated.data.credential,
      )
    ).status,
    404,
  );
  ok("closed room rejects returning sessions");
  console.log(`${passed}/${passed} V2 security checks passed`);
} finally {
  for (const ws of sockets) ws.close();
}
