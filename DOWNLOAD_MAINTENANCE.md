# Unified installer release and download maintenance

The Windows release is StoneForge 1.5.9. Tutorial, Story Mode and Multiplayer
use the same installer. The download is free and does not require account
ownership, a one-time payment or an activation key.

## Verified release artifact

- File: StoneForgeSetup.exe
- Version: 1.5.9
- Size: 226,666,685 bytes (226.67 MB, 216.17 MiB)
- SHA-256: 463aded4311d78a0f0e5772e1f2cdf4634ca666a510a82ac3b0d91da639005c1
- Platform: Windows 10/11 x64

On 11 November 2026 the public download API returned a link to the private R2
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
