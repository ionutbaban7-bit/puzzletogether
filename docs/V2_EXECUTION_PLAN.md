# PuzzleTogether V2 — execution plan
Updated: 2026-10-03
Branch: `v2/phase-0-security-foundation` · PR #10
Status: P0/P1 implementation verified locally; operational release checks remain open.

## Product contract
One collaborative jigsaw. Choose → invite → play → complete → replay with the same group. No accounts, employee assessments or separate coaching products.

## P0 — implementation
- [x] Independent 256-bit player credentials; snapshots store only player credential hashes.
- [x] Credential-backed returning join, WS authentication and host HTTP/socket controls.
- [x] Public metadata omits host ID, access code, invite token and player names.
- [x] Room-scoped invitation capability in the URL fragment, separate from player credentials; 24-hour expiry and host renewal.
- [x] Cross-origin HTTP/WS rejection, no-store API responses and no-referrer policy.
- [x] Kick revokes membership and rotates invitation/code. Session rotation invalidates the old credential.
- [x] Replaced sockets cannot continue acting; repeated hello is rejected; replaced browser tab receives a terminal message instead of reconnecting indefinitely.
- [x] Connected guest takeover is denied while host is present; former host loses privileges after legitimate takeover.
- [x] Request/message limits, bounded buckets and unauthenticated WS timeout.
- [x] Personal photos restored: real JPG/PNG/WebP validation, two bounded async processors, orientation correction, metadata stripping, single-use attachment proof and private read capability. Anonymous room metadata never reveals photo URLs.
- [x] Fixed one-hour photo deadline; actual image/metadata deletion without traffic, after restart, on another image and room closure. Expiry preserves the group on a library puzzle.
- [x] Actual process restart restores a placed piece, invitation and authenticated host/guest access on the same disk.
- [x] CI covers build, renderer, image geometry, security, protocol, restart and desktop/mobile browser flow.
- [x] CI triggers once for a V2 PR update; concurrency cancels superseded runs.

## P1 — implementation
- [x] V1 preserved on `archive/v1-before-focused-jigsaw` before removing legacy UI.
- [x] Remove non-jigsaw UI/routes and CoachingHub navigation. Server creation/protocol gates deny archived activity requests.
- [x] Home has Create / Join; short copy and details only where needed.
- [x] Creation uses image, piece count, name and optional observer role.
- [x] 12/25/64/100 visible; 144/192 under advanced options.
- [x] One invitation link plus name; manual code fallback; stale/expired invitation explains how to rejoin.
- [x] Board uses its actual container size; resize observer refits when side panels open/close.
- [x] Essential progress, people/invite, help and reference; sorting/layout controls appear in Help.
- [x] Keyboard/tap piece selection, row/column destination, explicit placement and live server feedback. Native form keys do not pan the board.
- [x] Shared completion and replay/new image preserve the room and group; no individual podium.
- [x] Authenticated refresh resumes progress; leaving the route disconnects its socket.
- [x] Safe-area spacing, narrow/landscape layout checks and reduced-motion styling.

## Recorded local evidence
- Build/typecheck passed.
- Security baseline: 15/15; additional V2 security: 13/13; real-upload privacy and lifecycle checks passed.
- Core protocol: 25/25; layout: 10/10; reset: 6/6; claim lifecycle: 8/8.
- Restart test: placed piece, invite and credentials survive stopping/restarting a real child process.
- Photo tests: actual JPG/PNG/WebP derivatives; EXIF orientation corrected and stripped; owner-only single-use attachment; private image URL omitted from anonymous metadata; timer deletion without traffic; fixed 1h cutoff using an isolated test clock; restart before/after expiry; earlier removal on image change and closure. Slow processor test confirms HTTP remains responsive and originals/cache files are removed.
- Image geometry: 4,392 clipped sprites, including 12-piece portrait/landscape grids.
- Renderer contracts: 7/7. Catalog audit passed structurally; this is not a fresh legal review of sources.
- Chromium 134 browser tests: catalog and personal-photo creation, separate guest via invite, portrait/landscape 12-piece games, keyboard/phone placement, refresh, full completion, another personal photo with the same group and playable replay passed. Replay now clears the completion lock while preserving a deliberate mid-game pause. Photo deadline is unchanged by replay/refresh. Widths 320/390 and landscape 844 checked; no browser errors.

## Release checks still requiring environment/human evidence
- [ ] Latest remote GitHub Actions run passes on the pushed commit. Do not substitute an old run for current evidence.
- [ ] Configure `main` branch rules to require the CI check and review; prevent force pushes.
- [ ] Verify real Render persistent storage and a redeploy during a live game. Local same-disk restart does not establish hosting durability.
- [ ] Physical iPhone and Android walkthrough, browser coverage and assistive-technology review. The puzzle remains a visual activity; semantic controls alone are not a WCAG conformance claim.
- [ ] Pilot with a family, friends and a team; measure practical player limits (20 is configured, not load-certified).

## P2 / deferred
- Curate the 36-image catalog to 10–15 preferred launch images and optimize assets.
- Physical photo-picker/orientation checks on iPhone and Android remain part of release QA.
- Remove unreachable legacy server helpers/types after retained protocol gates stabilize; the legacy product is already disabled.
- Review commercial-use terms and image licensing with the owner; do not silently replace the existing license.

No merge or production deployment is included in this implementation push.
