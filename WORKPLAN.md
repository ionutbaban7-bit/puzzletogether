# PuzzleTogether — seven-stage delivery workplan

**Session date:** 2026-09-03
**Status legend:** [ ] todo · [~] in progress · [x] complete · [-] deferred with a reason

This supersedes the earlier exploratory plan. It records the agreed delivery
sequence and the release evidence for the active branch.

## Stage 0 — Reachable room overlays
- [x] Made every room-overlay card height-aware and vertically scrollable on
  short/mobile viewports; primary actions remain reachable.
- [x] Added the focused Playwright viewport gate for create → lobby → Start.
- [x] Validated all **16/16** combinations: jigsaw, Letter Canvas, Sentence
  Canvas, and Team Coaching at four viewport sizes.

## Stage 1 — Jigsaw rendering budget
- [x] Baked ordinary free-piece shadows into reusable cached sprites. A live
  lift shadow is drawn only for the actively grabbed piece.
- [x] Kept dirty, request-animation-frame-on-change rendering and bounded the
  placement-glow/cursor animation loops.
- [x] Made the dot grid scale its spacing at low zoom and skip safely when the
  threshold is not reached.
- [x] Added the source-level renderer contract gate (`npm run
  test:render-contract`, **7/7** on the final pass) alongside the browser FPS
  harness for 144- and 192-piece boards.

## Stage 2 — Server-authoritative jigsaw layouts
- [x] Made scattered, unplaced pieces the default server layout.
- [x] Added the authorized `layout` WebSocket operation for scattered/tray
  layouts: only eligible non-spectator players during unlocked jigsaw play can
  invoke it; locked and held pieces are preserved and a layout operation never
  sets `moved=true`.
- [x] Added Romanian/English Mix and Help controls, a tray panel only in tray
  mode, and bounds-aware fit/bring-unplaced behavior.
- [x] Covered layout, rejection, reconnect, lock, held-piece, and moved-state
  cases in the protocol suite (**10/10** layout checks).

## Stage 3 — In-play puzzle reset
- [x] Added host-only `POST /api/rooms/:id/puzzle-reset` for jigsaw play.
- [x] Reset preserves room stage, timer, players, and workshop state; the
  existing workshop `POST /api/rooms/:id/reset` behavior is unchanged.
- [x] Added a confirmed facilitator HUD action and two-client/non-host/coaching
  regression coverage (**7/7** reset checks; coaching **17/17**).

## Stage 4 — Coaching Partners marketing refresh
- [x] Applied Coaching Partners azure, pink, purple, blue-gray, and white to
  marketing surfaces while retaining a near-black gameplay surface.
- [x] Added “by Coaching Partners” below the landing wordmark and in the
  footer; kept Romanian and English copy short and plain.
- [x] Retained a concise, honest Letter Canvas roadmap line and made no
  unrequested changes to canvas or coaching mechanics.
- [x] Captured reproducible desktop/mobile landing, create, and jigsaw-play
  screenshots under `docs/screenshots/`.

## Stage 5 — Licensed catalog expansion
- [x] Added **55 reviewed CC0 originals**: five each in paintings, landscapes,
  landmarks, nature, and cities; ten each in isometric worlds, abstract
  geometry, and blueprint architecture. The Romanian subjects include
  Bucharest, Brașov, Cluj, Sibiu, Timișoara, Sighișoara, Bran, Corvin, Apuseni,
  the Carpathians, and the Danube Delta.
- [x] Archived source originals and provenance in `data/catalog/originals/`,
  produced optimized full/thumbnail WebP assets, and refreshed the manifest
  and puzzle records. The final catalog has **94 records / 90 puzzle-linked
  records**.
- [x] Delisted the two fatal legacy assets (`new-york`, `plitvice-lakes`) and
  eight other legacy orphan assets; `data/catalog/incoming/` was finalized
  empty.
