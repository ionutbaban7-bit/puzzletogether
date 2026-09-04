# Copy/paste implementation prompt — PuzzleTogether remediation delivery

> **Use this prompt in the next implementation session.** It is intentionally specific so the session can continue even if the prior agent context is unavailable.

## Role and mission

You are the implementation owner for the next PuzzleTogether delivery. Raise the product to a premium collaborative-game quality bar, beginning with two verified user blockers:

1. On a physical iPhone, a participant intermittently cannot grab or move jigsaw pieces.
2. On a physical iPhone, a joining participant cannot reliably find/use Chat or see team conversation.

Then replace the current tray-based Canvas mechanics with purposeful, team-aware Letter Canvas and Sentence Canvas experiences. Add selectable colour teams safely, and remove/delist the weak generated catalog categories until replacements meet a real quality gate.

Read `docs/product-remediation-review-2026-09-04.md` first. It contains audited evidence, decisions, and the exact non-regression constraints.

## Mandatory operating rules

- Work only on the Arena-provided active branch. Do not switch branches, create a side branch, or push elsewhere.
- Before changing files, run `git status --short`, fetch the active remote branch, and reconcile only after proving any worktree delta is preserved. **Never use `git reset --hard`, `git clean`, or checkout-overwrite to discard unknown work.**
- Treat the repository’s current `WORKPLAN.md` and `docs/qa-report.md` as historical evidence. Extend them with the new remediation facts; do not silently rewrite or erase the prior delivery record.
- Do not claim the iPhone issue is fixed from Chromium emulation, synthetic PointerEvents, Android, or code inspection. A physical iPhone Safari sign-off is mandatory.
- Do not implement teams as frontend-only local state. Teams, membership, inventory/ownership, permissions, persistence, reconnect, and exports must be server-authoritative.
- Do not replace weak catalog content with a batch of superficial seed variations. Quality and truthful naming matter as much as valid licenses.
- Preserve the existing workshop reset endpoint and semantics: `POST /api/rooms/:id/reset` remains the workshop reset.
- Preserve the Stage 2 jigsaw layout contract: server-authoritative, reconnect-safe, skips locked/held pieces, and never sets `moved=true` merely because a layout ran.
- Preserve the jigsaw-only reset contract: active timer, stage, players, and workshop state survive `POST /api/rooms/:id/puzzle-reset`.
- Keep gameplay dark. If Canvas needs a work surface, it is a contained activity surface, not a white gameplay page. Preserve the Coaching Partners marketing identity and short/plain RO/EN copy.

## Starting facts you must not rediscover incorrectly

- Current remote baseline was `d35f7bb` when this handoff was written. The original Stage 0–7 work and picker-image repair are already pushed.
- Current protocol version is 2. Existing automated protocol suite passed 132/132 at the baseline.
- Current server chat behaviour is already participant-capable: `init` includes `room.chat`, live chat broadcasts to every connection, snapshots persist chat, and the client stores it. A fresh two-client probe proved participant live delivery and reconnect history.
- The reported Chat failure is therefore not evidence that the server deliberately restricts chat to facilitators. The likely problem is mobile chrome/discoverability/keyboard/layout, but verify it on device.
- Current `Board.tsx`, `CanvasBoard.tsx`, and `RankingActivity.tsx` each have separate Pointer Event implementations. They call `setPointerCapture`, do not handle `lostpointercapture`, and do not share cancellation/release logic.
- `Board.tsx` calls `setPointerCapture(undefined as number)` on Escape; correct this rather than preserving it.
- Server claim TTL is configured at eight seconds, but the stale-claim sweep currently runs only on the 30-second heartbeat. Fix the observed expiry semantics.
- Current Letter Canvas/Sentence Canvas uses a desktop tray or mobile bottom sheet. Clicking/tapping a token spawns it at the viewport centre with jitter. It has no team entity and reconstructs sentence text from coordinates.
- Current individual `PlayerView.color` is presence colour, not team colour. Do not repurpose it as `teamColor`.
- Visual review found the complete current Abstract Geometry and Isometric Worlds sets unacceptable: repeated template composition, not meaningful distinct content. Blueprint Architecture and five named Romanian city illustrations also need a quality/truthfulness review.

## Ordered work packages

