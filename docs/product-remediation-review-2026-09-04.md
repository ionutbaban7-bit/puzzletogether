# PuzzleTogether — post-release product-quality remediation review

**Review date:** 2026-09-04

**Status:** remediation planning complete; the reported iPhone interaction and participant-chat problems are **not closed**.
**Scope:** product quality, mobile interaction, realtime behaviour, Canvas activity design, content quality, accessibility, resilience, and release readiness after the seven-stage delivery.

## Executive decision

The original seven-stage delivery is present on GitHub and its automated scope remains green. That is not sufficient evidence for the new product reports. The quality bar is reopened for the affected experiences.

1. **Do not declare the iPhone jigsaw fixed** until it passes a physical iPhone Safari test. Chromium mobile emulation is useful regression coverage, not proof for WebKit touch/pointer behaviour.
2. **Do not treat chat as facilitator-only.** The server already transports participant chat correctly; the urgent failure is participant discoverability/usability in the mobile game chrome until proven otherwise.
3. **Do not ship Letter Canvas or Sentence Canvas as polished activities in their current form.** They are technically functional freeform canvases, but they do not yet deliver the requested game loop, structured collaboration, or team identity.
4. **Delist the current Abstract Geometry and Isometric Worlds sets before the next catalog-quality release, unless a genuinely varied replacement set is ready.** The visual evidence does not meet a premium content bar. The same remediation review must include Blueprint Architecture and the five Stage 5 Romanian city illustrations.
5. The next delivery must be sequenced: mobile input → mobile chat → versioned team/canvas model → Letter Canvas → Sentence Canvas → catalog remediation → hardening/release gate.

## Workspace and verification status

### Safe reconciliation

The local checkout had been reset to the grafted base commit while the prior delivery files were still present as apparent unstaged/untracked content. To preserve the worktree, the branch was first fetched from `origin`, verified at remote SHA `d35f7bbb0c1a798592efa9c4b177939325e952a5`, then reconciled with a **mixed** reset to `FETCH_HEAD`. A mixed reset updated only `HEAD` and the index; it did not overwrite working files. The resulting branch is clean at `d35f7bb`.

No destructive `reset --hard`, `clean`, reclone, or checkout-overwrite was used before reconciliation.

### Fresh executable checks on this checkout

| Check | Result | Meaning |
| --- | --- | --- |
| `npm ci --no-audit --fund=false` | pass | Reinstalled the checkout’s locked dependencies. |
| `npm run typecheck` | pass | Current client TypeScript compiles. |
| `npm run build` | pass | Current production Vite build compiles. |
| `BASE=http://127.0.0.1:3000 npm run test:protocol` | **132/132 pass** | Existing server contracts remain green. |
| Chat transport probe | pass | Participant message reached host and sender; reconnect `init` retained history. |
| `npm run catalog:audit` | pass structurally | 94 source records, 0 structural failures, 43 warnings. This is not a visual-quality approval. |
| `BASE=http://127.0.0.1:3000 npm run test:catalog-serve` | **457/457 pass** | API, image derivatives, and room matrices serve. |
| `BASE=http://127.0.0.1:3000 npm run test:load` | pass | 20 clients; 800 piece frames + 400 cursor frames in 686 ms. |
| `npm run test:render-contract` | **7/7 pass** | Existing dirty-rendering contract remains intact. |
| `npm audit --omit=dev` | 0 known production vulnerabilities | Helpful baseline only; it is not a security architecture review. |

### Explicit test limitations

No Chromium, Firefox, or WebKit executable is available in this sandbox. More importantly, no sandbox browser test can substitute for the reported physical iPhone. The new P0 acceptance gate therefore requires a real iPhone Safari session, its Web Inspector trace/telemetry, and a repeatable device test record.

## Evidence-based findings

Severity is based on user impact and release risk.

