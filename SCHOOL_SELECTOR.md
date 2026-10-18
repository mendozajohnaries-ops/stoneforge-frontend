# Searchable Cavite school selector

Local implementation in the existing website; no new hosted Site or deployment. Payments remain on hold. Branch: codex/feature-cavite-school-selector.

## Behavior

- Shared school-selector.js / school-selector.css are used in signup and Edit Profile.
- Search by school name, acronym, campus, city or public/private label. Accent-insensitive search recognizes Dasmarinas as Dasmarinas with its original accented display.
- Choose an explicit campus using mouse/touch or Arrow Up/Down + Enter. Escape closes the results first; Tab leaves the picker without selecting.
- Results wrap long names and show campus, city and sector. The list expands inside the form rather than clipping under the dialog. Account Info displays the selected campus/city as well as the school name.
- Editing a selected label clears its ID; simply typing a Student school name is not a catalog selection.
- Student requires a selection unless keeping genuine pre-directory saved text unchanged. Teacher/Instructor institution is optional and may be typed; Regular User hides school and does not submit school changes.
- Directory failure shows Retry and does not fabricate choices or erase an existing school. Loading/late responses and logout are guarded.
- Selection is self-declared profile metadata, not proof of enrollment/employment and not an authorization role.

The backend returns 202 documented campus choices (193 private, 9 public) as of this implementation. Coverage is explicitly incomplete, particularly public schools. It does not certify current admissions or label every 2026 program a STEM strand. Missing schools must be reviewed with official evidence, not replaced by a different campus.

## Backend dependency

Deploy the paired school-directory backend before the frontend:
- GET /api/schools
- Canonical school_id support on signup and profile saves
- Campus/city metadata and saved_text versus institution_text distinction

The frontend ships no independently editable production school list. test-fixtures/school-catalog.json contains SYNTHETIC test entries only and is not fetched by application code.

## Checks

node --test game-verify.test.js download.test.js achievements.test.js profile-store.test.js school-selector.test.js

DOM/VM tests cover keyboard/mouse selection, duplicate school names, search, text-only rendering, preserved legacy school, typed institution role changes, outage/retry, late responses and script/ARIA wiring.

Before the interruption, the loopback synthetic preview was visually checked: NCST search showed separate Main/Dasmarinas and Imus campuses, keyboard selection saved the canonical profile, and a dropdown-clipping issue was found and fixed. After resuming, Work settings disabled browser access, so the latest full signup/mobile visual pass remains unverified. No real account, email, payment or production mutation was used.

Manual acceptance still needed:
1. Signup: Student must select; Teacher can leave blank or type institution; Regular hides school. Do not submit a real test signup without operator approval.
2. Search NCST, SPIST, ICA, a city and public. Same-name campuses remain distinguishable.
3. Legacy NCST remains until user selects a campus; Edit Profile save/reload preserves the selected campus.
4. Clear/edit a chosen label; Student save must reject unmatched text. New Teacher text must not become a Student directory choice on role switch.
5. Mobile portrait/landscape: list scrolls, names wrap, Save remains reachable, and no horizontal overflow.
6. Directory outage/retry: show clear state without clearing the school or offering arbitrary fallback choices.

The loopback helper in the sibling Unity repository, Tools/Validation/Preview-ForgeWebsite.cjs, serves synthetic data only. It must not be deployed with the public website.
