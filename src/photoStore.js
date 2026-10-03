import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const PHOTO_TTL_MS = 60 * 60 * 1000;
const FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function proves(value, expected) {
  return typeof value === "string" && /^[\w-]{43}$/.test(value) &&
    crypto.timingSafeEqual(Buffer.from(hash(value)), Buffer.from(expected));
}

/** Private, single-use uploads. Deadlines persist and never reset on replay. */
export class PhotoStore {
  constructor(directory, { now = Date.now, ttlMs = PHOTO_TTL_MS, onExpire = () => {} } = {}) {
    this.directory = directory;
    this.now = now;
    this.ttlMs = ttlMs;
    this.onExpire = onExpire;
    this.photos = new Map();
    this.timers = new Map();
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    for (const entry of fs.readdirSync(directory)) {
      if (!entry.endsWith(".webp.json")) continue;
      const file = entry.slice(0, -5);
      try {
        const photo = JSON.parse(fs.readFileSync(path.join(directory, entry), "utf8"));
        if (!FILE_PATTERN.test(file) || photo.file !== file ||
            !/^[\w-]{43}$/.test(photo.readKey) || !/^[a-f0-9]{64}$/.test(photo.claimHash) ||
            !Number.isFinite(photo.createdAt) || !Number.isFinite(photo.expiresAt) ||
            photo.expiresAt > photo.createdAt + ttlMs ||
            !Number.isInteger(photo.width) || !Number.isInteger(photo.height) ||
            photo.width < 1 || photo.height < 1 || !fs.existsSync(path.join(directory, file))) throw new Error("Invalid photo metadata");
        this.photos.set(file, photo);
        this.arm(photo);
      } catch {
        if (FILE_PATTERN.test(file)) this.remove(file);
      }
    }
    // Remove old V1/untracked derivatives and processing leftovers after a crash.
    for (const file of fs.readdirSync(directory)) {
      if (/^processing-[0-9a-f-]{36}$/.test(file)) {
        fs.rmSync(path.join(directory, file), { recursive: true, force: true });
        continue;
      }
      if ((FILE_PATTERN.test(file) && !this.photos.has(file)) || /^[0-9a-f-]{36}\.in$/.test(file)) {
        try { fs.unlinkSync(path.join(directory, file)); } catch {}
      }
    }
  }
  persist(photo) {
    const meta = path.join(this.directory, photo.file + ".json");
    fs.writeFileSync(meta + ".tmp", JSON.stringify(photo), { mode: 0o600 });
    fs.renameSync(meta + ".tmp", meta);
  }
  arm(photo) {
    if (photo.expiresAt <= this.now()) { this.expire(photo.file); return; }
    const timer = setTimeout(() => {
      this.timers.delete(photo.file);
      if (photo.expiresAt <= this.now()) this.expire(photo.file);
      else this.arm(photo);
    }, Math.max(1, photo.expiresAt - this.now()));
    timer.unref();
    this.timers.set(photo.file, timer);
  }
  add(file, width, height, createdAt = this.now()) {
    if (!FILE_PATTERN.test(file)) throw new Error("Invalid image file");
    const claimToken = crypto.randomBytes(32).toString("base64url");
    const photo = { file, width, height, createdAt, expiresAt: createdAt + this.ttlMs,
      readKey: crypto.randomBytes(32).toString("base64url"), claimHash: hash(claimToken), roomId: null };
    this.persist(photo);
    this.photos.set(file, photo);
    this.arm(photo);
    if (!this.photos.has(file)) throw new Error("Photo expired during upload");
    return { file, token: claimToken, width, height, expiresAt: photo.expiresAt };
  }
  get(file) {
    const photo = this.photos.get(file);
    if (photo && photo.expiresAt <= this.now()) { this.expire(file); return null; }
    return photo || null;
  }
  claim(file, token) {
    const photo = this.get(file);
    if (!photo || photo.roomId || !proves(token, photo.claimHash)) throw new Error("Photo unavailable. Upload it again.");
    return photo;
  }
  bind(file, roomId) {
    const photo = this.get(file);
    if (!photo || photo.roomId) throw new Error("Photo unavailable. Upload it again.");
    photo.roomId = roomId;
    this.persist(photo);
  }
  url(photo) { return `/uploads/${photo.file}?key=${photo.readKey}`; }
  canRead(file, key) {
    const photo = this.get(file);
    return photo && proves(key, hash(photo.readKey)) ? photo : null;
  }
  expire(file) {
    const photo = this.photos.get(file);
    this.remove(file);
    if (photo) this.onExpire(photo);
  }
  remove(file) {
    if (!FILE_PATTERN.test(file)) return;
    clearTimeout(this.timers.get(file));
    this.timers.delete(file);
    this.photos.delete(file);
    let retry = false;
    for (const suffix of ["", ".json", ".json.tmp"]) {
      try { fs.unlinkSync(path.join(this.directory, file + suffix)); }
      catch (error) { if (error.code !== "ENOENT") { retry = true; console.error("Photo deletion failed; will retry", error.code); } }
    }
    if (retry) {
      const timer = setTimeout(() => this.remove(file), 10000);
      timer.unref();
      this.timers.set(file, timer);
    }
  }
  close() { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }
}
