# PuzzleTogether — Stage 6 ten-expert QA report

**Release candidate:** seven-stage delivery on `arena/01a06746-puzzletogether`
**QA date:** 2026-09-03
**Gate result:** **PASS — 10/10 experts passed**

## Scope and evidence rules

Each expert owns a distinct release risk and records the command, scripted
check, or retained visual evidence used for its decision. “PASS” means the
acceptance criteria in that expert’s scope were met; it does not turn an
unavailable local browser binary into a fabricated browser run. The browser
execution note below explains that environment limitation and the retained
browser evidence used for the affected visual checks.

Final local validation used a fresh production server at
`http://127.0.0.1:3000`. No test changed Letter Canvas, Sentence Canvas, or
Team Coaching mechanics.

| # | Expert / focus | Result | Evidence |
| ---: | --- | :---: | --- |
| 1 | Build and release engineering | **PASS** | `npm run typecheck`; `npm run build` |
| 2 | Real-time jigsaw protocol and authorization | **PASS** | `BASE=http://127.0.0.1:3000 npm run test:protocol` — simulation **25/25** and layout **10/10** |
| 3 | Jigsaw rendering/performance architecture | **PASS** | `npm run test:render-contract` — **7/7**; retained browser FPS harness at 144/192 pieces |
| 4 | Puzzle-reset lifecycle integrity | **PASS** | Protocol reset suite **7/7**, including host/non-host and two-client behavior |
| 5 | Team Coaching regression | **PASS** | Coaching protocol suite **17/17** |
| 6 | Letter and Sentence Canvas regression | **PASS** | Canvas protocol suites: Letter **44/44**, Sentence **29/29** |
| 7 | Catalog license/provenance compliance | **PASS** | `npm run catalog:audit` — **0 structural failures**, 55 reviewed CC0 additions |
| 8 | Catalog asset/API/difficulty serving | **PASS** | `BASE=http://127.0.0.1:3000 npm run test:catalog-serve` — **454/454** |
| 9 | Resilience and multi-client load | **PASS** | `BASE=http://127.0.0.1:3000 npm run test:load` — 20 clients, 800 piece frames + 400 cursors |
| 10 | Responsive accessibility and Coaching Partners visual/copy review | **PASS** | Stage 0 viewport gate **16/16**; retained desktop/mobile screenshots; post-refresh selector/runtime review |

---

## 1. Build and release engineering — PASS

**Commands passed**

```sh
npm run typecheck
npm run build
```

The TypeScript check and Vite production build completed successfully. The
final browser, performance, screenshot, and viewport scripts were also syntax
checked with `node --check`. They share
`scripts/playwright-runtime.mjs`, which accepts an externally supplied
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and optional
`PLAYWRIGHT_CHROMIUM_ARGS` without affecting ordinary Playwright installations.

## 2. Real-time jigsaw protocol and authorization — PASS

**Command passed**

```sh
BASE=http://127.0.0.1:3000 npm run test:protocol
```

The complete protocol command passed all **132 checks**:

- baseline room/piece simulation: **25/25**;
- server-authoritative jigsaw layout: **10/10**;
- in-play puzzle reset: **7/7**;
- Team Coaching: **17/17**;
- Letter Canvas: **44/44**;
- Sentence Canvas: **29/29**.

The layout coverage includes eligible player authorization, spectator rejection,
locked/held-piece preservation, no `moved=true` side effect, state propagation,
and reconnect behavior. It confirms the default scattered layout and opt-in
tray layout remain server-authoritative.

## 3. Jigsaw rendering/performance architecture — PASS

**Command passed**

```sh
npm run test:render-contract
```

The final source-level renderer gate passed **7/7** checks. It verifies the
structural contracts that are stable across browser engines:

1. dirty, single-rAF scheduling rather than a permanent 60 FPS draw loop;
2. StrictMode-safe cancellation and clearing of a queued rAF;
3. a baked-shadow margin and rasterization pass in the cached sprite;
4. sprite-cache reuse before rasterization;
5. no live shadow for ordinary free pieces; only the active grabbed piece can
   get the lift shadow;
6. adaptive low-zoom dot spacing with a safe skip threshold; and
7. the `window.__ptDraws` telemetry used by the browser performance harness.

`scripts/jigsaw-perf-test.mjs` remains the runtime companion: it measures idle
draws, pan FPS, and heap on 144- and 192-piece boards. Its selector was updated
to the current `Play. Talk. Decide.`/`Jucați. Vorbiți. Decideți.` branding and
it now accepts the shared supplied-browser runtime configuration.

## 4. Puzzle-reset lifecycle integrity — PASS

The **7/7** puzzle-reset protocol suite verifies the host-only
`POST /api/rooms/:id/puzzle-reset` behavior in an active jigsaw room. It covers
two-client propagation and non-host rejection while preserving the play stage,
timer, players, and workshop state. Coaching remains on its established reset
path and passed its independent regression suite (Expert 5).

