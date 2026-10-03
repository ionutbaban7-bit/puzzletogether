import assert from "node:assert/strict";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import WebSocket from "ws";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const canvas = createCanvas(420, 300), ctx = canvas.getContext("2d");
ctx.fillStyle = "#059669"; ctx.fillRect(0, 0, 420, 300);
ctx.fillStyle = "#ffffff"; ctx.font = "48px sans-serif"; ctx.fillText("Our photo", 35, 140);
// A phone-style JPEG with EXIF orientation=6 must rotate, then lose EXIF.
const jpeg = canvas.toBuffer("image/jpeg");
const exif = Buffer.from("45786966000049492a0008000000010012010300010000000600000000000000", "hex");
const marker = Buffer.from([0xff, 0xe1, 0, exif.length + 2]);
const orientedJpeg = Buffer.concat([jpeg.subarray(0, 2), marker, exif, jpeg.subarray(2)]);
const fixtures = { "image/png": canvas.toBuffer("image/png"), "image/jpeg": orientedJpeg, "image/webp": canvas.toBuffer("image/webp") };
async function upload(type, body) {
  const response = await fetch(BASE + "/api/uploads", { method: "POST", headers: { "Content-Type": type }, body });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function post(route, body, credential) {
  const res = await fetch(BASE + route, { method: "POST", headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function init(created) {
  const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.terminate(); reject(new Error("Photo WS timeout")); }, 3000);
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ t: "hello", roomId: created.room.id, playerId: created.playerId, credential: created.credential })));
    ws.on("message", raw => {
      const msg = JSON.parse(String(raw));
      if (msg.t === "init") { clearTimeout(timer); ws.close(); resolve(msg); }
      if (msg.t === "deny") { clearTimeout(timer); ws.close(); reject(new Error(JSON.stringify(msg))); }
    });
  });
}
assert.equal((await upload("image/svg+xml", "<svg/>")).status, 415);
assert.equal((await upload("image/png", Buffer.alloc(2048))).status, 415);
assert.equal((await upload("image/png", Buffer.from([137,80,78,71,13,10,26,10]))).status, 400);
assert.equal((await upload("image/png", Buffer.alloc(9 * 1024 * 1024 + 1))).status, 413);
assert.equal((await fetch(BASE + "/uploads/example.webp")).status, 404);
assert.equal((await fetch(BASE + "/uploads/")).status, 404);
console.log("PASS unsupported, forged, corrupt and oversized files rejected; storage not public");
for (const [type, body] of Object.entries(fixtures)) {
  const before = Date.now();
  const uploaded = await upload(type, body);
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
  const photo = uploaded.body;
  assert.equal(photo.url, undefined, "Uploader receives attachment proof, not a public image URL");
  assert.match(photo.token, /^[\w-]{43}$/);
  assert.ok(photo.expiresAt >= before + 3600000 && photo.expiresAt <= Date.now() + 3600000);
  const request = { puzzleId: "custom-upload", difficulty: "mini", name: "PhotoHost", customImage: photo };
  assert.equal((await post("/api/rooms", { ...request, customImage: { ...photo, token: "a".repeat(43) } })).status, 400);
  const created = await post("/api/rooms", { ...request, customImage: { ...photo, width: 99999, url: "/uploads/forged.webp" } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const room = created.body;
  const metadata = JSON.stringify(await (await fetch(BASE + `/api/rooms/${room.room.id}`)).json());
  assert.equal(metadata.includes(photo.file), false);
  assert.equal(metadata.includes(photo.token), false);
  assert.equal(metadata.includes("/uploads/"), false);
  assert.equal((await post("/api/rooms", request)).status, 400, "One photo belongs to one room only");
  const hello = await init(room);
  assert.equal(hello.puzzle.width, type === "image/jpeg" ? 300 : 420, "Use decoded, oriented dimensions rather than caller input");
  assert.equal(hello.puzzle.height, type === "image/jpeg" ? 420 : 300);
  const privateUrl = hello.puzzle.image;
  const image = await fetch(BASE + privateUrl);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("cache-control"), /no-store/);
  assert.match(image.headers.get("content-type"), /image\/webp/);
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.equal(bytes.includes(Buffer.from("EXIF")), false, "Remove photo metadata");
  const derivative = await loadImage(bytes);
  assert.equal(derivative.width, hello.puzzle.width);
  assert.equal((await fetch(BASE + privateUrl.split("?")[0])).status, 404);
  assert.equal((await fetch(BASE + privateUrl.replace(/key=.*/, "key=bad"))).status, 404);
  const joined = await post(`/api/rooms/${room.room.id}/join`, { name: "PhotoGuest", invite: room.room.inviteToken });
  assert.equal(joined.status, 200);
  const guestHello = await init(joined.body);
  assert.equal(guestHello.puzzle.image, privateUrl);
  assert.equal((await post(`/api/rooms/${room.room.id}/puzzle`, { puzzleId: "starry-night", difficulty: "mini" }, joined.body.credential)).status, 403);
  assert.equal((await fetch(BASE + privateUrl)).status, 200);
  assert.equal((await post(`/api/rooms/${room.room.id}/puzzle`, { puzzleId: "starry-night", difficulty: "mini" }, room.credential)).status, 200);
  assert.equal((await fetch(BASE + privateUrl)).status, 404, "Switching image deletes the photo immediately");
  console.log(`PASS ${type}: real upload, private multiplayer image, fixed 1h deadline and removal on image change`);
}
