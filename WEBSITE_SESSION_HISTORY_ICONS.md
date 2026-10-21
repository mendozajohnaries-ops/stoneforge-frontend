# Website logout history and tab icons

Profile, Admin and the required-profile Sign out action use the shared confirmation dialog. Cancel, Escape and closing it leave the session and page intact. Only explicit Sign Out runs existing cleanup and the authenticated logout request; repeated clicks are ignored while pending. Cancel receives initial focus and the previous control regains focus afterward.

Transaction history loads once when the authenticated dashboard opens or reloads. Its own Refresh button reloads it; Filter and Load more remain manual navigation actions. Tab visibility, the wallet timer and wallet Refresh no longer reload history. Wallet and achievement refresh/reconciliation behavior is unchanged. Pending payments may remain pending on screen until history is manually refreshed; a displayed redirect never grants currency.

All eight HTML pages reference the supplied StoneForge logo as 16/32 PNG, multi-size ICO and 180px touch icons. The website source copy under Assets/brand is byte-identical to the supplied Unity PNG; the original and navbar logo are unchanged. Icons use a versioned URL to avoid an old browser-tab cache. Exports are mechanical resizes, not AI-redrawn artwork. For authoring only, run tools/generate-favicons.cjs with sharp available on Node's module path; no deployment build step is required.

Tests: node --test sign-out.test.js transaction-history.test.js favicon.test.js profile-store.test.js game-verify.test.js

These are isolated DOM/VM and binary-asset tests, not live account or browser visual certification. Merge/deploy the frontend PR, hard-refresh/reopen the tab, and verify Cancel/Confirm on Profile/Admin, unchanged required-profile behavior, no history updates on tab switches/wallet refresh, manual history Refresh and the tab icon. No backend changes, payment settings, production balances or Unity builds are included.