Do not begin a later package until its tests and documented acceptance gate are green. Commit logically after each green package and push the active branch. Keep the pull request updated.

### Package 0 — baseline, safety, and reproducibility

1. Inspect current Git state and preserve any unknown worktree material.
2. Run the current executable baseline:
   ```sh
   npm ci
   npm run typecheck
   npm run build
   BASE=http://127.0.0.1:3000 npm run test:protocol
   BASE=http://127.0.0.1:3000 npm run test:catalog-serve
   BASE=http://127.0.0.1:3000 npm run test:load
   npm run test:render-contract
   ```
3. Start the app on `0.0.0.0`; browser-facing paths must remain relative/same-origin so the Arena preview works.
4. Add a documented device-test protocol and a privacy-safe input telemetry switch before attempting to diagnose the iPhone failure.
5. Add an explicit test inventory identifying which checks are Node protocol tests, browser-emulation tests, and physical-device tests. Do not merge labels between them.

**Exit gate:** clean baseline or every pre-existing failure recorded with cause; no destructive recovery action; device test plan and telemetry design reviewed.

### Package 1 — P0 resilient pointer/claim lifecycle

#### Desired implementation

Create a reusable client-side gesture controller/hook, rather than patching only `Board.tsx`. It should serve the jigsaw first and then be adopted by Canvas/ranking where applicable.

Use an explicit state machine, for example:

```text
idle
  -> pressing(pointerId, candidate)
  -> claiming(pointerId, itemId)
  -> dragging(pointerId, itemId)
  -> dropped
  -> cancelled
  -> idle
```

Required behaviour:

- Store the active `pointerId`, last valid screen/world location, capture status, candidate item, and whether the movement threshold was crossed.
- Add pointer state before attempting capture. Wrap `setPointerCapture` in a safe helper; if it fails or is unavailable, use a window-level `pointermove`/`pointerup`/`pointercancel` fallback for the active pointer.
- Handle all release paths exactly once: `pointerup`, `pointercancel`, `lostpointercapture`, `window.blur`, `visibilitychange`, `pagehide`, component unmount, second-finger transition, and explicit Escape. Use `releasePointerCapture(pointerId)` only when capture exists; never call `setPointerCapture` with an invalid id.
- Do not treat a cancellation as a normal pointer-up with an invented final coordinate. Release the current claim using the last known valid position, then reconcile from the server.
- Use a small movement threshold before turning a touch/press into a drag/claim. It must still feel immediate, but an accidental tap must not leave a server claim/moved state.
- Preserve pinch/pan. A second touch must atomically cancel/release an in-progress piece drag before entering pinch mode.
- Add scoped CSS/native-event protections only to interactive boards: `touch-action: none`, appropriate `overscroll-behavior`, selection/callout suppression, and a tested non-passive fallback only if Safari evidence shows it is needed. Do not globally prevent scrolling or break forms/chat.
- Make server claim expiration genuinely prompt. Either sweep claims at a short interval or use expiry timers; also make a deliberate client release idempotent. On disconnect, continue to release all claims immediately.
- Keep server authority: local motion is optimistic only; piece/tile rejection restores authoritative state and communicates a concise usable message.
- Keep dirty rendering. Do not introduce a perpetual animation loop to hide state inconsistencies.

#### Test requirements

Add source/unit/state-machine tests for:

- safe capture failure;
- `lostpointercapture` after pointer down;
- cancellation after a partial move;
- blur/pagehide/unmount;
- second finger during a drag;
- duplicate/out-of-order terminal events;
- server rejection/reconcile;
- prompt stale claim expiry;
- existing two-player contested claim and reconnect flows.

Update protocol tests to assert a cancelled/released claim does not remain held beyond the agreed short deadline. Keep jigsaw layout and reset tests intact.

#### Physical iPhone gate — mandatory

Use a real iPhone, Safari, and Web Inspector/remote debugging. Test the newest supported iOS and the oldest supported iOS release; record exact devices and OS versions. For each device:

- perform at least 100 grab/move/drop cycles from scattered positions, tray positions, board edges, and different zoom levels;
- repeat in portrait and landscape, with compact/expanded Safari chrome;
- test a second-finger pinch while dragging, a quick tap, long press, cancellation/lost-capture test hook, background/foreground, orientation change, host lock/unlock, and offline/reconnect;
- test a second browser/player trying to claim the same item;
- confirm no stale local pointer map, no stuck claim, no false snap/drop, and no more than the agreed prompt claim-release delay.

