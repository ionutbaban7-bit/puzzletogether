/* Negative upload-abuse checks against an isolated local room server.
 * Intentionally no valid images; do not persist user assets in QA.
 */
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
async function upload(contentType, payload) {
  const response = await fetch(`${BASE}/api/uploads`, {
    method: "POST", headers: { "Content-Type": contentType }, body: payload,
  });
  return { status: response.status, retry: response.headers.get("retry-after"), body: await response.json().catch(() => ({})) };
}
const invalid = Buffer.alloc(2048, 0);
for (let attempt = 0; attempt < 6; attempt++) {
  const answer = await upload("image/png", invalid);
  assert.equal(answer.status, 415, `An image MIME type is not enough to upload arbitrary bytes (attempt ${attempt + 1})`);
}
const throttled = await upload("image/png", invalid);
assert.equal(throttled.status, 429);
assert.equal(throttled.body.code, "rate_limited");
assert.ok(Number(throttled.retry) >= 1);
console.log("PASS: forged image payloads rejected before ImageMagick");
console.log("PASS: repeated anonymous uploads throttled with Retry-After");
