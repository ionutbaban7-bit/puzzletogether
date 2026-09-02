export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0 || h > 0) parts.push(`${m} min`);
  parts.push(`${s} s`);
  return parts.join(" ");
}

/** Extracts a room id (uuid) or room code from user input (link or code). */
export function extractRoomRef(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Full URL of either form: /room/<uuid> or /join?c=<code>
  const urlMatch = trimmed.match(/\/(?:room|join)\/([0-9a-f-]{36})/i);
  if (urlMatch) return urlMatch[1];
  const codeMatch = trimmed.match(/[?&]c=([A-Za-z0-9]{4,12})/);
  if (codeMatch) return codeMatch[1];
  const uuidMatch = trimmed.match(/^([0-9a-f]{8}-[0-9a-f-]{27,})$/i);
  if (uuidMatch) return uuidMatch[1];
  const plainCode = trimmed.match(/^[A-Za-z0-9]{4,12}$/);
  if (plainCode) return trimmed.toUpperCase();
  return null;
}

export function inviteUrl(room: { id: string }): string {
  return `${window.location.origin}/room/${room.id}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