Capture privacy-safe telemetry and a short screen recording. If it fails, include the event trace in the issue/PR; do not declare success.

**Exit gate:** all protocol/state-machine tests pass and the physical iPhone evidence explicitly passes.

### Package 2 — P0 mobile GameChrome and participant Chat

#### Desired implementation

Split global room chrome from activity controls. Create a documented layer/layout contract, e.g. `GameChrome`, `MobileCommandBar`, `MobileChatSheet`, and CSS variables for safe top/bottom, keyboard offset, and reserved activity-tool area.

On phone widths:

- Keep a **visible, labelled Chat action** persistently reachable by every participant. It must not require interpreting an emoji or opening an unrelated host menu.
- Use an unread count for messages received while the sheet is closed. Do not display total historic message count as though it were unread count.
- Move lower-priority/host-only/new puzzle/share/leave actions into a labelled overflow menu or a separate reachable command surface. Do not make an unwrappable row of icon buttons compete with the HUD.
- Make z-index layering explicit. Global Chat must not sit below Canvas sheets, ranking panels, board controls, or browser safe areas.
- Implement the drawer as an accessible bottom sheet/dialog on mobile. It needs a semantic title, close label, focus management, focus return, Escape handling where applicable, and an `aria-live` strategy for new messages.
- Use dynamic viewport and `window.visualViewport` safely so the message list and composer stay visible above the iOS keyboard. Avoid a fixed `vh` calculation that ignores keyboard/Safari chrome.
- Auto-scroll only if the user is already near the bottom. Preserve their reading position and show a “new messages” affordance otherwise.
- Keep chat history/live message access for host, participant, and any explicitly allowed role. Do not introduce a host-only branch.
- Preserve the current server chat retention cap unless a product decision changes it. If changing it, include snapshot/storage/abuse implications and migration.

#### Test requirements

Add a committed multi-client chat protocol test covering:

- init history for host and participant;
- participant-to-host and host-to-participant delivery;
- ordering and duplicate protection;
- reconnect history;
- maximum length and empty message handling;
- persistence/restart behaviour;
- puzzle change/reset behaviour as decided.

Add browser tests at narrow desktop/mobile emulation sizes for visible labelled trigger, open/close, unread state, focus return, and no clipping. These tests do not replace iPhone validation.

#### Physical iPhone gate — mandatory

As a non-host participant, prove:

- Chat is visibly named and reachable immediately in the lobby and active play.
- History and live messages are visible.
- Sending works with the iOS keyboard open.
- The composer, close control, and trigger remain reachable at 320×568, 375×667, 390×844, landscape, and a safe-area device.
- Board/Canvas interaction resumes after Chat closes.

**Exit gate:** participant chat device flow and all protocol/browser tests pass.

### Package 3 — versioned server-authoritative team and Canvas domain model

Do this before redesigning UI. Do not bolt colours onto `PlayerView.color`.

#### Recommended model

```ts
interface TeamView {
  id: string;
  name: string;
  color: TeamColor;       // e.g. red, amber, yellow, green, blue, purple
  marker: string;         // symbol/pattern label; color is never the sole cue
  order: number;
  memberIds: string[];
}

interface PlayerView {
  // retain id, name, personal presence color, role
  teamId?: string | null;
}

interface RoomView {
  teamMode: "shared" | "color-teams";
  teams: TeamView[];
  canvasVersion?: 1 | 2;
}
```

On the server, retain the authoritative maps/relations rather than trusting `memberIds` from the client. Add `teamId` to serialised player/tile/composition state only where needed.

Recommended lobby flow:

1. Host chooses **Shared** or **Color teams** and 2–6 available named colours.
2. Players choose an open team before start; host can rebalance or assign.
3. Once play begins, ordinary self-switching is locked. Host reassignment is server-authoritative, auditable, and does not delete a player’s work.
4. Every team indicator has a name plus a marker/pattern/icon as well as a colour.

Recommended semantics:

