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
  createRoom(puzzleId: string, difficulty: string, name: string, options: { sessionName?: string; role?: "host" | "spectator" } = {}) {
    return post<{ room: RoomView; playerId: string }>("/api/rooms", { puzzleId, difficulty, name, ...options });
  },
  joinRoom(ref: string, name: string, pid?: string, code?: string) {
    return post<{ room: RoomView; playerId: string; returning?: boolean }>(`/api/rooms/${encodeURIComponent(ref)}/join`, { name, pid, code });
  },
  changePuzzle(ref: string, puzzleId: string, difficulty: string, pid: string) {
    return post<{ ok: boolean; room: RoomView }>(`/api/rooms/${encodeURIComponent(ref)}/puzzle`, { puzzleId, difficulty, pid });
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
  exportUrl(ref: string, pid: string, format: "json" | "html" = "json") {
    return `/api/rooms/${encodeURIComponent(ref)}/export?pid=${encodeURIComponent(pid)}&format=${format}`;
  },
};
