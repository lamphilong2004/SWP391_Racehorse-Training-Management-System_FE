# Hoàng — FE final handoff (20/10/2026)

## Scope and integration base

This branch completes the Leader-approved final FE scope: CORE-022 Program List, CORE-041 minimum read-only Program Detail, CORE-031 Alert Detail and CORE-020 Threshold Override, together with the previously verified readiness fixes.

- Original base: FE main `bfa814776d16e2b7cb054e5600714cd6382e1662`. Updated against `f3676d142d617087892531cbe74cc1f91d0408d4` after the team merged PR #20/#21 during handoff. The earlier delivery `a46f80d` and CORE-010 Landing already belong to main through Release PR #18. Do not merge/cherry-pick PR #14 again.
- Branch: `fix/hoang-fe-final-readiness`; [PR #22](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_FE/pull/22) targets FE `main`. The Leader's subsequent Final Integration & Release instruction authorizes Hoàng to prepare, merge and deploy the FE release, retaining independent peer review. This supersedes the earlier no-merge/no-deploy instruction.
- Contract: BE dev `5867f07`, `docs/api/flow2-training.openapi.yaml`, `flow2-stomp.md`, `flow3-medical.openapi.yaml`. Fetch confirms no API-contract change since the initial handoff.
- The team's v2 foundation/finalization is now in main and is preserved. Shell chrome uses the team's v2 behavior; page content keeps its existing opt-in boundary. Compared with current main, this PR does not modify `src/design-system`, layout, dependencies/lockfile, hosting configuration, Backend, OpenAPI, SQL schema or the Codex release candidate. Only `docs/RELEASE-RC1-UI-GAPS.md` required content-conflict resolution; both source/ownership evidence and updated screen statuses are retained.
- CORE-041 expanded template/adjustment management remains after this minimum detail delivery. CORE-050/054 are not expanded.

## Routes and delivered behavior

DONE below means the authorized FE implementation and local regression coverage; every real Backend/SQL/STOMP check remains pending.

| CORE | Route / surface | FE status |
| --- | --- | --- |
| 015 | `/horses/:id/baseline` | DONE accepted baseline/initial weight-health slice. No unsupported actor/time fields sent. |
| 020 | `/medical/restrictions`, `?horseId=:id` | DONE restriction editor/read-only scope plus Vet threshold management. |
| 022 | `/training/programs`, `/training/programs/new` | DONE approved list/create flow. Missing list summaries and horse analytics remain unavailable. |
| 041 minimum | `/training/programs/:id` | DONE read-only Program/Horse/Trainer/status, pinned template/version, phase dates/objectives/intensity/workload, Progress and History. Existing List and Assigned Programs links enter the actual page; creation success also links here. |
| 025 | Trainer `/dashboard`, `/training/schedule/session/new`, `/training/session/:id` | DONE accepted dashboard/session flow, including corrected nested Groom pre-check read. |
| 031 | `/training/monitoring?sessionId=:id`, Alert Detail modal | DONE minimum metrics/actions/detail interface. Warning threshold, exercise/repetition and unsupported analytics stay unavailable. |
| Live integration | All HTTP operations and authenticated STOMP | BLOCKED_BACKEND / NOT RUN; authorized, but a verified released Backend and test-account handoff are not available. |

Program Detail keeps the existing five-role route boundary. Progress/History are read on demand only for HEAD_TRAINER, TRAINER and CLUB_MANAGER. Veterinarian/Groom retain overview access and see an explicit unavailable state for the restricted tabs, with no forbidden request. Backend still enforces Trainer assignment scope.

Alert Detail renders current REST/STOMP alert values and server severity. WARNING stays transient with no persisted ID or acknowledge request. Critical acknowledgement is limited to Trainer/Vet using the existing API. Sparse acknowledgement/escalation events preserve recorded value/threshold/time and update the open detail. Missing data is not inferred.

Threshold Override is mounted only for Veterinarian on a selected horse. It loads the effective HEART_RATE threshold; positive values up to 99999.99 bpm and two decimals are accepted. Effective times are explicit, reason length is bounded to 1000, and END cannot precede a returned effective start. PUT and END require a separate review/confirmation before sending. Pending actions prevent duplicate submits; errors retain the draft; confirmed operations reload GET. A missing global default is never replaced with a constant. Clearing the input does not silently end an override.

## Figma and validation limits

Live Figma file: `tm7dpgAQbHReZ7tlQeQJlc`.

- Program List `77:317`; Program Detail Overview/Progress `78:288` / `79:288`, History `80:423` (contract fields), Trainer entry `96:286`.
- Alert Detail `156:7383`; paused monitoring `155:7089`; base monitoring `151:6627`.
- Threshold Override `272:1791`; restriction editor `210:9332`.
- Existing baseline `273:1805`, Trainer Dashboard `94:286`, session wizard `101:286` and Session Detail `147:5976` retain their accepted layout.

Live frames and source were inspected. Existing `docs/evidence/hoang-main-flows/` screenshots belong to the original delivery; they are not screenshots of this new branch. No new complete browser visual-fidelity Gate or real Backend E2E is claimed. Shared AppShell/Modal/Tabs/Card/fields/badges/tokens are reused. Analytics, scores, progress percentages, warning formulas and reduced-intensity APIs are not invented.

## API bindings ready for the final live test

All entries in this table await real Backend verification. Client wiring and fixture regression success do not establish live API PASS.

| CORE | Approved operations connected |
| --- | --- |
| Shared | Canonical `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`; protected calls carry Bearer JWT and canonical expiry/deactivation handling. |
| 014 | `POST /api/horses/{id}/baseline-examinations` with weightKg/healthStatus/optional clinicalNotes. Standalone GET/POST `/weights` clients remain client-only; no periodic weight screen was added. |
| 019 restriction | GET `/api/medical/restrictions?page=…&size=100`; GET `/api/horses/{id}/training-availability`; POST `/api/horses/{id}/medical-restrictions`; PUT `/api/medical/restrictions/{id}/exercise-rules`; POST `/api/medical/restrictions/{id}/lift` with `{}`. |
| 019 threshold | GET and PUT `/api/horses/{horseId}/medical-thresholds`; POST `/api/horses/{horseId}/medical-thresholds/end`. PUT sends only metricType=HEART_RATE, thresholdValue, effectiveFrom, optional reason. END sends only effectiveTo. |
| 021 list/create | GET `/api/training-programs`, `/api/program-templates`, `/api/program-templates/{id}?versionNo=…`, horse template/trainer recommendations; POST `/api/training-programs`. HT list is not restricted with assignedToMe; Trainer list is server-scoped. |
| 021 read-only detail | GET `/api/training-programs/{id}`, `/{id}/progress`, `/{id}/history`. No new management or template mutation. |
| 024 | GET `/api/exercises`, `/api/training-sessions?from=…&to=…`, `/api/training-sessions/{id}`; POST suitability-check, work-rider-recommendations and training-sessions using their distinct approved DTOs. |
| 030 REST | GET `/api/training-sessions/{id}/result`; POST session pause/resume (bodyless), stop (`reason, medicallyRelevant:false`), and `/api/monitoring-alerts/{id}/acknowledge` (`action:ACKNOWLEDGE`). Alert Detail needs no new GET-by-alert API. |
| STOMP | WebSocket `/ws`, JWT in CONNECT Authorization; subscribe-only session metrics/alerts/state topics. REST reload before connection/reconnect, heartbeat/error/cleanup preserved. No shared notifications subscription or SEND. |
| Existing support | Horse list/profile/activation-status reads retain the approved paths. |

Medical list pagination uses page/size/totalElements rather than Flow 2 totalPages. ALLOWED/PROHIBITED are preserved. Missing rule reads cannot clear server rules. Partial restriction create/rule-write failure preserves the restriction ID. 400/409/network errors remain visible; failed saves retain drafts. No runtime sample fallback.

## Final integration and release checkpoint

Checked after the Leader's release delegation on 20 October 2026:

- FE main remains `f3676d142d617087892531cbe74cc1f91d0408d4`. PR #22 implementation/integration HEAD `2276ff5b94a85c9e9510bf77a30f594838292880` is pushed and mergeable, but GitHub reports `REVIEW_REQUIRED` / `BLOCKED`, with no submitted reviews. A review request has been sent to `minhduc1204`. Repository auto-merge is disabled; this account has push permission and no administrative permission. No self-approval, protection change or forced merge is attempted.
- GitHub's Vercel status on FE main is successful: [deployment 4Gp1HSKYStGnrtngF1RDDhoSXtqy](https://vercel.com/lamphilong2004s-projects/racehorse-official-fe/4Gp1HSKYStGnrtngF1RDDhoSXtqy). The public [Production site](https://racehorse-training-management.vercel.app/) passes a read-only static smoke: 16 SPA documents, 82 linked JS/CSS/font assets, and four expected 404 responses (`/api/health`, `/.env`, `/package.json`, missing asset). Landing and Login render in the browser; anonymous Program Detail redirects to Login. These checks establish hosting behavior only. The public alias's exact source SHA could not be independently confirmed through Vercel because its dashboard requires sign-in and no Vercel CLI/session is available here. No new cloud deployment or environment change has occurred.
- BE main remains the initial `89991c1281edd8f2421b5ee57d6e1a283a70683d`. BE dev remains `5867f07ad521f2862eb80d5aa85c0bd615826855`. [BE PR #25](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/pull/25) and the API feature PRs are still open. The inspected candidate does not change the approved Flow 2/3 contracts used here. No verified Render API origin, deployed API SHA, readiness result or business test accounts were available for this FE handoff. Do not label the candidate's local/H2 checks as live SQL/API evidence.
- Old Medical/Groom PR heads are not all ancestors of main, but main already contains the replacement delivery through PR #16 (`778d279`), including Medical form validation/cancel controls and actor-keyed Groom access. Do not merge the older PR #8/#5 wholesale over that implementation.
- Unsupported fields remain unavailable. No extra CORE-041 management, CORE-050/054, Backend, schema, shared v2 or release-candidate change is included.

Release continuation is operationally blocked by independent review and the Backend/hosting handoff, not by missing Leader authorization. After Đức approves the final PR revision, re-fetch main, inspect the combined diff and merge with an ordinary merge commit to retain all authors' history. If main changes, repeat the affected checks before merging. Use the existing Vercel project only. Once Dũng supplies a verified HTTPS API origin and release SHA, configure `VITE_API_BASE_URL` for the intended environment, verify exact FE-origin CORS and `/ws`, then run real login/me/logout, seven-role/assignment denials, the three flows and persisted readback with approved demo accounts. No credentials belong in GitHub or FE config. A static deployment or fixture test alone cannot satisfy this gate.

Keep the last verified Production deployment available. A broken asset/deep link, invalid sign-in/role boundary, fabricated success or data-loss defect stops release acceptance; use the existing Vercel rollback and a normal revert PR for source correction, preserving Git history. No rollback is executed in this checkpoint.

## Changes included from the previous local pass

1. Replace the approved CORE-022 Program List placeholder with real typed reads, paging, status filter and existing wizard navigation.
2. Fix restriction lookup after page zero using medical totalElements; malformed metadata raises an error.
3. Read `preSessionCheck.overallResult` in Session Detail; missing data stays unavailable.
4. Add approved Trainer Resume POST with status/medical guards and server reload.
5. Preserve simulated alert labels even before a metric arrives; preserve severity and sparse alert updates.
6. Show Reason unavailable for LIMITED/LOCKED when the server omits the reason.
7. Replace the required Program Detail placeholder, add Alert Detail and Vet threshold confirmation UI; update readiness/coverage/release-gap documents.

## Verification

- Focused route/feature regression: PASS 54/54 across six files, including list/assigned navigation, JWT, role boundaries, deferred reads, API failures, threshold validation/confirmation/DTOs, Alert Detail severity/acknowledgement/sparse STOMP updates.
- Final after main/v2 integration: full suite PASS 922/922 tests across 74/74 files, exit 0, 236.77 seconds. Before integration the feature branch also passed 886/886 across 70 files. Command: `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1 --no-file-parallelism --isolate`. No assertions/timeouts or file isolation weakened.
- Lint and typecheck: PASS, exit 0.
- Production build and production bundle guard: PASS, exit 0; no sample/dev/test identity/local API origin bundled.
- Current-main staging/design-system policies: PASS 18/18, exit 0 (earlier base: staging 7/7).
- Diff whitespace check: PASS.
- Real Backend/SQL/authenticated STOMP: NOT RUN / blocked by the handoff above. The latest Leader instruction authorizes these checks once the required environment is available.

Final integrated-main logs are preserved in workspace `project-context/HOANG-FE-GITHUB-main-v2-tests.log` and `HOANG-FE-GITHUB-main-v2-build.log`; earlier feature-base logs are `HOANG-FE-GITHUB-tests.log` and `HOANG-FE-GITHUB-build.log`. Historical pre-fix logs from the previous pass are not final evidence.

## Remaining limits

No missing contract blocks the three minimum surfaces requested in this follow-up. Live behavior, persisted SQL readback, JWT/RBAC/assignment enforcement, CORS/WebSocket origin and seeded-data integration await a verified Backend release and demo-account handoff.

Unavailable data includes overall progress percentage, speed/workload analytics, warning threshold, current exercise/repetition, underlying global threshold while a horse override is effective, and any fields omitted by the server. More extensive CORE-041 template/adjustment management is not included. No merge, deploy or release-candidate edit has occurred at this checkpoint; merge/deploy authorization is recorded above.