- Shared mode is one neutral/shared group; current individual presence colours stay visible.
- Color-team mode uses team-scoped source banks/inventory and team-aware composition lanes. It is collaborative by default, not an arbitrary competitive leaderboard.
- If a later activity needs scoring, score only a validated objective and expose team score explicitly. Do not add decorative scoring just because teams exist.

#### Protocol, persistence, and migration

- Add a versioned, validated server message/action for team configuration, participant selection, and host assignment. Reject unknown team, cross-room player, spectator misuse, post-start self-switch, and unauthorised host actions.
- Include teams/membership in `init`, room broadcasts, snapshot persistence, restore, reset, activity switch, export, and reconnect.
- Add `canvasVersion`/activity revision. New Canvas rooms use v2. Preserve existing v1 active/snapshot rooms for their short remaining room lifetime with the legacy renderer/model; do not rearrange a live v1 freeform composition.
- Normalise old snapshots safely: absent teams become shared mode; absent player team is `null`; absent version is v1 when canvas tiles exist. Make the normaliser idempotent.
- Document how old v1 rooms expire/migrate. Do not silently delete live workshop output.
- Bump protocol version only if the wire compatibility change truly requires it; otherwise retain backward-compatible optional fields. Document the compatibility decision.

#### Test requirements

Add team protocol tests for lobby selection, host assignment, start lock, reconnect, snapshot restart, reset/puzzle-switch handling, role rejection, export, tile ownership/inventory, and simultaneous moves. Update all existing type/store fixtures.

**Exit gate:** team state survives reconnect/restart, cannot be spoofed by frontend messages, and has a stable migration story.

### Package 4 — Letter Canvas v2: physical, collaborative word building

#### Product outcome

A participant should immediately understand: “These are real letter pieces from our team bank; we can discover them, bring them into a word lane, and see what our group is creating.” The experience should feel playful and tactically collaborative, not like an alphabet toolbar that teleports tokens to the viewport centre.

#### Required design

- Replace tap-to-spawn inventory with actual server-created letter tiles in intentional source-bank regions. A finite mode physically contains the available letters; sandbox may generate from an explicit controlled source action.
- On desktop, provide a visibly organised but playful bank/rack. On mobile, provide a bottom/board source area with draggable/tappable physical pieces, not a hidden generic tray.
- Use deterministic server layout for bank tiles so all players see the same pieces. Preserve individual item claims and prompt release.
- Provide explicit, structured word lanes or word groups. Dropping into a lane should give a clear insertion/ordering preview; do not infer a word only from near-by pixel coordinates.
- Support a robust alternative to drag: tap/select a tile, then choose an insertion location/action. This is required for mobile resilience and keyboard accessibility.
- Show team identity on banks, lanes, active pieces, and activity status without relying on colour alone.
- Explain the scenario/objective in concise RO/EN copy. Examples may be Agile values, team motto, or themed anagrams, but do not promise dictionary validation without a maintained licensed lexicon.
- Support a shared mode and color-team mode. In team mode, each team bank must be meaningful and server-authoritative; do not allow a member to steal a different team’s bank item unless the facilitator explicitly grants it.
- Keep purposeful collaboration: visible team activity/presence, clear “draft/review/final” state, host finalisation, undo behaviour that cannot undo another team’s work accidentally, and durable export.

#### Implementation direction

Prefer semantic DOM tiles/buttons with CSS transforms and viewport culling/virtualisation over an opaque all-canvas interaction surface. The inventory size (96/180/260) requires performance design, but not a sacrifice of keyboard/VoiceOver interaction. If canvas remains for any visual layer, provide a fully equivalent semantic interaction layer.

Create a first-class composition model, for example token locations represented as `bank`, `laneId`, and ordered `index`, rather than only free x/y. Retain x/y only if needed for visual animation/layout. The server must own insertion, reordering, inventory, claims, history, and final reconstruction.

#### Tests and acceptance

- Two teams and shared mode; team selection and banking visible on desktop/phone.
- Concurrent claimed tiles, contested operations, undo, reconnect/restart, host lock/complete/reset, and export.
- Meaningful output reconstruction from ordered lanes, including Romanian diacritics and punctuation.
- Keyboard-only selection/insertion/reorder and screen-reader labels.
- At least one facilitated usability session with participants: every participant can form a first word without facilitator explanation, can identify their team/bank, and can tell what the group should do next.

