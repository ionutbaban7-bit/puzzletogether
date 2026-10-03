// Disabled uploads must be rejected before parsing or image processing.
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
for (const type of ["image/png", "image/jpeg", "image/webp", "application/octet-stream"]) {
  const response = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: { "Content-Type": type }, body: Buffer.alloc(2048) });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "uploads_disabled");
}
assert.equal((await fetch(`${BASE}/uploads/example.webp`)).status, 403);
console.log("PASS: uploads and upload file access disabled for every content type");
