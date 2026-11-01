# Account tool-skin previews

The website reads authenticated /api/skins and validates owner, currency/environment, stable tool/skin IDs, prices, ownership, equipment and monotonic revisions before showing Owned/Equipped. Unsupported or foreign data is unavailable, never guessed as unowned; stop/logout clears private skin state.

All ten current tool skins are drafts. The Store explicitly shows Preview, with no skin purchase/equip button or client-side credit. Actual skin unlocking/equipping is prepared in the matching game client, guarded by both server release state and approved client visuals. The canonical FM wallet, class ownership, FM handoff/checkout, session protection and manual Transaction History behavior are retained.

Deploy the companion backend first, then this frontend. No live keys, prices, balance/ownership reset, new dependency or content activation occurs here. DOM/parser fixtures verify preview counts, account-derived Owned/Equipped, logout clearing, foreign/late replies and malformed/stale loadouts; native-browser/hosted acceptance remains manual.
