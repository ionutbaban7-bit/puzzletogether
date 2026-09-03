const KEY = {
  name: "pt.name",
  pid: "pt.pid",
  room: "pt.room",
};

export interface Session {
  name: string;
  pid: string;
  roomId: string;
}

export function getSession(): Partial<Session> {
  try {
    return {
      name: localStorage.getItem(KEY.name) || "",
      pid: localStorage.getItem(KEY.pid) || "",
      roomId: localStorage.getItem(KEY.room) || "",
    };
  } catch {
    return {};
  }
}

export function saveSession(s: Partial<Session>) {
  try {
    if (s.name) localStorage.setItem(KEY.name, s.name);
    if (s.pid) localStorage.setItem(KEY.pid, s.pid);
    if (s.roomId) localStorage.setItem(KEY.room, s.roomId);
  } catch {
    /* private mode */
  }
}
