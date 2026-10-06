# Game account verification page

Feature branch: `codex/feature-game-auth`. The existing website is deployed on
Vercel; this new game-authentication patch has not been published by Codex.

Publish game-verify.html/css/js together with updated auth.js and dashboard.js
after backend endpoints are deployed. The page uses the existing website
cookie session, explicit owned-account approval, and a validated local callback.
Login/signup links preserve the handoff, and redirects are limited to approved
same-site pages. No credentials, verifier or persistent tokens are put in URLs.

API URL: `https://stoneforge-backend.onrender.com/api`.
Frontend base URL and backend allowed Origin: `https://stoneforgegame.vercel.app`.
Verification page: `https://stoneforgegame.vercel.app/game-verify.html`.
Pages are hosted at the domain root, not under `/stoneforge-frontend/`.
Use the plural server variable `ALLOWED_ORIGINS`; do not append a page path.

## Review and deployment order

1. Review and push the feature branches, then open separate backend/frontend PRs.
   Check the hosting deployment branch before merging; a merge may auto-deploy.
2. The backend owner configures secrets privately, verifies PlayFab title E1CDE,
   Mongo indexes and `ALLOWED_ORIGINS`, then deploys the backend integration.
3. Publish game-verify.html/css/js, auth.js and dashboard.js together to the
   Vercel project serving the domain above. Check its root/output directory so
   `/game-verify.html` is served directly; homepage availability alone is not enough.
4. Configure Photon Custom Authentication before testing real Multiplayer.
5. Test existing signup/login/purchase flows and the Unity browser handoff,
   cancellation, timeout and remembered-session behavior.

During the read-only assessment, the homepage returned 200 but game-verify.html
and backend `/api/game/me` returned 404. Login CORS preflight already accepted
the Vercel Origin. These are assessment observations, not guarantees about a
later deployment. After deployment, verify that the page serves HTML and the
unauthenticated game/me endpoint returns 401 rather than 404. This availability
check is not a substitute for real account and Photon tests.

Never commit a populated .env or share cookies/tokens/server keys. Cross-site
cookie restrictions between Vercel and Render may still affect browser sign-in.
Story remains offline and is not gated by deployment or account verification.

`node --test game-verify.test.js` runs six isolated production-script tests,
not browser cookie/visual tests. Test login/signup continuity, browser privacy
settings, no ownership, blocked account, errors and real Windows callback.
Private Full Game installer downloads are implemented separately on
`codex/feature-private-installer-download`. See `INSTALLER_DOWNLOAD_SETUP.md`
for backend-first deployment and the download acceptance checklist. The original
game-authentication test scope above does not certify that separate integration.

Full integration guide:
`C:/Users/USER/NewStoneForge-FullGame/Docs/WebsiteAuthenticationSetup.md`.
