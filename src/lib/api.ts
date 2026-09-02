import type { CatalogData, RoomView } from "../types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || "Request failed");
    (err as Error & { code?: string }).code = (data as { code?: string }).code;
    throw err;
  }
  return data as T;
}

export const api = {
  fetchCatalog(): Promise<CatalogData> {
    return fetch("/api/puzzles").then((r) => r.json());
  },

  createRoom(puzzleId: string, difficulty: string, name: string) {
    return post<{ room: RoomView; playerId: string }>("/api/rooms", {
      puzzleId,
      difficulty,
      name,
    });
  },

  joinRoom(ref: string, name: string, pid?: string) {
    return post<{ room: RoomView; playerId: string; returning?: boolean }>(
      `/api/rooms/${encodeURIComponent(ref)}/join`,
      { name, pid },
    );
  },

  getRoom(ref: string) {
    return fetch(`/api/rooms/${encodeURIComponent(ref)}`).then(async (r) => {
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const err = new Error(data?.error || "Room not found");
        (err as Error & { code?: string }).code = data?.code;
        throw err;
      }
      return data as {
        room: RoomView;
        puzzle: { name: string; category: string };
        players: { id: string; name: string; color: string }[];
        playerCount: number;
      };
    });
  },

  resetRoom(ref: string) {
    return post<{ ok: boolean }>(`/api/rooms/${encodeURIComponent(ref)}/reset`, {});
  },
};
