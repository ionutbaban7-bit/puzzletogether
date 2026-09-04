# PuzzleTogether — remediation review and release status

**Review date:** 2026-09-04
**Status:** automated remediation is implemented and regression-tested. The affected release is **not physically iPhone-approved** yet; that P0 gate remains open.

## Executive decision

The reports were credible product blockers even though the original Stage 0–7 delivery was green. The implementation work completed in this branch addresses the known code paths, but a real iPhone Safari participant test remains the only valid close-out for the original report.

1. **Jigsaw input:** the three board-like activities now share a defensive Pointer Events lifecycle and prompt claim recovery. This is a code/test remediation, not a claim of physical-iPhone success.
2. **Participant chat:** chat transport was already participant-capable; the product defect was primarily mobile discoverability/sheet usability. Chat is now a labeled, always-visible mobile action with a keyboard-safe dialog.
3. **Canvas:** new Canvas rooms use a server-authoritative v2 composition model: meaningful lanes, team banks, colour-plus-marker identity, explicit ordering, semantic keyboard controls, and v1 snapshot preservation.
4. **Catalog:** Abstract Geometry and Isometric Worlds are deliberately retired rather than cosmetically renamed. Their active derivatives and picker/API records are gone; provenance and narrowly scoped legacy-room compatibility remain.
5. **Image loading:** missing catalog derivatives now return a prompt 404 rather than falling into a development Vite self-proxy timeout. The serving gate runs against an isolated server/data directory by default.

## What is now implemented

### P0 — resilient pointer and claim lifecycle

- `src/puzzle/usePointerLifecycle.ts` is used by `Board.tsx`, `CanvasBoard.tsx`, and `RankingActivity.tsx`.
- It records a pointer before capture, safely handles capture failure, and uses a window fallback only when capture is unavailable.
- Every active pointer terminates exactly once through `pointerup`, `pointercancel`, `lostpointercapture`, blur, visibility loss, page hide, resize/visual-viewport interruption, Escape, and unmount.
- A small touch/mouse movement threshold prevents a tap from becoming a server claim. A second touch cancels an active item before pinch begins.
- Cancellation sends an explicit release rather than a normal drop; the server does not snap or score a cancellation. Claim expiry is independently swept rather than waiting for the 30-second WebSocket heartbeat.
- Canvas drag state retains its pre-drag position/lane while live frames are sent. Cancellation, disconnect/expiry, and undo restore the intended pre-drag composition state instead of leaving stale lane metadata.
- `?ptPointerDebug=1` enables a bounded, client-only `window.__ptPointerTrace` for Web Inspector. It records only timestamp, board scope, event class, pointer type, capture/fallback result, terminal reason, duration, and gesture state. It intentionally contains no coordinates, IDs, names, room data, or message text.

### P0 — participant-visible Chat and mobile chrome

- `GamePage.tsx` has an always-visible labeled `Chat` trigger below the compact breakpoint, independent of host status; lower-priority actions are in a labeled `More` menu.
- `ChatSheet.tsx` is a dialog above activity-local surfaces, has focus management, Escape/close and focus restore, unread state, history/live-message behavior, and a visual-viewport-aware iOS keyboard layout.
- The server sends ordered room chat history in `init`, broadcasts live entries to all participants, persists the bounded history, and deduplicates sender retries using a client message ID.
- The game shell uses dynamic viewport sizing; the Canvas lower rack and action strip use the visual viewport rather than a one-time width/height decision.

### P1 — Canvas v2 and selectable colour teams

- New Canvas rooms are `version: 2`; restored v1 canvases keep their freeform renderer/coordinates and are not reshuffled.
- The facilitator can choose a shared group or 2–6 colour teams **for Canvas activities**. A team always has a written colour label and marker as well as hue.
- Membership, host assignment, start validation, team banks, lane permissions, tile ownership, snapshots/reconnect, and exports are server-authoritative. A participant cannot spend another team’s bank or edit another team’s tile.
- Letter Canvas uses a lower-board letter rack and three explicit word lanes. Sentence Canvas uses scenario-driven Idea / Reason / Next step lanes, a grouped word bank, custom words and soft suggestions.
- Tap-to-place, drag-to-lane, semantic lane outline selection, Place, earlier/later ordering, duplicate/delete/undo, keyboard shortcuts, and export all operate against the same authoritative lane order.
- Mobile tools are a compact horizontal strip above the lower rack; selected-tile actions wrap within the viewport rather than being hidden below the rack.

### P1 — catalog retirement, legacy safety, and image delivery

- Active catalog: **8 categories, 70 puzzles, 74 source records**. The 20 retired Abstract Geometry/Isometric Worlds records are retained only in `data/catalog/retired-stage5.json` and archival originals.
- Retired entries are absent from `shared/puzzles.json`, `/api/puzzles`, category pickers, public WebP full/thumb assets, and `server/public/images/manifest.json`.
- A pre-retirement persisted room restores only for its normal short lifetime. Its JPEG is available only through a room-scoped `/api/retired-images/:id?room=:roomId` compatibility route; the unscoped archive route returns 404. Selecting a reviewed activity clears legacy status.
- `DATA_DIR` supports isolated integration tests. `scripts/retired-catalog-compat-test.mjs` validates restoration, delisting, room-scoped archival serving, and migration back to an active puzzle.
- `/images` is a closed static route with `fallthrough: false`; the final error handler preserves static 404 status. `vite.config.ts` enables a proxy only when an explicit separate `VITE_BACKEND_URL` is supplied.
- `scripts/catalog-serve-test.mjs` starts/cleans an isolated server by default so its full difficulty matrix does not contaminate operational room snapshots.

