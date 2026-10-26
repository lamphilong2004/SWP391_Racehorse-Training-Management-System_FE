# Local demo fixes — 26 October 2026

Base: FE main `5710b2f0807aecc73812bcb63f8fb44b8a7db3bc`.
Branch: `fix/landing-session-guidance`. Backend main remains
`d7fcc3db31833476b0d35be054dd65f07a404785`.

## Findings and changes

| Area | Evidence and outcome |
| --- | --- |
| CORE-024 Rider selection | The selected candidate previously only assigned the same ID again. The button now toggles selection, clears the warning acknowledgement and displays an explicit deselect action. No selected rider still blocks progression. Real-browser select/deselect and validation verified; no session saved. |
| CORE-053 Notifications | Real notifications use `TRAINING_PROGRAM`; the existing link handler only recognized `HORSE_TRAINING_PROGRAM`. Both now resolve to the existing guarded route. Dates use the shared formatter. Notification title, time, body and actions wrap independently. Unread count remains server-backed. |
| CORE-033 Evaluation | Real results for sessions 1 and 3 returned 200. The session-3 detail link opened evaluation and displayed the persisted evaluation. The reported load failure was not reproduced. Nonterminal session details now expose the results/eligibility page with a distinct label; terminal-only submission remains enforced. |
| CORE-035 Medical | The list, case 1 and herd-health API returned 200; the real Vet browser opened all five case tabs and the herd-health view. The reported load failure was not reproduced. Forms now have aligned responsive fields, required semantics and full-width text areas. Case search/status filters explicitly affect only the loaded page, with clear/reset and truthful counts. |
| CORE-035 Case closure | Case 1 has a treatment plan, no re-examination, an incident still UNDER_REVIEW and an active LOCKED restriction. Its care task is completed. These are genuine remaining closure conditions, not evidence of a broken status selector. Known server refusals now have actionable Vietnamese explanations; unknown errors remain visible. A link leads to the existing restriction workspace. No close request or recovery/restriction mutation was performed. |
| CORE-010 Landing | Preserves the pending full-width landing fix from 24 October, including fluid hero sizing. |
| CORE-027/029 Session gates | Preserves pending per-session Groom guidance, localized blocking reasons, refresh and scheduled-start messaging. A check for another session cannot clear this session's gate. No business gate is bypassed. |

Date and time inputs in session creation have independent controlled state; the same existing datetime payload and validation remain. No API, authentication, RBAC, Backend source or database schema change is included.

## Verification

- Final affected suite: **180/180 tests, 18/18 files PASS**, one worker, 58.39 seconds. Covers Medical API/auth boundaries and retries, notification lifecycle, Rider selection, evaluation, session actions and Rider state.
- Additional Groom/precheck regression: **11/11 tests, 1/1 file PASS**, 4.37 seconds. Combined affected checks: 191 passing tests; these were two separate runs.
- An earlier run had three required-field label test failures. Explicit control labels corrected their accessible naming; no assertions, security guards or timeouts were weakened. A temporary test typing error was also fixed by using an anchored role-name matcher.
- TypeScript, ESLint, production build, production bundle isolation, **13/13 staging policy checks** and `git diff --check` passed. The complete repository test suite was not repeated.
- Real browser: Trainer notification links; select/deselect Rider with required validation; session-3 evaluation; Vet list, all case-1 tabs, close confirmation/cancel, herd-health and page-filter empty/reset states. No notification read, clinical save, session save or case-close action was submitted.
- Case form measured at 1440, 1024 and 390 pixels with document/main widths contained. No new console errors at port 5173; two historical Vite errors belong to the stopped port-5214 page. This is affected-screen verification, not exhaustive certification of every route, zoom or state.
- HTTP reachability: FE `/login` and BE `/api/health` both 200. Six authenticated diagnostic GET requests returned 200. Login/logout updates normal auth/audit metadata only.

## Running environment and limits

- FE: `http://localhost:5173` serves this feature branch, including these changes; it is not a claim that main has been updated.
- BE: `http://localhost:8080`, existing main JAR, strict JDBC TLS and JPA validate.
- Database: `racehorse_presentation_20261023`; existing records and SQL Server configuration preserved. SQL was started by the Leader.
- Old `localhost:5214` is not the active demo URL.
- The presentation database contains deliberately documented simulated operational scenarios. The runtime reads their real SQL rows; it does not fall back to sample fixtures.
- The original unspecified evaluation/medical load failure remains unconfirmed for other IDs or another database. Case 1 and evaluation 1/3 work in this environment. No broader Backend fix or successful medical transition is claimed.
- Local screenshots and sanitized diagnostics are retained outside the repository under `_gate-monitor/enterprise-v4`. Secret-bearing/private API payloads remain outside Git. Independent review and main merge are still required.
