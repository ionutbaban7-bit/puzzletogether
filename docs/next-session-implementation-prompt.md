# Copy/paste continuation prompt — PuzzleTogether post-remediation release gate

> **Read this before changing code.** The automated remediation is already implemented on the active Arena branch. Your job is to validate it on real devices, complete the remaining quality gates in order, and make only evidence-backed follow-up fixes. Do not restart or replace the completed architecture.

## Mission and current truth

PuzzleTogether has completed the original seven-stage delivery plus this remediation:

- resilient shared Pointer Events lifecycle and prompt claim recovery;
- participant-visible, keyboard-safe mobile Chat;
- Canvas v2 lanes, lower source banks, selectable colour teams and semantic ordering;
- retirement of weak Abstract Geometry and Isometric Worlds content with legacy-room compatibility;
- catalog image-serving hardening and isolated catalog serving tests.

The user’s two original P0 reports are **not physically closed**: no real iPhone Safari test was possible in this sandbox. Do not say “fixed on iPhone” without the physical evidence specified below.

Read `docs/product-remediation-review-2026-09-04.md` first. It is the authoritative status/risk record.

## Non-negotiable operating rules

- Work only on Arena’s active branch. Do not switch branches, create side branches, or push elsewhere.
- Start with `git status --short`; preserve unknown work. Never use `git reset --hard`, `git clean`, or checkout-overwrite to discard work.
- Complete stages **0 → 7 in order**. A stage is not green until its stated evidence is recorded; do not quietly start a later stage.
- Commit logically and push the active branch after every green stage. Keep the pull request truthful about automated versus physical evidence.
- Do not claim an iPhone result from Chromium emulation, synthetic PointerEvents, Android, source inspection, or a passing Node test.
- Preserve `POST /api/rooms/:id/reset` workshop-reset semantics.
- Preserve the server-authoritative jigsaw layout contract: never move locked/held pieces and never set `moved=true` merely because a layout ran.
- Preserve the jigsaw-only reset contract: timer, stage, players, and workshop state survive `POST /api/rooms/:id/puzzle-reset`.
- Keep gameplay dark. Marketing uses the Coaching Partners azure/pink/purple/blue-gray/white identity. Keep short/plain correct RO/EN copy; do not invent claims.
- Do not reintroduce Abstract Geometry or Isometric Worlds merely by renaming/recolouring procedural variants.

## Completed architecture — preserve it

### Input and claims

- `src/puzzle/usePointerLifecycle.ts` is shared by `Board.tsx`, `CanvasBoard.tsx`, and `RankingActivity.tsx`.
- It stores active pointers before safely attempting capture; on failed/unavailable capture it uses a window fallback for only that pointer.
- It terminates exactly once on up, cancel, lost capture, blur, visibility change, page hide, resize/visual-viewport interruption, Escape, and unmount.
- `src/puzzle/pointerTelemetry.ts` is opt-in only. Add `?ptPointerDebug=1` to an iPhone test URL and inspect `window.__ptPointerTrace` in Web Inspector. The trace must remain client-only and must not acquire coordinates, pointer IDs, room/player IDs, names, chat text, or other personal/content data.
- Server claim sweeping is independent of the heartbeat. Do not restore the old 30-second-only expiry behavior.
- Cancellation is not a normal drop. It must release/reconcile without snap/score. Canvas preserves a pre-drag origin so cancel/disconnect/expiry/undo do not leave stale lane metadata.

### Chat and mobile shell

- `GamePage.tsx` provides labeled always-visible `Chat` below the compact breakpoint, regardless of role. Lower-priority commands are behind `More`.
- `ChatSheet.tsx` is a dialog with focus handling, history/live message behavior, unread state, return focus, safe areas, and visual viewport/keyboard handling.
- Server `init` includes chat history for every connection. Live entries broadcast to every participant and sender retries are idempotent by sender-scoped `clientMessageId`.
- `game-shell`, `useVisualViewport`, and `useMediaQuery` are used to avoid fixed iPhone viewport assumptions. Do not replace them with a one-time `window.innerWidth` branch.

### Canvas v2 and teams

