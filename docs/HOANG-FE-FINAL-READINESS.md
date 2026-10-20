# Hoàng — FE final handoff (20/10/2026)

## Scope and integration base

This branch completes the Leader-approved final FE scope: CORE-022 Program List, CORE-041 minimum read-only Program Detail, CORE-031 Alert Detail and CORE-020 Threshold Override, together with the previously verified readiness fixes.

- Base: FE main `bfa814776d16e2b7cb054e5600714cd6382e1662`. The earlier delivery `a46f80d` and CORE-010 Landing already belong to main through Release PR #18. Do not merge/cherry-pick PR #14 again.
- Branch: `fix/hoang-fe-final-readiness`; PR targets FE `main`. Leader explicitly authorizes commit, push and PR creation. No merge or deploy.
- Contract: BE dev `5867f07`, `docs/api/flow2-training.openapi.yaml`, `flow2-stomp.md`, `flow3-medical.openapi.yaml`. Fetch confirms no API-contract change since the initial handoff.
- Shared v2 remains opt-in and is on a separate branch. This diff does not modify `src/design-system`, dependencies/lockfile, hosting configuration, Backend, OpenAPI, SQL schema or the Codex release candidate.
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
| Live integration | All HTTP operations and authenticated STOMP | BLOCKED_BACKEND / NOT RUN; awaits Leader's final live-test assignment. |

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
- Full suite: PASS 886/886 tests across 70/70 files, exit 0, 206.72 seconds. Command: `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1 --no-file-parallelism --isolate`. No assertions/timeouts or file isolation weakened.
- Lint and typecheck: PASS, exit 0.
- Production build and production bundle guard: PASS, exit 0; no sample/dev/test identity/local API origin bundled.
- Staging policy: PASS 7/7, exit 0.
- Diff whitespace check: PASS.
- Real Backend/SQL/authenticated STOMP: NOT RUN as instructed.

Logs are preserved in the workspace `project-context/HOANG-FE-GITHUB-tests.log` and `HOANG-FE-GITHUB-build.log`. Historical pre-fix logs from the previous pass are not final evidence.

## Remaining limits

No missing API blocks the three minimum surfaces requested in this follow-up. Live behavior, persisted SQL readback, JWT/RBAC/assignment enforcement, CORS/WebSocket origin and seeded-data integration await Backend online and Leader's final test assignment.

Unavailable data includes overall progress percentage, speed/workload analytics, warning threshold, current exercise/repetition, underlying global threshold while a horse override is effective, and any fields omitted by the server. More extensive CORE-041 template/adjustment management is not included. No merge, deploy or release-candidate edit is performed.