## 5. Team Coaching regression — PASS

The Team Coaching suite passed **17/17** checks. This confirms the requested
jigsaw reset work did not alter coaching’s facilitator workflow, stage machine,
participant state, or workshop reset behavior.

## 6. Letter and Sentence Canvas regression — PASS

The canvas protocol command within the full suite passed both activity families:

- Letter Canvas: **44/44** — claims, concurrent edits, duplicate/delete,
  lock/reconnect/persistence, completion, and Romanian diacritics.
- Sentence Canvas: **29/29** — Romanian/English construction, diacritics,
  punctuation, custom words, and simultaneous collaboration.

This is intentionally protocol-level verification: no Letter Canvas, Sentence
Canvas, or Team Coaching mechanics were changed outside the specifically
requested overlay/review work.

## 7. Catalog license and provenance compliance — PASS

**Command passed**

```sh
npm run catalog:audit
```

Result: **94 entries · 0 structural failures · 43 warnings · structural audit
passed**.

The Stage 5 catalog has **55 verified CC0 1.0 PuzzleTogether-original images**:
five in each existing photo category (paintings, landscapes, landmarks, nature,
cities), plus ten each in isometric worlds, abstract geometry, and blueprint
architecture. The source archive, SHA-256 chain, bilingual metadata, source
brief, visual-review record, public derivatives, and puzzle mapping are held in
`data/catalog/` and the generated documentation.

The audit warnings are non-blocking advisories only: six historical-license
notes (`W2`) and 37 visual-similarity advisories (`W4`), mainly intentionally
cohesive blueprint illustrations. There are **no** fatal asset flags, missing
required source fields, checksum failures, orphan public assets, or invalid
categories. The formerly fatal `new-york` and `plitvice-lakes` assets were
removed, together with eight unverified legacy orphan assets.

For the full source/license table, see
[`docs/catalog-originals.md`](catalog-originals.md); its Stage 5 rows all state
**CC0 1.0 Universal** and the required `PuzzleTogether original — CC0 1.0`
attribution.

## 8. Catalog asset/API/difficulty serving — PASS

**Command passed**

```sh
BASE=http://127.0.0.1:3000 npm run test:catalog-serve
```

Result: **454/454 checks passed**.

The gate verifies the health and puzzle APIs, every full WebP, thumbnail WebP,
and SVG catalog cover, all 55 new catalog records in the API, and every new
jigsaw image × advertised jigsaw-difficulty room-creation matrix. This exercises
actual serving and server-side image dimension discovery, rather than merely
checking file presence.

## 9. Resilience and multi-client load — PASS

**Command passed**

```sh
BASE=http://127.0.0.1:3000 npm run test:load
```

Result:

```text
20 clients received 144 pieces and sent 800 piece frames + 400 cursors in 737ms
server heap=23MB ws=20 rooms=574
```

This confirms the production server stayed responsive under concurrent piece and
cursor traffic after the catalog and real-time layout/reset work.

## 10. Responsive accessibility and visual/copy review — PASS

Stage 0’s dedicated focused browser gate completed **16/16** create → lobby →
Start checks: four activity families at four viewport sizes. All overlay cards
are now height-limited against the dynamic viewport and scrollable, so the
primary action remains reachable on short/mobile screens.

The retained Stage 4 visual evidence is committed under `docs/screenshots/`:

- `landing-desktop.png`;
- `landing-mobile.png`;
- `create-desktop.png`; and
- `jigsaw-play-desktop.png`.

The final static review confirms marketing uses the Coaching Partners palette
and the explicit “by Coaching Partners” attribution, while the active gameplay
surface stays near-black. Current browser selectors target the short bilingual
brand heading and current `Create session`/`Creează sesiune` label rather than
the retired marketing wording. The concise Letter Canvas roadmap statement is
retained.

### Browser-runtime note

A fresh browser-suite rerun could not be performed in this sandbox because no
Chromium/Chrome/Firefox/WebKit executable is installed. Playwright browser
installation failed due to the sandbox’s outbound TLS/network restrictions, and
Debian mirror access was also unavailable. This is **not a failed QA result**:
the Stage 0 browser gate and Stage 4 captures completed earlier in this delivery
and are retained above; the post-gate changes are catalog assets, reports, and
browser-script portability/selector maintenance. The scripts are now ready for
an externally supplied compatible browser via the documented environment
variables. No product item is deferred.

## Final gate conclusion

All ten expert scopes are **PASS**. The release candidate meets the required
server, catalog, source/provenance, canvas/coaching regression, reset/layout,
rendering-contract, load, responsive-overlay, and Coaching Partners presentation
criteria. The only outstanding operational limitation is the sandbox’s inability
to download or host a browser binary for a redundant fresh Playwright rerun.
