export interface ServerMessage {
  t: string;
  [key: string]: unknown;
}

interface Handlers {
  onMessage: (msg: ServerMessage) => void;
  onStatus: (connected: boolean, attempt: number) => void;
}

/**
 * WebSocket connection to the room with automatic reconnection.
 * All traffic lives on the same origin as the page (the Node backend).
 */
export class RoomSocket {
  private ws: WebSocket | null = null;
  private roomId = "";
  private playerId = "";
  private handlers: Handlers;
  private closedByUser = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private manuallyClosed = false;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  connect(roomId: string, playerId: string) {
    this.closedByUser = false;
    this.manuallyClosed = false;
    this.roomId = roomId;
    this.playerId = playerId;
    this.open();
  }

  private open() {
    if (this.closedByUser || this.manuallyClosed) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus(true, 0);
      ws.send(
        JSON.stringify({ t: "hello", v: 2, roomId: this.roomId, playerId: this.playerId }),
      );
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" }));
      }, 15000);
    };

    ws.onmessage = (ev) => {
      try {
        this.handlers.onMessage(JSON.parse(ev.data as string) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.handlers.onStatus(false, this.attempts);
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };
  }

  private scheduleReconnect() {
    if (this.closedByUser || this.manuallyClosed) return;
    if (this.reconnectTimer) return;
    this.attempts += 1;
    if (this.attempts > 15) {
      this.handlers.onStatus(false, this.attempts);
      return;
    }
    const delay = Math.min(600 * Math.pow(1.8, this.attempts - 1), 8000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  send(msg: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        /* noop */
      }
    }
  }

  close() {
    this.closedByUser = true;
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
    }
    this.ws = null;
  }
}
