# Unified installer release and download maintenance

The Windows release is StoneForge 1.5.8. Tutorial, Story Mode and Multiplayer
use the same installer. The download is free and does not require account
ownership, a one-time payment or an activation key.

## Verified release artifact

- File: StoneForgeSetup.exe
- Version: 1.5.8
- Size: 187,392,095 bytes (187.39 MB; 178.71 MiB)
- SHA-256: c7cd712b99e5f9ecda60b5d1840eb4ff18d9f37a970482b03bc68340cee490cb
- Platform: Windows 10/11 x64

On 5 November 2026 the public download API returned a link to the private R2
object. A downloaded copy matched the local packaged installer exactly by
byte count and SHA-256. This verifies delivery of the intended artifact;
it does not certify installed gameplay on every device.

## Frontend and backend release gates

The frontend policy in download-maintenance.js has enabled: false for this
release. Missing, malformed or explicitly enabled maintenance policies still
prevent download requests. HTML keeps the initial action disabled until the
client loads the policy; a hidden maintenance notice avoids a paused-page flash.
Versioned script URLs allow the new page to request the release policy.

The backend must independently use:

    GAME_UNIFIED_RELEASE_READY=true
    GAME_DOWNLOAD_MAINTENANCE=false

It checks storage availability and returns a five-minute private R2 download
link only after an explicit POST to /api/download/game. There is no direct
public bucket URL in the frontend, automatic download or game-ownership check.
The backend gates also protect pages opened before a frontend redeployment.

If downloads need to be paused again, set GAME_DOWNLOAD_MAINTENANCE=true on
Render, then set enabled: true in the frontend policy and deploy with updated
script URLs. Preserve the release object and existing account/payment records.

## Validation and release

    node --test

After merging the frontend PR and waiting for Vercel, open /download and check
the version, size and Download StoneForge action. A visitor who is not signed
in should be able to request the installer. Compare a downloaded file to the
SHA-256 above. Install/launch and two-device Multiplayer/Voice acceptance remain
separate from frontend unit tests and file-delivery verification.

FM checkout still uses test payments; this installer release does not enable
live payments or modify balances, owned classes or transaction history.