## Evidence and current automated gates

Run the following from this branch after starting the normal development server only where a `BASE` is explicitly supplied:

| Gate | Current evidence |
| --- | --- |
| `npm run typecheck` | pass during this remediation |
| `npm run build` | pass during this remediation |
| `npm run test:protocol` | 176/176 pass across core, layout, reset, coaching, Canvas, team, retirement, claim, and Chat contracts |
| `npm run test:teams` | 18/18 pass, including Canvas cancellation, pre-drag undo restoration, and non-Canvas team mutation rejection |
| `npm run test:catalog-compat` | 6/6 pass, including scoped archival route |
| `npm run test:render-contract` | 7/7 pass |
| `npm run catalog:audit` | pass, 74 entries, 0 structural failures, 41 warnings |
| `npm run test:catalog-serve` | 319/319 pass; isolated default server |
| `npm run test:load` | pass: 20 clients / 800 piece frames / 400 cursors in 884 ms |
| Canvas browser suite | blocked locally: no Playwright browser binary; browser download failed with TLS `ECONNRESET` |
| Physical iPhone Safari | not run in this sandbox; mandatory release blocker for the reported iPhone issue |

The catalog audit is structural/provenance validation only. Its pass does not substitute for human visual review of Blueprint Architecture or the named Romanian city images.

## Remaining ranked backlog

| ID | Priority | Dependency | Required evidence before closure |
| --- | --- | --- | --- |
| R0-01 | **P0** | deployed build and physical hardware | Real iPhone Safari newest and oldest supported iOS: 100 jigsaw grab/move/drop cycles, interruption/reconnect/second-finger cases, no stuck claim/gesture; attach privacy-safe trace and recording. |
| R0-02 | **P0** | R0-01 mobile session | Non-host iPhone: find labeled Chat, read initial/live history, send with keyboard open, close/reopen and resume play. |
| R1-01 | P1 | Canvas v2 deployed | Facilitated desktop + phone usability session: people form/revise a word and an Idea→Reason→Next step response without explanation; verify rack/tool no overlap. |
| R1-02 | P1 | human visual review | Review Blueprint Architecture and named Romanian city visuals at thumbnail/25/64/144-piece scales. Retire or replace any generic/misnamed/repetitive record; do not relabel it. |
| R1-03 | P1 | device review | VoiceOver, keyboard-only, Dynamic Type/text zoom, contrast and reduced-motion review for Canvas, Chat, overlays, and teams. |
| R2-01 | P2 | product security decision | Rate/abuse controls, host/export bearer-capability model, WebSocket origin policy, production headers, restricted health metrics, upload lifecycle/resource limits. |
| R2-02 | P2 | none | CI lint/format gates, error boundary, deployment observability, domain decomposition of `server.js`/large components, device matrix automation. |

## Required physical-device runbook

Use a real iPhone Safari session and enable the diagnostic URL with `?ptPointerDebug=1`. In Web Inspector, export/screenshot the bounded `window.__ptPointerTrace`; do not add user names, chat content, room IDs, or screen recordings containing private data to public logs.

For each supported iOS version, record device model, OS/Safari version, date, build SHA, role, and pass/fail for:

1. 100 jigsaw drag cycles from scattered/tray pieces and multiple zoom levels.
2. Portrait/landscape; compact/expanded browser chrome; background/foreground; orientation change; lock/unlock; offline/reconnect; quick tap/long press; second-finger pinch during drag; contested claim from a second client.
3. Participant Chat initial history, live host/participant messages, unread badge, keyboard-open composer, close/reopen, and activity resume.
4. Letter and Sentence Canvas rack/lane placement, selected-tile controls, tools, team selection, and a typed custom word with the iOS keyboard open.

A failure stays P0. Do not relabel Chromium emulation, synthetic pointer events, Android testing, or source review as iPhone approval.

## Non-regression rules

- Preserve `POST /api/rooms/:id/reset` workshop reset semantics.
- Preserve jigsaw-only reset behavior: active timer, stage, players, and workshop state survive `POST /api/rooms/:id/puzzle-reset`.
- Preserve server-authoritative jigsaw layouts: no locked/held move and no `moved=true` from layout alone.
- Keep gameplay dark; marketing remains Coaching Partners azure/pink/purple/blue-gray/white.
- Keep copy concise/plain and correct in RO/EN. Do not make unsupported marketing claims.
- Catalog additions require licensed provenance, full manifest/original-source documentation, no watermark/logo/identifiable-person main subject, truthful naming, Romanian requirements, zero audit fatals, and human differentiation review.

## Handoff

`docs/next-session-implementation-prompt.md` is the execution prompt for the remaining device/release work. It reflects completed architecture so the next agent must validate and finish rather than reimplement or accidentally regress it.
