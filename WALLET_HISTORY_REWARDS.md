# Wallet, transaction history and perk rewards

The dashboard presents the authenticated server-selected sandbox wallet from `/api/wallet/current` as its main `Balance`, including persisted upgrades/unlocks and server-confirmed perk reward credits. Live and test funds are never merged. `/api/wallet` supplies availability flags only; its historical balance fields are not displayed. No local balance increment or invented credit occurs. Checkout permission stays separate from reading confirmed funds.

The Store reads current perk cost matrices and Explorer's 750 FM in-game unlock from the backend catalog. Scientist has no paid upgrades. Explorer remains an in-game purchase, not a new website debit endpoint. Chroma promotion/price/card is removed pending its implementation; no assets or historical IDs are deleted. Normal FM labels are used, with a clear sandbox/no-real-charge notice on checkout. Live checkout remains off.

`Transaction History` sits below Achievements, with Refresh, all/topup/spend/reward filters, Load more, signed FM amounts, PHP package prices and actual server status. Pending orders say Not credited; a payment redirect alone never means Completed. History uses authenticated GET only, owner checks, no-store reads, safe text nodes, bounded pages and stale-response/logout guards. Desktop rows stack at narrow widths; no actual browser visual QA is claimed here.

Catalog v2 keeps 71 stable achievement IDs, enables six server-only perk milestones (64 supported / 7 reserved) and leaves all untrusted gameplay reward grants off. Client-reported rows cannot impersonate server-perk proof. Existing unearned/reserved details remain concealed. The six FM rewards total at most 220 per account in the sandbox wallet.

On verified wallet refresh, eligible accounts first POST an empty object to the protected reconciliation endpoint, then re-read their authoritative wallet. Achievements refresh after that read. Transaction history now loads only on page initialization/reload and its own Refresh or manual Filter/Load more actions; wallet updates and tab visibility do not refresh it. Old backend purchase receipts can earn their missed milestone once; local saves/screenshots/synced gameplay are not proofs. A reconciliation outage does not fake success or reset the balance: confirmed funds remain visible with a retry notice.

Deploy backend Batch 2 first, then this frontend, then use the updated matching Unity player. Global TEST flags and complete profiles control purchases/reconciliation for all active accounts; historical ownership and tester allowlists no longer grant access. See README.md for current policy. Do not enable live keys, merge environments or open downloads before the unified build is tested. Existing browser sessions should hard-refresh after deployment. No production deployment or personal account reconciliation is performed by this PR.

Validation command:

    node --test game-verify.test.js download.test.js achievements.test.js profile-store.test.js transaction-history.test.js school-selector.test.js tutorial-download.test.js

The DOM/VM tests do not certify an actual browser, real-account balances, provider checkout or two-PC gameplay. Browser Use was disabled in Work settings during implementation. An optional synthetic loopback visual preview remains outside the deployable repository, in the companion Unity workspace's Tools/Validation/Preview-ForgeWebsite.cjs --rewards. It never proxies production and explicitly labels its sample account and transactions.
