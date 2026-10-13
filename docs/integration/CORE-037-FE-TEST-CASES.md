# CORE-037 FE test cases

Current executable checks: `node --test scripts/core037/contract-check.test.mjs` checks source contracts and selected security invariants without mocks. `node scripts/core037/live-smoke.mjs` performs live HTTP checks only after FE, BE and test JWTs are supplied. Missing services or tokens exit 2 with `BLOCKED`; a successful contract check is not a live integration pass. The live script never prints JWTs. Its optional re-examination write requires `CORE037_ALLOW_MUTATION=1` and an isolated `CORE037_TEST_CASE_ID`.

| ID | Scenario / expected evidence | Current automation | Status |
|---|---|---|---|
| 01 | Active Vet reaches `/medical`, receives clinical case list | Live host and API GET | BLOCKED: no merged FE app or verified JWT resolver |
| 02 | Missing/expired JWT produces 401; wrong role produces 403 and safe UI state | Live missing JWT and role checks; expired JWT pending fixture | BLOCKED |
| 03 | Groom sees only server-assigned care tasks, without diagnosis/medication | Live safe projection and GET | BLOCKED: assignment adapter absent |
| 04 | Groom cannot read case or call Vet-only writes | Live case 403; write denial pending isolated fixture | BLOCKED |
| 05 | Incident list/detail links to numeric case ID and navigates correctly | Contract paths checked; browser route test pending merged FE | BLOCKED |
| 06 | HTTP methods, allowed payload fields, timestamps, empty completion body | Source contract test; real write pending | PARTIAL |
| 07 | Envelope, pagination, numeric IDs, enums, clinical/Groom projections map correctly | Source test; live list assertions when services available | PARTIAL |
| 08 | Loading, empty, invalid form, 401/403/404/409 and retry render safely | F36 mock tests are isolated only; real browser test pending | BLOCKED |
| 09 | Plan update and Groom task `PENDING→COMPLETED`, refreshing after update | Pending materialization/assignment decision and isolated fixtures | BLOCKED |
| 10 | `LIMITED/LOCKED` availability blocks training UI action and backend start | CORE-019 and training UI not merged | BLOCKED |
| 11 | Re-exam `NOT_RECOVERED/IMPROVING/RECOVERED`; recovery never auto-lifts restriction | Optional live POST/GET checks `IMPROVING` persistence; restriction check pending | BLOCKED |
| 12 | Reload after a real update preserves case/task state | Optional live re-exam POST followed by fresh GET; browser reload pending | BLOCKED |
| 13 | Cross-Groom task ID cannot be read or completed | Requires two assigned test accounts and task fixture | BLOCKED |
| 14 | No token leakage in logs, client actor identity rejected, safe backend errors | Script emits no token; source checks empty completion body; real negative tests pending | PARTIAL |

After CORE-002/036 merge, add Vitest tests for the production adapter and route behavior using explicitly labeled isolated mock responses. Add browser E2E tests using the project's approved tool once auth and services run. Live tests must use real FE and BE instances; do not promote mock tests to integration evidence. For restriction actions, assert both disabled UI controls and Backend 403/409 rejection with a test account. For cross-user scope, configure two Grooms with disjoint assigned tasks and check list, detail and completion denial. Use disposable case/task fixtures for writes.