**Exit gate:** usability evidence plus automated tests; no legacy v1 room regression.

### Package 5 — Sentence Canvas v2: professional collaborative composition

#### Product outcome

Sentence Canvas should behave like a guided collaborative composition activity, not a raw word tray scattered on a blank sheet. A facilitator should be able to frame the situation, teams should construct/review an answer, and export should faithfully represent intentional token order.

#### Required design

- Start with a visible scenario, goal, time/context, and concise instructions.
- Use structured composition lanes/sections (for example idea, reason/evidence, commitment/next step) appropriate to each puzzle’s scenario. Do not hard-code a generic sentence strip for every activity.
- Use first-class token sequences and insertion positions. Drag, tap-to-select/place, keyboard controls, and touch all produce the same authoritative operation.
- Show category/source bank as a supporting tool, not the centre of the experience. Give words meaningful grouping and search/filter only if it helps the scenario.
- Provide clear draft/review/final state, team/shared lanes, author/presence cues, and explicit facilitator finalisation.
- Retain custom words but label them clearly. Use soft suggestions only; never present unreliable spellchecking as a correctness judgment.
- Export exact semantic lane content, metadata, and participant/team context. Stop using spatial proximity as the sole source of sentence reconstruction for v2.
- Make punctuation and Romanian/English diacritics first-class in insertion and export.

#### Tests and acceptance

- Deterministic ordering, insertion before/between/after, punctuation rules, multiple lanes, team/shared mode, custom word create/edit/delete, undo/reconnect/snapshot, lock/finalise/export.
- Desktop/mobile usability test: participants can compose, revise, and review a complete response without being told to “drop words near each other.”
- Accessibility parity with Letter Canvas.

**Exit gate:** professional task flow passes usability, protocol, accessibility, mobile, and export checks.

### Package 6 — catalog quality remediation

#### Immediate content safety action

Delist **all current Abstract Geometry and Isometric Worlds records** from the public picker/API before the next catalog-quality release. Preserve their source/provenance history as `delisted`/`rejected` rather than deleting the audit trail blindly. Ensure active rooms retain the snapshot metadata they need for their limited lifetime.

Review **Blueprint Architecture** and the five named Romanian city assets immediately. The visual audit found repeated template compositions; the generic city images must not be represented as Bucharest/Sibiu/Cluj/Timișoara/Brașov without place-specific, truthful artwork.

#### Replacement quality gate

Do not add a replacement until every asset passes all of these:

1. Full manifest/schema/provenance fields and an explicit permitted license (public domain, CC0, or other approved open license).
2. Creator/source/changes/checksum/original archive documentation.
3. No watermark, logo, embedded text, or identifiable person as main subject unless explicitly approved by the product policy.
4. Truthful title, alt text, and category; a generic skyline cannot be named after a specific city.
5. Independent visual review at picker thumbnail, medium board, and high-piece puzzle use. Each entry needs a materially different subject, composition, palette, focal distribution, and puzzle-solving texture.
6. Automated duplicate/perceptual-similarity warning plus a human panel review. Warnings are release-blocking for a small curated collection unless a documented exception is approved.
7. The catalog audit has zero structural failures and the serving matrix passes after every delist/replacement.

Update picker category logic/tests, catalog source ledger, manifests, full/thumb derivatives, and documentation together. Do not leave orphan files or phantom categories.

**Exit gate:** the live picker contains only categories/art assets that pass provenance, visual differentiation, and truthful naming gates.

### Package 7 — accessibility, resilience, and production quality gate

Do not let Packages 1–6 create another local overlay/one-off code path.

#### Accessibility

- Modal/dialog primitive: named title, focus trap, Escape, focus restore, inert/background strategy.
- Every icon action has a real accessible name. Emoji is decorative, not the sole label.
- Team identity uses text/marker/pattern in addition to colour.
- DOM Canvas v2 interactions have keyboard controls and screen-reader announcements.
- Test keyboard-only, VoiceOver/iOS, text zoom/Dynamic Type, reduced motion, contrast, and no-color-only information.

#### Resilience and security

