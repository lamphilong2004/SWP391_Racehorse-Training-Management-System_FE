# Program wizard — Trainer selection

User report: Step 6, choose a Trainer, then Continue fails during the morning demo. The exact historical UI message was not captured, so the cause below is a reproduced defect consistent with that report, not a claim to have recovered the morning browser trace.

## Reproduction and correction

The template copy initializes trainer.effectiveFrom to an empty string. Selecting a candidate previously set only their id and reset warning acknowledgement/reason; it did not supply the required assignment date. Continue therefore failed local validation before POST /api/training-programs. A regression test failed with an empty date where the program start was expected.

- Choosing a Trainer now defaults an empty assignment date to the program start. Explicitly entered dates are preserved.
- Clicking an already selected Trainer is a no-op, so it cannot erase the reason or an acknowledged warning.
- Warning acknowledgement remains explicit and mandatory. Hard blocks, RBAC and all existing payload fields remain unchanged.
- A missing/invalid assignment date names the actual field in Vietnamese.
- If validation finds a field from an earlier wizard step, navigation returns there without discarding the draft. This also covers a program start becoming past after Vietnam midnight.

## Verification

- Before fix: focused regression failed because the assignment date remained empty.
- After fix: 35/35 tests, 4 files PASS (wizard/router/auth HTTP fixtures, draft validation, hook and adapter). Tests include manual dates, duplicate candidate clicks, warnings, midnight, no premature POST and normal program submission.
- TypeScript, ESLint, production build, production-bundle isolation and git diff --check PASS.
- These are fixtures, not a new browser-to-SQL program-creation E2E. No business records were written for this fix. No Backend business source, SQL schema or data changed.

## Local runtime

At verification time port5173 served TrekLink Operations Platform from the separate capstone project, while Racehorse BE8080 was not running. SQL Server was Running. No unrelated process was stopped.

The existing Racehorse Backend was started on8080 using the unchanged strict-TLS presentation configuration. The new FE build is served at http://localhost:5214/login. Both FE identity and proxied health were verified. The browser was opened at that login page; authenticated Step6 was not re-run in the browser.

The local startup helper now validates the Racehorse title and JSON health envelope instead of treating any HTTP200 as the correct app. It supports -FrontendPort5214; CheckOnly correctly rejects TrekLink5173 and accepts Racehorse5214. Default5173 is preserved and occupied ports are not terminated.

Source branch: fix/ui-ux-polish, base HEAD d47acf9. Fix remains uncommitted for review; no push, merge or cloud deployment.
