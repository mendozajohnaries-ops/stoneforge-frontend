# Website A: Store UI, verified logout and early FM rendering

Frontend-only branch `codex/website-store-session-performance`, based on merged
frontend Batch 3 at `a329c4b`. Backend efficiency remains the next separately
reviewed batch. No backend/Unity source, flags, keys, production balances,
deployments or account operations are changed by local validation.

## Store

- Retain the dark green/gold StoneForge identity with clearer typography, aligned
  package cards, compact balance/refresh header, responsive grids and accessible
  keyboard navigation including the spending-details summary.
- Main Store wording is product-focused. Move perk prices into collapsed spending
  details and remove the prominent sandbox badge/technical eligibility banner.
  The final review accurately states that no real payment will be collected.
  Provider requests and validation still enforce the existing TEST environment.
- Package ID, amount, prices, server eligibility, expected-owner checks and
  request-key reuse are unchanged. No browser credit or local-balance fallback.
- Four 512px transparent WebP derivatives total **97,910 bytes**, compared with
  **4,679,604 bytes** for the source PNGs (97.9% smaller). Originals remain intact.
  `tools/optimize-store-assets.cjs` is a mechanical authoring helper requiring
  sharp locally; deployment and tests do not acquire a new dependency.

## Session lifecycle

- Profile/Admin roots are hidden/inert while server `/me` identity is checked.
  Historical cached hints never authorize content or admin privileges.
- `pagehide` masks and suspends private UI, removes module handlers, clears private
  display/drafts and aborts account work. `pageshow` revalidates before remounting.
  Ordinary tab-visibility checks preserve the same-owner modules/history rather
  than creating duplicate timers or reloading transaction history.
- Confirmed logout validates both HTTP success and `{success:true}` before clearing
  hints, notifying other tabs and replacing the current history entry with Sign In.
  Network/error/malformed results keep private content masked with retry/return
  controls; they never claim a successful sign-out.
- Cross-tab storage/BroadcastChannel messages contain only an event kind and nonce.
  Sign-in events cause server revalidation; they do not supply trusted identity.
  Sign-out events clear private state and redirect. Expected generations reject
  late HTTP/JSON responses after logout, navigation or a different account.
- Genuine protected 401 invalidates the page. A feature 403 causes a separate `/me`
  check instead of assuming optional checkout denial proves session revocation.
  Existing backend auth/authorization still controls every protected operation.
- Public navigation refreshes its display hint on history restore/logout events;
  logged-out review fields respect the shared `[hidden]` rule.

## Loading

- After session verification, start canonical wallet/profile/catalog independently.
  Render the first validated FM amount immediately; package availability and reward
  reconciliation do not withhold it. Checkout waits for complete profile, confirmed
  availability and reconciliation completion; amounts are never invented/incremented.
- Coalesce overlapping wallet refreshes. Reward reconciliation remains server-owned,
  followed by another canonical read. A slow/failed optional service does not reset
  confirmed funds to zero. Invalid canonical data remains Unavailable/retry.
- Fetch school choices on actual profile-field interaction. Signup retains eager
  directory loading. Fonts are discovered directly from HTML with preconnects,
  and below-fold homepage artwork/screenshots use native lazy decoding/loading.
- Transaction History remains manual: initial/navigation load, its own Refresh,
  Filter and Load more. Wallet refresh/ordinary visibility checks do not reload it.

## Evidence

- Baseline: 101 tests passed. Final migrated suite: **117 passed**, zero failures/skips.
  All 14 changed/new JS/CJS files passed `node --check`; the scoped whitespace
  check passed. Dependency versions are unchanged.
  Paid/owner/checkout validation remains in the companion backend; this suite covers
  browser contracts, permission/state safety, package review, logout confirmation,
  failed/malformed logout, history restore, roles, account switches, late replies,
  cross-tab invalidation, slow profile/catalog/rewards and refresh coalescing.
- Desktop browser and a **390px iframe viewport** checked the new Store with
  synthetic identity/funds. The confirmed FM amount was visible while profile
  was still loading. A late-profile availability-copy race found in the browser
  was fixed and regression-tested.
- In the local browser: confirmed logout -> Back to public homepage -> Back to
  an older profile entry returned to Sign In. The second preview tab/iframe also
  returned to Sign In. This is local synthetic navigation evidence; deterministic
  tests separately exercise persisted-page lifecycle events.
- The preview intercepts every production backend URL and uses synthetic responses.
  No personal credentials, production logout, payment or real balance is involved.
  Real Vercel/Render latency, production cookies, all browser families and physical
  mobile devices still require acceptance after merge/deployment. No fixed speed
  multiplier or production cold-start improvement is claimed.

## After merge

Wait for Vercel deployment, then test Profile/Admin logout, Back/Forward, another
open tab, failed logout/retry, account switching and a direct protected-page URL.
Check early FM display, delayed/offline services, package review and manual history
on desktop and phone. Keep downloads paused and payment configuration TEST-only.
Backend duplicate identity/provider/query work and hosting analysis remain Website B.
