# Profile preview and homepage trailer

The sign-out dialog now explicitly uses fixed positioning, inset zero, automatic margins and fit-content height. This restores centering after the shared universal margin reset and keeps long content scrollable inside small viewports. Existing confirmation and session-cleanup rules are unchanged.

The collapsed profile achievement preview shows up to six actually completed definitions, including completed entries later in the catalog. It never fills unused space with locked/reserved cards. Empty accounts/categories receive an explicit no-completed-achievements message. View all retains the full category-filtered catalog with locked details concealed; Show completed achievements restores the preview. Counts, authenticated progress, server-only proof validation, reward grants and synchronization frequency are unchanged.

The homepage's existing Watch Trailer link leads to the active YouTube player for Z1ijl2PwrlA. The old commented video/Coming Soon placeholder is replaced with a responsive, lazy-loaded player, no autoplay, fullscreen controls, inline mobile playback and a direct Watch on YouTube fallback. No third-party video is downloaded or re-hosted.

Validation: node --test achievements.test.js sign-out.test.js trailer.test.js transaction-history.test.js profile-store.test.js favicon.test.js

An isolated localhost browser fixture used the production CSS/modules and synthetic achievement records, not a real account. Desktop 1280x720 and narrow 390x844 viewport checks observed centered dialogs with zero center offset in their layout viewport, Cancel focus and no clipping. Three completed entries from the end of the catalog appeared in the preview; View all displayed all 71, and the empty snapshot displayed No completed achievements yet. The real supplied YouTube player loaded its correct trailer title/thumbnail and Play button without autoplay in the local homepage preview. Playback with sound and the final Vercel deployment remain user acceptance checks.

Merge/deploy this frontend PR, wait for Vercel Ready, then hard-refresh. No backend, database, payment settings, account/reward grants, game source or Unity build changes are included.
