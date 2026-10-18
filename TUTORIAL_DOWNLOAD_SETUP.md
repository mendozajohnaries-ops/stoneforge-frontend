# Tutorial installer download UI

The Free Trial card now downloads StoneForgeTutorialSetup.exe (Tutorial v0.1.0, 103.4 MB / ~98.6 MiB) through a dedicated free backend route, not the older Dropbox ZIP.

## Integration

- tutorial-download.js initializes the Tutorial button independently, before the existing Full Game script.
- No sessionStorage, cookie, account, entitlement or payment request is needed for the Tutorial action.
- Click POSTs {} to /api/download/tutorial with credentials omitted.
- Returned metadata must match the selected Demo release. Only an HTTPS private R2 S3 URL for /stoneforge-demo/StoneForgeTutorialSetup.exe, a 300-second signature and the fixed attachment disposition is used. Old stoneforge-tutorial paths and earlier release checksums are rejected.
- Download is direct navigation to an attachment, not a large JS blob. API keys never enter frontend code.
- Busy state prevents duplicate clicks; timeout/storage/rate-limit errors restore Retry behavior without login, checkout or fallback to a different file.
- Installer instructions explain the separate Tutorial application folder, unsigned beta and manual launch. Existing Full Game instructions/payment/ownership behavior are preserved.

## Required operator steps

Deploy the backend Tutorial route and set its dedicated TUTORIAL_R2_* variables in Render first; exact names are in the backend TUTORIAL_DOWNLOAD_SETUP.md. TUTORIAL_R2_BUCKET_NAME must now be stoneforge-demo, and the key pair must belong to that bucket's new read-only token. Keep the bucket PRIVATE. Do not change existing Full Game R2_* values.

Then publish/deploy all four frontend files together: download.html, download.css, tutorial-download.js and download.js. No deployment is performed by editing these local files.

## Validation

    node --test game-verify.test.js download.test.js achievements.test.js profile-store.test.js school-selector.test.js tutorial-download.test.js

DOM/VM tests cover anonymous fresh downloads, fixed release/URL validation, double clicks, timeout, storage errors, late responses and no ZIP/login/payment fallback. Existing Full Game purchase/download tests remain.

Manual acceptance: signed-out Tutorial download, repeated click/fresh link, actual downloaded checksum, server unavailable/retry, keyboard/mobile layout, and unchanged paid Full Game gate. Local browser access was disabled in Work settings during this change, so visual/live-R2 tests remain pending.

Expected download checksum:
ab8e479d4f1a0c8c21b8cb40009cefea53d4616edf8fb8996acfde92e12b19dd

This is the published expected binary hash; neither a displayed file size nor the page itself verifies the downloaded bytes.

The selected Demo package is 103426838 bytes. Local install/uninstall and all 200 payload hashes passed. Only the build GUID differed from the earlier package; gameplay bug-fix verification remains separate. No Cloudflare bucket/token deletion or production environment update is performed by changing this local client.
