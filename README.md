# StoneForge website

Current frontend policy: **Batch 3**, paired with backend Batch 2 (PR #12).
Website A builds on that contract: see [UI, session and performance notes](WEBSITE_A_UI_SESSION_PERFORMANCE.md).
StoneForge is free to play; optional Forge Medal checkout remains sandbox only.
This repository is plain HTML/CSS/browser JavaScript with Node's built-in tests.

## Modules

| Area | Entry points |
| --- | --- |
| Public home/trailer/navigation | `index.html`, `index.css`, `StoneForge.js` |
| Unified download preparation | `download.html`, `download.js`, `download-maintenance.js` |
| Account login/profile | `auth.js`, `dashboard.js`, `profile-fields.js`, `school-selector.js` |
| Native browser handoff | `game-verify.html`, `game-verify.js` |
| FM contract and Store | `wallet-client.js`, `profile-store.js`, `profile-store.css` |
| Achievements/manual history | `achievements.js`, `transaction-history.js` |
| Logout confirmation | `sign-out.js`, `sign-out.css` |

## Current behavior

- The download page presents one planned `StoneForgeSetup.exe`. It requests public
  `POST /api/download/game` with an empty object only after an explicit click;
  no cookies, account ownership lookup or game checkout is involved. The browser
  validates the five-minute HTTPS R2 attachment response. No binary is fetched into
  browser memory and no static/public file URL is embedded.
- Downloads stay paused. The browser policy remains enabled; the backend also
  requires maintenance-off AND `GAME_UNIFIED_RELEASE_READY=true`. Only the operator
  may open release after building/uploading/testing the combined game. No release
  date, final size or unified version is invented. Old payment query parameters
  cannot approve a purchase or unlock anything.
- Game verification accepts a valid `/me` account regardless of historical
  `owns_game`. Explicit approval rechecks the cookie account before requesting a
  one-time authorization code. Existing PKCE/state/loopback validation remains.
  Restricted/expired accounts cannot approve; no local flag grants access.
- `wallet-client.js` strictly validates the owner/version/currency/environment and
  integer balance from **`GET /api/wallet/current`**. The legacy `/api/wallet` call
  supplies availability/profile flags only. Its historical live/test/display
  amounts are never used as the displayed balance. Missing availability keeps
  confirmed funds visible while disabling checkout. Missing canonical funds show
  Unavailable/retry, never a fabricated zero or a legacy fallback.
- Reconciliation remains server-owned. Eligible refreshes reconcile then re-read
  canonical funds. Wallet refresh on visibility/the existing 60-second timer stays;
  Transaction History refreshes only on page load/reload, its own Refresh, or manual
  Filter/Load more. Wallet/achievement refresh does not reload history.
- Profile/Store retain complete-profile requirements, server catalog prices,
  package review, double-click guards and the sandbox/no-real-charge disclosure.
  Explorer stays an in-game 750 FM unlock. Historical sandbox game orders remain
  visible to admins as test records rather than live revenue or the FM ledger.

## Validation and rollout

Run `node --test` from this repository using Node 22 or newer. Tests use synthetic
identities/responses; no credentials, provider calls or real FM changes are needed.

Batch 3 local evidence (2026-10-24): the baseline and final migrated suites each
passed **101 tests** with zero failures/skips. Obsolete paid-download cases were
replaced by the public/release-guard behavior; account, payment review, safe-link,
replay/double-click, stale-response, manual-history and logout checks remain.
Syntax checks passed for all 13 changed/new JS files. A separate local Express
smoke check used the actual backend composition and this wallet validator with
synthetic models/providers: non-owner identity, website/native balance equality,
availability metadata, owner mismatch and the closed installer gate passed.
Local desktop-browser preview checked the guarded download page, a synthetic
non-owner profile/Store with 175 FM, and the free-account approval screen. No
production payment, native EXE, mobile viewport or two-device test is certified.

Merge/deploy backend Batch 2 before this frontend. Matching Unity free-account and
wallet integration is still a separate batch; this website cannot remove the old
EXE's ownership check. The unified installer is not generated/released here.
No framework/dependency migration, account conversion, refund, reward grant,
production configuration or deployment is performed by this frontend change.

Earlier installer/game-auth guides are historical. This README supersedes their
paid-download and ownership prerequisites. `tutorial-download.js` remains a detached
compatibility helper; the unified page does not load it or offer a separate demo.
