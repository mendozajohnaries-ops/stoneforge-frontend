# Full Game installer download page

Branch: `codex/feature-private-installer-download`.
Local changes only; no website deployment performed by Codex.

## Publish after the backend

The backend owner first deploys the matching private-download integration and
keeps R2 credentials in Render only. Its `INSTALLER_DOWNLOAD_SETUP.md` lists all
five required variables and acceptance tests. Configuring variables alone does
not install the new backend code.

Then publish `download.html` AND `download.js` together to the Vercel project
serving `https://stoneforgegame.vercel.app`. Keep the root URL `/download.html`.
Review/push/open a PR only when authorized and check the deployment branch before
merging. No public R2 bucket, static Full Game URL or frontend key is needed.

The existing Free Trial Dropbox link is unchanged. This patch covers Full Game
only: Windows installer v1.4.4, `StoneForgeSetup.exe`, approximately 147 MB.

## UI behavior

- Every page load checks ownership through the backend's authenticated cookie.
  Browser cached user data cannot unlock Full Game. Signed-out users are sent
  to sign-in with a return to this download page.
- An authenticated non-owner sees Purchase to Unlock. Existing checkout is
  called with a cookie and only `package_id: full_game`, not a browser owner ID.
- A `payment=success` return is only a hint to poll ownership, never proof of
  payment. At most ten checks are made, two seconds apart between responses;
  network timeouts can extend the overall wait. If still pending, Check Purchase
  Again remains available without encouraging another payment.
- An owner sees Download Full Game. Each click rechecks session/ownership and
  requests a fresh five-minute R2 link. The browser downloads the attachment
  directly; JavaScript does not fetch the entire executable into memory.
- The page says Download requested, not Download completed: check the browser's
  Downloads list. Expired sessions need sign-in; temporary errors allow retry.
- Download errors, offline checks and malformed responses never unlock access.
  Restricted accounts cannot download or buy through this UI.

The transient link uses no referrer. The bucket can stay private. This navigation
does not need bucket CORS; website-to-API requests still require Render CORS and
the real session cookie. Browser third-party-cookie policies between Vercel and
Render need testing in the intended browser.

## Local verification

```text
node --check download.js
node --test game-verify.test.js download.test.js
```

These are isolated production-script tests with a simulated DOM/fetch, not
real browser, R2, payment, installation or Unity runtime validation. They cover
cookie-only ownership, forged cached values, pending payment, fresh links,
restrictions, expiry/retry, double-clicks, timeout, Trial and patch-note toggling.

After backend/frontend deployment, test signed-out, non-owner and owner accounts
on the actual page. Use only the team's PayMongo TEST flow for this demo. Confirm
the download is the complete installer, then install/launch/uninstall and check
that Story saves remain. Verify profile ownership and existing game verification
still work. Backend docs include the expected installer SHA256 and error cases.

## Important limits

Five-minute links can be reused/shared until expiry. Downloaded installers can
be copied; this is not DRM. Never share a signed URL or S3 secret in screenshots.
No sensitive values are stored in website scripts.

Existing test and live payments currently use the same backend `owns_game` flag.
The integration preserves the team's demo behavior; test/live entitlement
separation and payment/refund auditing are required before a real paid launch.

Reference: [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
