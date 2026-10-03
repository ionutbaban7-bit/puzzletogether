# PuzzleTogether

One puzzle. Together.

A standalone collaborative jigsaw for family, friends and teams. Choose a picture, create a room and share one invitation link. Guests enter a display name; no accounts are required.

## Product

- Shared, server-authoritative jigsaw with concurrent piece claims.
- 12, 25, 64 and 100 pieces; 144 and 192 under advanced options.
- Phone and desktop controls, zoom, pan, reference image and optional piece sorting.
- Keyboard/tap alternative: select a piece, choose a row and column, confirm.
- Shared lobby/start, optional observer host, team completion and replay with the same group.
- RO/EN. Personal JPG/PNG/WebP photos, without accounts; private to the invited group and automatically deleted one hour after upload. Choosing another image or closing the room deletes the photo sooner.

V1 coaching, CARTOGRAF, chat and letter/sentence activities are not available in V2. Their source is preserved on `archive/v1-before-focused-jigsaw`. Some unreachable legacy server helpers remain for later internal cleanup; they are not enabled product features.

## Run

```bash
npm ci
npm run dev
```

Production uses `npm run build` followed by `npm start`. One Node process serves the React app, API, catalog images and WebSocket endpoint on the same origin.

## Verify

```bash
npm run build
npm run test:render-contract
npm run test:image-scaling
npm run catalog:audit
npm run test:security
npm run test:protocol
npm run test:restart
npm run test:photos
npm run test:e2e
```

The retained protocol suites run on fresh local instances. The browser suite requires Chromium: install it with `npx playwright install chromium` or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible installed binary. Screenshots and failure evidence go to ignored `test-artifacts/`.

Legacy activity tests are preserved in Git history; they are intentionally outside the focused V2 test commands. Browser phone emulation is not physical-device certification or a full screen-reader audit.

## Security and hosting

Public player IDs are never credentials. Each player receives an independent random secret; only its verifier is saved. Host actions, returning joins and WebSocket connections require proof of membership. Invitations are separate, room-scoped admission capabilities and expire after 24 hours. Removing a player revokes their membership and changes the invitation and fallback code.

Photos are re-encoded to WebP in bounded asynchronous ImageMagick child processes, with orientation corrected and metadata stripped. The production host needs `identify` and `convert` (ImageMagick). Uploads are limited to 9 MB, 16 megapixels and two concurrent processing jobs. Their fixed one-hour deadline is stored with the derivative and survives restart. Uploaded originals are removed after processing. At expiry, the image and its metadata are deleted; the same room returns to a library puzzle in the lobby, preserving the group. Do not back up the uploads directory, or copies could outlive the one-hour retention.

Room snapshots require a writable, persistent `DATA_DIR`. The default `.data/` supports local restarts; an ephemeral hosting filesystem does not guarantee survival across redeploys. Use one instance; shared storage and pub/sub are required before horizontal scaling.

Set `PUBLIC_ORIGIN` to the exact public origin when deploying. Set `TRUST_PROXY=1` only after verifying the hosting proxy's forwarding behavior. Keep secrets and room snapshots out of Git, backups public links and logs.

Inactive rooms expire after 24 hours; empty rooms expire after 30 minutes. The project license remains the repository's existing [LICENSE](LICENSE); catalog credits do not grant rights beyond each image's stated license.

Implementation and evidence: [V2 execution plan](docs/V2_EXECUTION_PLAN.md). Hosting and release checks: [V2 release notes](docs/V2_RELEASE_NOTES.md).
