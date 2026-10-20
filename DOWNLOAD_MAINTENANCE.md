# Temporary download pause

Demo and Full Game buttons read **Under Maintenance**, are natively disabled in
HTML before JavaScript runs and display **Will unlock next week**. A notice
explains that issues found during testing are being fixed. Navigation, the trailer
and the rest of the website remain available.

`download-maintenance.js` is loaded before both download clients. Its release
policy defaults ON; missing policy also fails closed. Neither ownership responses,
sign-in state, payment-return parameters nor retry/finally handlers can reactivate
the paused actions. Cache-versioned script URLs reduce stale-client mixing.

The paired backend rejects new Demo/Full Game signed links and Full Game checkout
requests. Existing purchases and payment webhooks are preserved. A browser tab
opened before deployment needs this backend guard; a frontend-only pause is not
an access-control boundary. Previously signed links retain their original expiry.

The next-week wording is a manual release target, not an automatic unlock. After
fixed builds pass testing, reopen via a coordinated frontend/backend release.
Do not enable purchases while the replacement downloads are unavailable.

Validation:

    node --test game-verify.test.js download.test.js achievements.test.js profile-store.test.js school-selector.test.js tutorial-download.test.js

Legacy purchase/download tests explicitly select maintenance-off test fixtures;
maintenance-on and missing-policy fixtures verify no download/checkout requests,
native disabled state, no click handler, keyboard-safe HTML, unchanged patch notes
and no timer-based reopening. No live checkout/payment is created by these tests.