- New Canvas rooms use `canvas.version === 2`; active/restored v1 canvases remain freeform and must not be rearranged.
- Canvas v2 has server-defined semantic lanes. Letter Canvas uses Word lanes; Sentence Canvas uses Idea → Reason → Next step lanes.
- `teamMode` is `shared | color-teams`. Colour teams are intentionally a Canvas mechanic only; do not expose a misleading team-bank/lane promise for jigsaw/coaching.
- Teams are server-authoritative: `TeamView` has `id`, `name`, `color`, `marker`, `order`, `memberIds`; player presence colour remains separate from team colour.
- Host controls: `{ t: "control", action: "teams", mode, count }` and `{ t: "control", action: "teamAssign", playerId, teamId }`.
- Participant lobby selection: `{ t: "team", action: "select", teamId }`. Start rejects unassigned active Canvas players in colour-team mode.
- Canvas operations remain authoritative: `{ t: "canvas", op: "place", id, laneId, laneIndex? }`; spawn, move, duplicate, delete, edit, flip, undo remain supported.
- Team banks, lane permissions, tile ownership, reconnect snapshots and export are server-side. Never turn these into client-only state.
- `CompositionOutline` is the semantic/keyboard alternative to visual canvas tiles; selected tiles support Place and earlier/later authoritative reorder actions.

### Catalog and image serving

- Active catalog is 8 categories / 70 puzzles / 74 source records. `data/catalog/retired-stage5.json` retains 20 retired records only for provenance/short-lived legacy room restoration.
- Retired entries must remain absent from active API, pickers, manifests, public WebPs and active source ledger.
- A legacy retired room uses `/api/retired-images/:id?room=:roomId`; the route must validate that currently active legacy room. The unscoped route must remain unavailable.
- `/images` is an explicit closed static route. A missing derivative must be a fast 404, not Vite HTML/proxy timeout or a 500. Vite proxy configuration must require an explicit distinct `VITE_BACKEND_URL`.
- `npm run test:catalog-serve` owns a clean `DATA_DIR` and port by default. Do not make its room matrix pollute normal `.data/rooms.json` again.

## Stage 0 — establish reproducible release evidence

1. Record active branch/commit, dependency version, deployment URL, and supported oldest iOS policy.
2. Run:
   ```sh
   npm ci
   npm run typecheck
   npm run build
   npm run test:protocol
   npm run test:render-contract
   npm run catalog:audit
   npm run test:catalog-serve
   npm run test:load
   ```
3. Run browser suites where Playwright runtimes are available:
   ```sh
   npm run test:e2e
   LOBBY_ONLY=1 node scripts/jigsaw-browser-test.mjs
   ```
   The previous sandbox had no Playwright browser binary and `npx playwright install chromium` failed with TLS `ECONNRESET`; record that fact rather than inventing a pass.
4. Start the app on `0.0.0.0`. Browser-facing client calls must remain relative/same-origin for Arena preview/proxy compatibility.
5. Create a release evidence record separating Node/protocol, browser-emulation, physical-device, catalog, accessibility, security, and manual visual results.

**Exit gate:** all executable gates green or an explicitly documented infrastructure failure; no unclassified failure.

## Stage 1 — physical iPhone Safari jigsaw P0 validation

Use a real iPhone and Safari Web Inspector. Test the newest supported iOS plus the oldest supported iOS release. Use `?ptPointerDebug=1` and capture only privacy-safe trace data.

For each device/role, execute and record:

1. At least 100 grab/move/drop cycles across scattered pieces, tray pieces, board edges, and different zoom levels.
2. Portrait and landscape; compact and expanded Safari chrome; Dynamic Type/text zoom where supported.
3. Quick tap, long press, second-finger pinch during drag, lost-capture/cancel path, background/foreground, orientation change, host lock/unlock, offline/reconnect.
4. A second browser/client contesting a held piece and successful recovery after release/expiry.
5. No stale local interaction, no false snap/score on cancellation, no stuck `heldBy`, and a usable claim-release delay.

If a failure occurs, attach the bounded trace and a privacy-safe recording to the issue/PR, identify the first unexpected transition, then fix only the demonstrated path. Keep pointer capture fallback and cancellation semantics intact.

**Exit gate:** explicit pass result from real iPhone Safari. This remains a release blocker until passed.

## Stage 2 — physical iPhone participant Chat P0 validation

As a non-host on the same real devices:

1. Find the labeled `Chat` button without guessing an icon.
2. Open it from lobby and play; read initial history and live host/participant messages.
3. Send a message with the iOS keyboard open; verify it reaches sender and another client exactly once.
4. Test unread badge, scroll/read position, close/reopen, Escape/hardware keyboard where available, safe areas, portrait/landscape, and resume activity after close.
5. Test reconnect/retry and a room reset/activity switch according to existing chat policy.

Do not hide the trigger behind host-only state or a visual-only emoji. Do not globally suppress touch scrolling in inputs/chat.

**Exit gate:** real iPhone non-host success and no overlap/clipping around keyboard/browser chrome.

## Stage 3 — Canvas v2 usability and accessibility validation