- Establish a documented threat model for room links, participant IDs, host capability, exports, uploads, and chat.
- Add appropriate rate limits/abuse controls for create/join/upload/chat/WebSocket frames; avoid harming a normal workshop.
- Set explicit production security headers and WebSocket origin policy compatible with the deployed preview/origin model.
- Revisit client-held host bearer IDs and export query parameters before an enterprise launch; avoid logging or leaking capabilities.
- Make uploads room-linked or time-limited from creation, add abandoned-upload cleanup, content/size/dimension limits, ImageMagick resource limits, and monitoring.
- Restrict/secure production health metrics as appropriate.
- Keep the explicit single-instance limitation until shared persistence/pub-sub is actually implemented; do not imply horizontal scale from a local JSON snapshot.

#### Engineering quality

- Decompose `src/server.js`, `Board.tsx`, `CanvasBoard.tsx`, and `GamePage.tsx` into domain modules/components with focused tests.
- Bring server domain contracts under type checking or runtime schema validation.
- Add CI for install/typecheck/build/protocol/catalog/format/lint and test reports.
- Add a controlled production error boundary and privacy-safe observability for input failures, claim rejections, chat delivery/UI open failures, room errors, and uploads.
- Keep any test/debug globals gated out of ordinary production use unless a deliberate diagnostic flag enables them.

## Required final QA matrix

Run and report all green before declaring the delivery complete:

```sh
npm ci
npm run typecheck
npm run build
npm run test:protocol
npm run test:render-contract
npm run catalog:audit
BASE=http://127.0.0.1:3000 npm run test:catalog-serve
BASE=http://127.0.0.1:3000 npm run test:load
npm run test:e2e
```

Add/execute the new targeted suites for pointer lifecycle, chat protocol, teams, Canvas v2, migration, and mobile chrome. If Playwright runtime is unavailable locally, document it truthfully and run it in a supplied CI/browser environment; do not invent a pass.

The physical iPhone report must include:

- device model, iOS/Safari version, date, tester, app URL/build SHA;
- both host and participant test roles;
- 100-cycle jigsaw result and cancellation/interruption cases;
- participant Chat history/live/send/keyboard result;
- Canvas v2 mobile flow where delivered;
- defects found, telemetry trace IDs, screen recording/screenshot references, and explicit pass/fail conclusion.

Repeat a visual review at desktop, small Android Chrome, physical iPhone Safari, portrait/landscape, safe area, keyboard open, and text zoom. Validate the dark gameplay shell and correct concise RO/EN copy.

## Release, migration, and rollout plan

1. **Feature/version gate:** ship resilient jigsaw input and Chat independently first if needed. Version Canvas v2 so active v1 rooms remain stable.
2. **Content gate:** delist weak categories in a separate, reversible catalog release; keep provenance history and allow existing active room snapshots to finish.
3. **Canary:** enable Canvas v2 for internal/facilitated pilot rooms first. Observe claim cancellation rate, input capture failures, chat-open/send success, team operations, reconnect errors, performance, and accessibility feedback.
4. **Rollback:** feature flag/version-select Canvas v2; retain v1 renderer for active legacy rooms. Input and Chat releases need a tested rollback strategy that does not lose room state.
5. **Documentation:** append the new evidence to `WORKPLAN.md` and `docs/qa-report.md`, update README/product copy honestly, document catalog changes/provenance, and add an operations/device-test runbook.
6. **GitHub:** make logical commits, push the active Arena branch, and update/open the pull request only from that branch. Include test evidence and unresolved risk explicitly in the PR description.

## Definition of done

The work is done only when all conditions hold:

- A real iPhone Safari participant can reliably drag jigsaw pieces, recover from interruption, and has no stuck claim/gesture state.
- A real iPhone non-host can visibly find Chat, view history/live messages, send with the keyboard open, and resume the activity.
- Teams are server-authoritative, accessible, reconnect-safe, and meaningful to Canvas gameplay.
- Letter Canvas and Sentence Canvas are structured, intuitive collaborative activities with mobile/keyboard alternatives, not centre-spawn trays.
- Weak content is not exposed as premium catalog content; all replacement content is visually distinct, truthfully named, licensed, and audited.
- Existing reset/layout/coaching/privacy behaviour remains intact.
- Automated, browser, physical-device, performance, catalog, migration, accessibility, and security gates are documented and green—or any limitation is honestly recorded and blocks the affected release rather than being relabelled as a pass.
