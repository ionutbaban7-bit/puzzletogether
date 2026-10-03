# V2 P0/P1 review notes

This branch changes PuzzleTogether from a workshop activity collection into a focused collaborative jigsaw. Legacy UI is preserved on `archive/v1-before-focused-jigsaw` and removed from the active client. Archived activity creation and messages are rejected by the server.

The client now offers one-link admission, short create/join flows, 12-piece games, team completion and replay. Keyboard/tap controls are an alternative to dragging. The existing jigsaw renderer, geometry and authoritative piece claims are retained.

Core gamification now supports 25 players plus a separate observing facilitator, shared progress/time and direct pause/resume controls. The host can opt into a final podium before play. Only newly locked pieces earn points; ties share a place, observers are excluded and offline contributions remain. Replay starts a new clock and scores in the same room. [Research and rules](GAMIFICATION_DECISIONS.md) explain the choices.

The active catalog now has 48 images, with a 24-image familiar-icons collection and category filters. Twelve new public-domain/CC0 images include Sunflowers, The Creation of Adam, The Thinker, Earthrise and the Wright brothers' first flight. Sources and rights evidence are documented, portrait/panoramic thumbnails preserve selected compositions, and picture names follow the RO/EN setting. [Catalog details](PUBLIC_DOMAIN_ANCHORS.md).

Security uses separate player credentials and admission capabilities. Kick/session rotation invalidate compromised access; websocket replacement cannot leave a stale connection authorized. API caching and cross-origin requests are constrained. Personal photos use one-use attachment credentials and separate private image capabilities; anonymous room metadata omits their URLs. Photos expire exactly one hour after upload, including after restart, and are removed sooner on another image or room closure. Expiry returns the same group to the lobby with a library image.

## Before production

1. Require `V2 baseline checks / build-security-and-core` on reviewed PRs to `main`; disable force pushes. Connector access in this session does not include ruleset administration.
2. Confirm the actual Render service branch and auto-deploy setting. This branch must not auto-deploy to the production service.
3. Mount persistent storage and set `DATA_DIR` to its writable directory. One instance only. Set `PUBLIC_ORIGIN` to the service's exact origin, including `https://`; verify custom-domain routing and proxy behavior before enabling `TRUST_PROXY=1`.
4. Start a two-player game, place pieces, redeploy, refresh both clients and verify progress, membership and host controls. Record the result. An ephemeral plan needs an explicit session-loss limitation instead of a durability promise.
5. Run physical iPhone/Android and assistive-technology checks and small user pilots, then a 25-person session on different networks. Local 25-player protocol load and emulated phone events are already tested, but do not establish real hosting latency or replace physical device testing.

## Rollback

Keep the current production commit and deployment available. If the approved deployment fails, restore that previous deployment. Do not overwrite V2 snapshots with V1 data: the old application does not understand the new credential model. Keep private snapshot backups outside the repository and retain them only under the operator's data policy.

## Known limits

Single-process request limits and JSON snapshots; no multi-instance coordination. Photos require ImageMagick (`identify` and `convert`) on the production host. Originals are discarded after processing, EXIF is stripped and upload storage must be excluded from backups. A recipient can save a received image; the timer deletes server copies and prevents further fetches, not copies on other devices. Existing image credits and repository license retained, not re-licensed. Some unreachable legacy server helpers remain internal cleanup work. Current test evidence is in `V2_EXECUTION_PLAN.md`; inspect the latest GitHub Actions run before merging.
