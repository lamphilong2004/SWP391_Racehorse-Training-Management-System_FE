# UI defect follow-up — 24 October 2026

Base main:914ece5114e7ba45044ff77156bbd28ab01377d7. Continues the Account screenshot fix in PR28; preserves contributor commits. No Backend, schema, endpoint, auth, RBAC or workflow changes.

## Confirmed defects and fixes

| Surface | Reproduced defect | Correction / evidence |
|---|---|---|
| Account identity/password rows | Bottom-aligned filter layout shifts Full Name22px below Email with helper text; nested filter decoration inside form cards | Shared administration/account form grid aligns controls at top and stacks below767px; previous22px offset becomes0px |
| Staff identity/experience | Same filter class shifts Experience22px below Level; error text also changes alignment | Use the same form grid instead of the filter toolbar. Real Trainer edit screen has equal input tops with helper text and with an invalid-year error; temporary value restored, no Save |
| Trainer assigned programs | Fixed non-wrapping toolbar, including reset and count, overflows the available sidebar/card content width | Wrap at actual available width; reset button uses intrinsic width. At1440, main client/scroll widths1185/1198px become1185/1185px. Table remains independently scrollable |
| Horse / program creation result activation | Raw UTC timestamp displayed despite the existing local date/time convention | Reuse existing dateTime formatter and semantic time element; preserve original ISO in datetime/title. No instant, status or API data changed |

## Actual browser coverage

Baseline inspection:35 distinct authenticated paths,48 role/path combinations,99 viewport observations across all seven roles. Lists, dashboard entries, Horse creation/setup/detail, Owner tabs, staff edit, medical case/treatment and notification drawer were inspected read-only against the real local API. Three early medical snapshots were still loading; fully loaded case/treatment views were subsequently measured at all four widths instead of claiming those early snapshots passed.

Candidate follow-up:24 measurements across1440×900,1280×800,1024×768,390×844 on affected Account/staff/Horse/Trainer and completed medical views; no main/document horizontal overflow found. Login, forgot-password and landing add12 measurements across the same four widths. Native table-region horizontal scrolling is intentional; outer page overflow is not. Notification drawer fits390px; no read/reset-email/account/business mutation submitted.

Horse activation from SQL `2026-10-23T16:02:45.918Z` displays `23/10/2026 · 23:02` in this viewer timezone; the exact server instant is retained. Program creation-result rendering is covered with HTTP fixtures, not a new SQL program write.

Local evidence: _gate-monitor/enterprise-v4/ui-followup-before.json, ui-followup-after.json, ui-followup-public.json and screenshots. No credentials, tokens, cookies or private keys in repository evidence. Successful login/logout checks generate normal auth audit metadata; no business records were modified.

## Checks

-90/90 focused tests PASS across six actual test files: Horse application, staff UserPages, ProgramCreationPage, AuthProvider, assigned/supporting and evaluation/dateFormat.
-New assertions verify activation uses readable local date/time without losing the server instant. Existing validation and authorization assertions remain intact.
-Lint, TypeScript, production build, production bundle guard,16/16 policy checks and diff check PASS.
-No repeated full suite; prior main full990/990 remains historical evidence, not a full-suite claim for this follow-up.

## Limits and runtime

This is measured coverage, not certification that every alias, optional route, modal, browser zoom or failure-state combination is defect-free.125% zoom remains unverified. No missing Backend endpoint is replaced with mock success.

For visual verification only, the fix branch temporarily served5173 using unchanged real BE8080 and SQL. Official main is restored after testing; fixes become part of main only after PR review/merge. No cloud deployment or protection bypass.
