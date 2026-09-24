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

## CARTOGRAF — emotions zone, implemented 2026-09-13

Full execution of `docs/emotions/01–03` (phases 0–8): solo `/emotii` experience
plus the team "Camera Mare" activity reusing the room infrastructure.

- [x] Content: 24 emotions + 11 blends (8 Plutchik territories × 3 levels,
  research-anchored with explicit limits), 64 solo + 32 room situations,
  8 inner-voice archetypes. Audit gate: `npm run emotions:audit` green.
- [x] Solo zone (`src/emotions/`): emotion wheel (SVG, 24 segments + hub
  compass), Emotion Book detail (12 sections per emotion, "map, not
  territory" footer), 7 tabs — Harta, Meteo (daily check-in), Expediții
  (situation naming + debrief), Frontiera (prediction tracker, inhibitory
  learning framing), Muzeul (anonymous lines), Locuitorii (archetypes),
  Atlasul (local summary + honest "what it can/cannot do" + JSON export +
  reset). All data local-only (localStorage).
- [x] Team Camera Mare (`src/puzzle/EmotionsActivity.tsx` + server
  `emotions*` protocol): private votes (1–3 emotions + intensity 0–10 +
  optional archetype, or anonymous Pass), 4 round kinds (weather-start,
  situation, museum, weather-end), anonymous aggregate reveal
  ("Aceeași situație. N ceruri diferite."), host facilitator controls,
  host safety word → participant trigger → board lock + calm pause overlay
  (112 + ARPS resources), export JSON/HTML includes rounds, reset clears.
- [x] Wiring: `/emotii` route, landing CARTOGRAF section, CreateRoom
  category + activity card, GamePage mode branch, FacilitatorPanel
  compatibility, RO/EN throughout.
- [x] QA (this sandbox, no Chromium available — jsdom + real-protocol harness):
  - `npm run typecheck` and `npm run build` pass.
  - `node scripts/camera-mare-smoke.mjs` — **44/44** live-server protocol
    checks: create/join, lobby gates, round kinds, dedupe/clamp/truncate,
    private confirm, anonymous aggregate (counts/passed/intensity/archetypes),
    history preserved across rounds, reveal-once, museum lines, safety word
    (case-insensitive, board lock, safetyPause), exports, reset.
  - `node scripts/ui-smoke.mjs` — **50/50** jsdom render checks: all 7 solo
    tabs + interactions (meteo log, frontier prediction + resolution, museum
    line, atlas), wheel 24 segments, Emotion Book + blend detail, room
    participant/host flows (vote → reveal → safety overlay), landing section,
    CreateRoom catalog card.
- [x] Bugs found and fixed during QA: round start wiping session history,
  votedCount excluding Pass answers, VotePanel local state persisting across
    rounds (per-round key), blend cards mapping blend-of ids through the wrong
    table, family legend `rings` type misuse, missing `.chip` styles.

## Google-style light redesign — 2026-09-13 (same-day follow-up)

User directive: whole app look "super clear, elegant, simplu", inspired by
learning.google/work/; main page presents the 3 categories (Clarity Express,
Emoții, Puzzle) clean; footer signature "by Ionut Baban" removed *for now*.

- [x] New `g` palette in `tailwind.config.js` (Google blues/greens/reds +
  `g-ink #202124`, `g-sub #5f6368`, `g-line #dadce0`, `g-soft #f8f9fa`).
- [x] `src/index.css`: `.marketing-page`/`.landing-page` → white canvas;
  `.setup-page` → soft gray `#f8f9fa` with light card/input overrides; dark
  setup overrides + `.footer-signature`/`.signature-script` removed; focus
  ring → Google blue; `.chip` → light pill.
- [x] `LandingPage` rewritten: centered hero (Jucați. Vorbiți. Alegeți.),
  3 equal category cards — 🧩 Puzzle → /create, 🗺️ Emoții/CARTOGRAF →
  /emotii, 💬 Clarity Express → external hub — then 3-step flow, privacy/use
  cards, minimal footer (© 2026 PuzzleTogether · Privacy · Terms — no
  signature, no LinkedIn).
- [x] CARTOGRAF zone light conversion: `Wheel.tsx` (white/`#f8f9fa` field,
  white segment gaps, ink hub + labels, blue selection), `Compass.tsx`
  (white plot, Google-colored quadrants), `EmotionsPage` + all 7 tabs +
  Emotion Book drawer + CalmScreen (white cards, `g-line` borders, one blue
  accent; green/yellow/red status colors from the `g` palette).
- [x] Create/Join room pages: light (removed dark `Logo`/`LangToggle`/
  `btn-dark` variants + marketing orbs).
- [x] Deliberate exception: the live in-room game stage stays deep navy —
  it is the "projector" surface where the white board and colored pieces
  read best (white app chrome, dark stage, like a video player).
- [x] RO wording pass: "Burla lumii tale" → "Busola lumii tale"
  (EmotionsPage + Compass caption), "Burla valență × intensitate" → "Busola…",
  InhabitantsTab "vorbesc în toată lumea" → "vorbesc în fiecare dintre noi",
  MeteoTab "o hărta meteo" → "o hartă meteo", taxonomy JSON: "durere
  anumbită" → "durere difuză, fără cauză clară", "un prăbușire" → "o
  prăbușire" (×2), "o „cețură"…alarmă de alarmă" → "o „ceată" interioară…
  alarmă puternică".
- [x] QA: `tsc --noEmit` clean; `npm run build` clean; `camera-mare-smoke`
  44/44; `ui-smoke` ALL PASSED (Section D updated to the new landing: hero,
  3 category cards, CARTOGRAF CTA, and an explicit "signature removed"
  assertion).

## Premium landing redesign — 2026-09-13 (v2, same-day)

User directive: make the main page a premium, memorable, interactive
experience (Google/Microsoft *principles*, not their interfaces) — "wow →
clarity → curiosity → click", editorial illustration identity, subtle
micro-interactions, mobile-first, no functional changes.

- [x] 4 original editorial illustrations (AI-generated, consistent identity:
  sophisticated lightly-caricatured figures, blue→indigo→violet, off-white):
  `server/public/images/landing/{hero,puzzle,emotions,clarity}.png` — hero
  (4 people + 3D puzzle + speech bubbles + idea bulb + connection nodes),
  Puzzle (team building a giant glowing puzzle, high-five), Emoții (calm
  figure inside a violet inner-map orbit), Clarity Express (futuristic metro
  with people conversing, speech bubbles, motion).
- [x] `LandingPage` v2: sticky translucent header; two-column hero with
  headline "Conectează oamenii. Pornește conversația. Descoperă ce se
  întâmplă între voi." (gradient third line), curiosity CTAs ("Începe o
  experiență →" gradient primary / "Explorează zonele" outline) + microcopy;
  3 premium zone cards ("Alege cum vrei să înceapă conversația.") with
  illustrations occupying the top 35–40%, tagline/description/CTA
  ("Pornește jocul", "Explorează harta", "Descoperă întrebarea");
  "Începe cu joaca. Ajungi la conversație." section with PLAY → CONNECT →
  REFLECT → ACT flow tiles (custom SVG glyphs); "De la primul click la un
  insight real." 3-step cards (01 Intră / 02 Explorează / 03 Capturează);
  human trust section "Creat pentru oameni. Gândit cu grijă."; minimalist
  footer (logo + "Play. Connect. Reflect. Act." + links + © 2026).
- [x] Micro-interactions (all subtle, reduced-motion safe): IntersectionObserver
  scroll reveals (`Reveal` component with jsdom guard), card hover lift −5px +
  shadow + per-zone gradient glow (`--pt-glow`), illustration scale 1.035,
  slow-panning gradient text (9s), floating accent dots + hero info chips
  (7–9s), gradient-primary button with position shift, smooth anchor scroll.
- [x] Typography: landing-scoped Inter/Manrope/Geist preference with system
  fallback (keeps the no-webfont CSP-safe approach); headings 600–800 with
  negative tracking; body ≤ ~70ch, dark gray not pure black.
- [x] QA: `tsc` clean; build clean (73 kB CSS); ui-smoke Section D rewritten
  (12 assertions: hero/CTAs/microcopy/zones/curiosity CTAs/4 illustrations/
  flow/steps/trust/footer tagline/signature removed/no dark tokens) — ALL
  PASSED; `camera-mare-smoke` 44/44; all 4 images 200 on :4173.

## Consulting audit + Waves 1–3 — 2026-09-13 (same-day, user-approved)

10-consultant critique (identity, product, interaction, a11y, motion,
mobile, data-viz, performance) produced a P0–P2 findings list; the user
approved ALL three waves.

- [x] Wave 1 — unified design system:
  - `brand` scale remapped from azure/cyan onto the blue identity
    (#1a73e8 primary, #8ab4f8 dark-stage accent) — the whole in-room stage,
    lobby, focus rings and Create/Join upgrade with zero class churn;
    `cp.purple` aligned to violet #8b5cf6 with the full scale (200/400/600
    were referenced but undefined — now generated); `cp.azure` follows brand.
  - Typography unified: Manrope (display) + Inter (body) with system
    fallback across the app (Poppins retired); CSP-safe (no webfonts).
  - Logo: mark gradient → #1a73e8→#7c3aed; wordmark "Together" →
    signature gradient (`.pt-wordmark`).
  - a11y contrast: `g.faint` #9aa0a6 (2.5:1, WCAG fail) → #70757a (4.6:1).
  - Landing images: 4 PNGs (5.6 MB) → WebP q82 (200 KB, −96%); hero gets
    width/height + `fetchPriority="high"`; new stats chips row under hero
    (Echipe 2–20 · 15–45 min · RO/EN · din browser).
- [x] Wave 2 — major interaction changes:
  - **Triple door** in CreateRoom ("Unde începem?"): 3 starter cards
    mirroring the landing zones (Puzzle → featured catalog puzzle, Emoții →
    Camera Mare, Clarity Express → external hub), preselect + jump straight
    to the lobby step; pending-starter race handled for async catalog;
    full catalog kept below a "sau alege din catalog" divider.
  - **CARTOGRAF first-run** (`src/emotions/FirstRun.tsx`): 3-step dismissible
    coach (wheel → emotion book → weather invite), once via localStorage,
    non-blocking (pointer-events only on the card), auto-advances when the
    user opens the book, CTA switches tab to Meteo.
  - Lobby copy per role (host: "Pornește sesiunea…" / participant:
    "Facilitatorul pornește…").
  - Puzzle reset: `window.confirm` anti-pattern → styled confirm modal.
- [x] Wave 3 — product depth:
  - **Session postcard** in HarvestBoard: white gradient-identity card at
    the end of every session (name, activity, date, people, rounds,
    "Play. Connect. Reflect. Act.") with copy-to-clipboard summary — the
    keepable moment.
  - Route-level code-split (`App.tsx` lazy): initial bundle 580 kB →
    175 kB (landing eager; CreateRoom/JoinRoom/RoomRoute/EmotionsPage
    on-demand chunks).
  - Tabs affordance: scroll-snap + right-edge mask fade on the 7-tab bar.
- [x] QA: `tsc` clean; build clean (4 lazy chunks); ui-smoke ALL PASSED
  (new: triple-door + catalog-divider assertions in Section E);
  `camera-mare-smoke` 44/44; `emotions:audit` OK; all WebP 200 on :4173.