- **P0 — release-blocking:** a user cannot participate reliably.
- **P1 — must be addressed before presenting the affected feature as polished:** the product loop, trust, accessibility, or content standard is materially weak.
- **P2 — planned hardening:** valuable engineering work that is not the immediate cause of the reports.

### P0-01 — iPhone jigsaw dragging can enter an unrecoverable local gesture state

**Status:** confirmed user-impact report; root cause is not yet proven on a physical device.

**Observed implementation facts**

- `src/puzzle/Board.tsx` directly calls `canvas.setPointerCapture(e.pointerId)` at the beginning of `onPointerDown` without a guard/fallback.
- It retains mutable pointer, pinch, pan, and grab maps, handles `pointercancel` by treating it as a normal pointer-up/drop, but has no `lostpointercapture`, `visibilitychange`, `pagehide`, or `blur` recovery path.
- `Escape` calls `setPointerCapture(undefined as number)` instead of releasing the captured pointer; this can throw and cannot safely end the server claim.
- The same unguarded capture/cancellation pattern appears in `CanvasBoard.tsx` and `RankingActivity.tsx`, so any one-off Board fix would leave a family of mobile risks.
- A jigsaw claim is nominally eight seconds (`CLAIM_TTL_MS`), but stale claims are swept only by the 30-second heartbeat in `src/server.js`. An interrupted gesture can therefore remain held substantially longer than the intended TTL.

**Most credible hypotheses to test, not conclusions to claim yet**

1. Safari loses pointer capture or stops delivery after a browser/system interruption; the stale pointer remains in the local map. The next one-finger tap is then interpreted as a second finger/pinch rather than a piece grab.
2. `setPointerCapture` occasionally throws or is unsupported in the relevant Safari path; the unguarded handler exits before initializing the gesture.
3. A cancellation is converted into a normal drop using an unreliable final coordinate, leaving client/server state out of sync.
4. Touch scrolling, browser chrome changes, visual viewport changes, or a second finger interrupts the canvas because the state machine has no single cancellation/release path.

**Required remediation**