- [x] Added glyphs for the three new categories and generated source/audit
  documentation. The final audit has **0 structural failures**; its 43
  nonfatal advisory warnings are documented in `docs/catalog-audit.json`.
- [x] Verified production serving with **457/457** catalog/API/image/difficulty
  matrix checks, including non-empty GET payloads and API thumbnail mappings.
- [x] Corrected the idempotent pipeline matching and catalog-card data path:
  all 90 API puzzle records now expose `thumbnail`, both pickers load the
  480×360 derivative first, and retry the full board image exactly once only
  if a thumbnail fails.

## Stage 6 — Ten-expert QA gate
- [x] Wrote `docs/qa-report.md` with ten independently scoped PASS decisions,
  commands/evidence, browser-runtime note, and remaining non-product
  environment limitation.
- [x] Final local evidence: TypeScript and production build pass; protocol
  suites pass (**132/132** total); catalog audit passes structurally; catalog
  serving passes **457/457**; twenty-client load test passes.
- [x] Updated all maintained Chromium scripts to consume the shared optional
  runtime helper and use current bilingual branding selectors.

## Stage 7 — Release and handoff
- [x] Inspected the final diff and created logical delivery commits:
  `64ed0c5` (licensed catalog finalization), `544b45a` (QA gate), and
  `398abeb` (catalog preview loading repair).
- [x] Pushed `arena/01a06746-puzzletogether` to GitHub and confirmed the draft
  pull request remains available for review.
- [x] Published the final handoff through this workplan and `docs/qa-report.md`:
  change summary, test results, source/license reference, and the explicitly
  scoped browser-runtime environment limitation.

## Deferred items
- [-] **Current-sandbox rerun of Playwright browser suites:** the sandbox has
  no compatible Chromium/Chrome/Firefox/WebKit executable, and package/CDN and
  Debian mirror retrieval were unavailable. This is an execution-environment
  constraint, not a product defect or an omitted browser test: the completed
  16/16 viewport gate and Stage 4 screenshots are retained as release evidence,
  and every browser script now accepts
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` plus optional
  `PLAYWRIGHT_CHROMIUM_ARGS` for a supplied compatible runtime.

## Post-release product remediation — opened 2026-09-04

The seven stages above remain historical delivery evidence, but a real-device
product review has reopened release gates that were outside their original
scope. The full evidence and ordered implementation brief are in:

- [`docs/product-remediation-review-2026-09-04.md`](docs/product-remediation-review-2026-09-04.md)
- [`docs/next-session-implementation-prompt.md`](docs/next-session-implementation-prompt.md)

- [x] Safely reconciled the local checkout with the already-pushed remote
  `d35f7bb` without overwriting the previously delivered worktree.
- [x] Re-ran executable baseline checks: TypeScript/build, protocol **132/132**,
  catalog serving **457/457**, load, renderer contract **7/7**, and a two-client
  chat transport/reconnect probe.
- [~] **P0 — physical iPhone Safari jigsaw input reliability:** user-reported
  intermittent drag failure remains open. Pointer capture/cancellation/claim
  lifecycle needs shared remediation and real-device evidence; mobile emulation
  is not a closure gate.
- [~] **P0 — participant-visible mobile Chat:** server transport/reconnect is
  confirmed for all players, but the iPhone control/discoverability/keyboard
  flow remains open until a participant physical-device test passes.
- [~] **P1 — Canvas v2 + server-authoritative colour teams:** current
  centre-spawn trays do not meet the word/sentence collaboration brief.
- [~] **P1 — catalog quality remediation:** delist/review the repeated Abstract
  Geometry and Isometric Worlds artwork; Blueprint Architecture and named city
  illustrations need the related visual/truthfulness review.
- [~] **P1/P2 — accessibility, mobile shell, security, resilience, CI, and
  observability:** prioritised in the remediation review rather than implied
  complete by the original structural catalog and protocol passes.
