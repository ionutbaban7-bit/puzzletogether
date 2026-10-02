const KEY = {
  name: "pt.name",
  pid: "pt.pid",
  room: "pt.room",
  credential: "pt.credential",
};

export interface Session {
  name: string;
  pid: string;
  roomId: string;
  credential: string;
}

export function getSession(): Partial<Session> {
  try {
    return {
      name: localStorage.getItem(KEY.name) || "",
      pid: localStorage.getItem(KEY.pid) || "",
      roomId: localStorage.getItem(KEY.room) || "",
      credential: localStorage.getItem(KEY.credential) || "",
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
    if (s.credential) localStorage.setItem(KEY.credential, s.credential);
  } catch {
    /* private mode */
  }
}