Conduct at least one facilitated desktop and phone session with people unfamiliar with the implementation.

Validate:

- A person can select a lane, pick from the lower letter/word bank, build/revise a first word or Idea→Reason→Next step response, and understand the next action without facilitator explanation.
- Shared mode remains a common bank/lanes; colour mode exposes written name + marker + colour, team-specific bank/lane, host assignment and participant selection before Start.
- Tap, drag-to-lane, semantic outline, Place, earlier/later reorder, duplicate/delete/undo, keyboard controls and export create the same ordered server result.
- iPhone lower rack, expanded rack, selected-tile actions, horizontal tool strip, custom-word keyboard, safe area and narrow layouts have no unreachable/overlapping controls.
- VoiceOver/keyboard-only users can select source tiles and lane tiles, hear names/order, reorder and delete. Test contrast, reduced motion and text zoom.
- v1 persisted Canvas room remains visually/functionally freeform after reconnect; do not migrate its live coordinates.

If usability evidence identifies a real ambiguity, preserve the v2 server contract and improve labels/layout rather than introducing a parallel local ordering model.

**Exit gate:** facilitated usability pass plus accessibility/mobile evidence; no v1 regression.

## Stage 4 — catalog visual and truthfulness review

The two retired categories stay retired. Review remaining Blueprint Architecture and named Romanian city assets manually at picker-thumbnail, 25-, 64-, and 144-piece scales.

For every asset that is generic, repetitive, weakly solvable, or inaccurately named:

1. retire it with a durable provenance/decision record, or replace it only after complete permitted-license proof;
2. retain original source/checksum/attribution/alt text and Romanian requirements;
3. ensure no watermark/logo/embedded text/identifiable-person main subject unless policy explicitly permits it;
4. show materially distinct subject, composition, focal distribution, palette and puzzle texture;
5. run duplicate/similarity screening and documented human review;
6. update source ledger, active puzzle data, manifest, full/thumb derivatives, picker/API and legacy-room policy together;
7. run `npm run catalog:audit`, `npm run catalog:report`, `npm run test:catalog-serve`, and legacy compatibility tests.

**Exit gate:** live catalog contains only accurately named, licensed, human-reviewed content. Structural audit alone is not visual approval.

## Stage 5 — security and operational hardening

Do not call this an enterprise release until the following have a threat model and tests:

- rate/abuse controls for room create/join/upload/chat/WebSocket frames;
- host/export bearer capability and query-string exposure; session authorization strategy;
- WebSocket origin policy and production security headers compatible with the deployment/preview;
- health metrics exposure;
- room-linked upload lifecycle, abandoned-upload cleanup, ImageMagick resource/decompression-bomb limits;
- local JSON snapshot single-instance limitation, backup/retention and deployment runbook.

Keep normal workshops usable while adding controls. Do not log chat text or personal names in diagnostic telemetry.

**Exit gate:** documented threat model, tested controls and operations/rollback plan.

## Stage 6 — engineering and release QA

- Add/maintain CI for install, typecheck, build, protocol, render contract, catalog audit/serve, lint/format, and browser tests where runners exist.
- Keep dirty rendering; never add a permanent animation loop to conceal interaction defects.
- Add controlled error boundary/observability and decompose only where test coverage preserves behavior; `server.js`, `GamePage.tsx`, Board and CanvasBoard are currently large cross-cutting files.
- Run final full QA matrix plus device/accessibility evidence. Re-run targeted suites after any code change:
  ```sh
  npm run test:teams
  npm run test:catalog-compat
  npm run test:claim-lifecycle
  npm run test:chat
  npm run test:protocol
  ```

**Exit gate:** all experts/gates pass, or unresolved P0/P1 defects are explicitly release-blocking rather than hidden.

## Stage 7 — rollout and release

1. Ship Pointer/Chat fixes with physical device evidence first if Canvas rollout must wait.
2. Canary Canvas v2 for internal facilitated rooms; observe capture fallback/cancel/rejection, chat-open/send, team operations, reconnect and accessibility feedback without recording content.
3. Maintain v1 renderer for short-lived v1 room snapshots and room-scoped legacy catalog route for retired rooms.
4. Document exact build SHA, tests, devices, visual review, remaining risks, rollback actions and support contacts.
5. Commit/push only the active Arena branch and update/merge its PR only after the stated evidence is accurate.

## Definition of done

The affected release is done only when real iPhone Safari validates jigsaw recovery and participant Chat; Canvas v2 has usable/mobile/accessibility evidence; the catalog is visually/truthfully reviewed; preservation contracts remain green; and automated, browser, physical-device, catalog, security and release records state facts rather than inferred passes.
