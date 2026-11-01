# Game Store package handoff

Deploy the companion backend first, then this frontend. The dashboard accepts only a bounded opaque `#forge-handoff=<UUID>` fragment. It checks the server cookie account and server-owned context before selecting the package. Login preserves that validated return destination; explicit logout still clears the session and redirects normally.

The package is preselected in the existing Store confirmation. Another account, invalid/expired context, altered package/price, or invalid response blocks checkout. A pending checkout reuses the original request key/link. Processing remains blocked pending verification; completion is backed by ledger proof rather than the return URL. Nothing credits a browser/local balance. The existing sandbox disclosure is preserved.

After a confirmed game payment, Back explicitly returns to ordinary Store browsing and removes the completed context from the address. Ordinary website repeat top-ups check their previous owner-bound request before replacing a completed/expired key; uncertain orders are not automatically replaced. Transaction History remains manual-refresh and logout/ownership protections remain active.

Native browser/hosted acceptance: select all four packages in game; sign in/re-login and compare the selected FM amount/price; try a different account; cancel; test a pending and completed return; verify duplicate/retry behavior and a second explicit purchase. Actual hosted provider/Mongo and two-device behavior require this manual acceptance. Automated tests use deterministic DOM/session and fake HTTP boundaries.
