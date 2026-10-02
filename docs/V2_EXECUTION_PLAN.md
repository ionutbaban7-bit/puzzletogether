# PuzzleTogether V2 — execution plan
Last updated: 2026-10-02
Status: Phase 0 IN PROGRESS
Base: main @ fa299124e5e9cd32e8f0c9ce5727c7487dbac6c0
Branch: v2/phase-0-security-foundation

## Product contract
One standalone realtime collaborative jigsaw for family, friends, colleagues and workshops. No accounts. Core loop: choose image → create room → invite with one secure link → play together → shared finish / replay in the same room. Workshop use is a light host choice, **not** another product or employee evaluation.

**Hard constraints:** no edits to production main without reviewed PR; no touching CoachingHub or CARTOGRAF repos; archive legacy work before removal; no confidential workshop sessions until Phase 0 gates are green.

## Critical path (deliverable / acceptance gate)

### P0-A: Authenticate participants and authorize host actions — RELEASE BLOCKER
**Observed defect:** public `GET /api/rooms/:id` currently exposes `hostId`; HTTP host endpoints accept this public ID as if it were secret, and WS `hello` can impersonate any known player ID.
- [ ] First commit tests proving public metadata, host export/reset/puzzle endpoints, WS impersonation, returning-join and guest permissions are safe. Tests MUST fail on vulnerable baseline and pass after fix.
- [ ] Mint cryptographically random, independent **per-participant session credentials** during create/join; IDs remain display identifiers, never credentials. Store only hashes/server-verifiable bindings and restore them securely with rooms.
- [ ] Require session proof for **every** returning join and WS `hello`; never allow known ID alone to authenticate; reject/expire incompatible legacy sessions safely.
- [ ] Authenticate all privileged HTTP operations from verified session identity and current role, never trusting a caller-supplied `pid`. Include export (HTML/JSON), puzzle changes, reset and takeover.
- [ ] Do not expose session secrets through room views, public API, player lists, shared links, logs, exports or error messages. Use room-scoped short-lived invite capability in the *one-click* link, separate from host/member credentials.
- [ ] Add origin/CSRF safeguards appropriate for same-origin HTTP/WS; rate-limit join/create attempts and sensitive operations; rotate/expire compromised credentials.
- [ ] Review all participant payloads for private notes and questionnaire data exposure.

**Done:** cross-user and forged-ID access denied; legitimate host and guest survive refresh/reconnect; all old protocol and new security tests green.

### P0-B: Hosting persistence + image upload protection
- [ ] Confirm live Render deployment branch, plan and **actual persistent volume**; simulate restart **and redeploy** during a live puzzle.
- [ ] Keep room state durable and recovered with secrets and images, or clearly limit sessions pending durable hosting.
- [ ] Close anonymous upload abuse: request quotas/rate limits, isolate ImageMagick limits/timeouts, verify bytes and pixel dimensions, clean orphan uploads, room-bound access and TTL. Until protected, hide upload option and reject requests in the focused V2 environment.
- [ ] Keep dependencies patched and review license/credit for every published image.

**Done:** documented live recovery and no unbounded anonymous file-processing path.

### P0-C: CI and safe delivery
- [ ] Add GitHub Actions: install, typecheck/build, source contracts, image-scaling, core protocol, security negative suite and browser smoke where supported.
- [ ] Protect `main`: require checks and reviewed PR; no force push, no automatic production deployment of draft branches.
- [ ] Record reproducible test logs and environment limitations; add rollback instructions.

**Done:** every PR carries repeatable evidence, failures block merge.

### P1-A: Strip product scope (after security)
- [ ] Tag/archive V1 and inventory its reusable pieces. Keep `Board`, jigsaw geometry, pointer lifecycle, image geometry, socket engine and needed tests.
- [ ] Remove non-jigsaw routes and entry points (CARTOGRAF, ranking, questionnaire, Letter/Sentence Canvas); archive source/catalogue rather than discard IP abruptly.
- [ ] Remove CoachingHub branding, navigation and cross-origin content from PuzzleTogether; publish standalone legal/privacy copy.
- [ ] Simplify landing to only **Create puzzle** / **Join game**.
- [ ] Reduce create flow to image, difficulty and name; simplify join to **one secure invite link and display name**; keep a short fallback room code for manual entry.
- [ ] Add 12-piece kid/quick mode; show 12, 25, 64, 100 upfront; hide 144/192 under “Advanced”.

**Done:** an unfamiliar user creates and shares a jigsaw without understanding coaching, workshop stages or technical room identifiers.

### P1-B: Mobile, inclusive play and happy-path polish
- [ ] Mobile piece pick/drop/edge pan at real phone scale and browser safe areas; fix overlap and black/cropped portrait pieces at all difficulties.
- [ ] Keyboard/switch alternative to dragging: select piece + choose target + confirm, with semantic status and screen-reader announcements.
- [ ] Keep only visible essentials (progress, people, Help, image reference); tuck controls, sorting and camera tools into coherent accessible Help.
- [ ] Default celebration is **team**; remove individual podium from public UX. Host can observe without moving pieces.
- [ ] Reconnect, resume, completion and replay/new image all preserve the same group.

**Done:** independent physical iPhone + Android + keyboard-only walkthroughs pass.

### P2: Catalog and measured pilots
- [ ] Launch with 10–15 genuinely distinct, accurately credited images; optimize thumbnail/full versions and archive non-public originals.
- [ ] Load test 2/5/10/20 mixed-network participants, specify measured practical limit instead of relying on the configured maximum.
- [ ] Pilot with one family (including child), friends and one work team/workshop; watch *unassisted* flow and collect concrete blockers.
- [ ] Only add an optional **single neutral debrief question** if pilots show actual value; avoid dashboards, psychological scoring, employee profiling or unrelated gamification.

## Release definition of done
- New user finds the game and creates a room without help.
- Invitee joins from one link with display name and no separate spoken code.
- Concurrent moves never duplicate/steal pieces; interrupted touch and reconnect safely recover.
- Public metadata cannot grant private host or participant access. Upload and data retention are bounded.
- A restarted/redeployed instance restores live rooms if advertised.
- Portrait/square/landscape and all supported difficulties work on physical devices.
- Non-jigsaw products do not appear in PuzzleTogether navigation or runtime.
- Full CI and three unassisted pilots have recorded results.

## Work handoff
Use this file as the **single execution backlog** and `docs/V2_SECURITY_TEST_PLAN.md` as the Phase 0 contract. In ChatGPT Work: operate on `ionutbaban7-bit/puzzletogether`, first inspect this branch and latest PR, run the full suite, finish P0-A before P0-B/C, then proceed by small reviewed PRs in the order above. Do not merge a failing security suite or claim real-device / live-deploy verification without evidence.
