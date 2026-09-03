import type { CatalogData, RoomView } from "../types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((data as { error?: string }).error || "Request failed") as Error & { code?: string };
    error.code = (data as { code?: string }).code;
    throw error;
  }
  return data as T;
}

export const api = {
  fetchCatalog(): Promise<CatalogData> { return fetch("/api/puzzles").then((response) => response.json()); },
  createRoom(puzzleId: string, difficulty: string, name: string, options: { sessionName?: string; role?: "host" | "spectator"; contentLanguage?: "ro" | "en"; mystery?: boolean; customImage?: { url: string; file: string; width: number; height: number; name: string } } = {}) {
    return post<{ room: RoomView; playerId: string }>("/api/rooms", { puzzleId, difficulty, name, ...options });
  },
  async uploadImage(file: File): Promise<{ url: string; file: string; width: number; height: number }> {
    const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || "Upload failed.");
    return data;
  },
  joinRoom(ref: string, name: string, pid?: string, code?: string) {
    return post<{ room: RoomView; playerId: string; returning?: boolean }>(`/api/rooms/${encodeURIComponent(ref)}/join`, { name, pid, code });
  },
  changePuzzle(ref: string, puzzleId: string, difficulty: string, pid: string, contentLanguage?: "ro" | "en") {
    return post<{ ok: boolean; room: RoomView }>(`/api/rooms/${encodeURIComponent(ref)}/puzzle`, { puzzleId, difficulty, pid, contentLanguage });
  },
  takeover(ref: string, pid: string) { return post<{ ok: boolean; room: RoomView }>(`/api/rooms/${encodeURIComponent(ref)}/takeover`, { pid }); },
  getRoom(ref: string) {
    return fetch(`/api/rooms/${encodeURIComponent(ref)}`).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.error || "Room not found") as Error & { code?: string };
        error.code = data?.code;
        throw error;
      }
      return data as { room: RoomView; puzzle: { name: string; category: string }; playerCount: number };
    });
  },
  resetRoom(ref: string, pid: string) { return post<{ ok: boolean }>(`/api/rooms/${encodeURIComponent(ref)}/reset`, { pid }); },
  resetPuzzle(ref: string, pid: string) { return post<{ ok: boolean; room: RoomView }>(`/api/rooms/${encodeURIComponent(ref)}/puzzle-reset`, { pid }); },
  exportUrl(ref: string, pid: string, format: "json" | "html" = "json") {
    return `/api/rooms/${encodeURIComponent(ref)}/export?pid=${encodeURIComponent(pid)}&format=${format}`;
  },
};
