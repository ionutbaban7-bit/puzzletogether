# PuzzleTogether

**Play together. Leave with a decision.**

PuzzleTogether is a realtime team workshop game. A facilitator can warm a team up with a collaborative jigsaw, run a survival-ranking exercise or Team Compass, freeze the room for discussion, and capture insights and owned actions without moving the group to a second tool.

## What ships

### Play

- Deterministic jigsaw pieces, zoom/pan/pinch and same-origin WebSockets
- Authoritative piece claims (`heldBy`) so two people cannot drag the same piece
- Free team ranking: every card can occupy every rank and can be reordered until lock
- Team Compass with private raw answers and shared final profile codes
- Letter-tile **jigsaws** (not yet a free word-building game; the UI says this explicitly)

### Facilitate

- Locked waiting lobby, share code and explicit synchronized Start
- Coaching stages: lobby → brief → play → reveal → debrief → harvest
- Host-only board lock, timer, reveal, reset, activity change, kick and close
- Facilitator-as-spectator role
- Explicit host takeover when the original facilitator is disconnected
- Private facilitator notes
- Team-first celebration by default; individual contribution podium is opt-in

### Harvest

- Captured debrief responses
- Observed / Learned / Try next insight board
- Action items with owner, due date and status
- Host-only JSON export and print-ready HTML/PDF view
- Small JSON room snapshots in `.data/` so sessions survive a Node restart

## Architecture

- React 18, TypeScript, Vite and Tailwind
- Node/Express and `ws` on one origin
- Protocol v2; server-authoritative rooms, roles, stages, claims and coaching results
- No participant accounts or external runtime services
- Rooms expire after 24 hours of inactivity; empty rooms wait 30 minutes before reaping

Room snapshots are designed for a single process and modest workshop volume. Multi-instance deployment still requires shared persistence and pub/sub.

## Run

```bash
npm ci
npm run dev
```

The server binds to `0.0.0.0:${PORT:-3000}`.

Production:

```bash
npm run build
npm start
```

## Test

With the development server running:

```bash
npm run typecheck
npm run build
npm run test:protocol
npm run test:load
```

Browser tests use Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

The protocol suite covers access codes, host authorization, lobby freeze, claiming conflicts, completion, free ranking destinations, reveal gating, exports and questionnaire privacy.

## Privacy and content notes

- Raw Team Compass answers are returned only to their owner. Other participants receive `done` and `profileCode`.
- Team Compass is an educational reflection activity, not a validated psychometric or medical assessment.
- The public puzzle catalog includes only entries with an explicit creator/source and license. Original SVG content is labeled as such.
- Facilitator notes are private and available only through host-authenticated room export.

## Commercial use

The repository remains under the terms in [`LICENSE`](./LICENSE). The product positioning does not override those terms. Commercial use requires the copyright holder's explicit written permission.
