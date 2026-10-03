# V2 security acceptance contract — IMPLEMENTED; OPERATIONAL RELEASE CHECKS OPEN

This is a blocker, not an enhancement. It applies to all REST + WebSocket paths, including legacy modes retained on the V2 development branch until they are archived. A cosmetic omission of `hostId` from the anonymous route does **not** repair authentication.

## Regression tests created
`scripts/security-regression-test.mjs` models separate unauthenticated clients with known user UUIDs. Those tests demonstrated the initial defect and now pass on the V2 branch, together with positive tests for authenticated hosts and guests. A passing targeted suite is **not** evidence that every old test, production environment and threat model is complete.

## Required implementation and test evidence
1. Create room + join returns a fresh, high-entropy per-client **secret** separately from the public `playerId`; do not put credentials in shared links, public room response, exports or logs. Existing sessions need an explicit transition strategy.
2. Persist the verifier/binding through restart in a safe, controlled way. Limit credential replay as appropriate for a family game that needs refresh/reconnect; two tabs must not silently let someone steal another player by knowing the ID.
3. All privileged HTTP endpoints validate the session secret, resolve the participant server-side and verify current host role. No permission checks may depend solely on JSON/query `pid`. Guest permissions and takeover need explicit tests.
4. WS `hello` validates identity proof and membership; forged `hostId` or `playerId` must receive deny and never disconnect the real user's established socket.
5. Anonymous room metadata must omit `hostId`, access code, participants' session secrets and confidential workshop data. Verify both JSON and WS projections for minimal data disclosure.
6. Test host normal play, reconnect across refresh and actual restart, authorized export, guest denied export/control, guest normal play, unauthorized impersonation, stale/revoked credentials, and same-room takeover only after legitimate host departure.
7. CSRF/Origin policy, invite token, rate limiting and uploaded custom photo isolation get separate negative tests before any public release.

## Test execution
Run against an **isolated local instance**, never against a real session:

```sh
npm ci
npm run dev
# other terminal
node scripts/security-regression-test.mjs
npm run test:protocol
npm run build
```

**Current evidence and release limits:** see `V2_EXECUTION_PLAN.md` and the latest PR #10 Actions run. Local baseline, V2 security, retained jigsaw protocol, browser flow and real process-restart tests pass. Archived activities are disabled. Photos use private capabilities, bounded async processing and a fixed one-hour deadline; upload, timer, restart and browser lifecycle tests cover the restored feature. Render redeploy durability, branch rules, physical devices and user pilots still require evidence before production.
