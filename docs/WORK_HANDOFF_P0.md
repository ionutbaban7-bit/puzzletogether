# PuzzleTogether — start in ChatGPT Work (P0)

Repository: https://github.com/ionutbaban7-bit/puzzletogether
Review: https://github.com/ionutbaban7-bit/puzzletogether/pull/10
Branch: `v2/phase-0-security-foundation`
Base: `main` (production; **never push or merge to main without explicit review**)
Execution backlog: [docs/V2_EXECUTION_PLAN.md](./V2_EXECUTION_PLAN.md)
Acceptance contract: [docs/V2_SECURITY_TEST_PLAN.md](./V2_SECURITY_TEST_PLAN.md)

## Paste this into Work

Continue PuzzleTogether V2 directly on my connected GitHub repository `ionutbaban7-bit/puzzletogether`, on branch `v2/phase-0-security-foundation` and its draft PR #10. Before changing anything, fetch the latest branch/PR and read `docs/V2_EXECUTION_PLAN.md`, `docs/V2_SECURITY_TEST_PLAN.md`, the open PR and GitHub Actions logs. Do not restart the project or overwrite current changes.

**The only product target** is a friendly standalone collaborative jigsaw for families, friends, coworkers, managers and coaching workshop facilitators. No standalone coaching, psychological ranking, employee evaluation or feature sprawl. **Do P0 first; no redesign or production deployment while security/stability checks are incomplete.**

### P0 progress already coded (verify, do not assume all green)
1. Independent random per-player credentials on create/join; hashed verifier in room snapshots; identity checked for returning joins and WS `hello`.
2. Bearer identity and server-side host checks for REST reset, puzzle selection, export and authenticated offline host takeover.
3. Browser credential persistence and propagation in all entry routes, socket reconnect and private recap download.
4. Anonymous metadata no longer exposes host ID; isolated security-negative tests added, plus legitimate host/guest regression checks.
5. Abuse limits for create/join/upload; MIME magic checks; ImageMagick child-process limits; abandoned image cleanup.
6. New CI `.github/workflows/v2-baseline.yml` running build, render-contract, catalog, authenticated layout and security tests, upload-abuse negatives and isolated process restart. Check the **latest Actions run**; earlier failing runs were from an incomplete workflow or old commits.

### Next concrete tasks; complete in sequence
1. **Verify the latest Actions status**. Fix any failure with the smallest possible diff. Never report "passed" without a completed successful run on the latest commit.
2. Review all P0 auth changes for broken direct/manual join, room creation, host takeover, legacy session expiry, WebSocket double-session eviction, API private export, and any remaining public/private identifier confusion. Expand regression tests for unauthorized host takeover after disconnect, token scope, token revoke after kick/room expiry, guest access to other rooms and reconnect across genuine restart.
3. Convert EVERY retained protocol/browser test that still assumes playerId alone authenticates to credential-backed sessions. Run `npm run test:protocol`, `npm run test:e2e` and `npm run test:e2e:mobile` where browser dependencies are available. Do not mask existing failing suites or confuse Playwright emulation with physical-device QA.
4. Verify valid photo upload, not only forged-payload rejection. Assess risks from synchronous ImageMagick handling and openly accessible URL. Either isolate async processing and enforce per-room asset access/TTL or feature-flag uploads off until that can be demonstrated. Confirm orphan cleanup and upload lifecycle through tests.
5. Inspect the actual Render hosting configuration and verify persistent room data/images survive a real redeploy. A successful *local isolated process restart test is NOT proof of Render durability*.
6. Check WS Origin acceptance from real Render and cross-origin rejection, HTTP cache policy, secrets in logs/snapshots, least-privilege room views, password/token expiry and compromised-session invalidation.
7. Keep the PR draft until all critical gates pass. Then document test evidence and remaining environmental/physical-device limits for human review. Never merge/deploy without user approval.

### After P0 is green
Follow V2_EXECUTION_PLAN in order. Archive V1 branches before deleting legacy features. Then simplify UI to **Create / Join / Play / Finish**; keep existing canvas jigsaw board geometry and accessible touch behavior. Trial with actual families and teams before adding features.

### Reporting expectations
At each meaningful code increment, commit to the existing V2 branch, attach tests, share latest PR diff and CI status, and update `docs/V2_EXECUTION_PLAN.md` checkboxes **only when verified**. Explicitly separate (a) code written, (b) tests passed, (c) physical/live deployment not checked. Stop or flag blockers instead of claiming success.

Note: The GitHub-based work in this chat is not itself a ChatGPT Work session. Use Work's own app/connected GitHub access to continue the branch and interact with the website if needed.
