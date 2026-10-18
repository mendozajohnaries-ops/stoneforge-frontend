# Website profile + Store preview

Implemented in the existing buildless website; no replacement Site, hosting manifest or deployment was created.

## What changed

- Required User Type on signup (Regular User, Student, Teacher / Instructor). Student school is required; instructor institution optional. Shared validation is used for signup and profile completion.
- Existing accounts get a one-time profile prompt instead of being assigned a guessed type. Sign out remains available while incomplete.
- User Types are self-declared, do not grant privileges, and do not affect pricing.
- Account Info plus a Forge Medal wallet card. Read-only balance comes from the authenticated backend; failures display Unavailable, never invented zero.
- Store section uses the supplied Unity medal artwork, copied byte-for-byte into Assets/store. Unity originals are untouched. Pack images are lazy-loaded; transparent margins on bundle artwork are handled with CSS.
- Four priced bundle cards; same prices for everyone. Default buttons are disabled Coming soon. Explicitly allowlisted testers may see Test checkout only when the dedicated test backend is configured.
- Characters, chromas and perk upgrades are configuration/previews, not purchasable items.
- Achievement preview shows six cards, View All shows the catalog, and locked/reserved entries conceal their name/description behind ???. Server snapshots remain owner-checked. No browser unlock or wallet-credit operation exists.
- Pending/failed/success query strings do not grant money, medals or ownership.

## Tests

node --test game-verify.test.js download.test.js achievements.test.js profile-store.test.js

DOM/VM tests are not visual browser certification. Browser automation was disabled by the desktop Work settings during implementation. Responsive layout, keyboard focus, native dialog/dropdown behavior and real deployed sessions still need manual browser acceptance.

## Local visual preview with synthetic data only

From the sibling Unity repository, run the provided Node helper:
Tools/Validation/Preview-ForgeWebsite.cjs

It prints a loopback Local URL. It serves the actual frontend files with synthetic account/catalog/wallet/profile responses and rewrites API calls to localhost in-memory. It never loads .env or proxies production. No actual signup, email, wallet grant or payment is performed. The preview contains an explicit LOCAL PREVIEW banner. Use Ctrl+C to stop it.

The helper is outside this deployable frontend repository. Do not publish a mocked API or use its synthetic state as migration/test evidence for real accounts.

## Manual acceptance

1. Signup: blank User Type rejected; Student requires school; Teacher institution optional; Regular hides school. OTP retry preserves the chosen profile.
2. Existing user: prompt appears, cannot bypass completion for FM checkout, can still sign out. Save the type; reopen/edit; check school preservation.
3. Desktop/mobile: wallet beside Account Info, Store cards 4/2 columns, all prices readable, original medals look correct, no horizontal overflow.
4. Achievements: six-card preview, View All/collapse, category filter, locked ??? and actual unlocked details. Refresh/outage/account switch must not misattribute progress.
5. Wallet: valid new wallet may show zero; API outage must show Unavailable; test balance clearly separate from live.
6. Store preview must not create a payment or debit/credit currency. Inspect explicit test mode separately with the backend operator; no live key is accepted.
7. Existing sign-in, private download, ownership checks and report UI still work after both backend/frontend deploy.

Do not assume an old six-placeholder live page has changed: these edits are local until reviewed, committed, pushed, merged and deployed.
