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
      name: sessionStorage.getItem(KEY.name) || "",
      pid: sessionStorage.getItem(KEY.pid) || "",
      roomId: sessionStorage.getItem(KEY.room) || "",
    };
  } catch {
    return {};
  }
}

export function saveSession(s: Partial<Session>) {
  try {
    if (s.name) sessionStorage.setItem(KEY.name, s.name);
    if (s.pid) sessionStorage.setItem(KEY.pid, s.pid);
    if (s.roomId) sessionStorage.setItem(KEY.room, s.roomId);
  } catch {
    /* private mode */
  }
}
