/**
 * Shared helpers for the catalog pipeline + audit.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function identifyRaster(file) {
  try {
    const out = execFileSync("identify", ["-format", "%w %h", file], { encoding: "utf8" }).trim().split(/\s+/);
    const w = parseInt(out[0], 10);
    const h = parseInt(out[1], 10);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null;
    return { w, h };
  } catch {
    return null;
  }
}

/** Parse intrinsic dimensions from an SVG file (width/height attributes or viewBox). */
export function svgDims(file) {
  try {
    const src = fs.readFileSync(file, "utf8");
    const vb = src.match(/viewBox\s*=\s*["']\s*[-\d.]+[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/i);
    let w = null;
    let h = null;
    const wm = src.match(/width\s*=\s*["']\s*([\d.]+)/i);
    const hm = src.match(/height\s*=\s*["']\s*([\d.]+)/i);
    if (wm) w = parseFloat(wm[1]);
    if (hm) h = parseFloat(hm[1]);
    if ((!w || !h) && vb) {
      w = w || parseFloat(vb[2]);
      h = h || parseFloat(vb[3]);
    }
    if (w && h && w >= 1 && h >= 1) return { w: Math.round(w), h: Math.round(h) };
    return null;
  } catch {
    return null;
  }
}

/** aHash: 8x8 grayscale → 64-char bit string (null on failure). */
export function ahash(file) {
  try {
    const out = execFileSync("convert", [file, "-colorspace", "Gray", "-resize", "8x8!", "PGM:-"], { maxBuffer: 8 * 1024 * 1024 });
    const bytes = Buffer.isBuffer(out) ? out : Buffer.from(out);
    let idx = 0;
    const nextTok = () => {
      while (idx < bytes.length && (bytes[idx] === 0x0a || bytes[idx] === 0x0d || bytes[idx] === 0x20)) idx++;
      const start = idx;
      while (idx < bytes.length && bytes[idx] > 0x20) idx++;
      return bytes.slice(start, idx).toString("utf8");
    };
    nextTok(); // P5
    const w = parseInt(nextTok(), 10);
    const h = parseInt(nextTok(), 10);
    nextTok(); // maxval
    const px = [];
    for (let i = 0; i < w * h; i++) px.push(bytes[idx + 1 + i]);
    const avg = px.reduce((a, b) => a + b, 0) / px.length;
    let bits = "";
    for (const v of px) bits += v >= avg ? "1" : "0";
    return bits;
  } catch {
    return null;
  }
}

/** dHash: 9x8 grayscale, compare adjacent pixels → 64-char bit string. */
export function dhash(file) {
  try {
    const out = execFileSync("convert", [file, "-colorspace", "Gray", "-resize", "9x8!", "PGM:-"], { maxBuffer: 8 * 1024 * 1024 });
    const bytes = Buffer.isBuffer(out) ? out : Buffer.from(out);
    let idx = 0;
    const nextTok = () => {
      while (idx < bytes.length && (bytes[idx] === 0x0a || bytes[idx] === 0x0d || bytes[idx] === 0x20)) idx++;
      const start = idx;
      while (idx < bytes.length && bytes[idx] > 0x20) idx++;
      return bytes.slice(start, idx).toString("utf8");
    };
    nextTok(); // P5
    const w = parseInt(nextTok(), 10);
    const h = parseInt(nextTok(), 10);
    nextTok(); // maxval
    const startPx = idx + 1;
    let bits = "";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w - 1; x++) {
        const a = bytes[startPx + y * w + x];
        const b = bytes[startPx + y * w + x + 1];
        bits += a > b ? "1" : "0";
      }
    }
    return bits.slice(0, 64);
  } catch {
    return null;
  }
}

export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) d++;
  return d;
}
