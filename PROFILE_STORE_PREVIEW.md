# Website profile + Store preview

Implemented in the existing buildless website; no replacement Site, hosting manifest or deployment was created.

## What changed

- Required User Type on signup (Regular User, Student, Teacher / Instructor). Student school is required; instructor institution optional. Shared validation is used for signup and profile completion.
- Existing accounts get a one-time profile prompt instead of being assigned a guessed type. Sign out remains available while incomplete.
- User Types are self-declared, do not grant privileges, and do not affect pricing.
- School search is now shared between signup and Edit Profile; see SCHOOL_SELECTOR.md for canonical campus selection, preserved legacy text and explicit coverage limits.
- Account Info plus a Forge Medal wallet card. Read-only balance comes from the authenticated backend; failures display Unavailable, never invented zero.
- Store opens as a labelled native dialog from the wallet's Open Store button, not a long profile section. Desktop uses a centered four-card popup; mobile uses a full-screen dialog with its own scrolling and a persistent balance/close header. The supplied Unity artwork remains byte-for-byte unchanged.
- Escape, the close button or an outside press/click dismisses Store and restores opener focus. Background scrolling is locked only while Store is open; logout/stop clears the modal and lock. Profile completion takes precedence over a pending shop intent, without stacked dialogs.
- Eligible test packages open an inline review step first. Only explicit Continue creates the existing gated checkout request; back/close does not. Closing an in-flight preparation suppresses its late redirect but does not claim to cancel a server order; its existing request key remains available for safe retry.
- Four priced bundle cards; same prices for everyone. With the updated dedicated sandbox backend enabled, all active signed-in accounts with complete profiles see Buy FM, including accounts without Full Game ownership. The browser follows authenticated server eligibility; it does not grant access or money locally. Real-money checkout remains disabled.
- Store shows loading, profile/configuration, expired-session, restricted-access and connection-failure messages. Its Refresh wallet / Retry button reloads a failed catalog if necessary and retries read-only wallet requests; it never creates a checkout or grants FM. Checkout stays disabled during wallet refresh.
- Characters, chromas and perk upgrades are configuration/previews, not purchasable items.
- Achievement preview shows six cards, View All shows the catalog, and locked/reserved entries conceal their name/description behind ???. Server snapshots remain owner-checked. No browser unlock or wallet-credit operation exists.
- The existing shop=true return/deep link opens the popup (or waits for required profile completion). Report intent takes precedence if both are supplied. Payment query strings still never grant money, medals or ownership.

## All-account sandbox deployment

Merge/deploy the companion backend first, then this frontend. No new environment variables are required; the existing TEST Store flag and dedicated PayMongo TEST secrets still control checkout. The old Store tester-ID list no longer limits top-ups. Native perk/reward and Full Game access requirements remain unchanged. A top-up does not purchase the Full Game. Keep the sandbox/no-real-charge notice visible at checkout.

After deployment, hard-refresh and verify a newly registered complete-profile account on another browser/device: Buy FM, package review, sandbox checkout, one credited top-up and matching history. Retry must recover after a temporary connection outage without inventing a zero balance or creating a duplicate payment. Automated tests use mocked providers/DOM and do not certify that real deployment flow.

## Tests

node --test game-verify.test.js download.test.js achievements.test.js profile-store.test.js school-selector.test.js tutorial-download.test.js

The popup change passes the complete 68-test DOM/VM suite. Synthetic loopback Chrome checks additionally cover desktop artwork/layout, 390x844 portrait and 844x390 landscape full-screen sizing, 320px single-column fallback, independent scroll with the close header remaining visible, Escape/focus return, keyboard focus wrapping and test-package review/back. These are local UI checks, not real-account, deployed-payment or live-wallet certification.

## Local visual preview with synthetic data only

From the sibling Unity repository, run the provided Node helper:
Tools/Validation/Preview-ForgeWebsite.cjs

It prints a loopback Local URL. It serves the actual frontend files with synthetic account/catalog/wallet/profile responses and rewrites API calls to localhost in-memory. It never loads .env or proxies production. No actual signup, email, wallet grant or payment is performed. The preview contains an explicit LOCAL PREVIEW banner. Use Ctrl+C to stop it.

The helper is outside this deployable frontend repository. Do not publish a mocked API or use its synthetic state as migration/test evidence for real accounts.

## Manual acceptance

1. Signup: blank User Type rejected; Student requires school; Teacher institution optional; Regular hides school. OTP retry preserves the chosen profile.
2. Existing user: prompt appears, cannot bypass completion for FM checkout, can still sign out. Save the type; reopen/edit; check school preservation.
3. Desktop/mobile: wallet beside Account Info; Store is absent from the profile until Open Store is clicked. Verify 4/2-column packages (one column at 360px or narrower), readable prices/artwork, full-screen mobile own scrolling, visible close header and no horizontal overflow.
4. Achievements: six-card preview, View All/collapse, category filter, locked ??? and actual unlocked details. Refresh/outage/account switch must not misattribute progress.
5. Wallet: valid new wallet may show zero; API outage must show Unavailable; test balance clearly separate from live.
6. Store preview must not create a payment or debit/credit currency. In separately configured test mode, selecting a pack only opens review; Back/close grants nothing, and only Continue uses the existing checkout. Test close during preparation, repeated clicks, Escape/backdrop, focus return and shop=true/payment return. No live key is accepted.
7. Existing sign-in, private download, ownership checks and report UI still work after both backend/frontend deploy.

Do not assume an old six-placeholder live page has changed: these edits are local until reviewed, committed, pushed, merged and deployed.

An existing shared StoneForge.js reviews-widget console warning on the dashboard (missing reviews-only elements) was observed in the local preview; that unchanged script is outside this Store UI change. Backend files, prices, payment configuration, currency grants and Unity files are unchanged by the popup feature.
