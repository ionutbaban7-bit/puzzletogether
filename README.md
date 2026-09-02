# 🧩 PuzzleTogether

**Solve beautiful puzzles together, in real time.**

PuzzleTogether is a real-time collaborative jigsaw puzzle app — "Miro, but everyone is
solving the same beautiful puzzle." Create a room, share a link or code, and assemble a
masterpiece with up to 20 friends. Watch each other's cursors move in real time, snap
pieces into place together, and celebrate the finish as a team.

No accounts. No sign-up. Just pick a name and play.

## ✨ Features

- **Real-time collaboration** — WebSocket sync of every piece move, player join, and cursor position (~50 ms throttle while dragging, instant final position on drop)
- **Room system** — unique room URL + 6-character room code, up to 20 players, rooms auto-expire after 24 h of inactivity
- **Curated puzzles** — 21 public-domain / CC-licensed images across 5 categories (Famous Paintings, Famous Landscapes, World Landmarks, Nature, Cities), with author credits shown in the app
- **4 difficulties** — Easy (25), Medium (64), Hard (100), Expert (144) pieces
- **Infinite-canvas board** — drag & drop pieces, pan, zoom (mouse wheel / pinch / buttons), reset view, fullscreen reference image
- **Snap & lock** — pieces snap into their slot when dropped close enough, then lock (nobody can move them), with a subtle success animation
- **Progress & timer** — live progress bar, piece counter, elapsed time
- **Completion celebration** — elegant full-screen modal with confetti, completion time, and the list of players who solved it; "Play another puzzle" resets the board for everyone

## 🛠 Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Puzzle board | HTML Canvas (sprite-cached piece rendering, 60 fps @ 144 pieces) |
| Backend | Node.js + Express (one file) |
| Realtime | `ws` WebSocket server on the same origin |
| State | In-memory rooms + rooms (no external DB or services required) |

The whole app is a **single Node.js process**: it serves the frontend (Vite middleware
in dev, static build in prod), the REST API, and the WebSocket server — no API keys,
no external services, nothing to configure.

## 🚀 Run it

Requires Node.js ≥ 18.

```bash
npm install
npm run dev        # development: http://localhost:3000 (HMR enabled)
# or
npm run build && npm start   # production: serves the built app on :3000
```

Then open two browser windows, create a room in one, and open the shared URL in the
other — move pieces and watch them sync live.

`PORT` and `HOST` env vars are supported (defaults `3000` / `0.0.0.0`).

## 🧪 Tests

Two self-contained test scripts (no test framework needed):

```bash
# 1. WebSocket protocol simulation: 24 checks covering rooms, joining by id/code,
#    move sync, snap/lock, locked-piece protection, cursors, reset, completion,
#    the 20-player cap, and room expiry handling.
node scripts/sim-test.mjs

# 2. Real-browser E2E: two headless Chromium pages join the same room, drag a piece,
#    verify realtime sync, completion modal, share dialog, and reset.
#    (requires playwright-core available; used for dev verification)
node scripts/browser-test.mjs
```

## 🖼 Image credits

All puzzle images come from **Wikimedia Commons** and are either public domain or
licensed CC BY / CC BY-SA. Author, license, and source are displayed in the puzzle
picker and shipped in `shared/puzzles.json`. To add more puzzles: drop a JPEG into
`server/public/images/`, record its dimensions in `manifest.json`, and add an entry
to `shared/puzzles.json`.

## 📁 Project structure

```
puzzletogether/
├── src/                 # React frontend
│   ├── pages/           # Landing, CreateRoom, JoinRoom, RoomRoute, GamePage
│   ├── puzzle/          # Canvas Board + viewport (pan/zoom/pinch) logic
│   ├── lib/             # API client, WebSocket client, router, session, helpers
│   └── store.ts         # useSyncExternalStore-based state (server messages → UI)
├── shared/puzzles.json  # Curated puzzle library (single source of truth)
├── server/public/       # Static assets: images + favicon
│   └── images/manifest.json   # Image dimensions (server grid math)
├── scripts/             # sim-test.mjs, browser-test.mjs
└── src/server.js        # Express + ws backend (rooms, realtime, serving)
```

## 🏗 How synchronization works

1. **Create/join** — REST calls return a `playerId` (random UUID) and room info.
2. **Connect** — the client opens `ws://host/ws`, sends `{t:"hello", roomId, playerId}`, and receives `{t:"init"}` with the full room, puzzle geometry, players, and all pieces.
3. **Drag** — pointer moves are applied locally for 60 fps smoothness and sent to the server every ~50 ms (`{t:"piece", id, x, y, drag:true}`). The server broadcasts to everyone else and is the authority for snapping/locking.
4. **Drop** — the final position is sent immediately; the server snaps the piece if it's within the snap distance and locks it (locked pieces reject further moves).
5. **Cursors** — throttled to ~30 fps and relayed in batches; rendered as colored arrows with name chips (`Maria 👆`).
6. **Completion** — when the locked count reaches the total, the server broadcasts a `completion` event with the player list.

## License

Code: MIT. Puzzle images: public domain or CC BY / CC BY-SA — see `shared/puzzles.json` for per-image attribution.
