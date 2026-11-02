# UI/UX review — 2026-10-29

Status: fixes implemented in the local `feat/flow4-local-review` worktree and rebuilt at http://localhost:5214. Backend, API contracts, RBAC and business records were not modified in this UI batch. Authentication during browser verification updates normal login/audit metadata.

## Findings fixed

| Finding | Change | Verification |
|---|---|---|
| Inventory primary action filled the whole content width | Content-width action aligned at the list header; clearer primary/secondary form actions | Real browser button bounds and screenshots |
| Loading or failed task/inventory requests could also show zero/empty results | Render counts and empty tables only after a successful resource load | Regression test; explicit browser network-abort and real retry |
| Save feedback disappeared when the editor closed | Confirmed success message belongs to the parent workspace and survives editor unmount | Focused save test; no success message before API confirmation |
| Cancel, route changes or switching records could discard input silently | Reuse the shared unsaved-changes guard and confirmation modal; block in-page record switches until the current editor closes | Unit and real browser cancel/navigation checks |
| Stock actions lacked an explicit close action | Add Close ledger with dirty-input confirmation; prevent conflicting inline editors | Real browser check, zero business submissions |
| Long instructions used a single-line control | Shared multiline fields for care instructions, plan notes and movement/request reasons | Form regression and visual inspection |
| New inline editors could open below the viewport unnoticed | Focus and reveal the editor heading; retain input focus while editing | Real browser form inspection |
| Required text inputs lacked the shared visual required mark | Forward `required` to Field and keep accessible labels consistent on input/textarea controls | Shared-component tests and seven-role form render checks |
| Evaluation displayed raw surface/intensity codes and English repetition units | Use shared Vietnamese labels; keep wire values unchanged | Evaluation regression and actual Trainer page |
| Medical review dates displayed raw ISO strings and examination severity codes | Reuse the existing calendar-date formatter and code labels | Medical regression and actual Vet case/tabs |
| Flow 4 conflicts/date/assignment errors remained English | Translate exact fixed server strings only; preserve arbitrary user-entered notes | Display-text tests; no server contract or rawMessage changes |
| Workspace links did not indicate the active section | Add aria-current and the shared active-link visual treatment | Browser screenshots |

## Actual verification

- Before and after: 49 role/route combinations across all seven roles. No observed page overflow, unnamed visible buttons, unlabelled visible form controls, page errors or failed API reads in either audit. This is a representative audit, not an exhaustive examination of every possible state.
- 92 focused tests pass in two runs: 64 UI/shared/evaluation/medical tests and 28 program-creation regression tests. No full suite was run. Assertion/security checks and timeouts were not weakened.
- Lint, TypeScript, production build, bundle isolation and git diff check pass.
- Seventeen additional real-browser UX checks pass: confirmation/route guards, explicit stock-panel closing, three editor widths (1280/1024/390), calendar dates, Vietnamese evaluation labels, five Medical tabs and actual SQL-backed retry.
- The error-state browser check deliberately aborts one GET to simulate network failure. It never returns a fake success or fake business data. It is recorded separately from real Backend behavior.
- Browser checks made zero non-authentication business writes. No migration, seed, database reset or cloud action occurred.

## Evidence and limits

Private evidence directory: `.preview-local/flow4-review/` at the shared workspace root. Before/after route evidence: `ux-audit-before.json`, `ux-audit-after.json`. Interaction evidence: `ux-interactions.json`. Screenshots have `ux-before-*` and `ux-after-*` names; credentials, JWTs and Authorization headers are not included.

A decimal-entry probe displayed `.25` after typing `0.25`; the numeric value was preserved. It was not classified as a data-corruption bug. One initial interaction run timed out without a confirmed cause; the subsequent instrumented run completed all seventeen checks. No app or timeout rule was changed to conceal that attempt.

Unknown backend/user-provided text remains unchanged. Performance with large histories, complete keyboard/screen-reader coverage, every tab/modal across every role and native browser-toolbar zoom remain outside this audit. No WCAG certification or Independent Gate approval is claimed.

Source remains local/uncommitted. Main and contributor histories are preserved. Refresh the local browser to load the new build; source approval and any commit/push/merge are separate from this UI review.