Replace the ad hoc handlers with one tested pointer-gesture controller shared by jigsaw, Canvas, and ranking. Its state machine must have an explicit `idle → pressed → claiming/dragging → dropped|cancelled` flow; record `pointerId`; safely attempt capture; use a window-level fallback when capture is unavailable; and release exactly once on `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `pagehide`, and visibility loss. A cancelled event must release the latest authoritative/local position, not manufacture a new drop position from an invalid event.

The server must also make claim expiry prompt (for example a short sweep or exact expiry scheduling) and support a deliberate release path. Preserve server authority and the existing rule that layout operations never set `moved=true`.

**P0 acceptance evidence**

- On physical iPhone Safari, repeat at least 100 grab/move/drop cycles across initially scattered pieces, tray pieces, and zoomed board positions with no stuck interaction.
- Cover portrait, landscape, compact/expanded Safari chrome, a second-finger pinch while dragging, `pointercancel`/lost-capture simulation, background/foreground, offline/reconnect, host lock/unlock, and two simultaneous players contesting the same piece.
- No pointer map remains stale after cancellation; no piece stays `heldBy` after the agreed short release deadline; a rejected claim visibly restores the piece and lets the user continue.
- Record privacy-safe input telemetry (event type, pointer type, state transition, capture success/failure, duration, rejection reason; never message text or names) and attach an iPhone test log/screen recording to the release evidence.

### P0-02 — participant chat is transport-correct but mobile-discoverability/usability is unproven and reported broken

**Status:** confirmed user-impact report; the backend transport is disproven as the primary missing feature, while the exact iOS visual/input cause remains unverified.

**What is proven**

- On WebSocket `init`, `src/server.js` sends `chat: room.chat` to every connected player, not just the host.
- A `chat` message is broadcast to all room connections; `src/store.ts` stores both the initial history and live entries.
- A fresh two-client probe sent a participant message, observed it at both host and participant, then reconnected the participant and verified the message in `init.chat`.
- The source renders the chat button without an `isHost` condition in `GamePage.tsx`.

**Why the report remains credible**

- The mobile game chrome puts a collapsed HUD and multiple icon-only actions in one top-row layout. Host actions can exceed the available width; action priority, overflow, and stacking are not designed as an explicit mobile layout system.
- The chat trigger is icon-only below the `sm` breakpoint and has only a generic `title`, no accessible action label or mobile-specific affordance. A participant can reasonably fail to discover it.
- The drawer is a fixed `max-h-[60vh]` panel with no focus management, unread state, auto-scroll policy, visual-viewport/keyboard handling, or return-focus behaviour. iOS keyboard and safe-area scenarios have not been tested.
- There is no automated end-to-end test that asserts a joining participant can find the control, read existing chat, receive a new message, type while the iOS keyboard is open, and close/reopen it.

**Required remediation**

Create a shared `GameChrome`/mobile command layout. On phones, preserve a **labeled, always-visible Chat action** with an unread badge; put lower-priority host/share/leave actions behind a clearly labeled overflow menu rather than relying on a dense icon row. Use one explicit z-index/safe-area contract for global chrome and activity-specific tools.

Turn the mobile drawer into an accessible bottom sheet/dialog that uses dynamic viewport sizing and visual-viewport keyboard offset. Focus the composer when opened intentionally, return focus to the invoking Chat button on close, auto-scroll only when the reader is already near the latest message, announce new unread messages accessibly, and never hide history/new messages based on role.

**P0 acceptance evidence**

- A non-host on physical iPhone can find a visible action named Chat without guessing an emoji.
- The participant sees the prior 50-message history, receives live host/participant messages, reconnects and sees retained history, and can send a message with the iOS keyboard open.
- At 320×568, 375×667, 390×844, landscape, and safe-area devices: no trigger, composer, or close action is clipped or covered by puzzle/Canvas controls.
- A two-client protocol test is committed for history, delivery, reconnect, ordering, length limit, and room reset/puzzle-switch behaviour; a browser/device test asserts the participant flow.

### P1-01 — Letter Canvas does not presently create a compelling word-building game

**Status:** confirmed product/UX failure against the new requirement.

`CanvasBoard.tsx` renders an alphabet tray on desktop or a 92px/46vh mobile bottom sheet. Tapping a letter calls `spawnLetter`, which sends it to the current **viewport centre** with a deterministic jitter. This is a tool palette, not a physical collection of playable letters; it does not create discovery, shared word formation, team territory, or a purposeful next move.

Additional design limitations:

- The finite inventory is a shared text/count map, not a board of actual letter pieces.
- There is no server team entity, team membership, team inventory, team score/goal, or colour-team protocol.
- Tile colours encode token type, not team identity; player colours are individual cursor/identity colours only.
- Text is reconstructed from approximate x/y grouping, making a user’s intended word/line a fragile inference rather than a first-class composition.
- A canvas-only interaction surface is not operable by keyboard/screen-reader users.

**Product direction:** make every finite letter a real tile initially placed in an intentional, accessible team source bank/bottom area. Teams select a colour/name in the lobby, then pull, drag, or use a tap-select/place path to compose structured word lanes. The board should reveal what can be played next and make colleagues’ work visible without colour alone being the only signal.

### P1-02 — Sentence Canvas is an unconstrained word tray rather than a professional collaborative composition activity

**Status:** confirmed product/UX failure against the new requirement.

The current experience groups words by grammar category in a tray, spawns each at the viewport centre, and tries to infer sentence rows and spacing from coordinates on drop (`snapSentenceTile` and `reconstructCanvasText`). It can technically make sentences, but it offers no composition brief, lanes, review state, shared decision workflow, or durable semantic document model.

**Product direction:** introduce scenario-led composition lanes with explicit token order/insertion, prompts, team/shared sections, draft/review/final states, and a deterministic export model. Retain a deliberately permissive custom-word path, but do not claim automatic grammar validation without a licensed, maintained language resource and a product decision about false positives.

### P1-03 — current color choices are personal presence colours, not selectable color teams

**Status:** confirmed architecture gap.

`PlayerView.color` is assigned by the server as an individual player colour. There is no `Team` domain object in `src/server.js`, no persistence/restore logic for teams, no client type/store representation, and no authorization semantics for team membership/ownership. A frontend-only “red/yellow team” selector would desynchronise reconnecting players and would not be safe.

**Required design principle:** preserve personal presence colour separately; add server-authoritative team identity (`teamId`, `teamName`, `teamColor`, non-colour marker) and team-aware canvas state. Colour labels must include names/symbols/patterns so collaboration does not rely on red-vs-green distinction.

### P1-04 — catalog passes licensing/serving checks but visibly fails differentiation and truthfulness quality review

**Status:** confirmed visual-quality failure for specific sets; no license structural failure was found.

A contact-sheet review of the shipped WebP files and the generator source found the following.

| Set | Finding | Decision |
| --- | --- | --- |
| **Abstract Geometry (10)** | All ten images use the same procedural composition: broad coloured loops, translucent polygons, fine grid, and the same central nested arch motif. `abstractArt()` uses the same fixed recipe for each ID. Names such as “Paper Folds”, “Kinetic Grid”, and “Solar Rings” are not visually distinct enough at thumbnail or board level. | **Delist all 10 now**; retain archived provenance but do not present them in the picker. Replace only after independent art direction and visual review. |
| **Isometric Worlds (10)** | Every image shares the same grid, star field, block/triangle language, palette family, and composition. `isometricArt()` uses only five central motifs (`index % 5`) for ten named worlds, so the visual families repeat. | **Delist all 10 now**; do not relabel superficial variants as distinct worlds. |
| **Blueprint Architecture (10)** | The audit already records perceptual-similarity warnings. The contact sheet confirms the same blueprint frame, corner targets, stacked rhombi, and central box construction across the set. | Put under **immediate art-direction review**; hide/delist if a human quality panel does not pass each asset as distinct. |
| **Stage 5 Romanian cities (5)** | The five files marketed as Bucharest, Sibiu, Cluj, Timișoara, and Brașov are effectively variants of one generic colourful skyline. The cities branch in the deterministic generator does not contain place-specific city motifs. | Stop representing these as specific locations unless replaced with truthfully sourced/created place-specific art. Delist or rename transparently pending replacement. |
| Other Stage 5 additions | Landscapes, landmarks, nature, and paintings show more subject variation in the review, but still need normal provenance/visual review before any future expansion. | No blanket approval; use the new quality gate for every replacement. |

The existing `npm run catalog:audit` result means the manifest schema, provenance fields, checksums, and permitted license classes pass. It does **not** measure whether a collection is visually distinctive, compelling, or accurately named. Its 43 warnings should no longer be treated as merely cosmetic in these categories.

**Content release rule:** never generate ten seed variations from one template and market them as ten distinct scenes. Every candidate must pass provenance/license review, truthful naming, human visual review at picker and puzzle sizes, and duplicate/similarity screening. If the replacement cannot meet those gates, leave the category delisted.

### P1-05 — Canvas product messaging is contradictory

The landing page says Letter Canvas is “In progress; we show only what is ready,” while the creation flow exposes Letter Canvas and Sentence Canvas as selectable activities. The README also describes letter tiles as “jigsaws” rather than the actual freeform Canvas implementation.

Until Canvas v2 is ready, either hide it from the general activity picker or label it consistently as a pilot/prototype with honest limitations. Preserve the requested concise roadmap line; do not use marketing language to overstate unfinished mechanics.

### P1-06 — accessibility is insufficient for a collaborative product

- Jigsaw and Canvas are primarily `<canvas>` surfaces with a generic image role, not keyboard-operable game controls.
- The modal primitive lacks labelled-dialog wiring, focus trapping, Escape strategy, and focus restoration.
- Multiple icon buttons rely on emoji/title rather than durable accessible names.
- Colour is currently central to player identity and would become more harmful if team colours are added without text/symbol alternatives.
- There is no verified reduced-motion, VoiceOver, Dynamic Type/text zoom, or keyboard-only test matrix.

The Canvas redesign is the opportunity to move interactive tiles to semantic DOM controls (or provide a fully equivalent semantic interaction layer) rather than deepen inaccessible canvas-only behaviour.

### P2-01 — mobile shell is a collection of local overlays rather than a controlled layout system

Game HUD, Board controls, Canvas sheet, selected-tile controls, ranking sheet, chat, facilitator drawer, and modals each choose their own `absolute`/`fixed`, z-index, safe-area, and viewport measurements. This makes collisions likely as features grow. `CanvasBoard` also derives `isMobile` directly from `window.innerWidth`, so crossing the breakpoint via resize/orientation does not itself trigger a React rerender.

Introduce a central responsive layout hook using `matchMedia` and `visualViewport`, named layer tokens, and explicit reserved regions for top chrome, bottom dock, activity tools, keyboard, and modal content.

### P2-02 — realtime robustness has good basics but needs a coherent interaction/claim contract

The server is authoritative for claims, state, reset, and snapshots, which is a strong foundation. The remaining gaps are client cancellation/release parity, prompt claim expiry, explicit rejection UX, tests for out-of-order/reconnect interaction frames, and shared input code rather than three divergent implementations.

### P2-03 — production hardening and privacy are incomplete

These are not claimed exploits; they are production-readiness gaps visible in the source.

- No rate limiting/abuse controls are present for room creation, join attempts, uploads, or chat/WebSocket messages.
- WebSocket origin policy and production security headers are not explicit.
- A client-held UUID is a bearer capability for host controls and exports; exports place it in a query string. Treat it as sensitive and define a durable host-session/authorization strategy before an enterprise deployment.
- `/api/health` exposes room/player/memory metrics publicly.
- Uploads can be created before a room links them; abandoned uploaded files are not tied to a cleanup record. ImageMagick processing needs resource/decompression-bomb controls and monitoring.
- Rooms persist only in a process-local JSON snapshot. The README correctly says multi-instance deployment needs shared persistence/pub-sub; this remains a scale boundary, not an implemented capability.
- `src/server.js`, `Board.tsx`, `CanvasBoard.tsx`, and `GamePage.tsx` are large cross-cutting files. The server is JavaScript and lies outside the TypeScript compilation boundary.
- There is no repository CI workflow, no lint/format gate, no error boundary/crash reporting, and no production observability dashboard/alerts.

## Prioritized backlog

| ID | Priority | Deliverable | Release gate |
| --- | --- | --- | --- |
| M-01 | P0 | Shared resilient pointer controller and prompt server claim release/expiry | Physical iPhone Safari evidence; cancellation/reconnect multi-client tests; no stale claims. |
| M-02 | P0 | Responsive mobile GameChrome and participant-safe Chat sheet | Physical iPhone participant finds/uses chat and sees history/live messages with keyboard open. |
| D-01 | P1 | Versioned, server-authoritative Team model | Team selection, host assignment, reconnect, persistence, authorization, accessibility semantics tested. |
| D-02 | P1 | Letter Canvas v2: physical source banks, team identity, word lanes, tap/keyboard alternative | Facilitated mobile/desktop usability test and server protocol suite. |
| D-03 | P1 | Sentence Canvas v2: scenario, compositional lanes, explicit sequence/review/final model | Deterministic export; collaboration/reconnect/undo tests; usability test. |
| C-01 | P1 | Delist Abstract Geometry and Isometric Worlds | Catalog, picker, API, manifest, source ledger, active-room compatibility, and serving tests green. |
| C-02 | P1 | Review/delist/replace generic Blueprint and named city imagery | Human visual panel and truthful-name/provenance gate pass. |
| P-01 | P1 | Resolve Canvas positioning/marketing/README contradiction | One short, honest RO/EN message across picker, landing, and documentation. |
| A-01 | P1 | Accessible semantic interaction paths and modal/chat accessibility | Keyboard, VoiceOver, text zoom, reduced-motion checks pass. |
| R-01 | P2 | Central mobile layout/layer system | No overlap/clipping matrix across activities, viewport sizes, keyboard, safe areas, orientation. |
| R-02 | P2 | Security, abuse, upload lifecycle, privacy, and production deployment hardening | Threat model, integration tests, monitored limits, data-retention policy, deployment runbook. |
| R-03 | P2 | Engineering quality system | CI, lint/format, component/domain decomposition, error boundary, telemetry/alerts, device farm or maintained physical device matrix. |

## Product decisions required before implementation begins

The recommended defaults are included to unblock a future implementation session.

1. **Canvas availability until v2:** recommended: hide from the normal picker or mark both Canvas activities as a clearly labelled pilot. Do not call them complete.
2. **Team intent:** recommended: colour teams are collaborative work groups, not a forced competition. They receive distinct banks/lanes/identity; add scoring only to a validated activity goal, not as decorative gamification.
3. **Team setup:** recommended: host chooses shared mode or 2–6 colour teams in the lobby; participants select an open team; host can rebalance before play and can make an auditable reassignment during play. A team always has name + colour + icon/pattern.
4. **Inventory policy:** recommended: in team mode each team owns its own finite letter/word bank, while shared mode uses one neutral bank. This makes team identity meaningful and avoids a race on an invisible global inventory.
5. **Canvas migration:** recommended: new rooms use `canvasVersion: 2`; persisted/in-progress v1 rooms retain the legacy renderer for their short room lifetime. Never rearrange a live v1 composition in place.
6. **Content action:** recommended: delist the two explicitly reviewed weak categories now, retain their archived source records as rejected/delisted rather than silently deleting provenance, and do not replace them with a new batch until the quality gate passes.
7. **iOS support policy:** define the supported oldest iOS version and test the latest iOS Safari plus that oldest supported release on physical hardware before every input release.
8. **Chat policy:** recommended: all active room roles retain the current ability to read/send normal team chat unless the product explicitly creates a separate moderator-only mode. Do not silently make spectator/participant visibility unequal.

## Non-regression constraints

The next implementation must preserve all of the following:

- Gameplay shell remains dark; any work-sheet surface is scoped to the activity rather than turning play into a white marketing page.
- Marketing continues to use the Coaching Partners azure/pink/purple/blue-gray/white identity.
- Copy remains concise, plain, and correct in Romanian and English; retain one concise honest Canvas roadmap line until the work is genuinely complete.
- `POST /api/rooms/:id/reset` retains the existing workshop reset semantics.
- Jigsaw layout stays server-authoritative, reconnect-safe, skips locked/held pieces, and never marks a piece moved merely because a layout changed.
- Jigsaw-only reset preserves timer, stage, players, and workshop state.
- Privacy rules for Team Compass raw answers remain intact.
- Catalog replacements use verifiable public-domain/CC0/open licenses, full provenance, no watermark/logo/identifiable-person main subject, truthful titles, audit-clean manifest entries, and Romanian content where required.
- Preserve dirty rendering; no permanent animation loop may be introduced to paper over input/UI defects.

## Handoff

The detailed copy/paste implementation brief is in [`next-session-implementation-prompt.md`](next-session-implementation-prompt.md). It includes architecture, migration, rollout, test plans, and acceptance criteria for the ordered remediation delivery.
