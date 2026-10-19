# CORE-022 — Program Creation UI and API delivery

Branch: `feat/CORE-022-program-creation`. Target: `dev`.
FE base fetched and merged without reset/force: `f7c290d100c77ba6d33cf781aed9102f73c8a1bc`.
Published author-verification revision: `26aad8db815a72565ad7970451acc745dde4962a`.
Earlier adapter/state slice: `5b7e0bbaa1836bfe760ca5c1d083d2a565cb543c`.

**LIVE INTEGRATION NOT VERIFIED.** All verification below uses test-only HTTP fixtures.

## Working flow

Head Trainer workspace → **Create program** → `/training/programs/new`:

1. Search/page ACTIVE horses; view profile and AVAILABLE/LIMITED/LOCKED state. LOCKED choices are disabled.
2. Review the horse's real profile fields and availability. Missing values are shown as not provided.
3. Select an ACTIVE template from recommendations/catalog, then pin a returned version. Trainer candidates use the
   actual version ID, not the display version number.
4. Customize a separate draft: name, goals, program period, target metrics, notes and source-derived phases.
   Edit phase order/name/dates/objective while retaining the source phase lineage.
5. Set optional per-phase intensity min/max and workload. Template text guidance stays read-only.
6. Select a Trainer candidate, set effectiveFrom/reason, and explicitly acknowledge its warnings.
7. Review → validate → POST `/api/training-programs` → show the returned program ID/status/summary.
   **Reload saved program** calls GET `/api/training-programs/{id}`. Success stays on the existing route.

The UI reuses `useProgramCreation`, draft/adapter and canonical Design System controls/AppShell. The optional
`RequireAuth.allowedRoles` permits HEAD_TRAINER and prevents other roles from mounting the feature/loading its data.
Existing RequireAuth consumers retain their behavior. A multi-role user qualifies if any role is HEAD_TRAINER.

## Transport and correctness

- `useProgramCreationApi` binds canonical `requestApi`, `authSession` and `useAuth().handleApiError`. Login and program
  requests share `VITE_API_BASE_URL` (existing default `http://localhost:8080`). No extra provider/token store,
  feature API base, automatic retry, runtime fixture import or mock fallback.
- 400 details map to fields, including `phases.0.name` / `phases[0].name`, and return to the matching step.
  409 displays the BE message and detail reasons. Errors preserve the draft for correction/manual retry.
- 401 and the existing inactive-account 403 signature use shared session handling. Other 403 errors retain the
  session. No new error codes or deactivation heuristics.
- Validate required fields, schema lengths, calendar dates, program period, phase containment/non-overlap,
  intensity enums/range and Trainer warnings. BE remains authoritative for lifecycle, LOCKED reasons, current
  template/Trainer state, permissions and the create transaction.
- Horse/template/version changes clear dependent draft/phases/Trainer selection. Selection/catalog requests abort
  and ignore late responses. A synchronous submission guard prevents overlapping POSTs; success removes the form.
- Explicit serialization sends only CreateProgramRequest fields: no generated phase IDs/status, template mutation,
  race, separate targetDate or program phase surface.
- Native labeled controls, keyboard-operable buttons/selects/checkboxes, field error associations and heading focus
  on step/error transitions. No custom keyboard protocol.

## Sources and approved mapping

CORE-005 read from BE `origin/dev` at `8b2e22a2aee710cc2ac9b3d1c372cb444ac9e21a`:
[flow2-training.openapi.yaml](https://github.com/lamphilong2004/SWP391_Racehorse-Training-Management-System_BE/blob/8b2e22a2aee710cc2ac9b3d1c372cb444ac9e21a/docs/api/flow2-training.openapi.yaml).
It matches the earlier CORE-005 branch source. Horse selection also uses previously read CORE-004
`flow1-horse.openapi.yaml` at `ac4e3a0`.

Figma file `tm7dpgAQbHReZ7tlQeQJlc`, SCR-TRAIN-003 wizard. Design context/screenshots read for all bodies:

| UI step | Frame | Body/content read | Implementation |
| --- | --- | --- | --- |
| Horse | `84:286` | `84:374` / `84:423` | Catalog, selected HorseCard, availability |
| Profile | `87:684` | `87:688` / `87:698` | Real profile fields and availability guidance |
| Template | `87:1188` | `87:1192` / `87:1202` | Recommendations, catalog, version pinning |
| Customize | `88:286` | `88:290` / `88:300` | Program fields, independent phase edits |
| Workload | `88:764` | `88:768` / `88:778` | Intensity range, workload, source guidance |
| Trainer | `90:415` | `90:419` / `90:429` | CandidateCard, effectiveFrom, warning acknowledgement |
| Review | `91:299` | `91:303` / `91:313` | Summary/edit actions, availability, activation |

[Open Figma wizard](https://www.figma.com/design/tm7dpgAQbHReZ7tlQeQJlc?node-id=84-286).

Leader's scope decision on 2026-10-17 removes Target race, separate Target date and program phase preferred surface.
They are not encoded into notes, targetMetrics, workload or periodEnd. periodStart/periodEnd remain the program period.
No template authoring, business dashboard, unsupported performance charts/data or mobile expansion.

**Missing source:** the actual Task Playbook has not been found. The execution workbook is not the Playbook. Leader
authorized this scope with CORE-005/Figma; this handoff does not claim full Playbook/DoD review.

## Author verification — published CORE-022 code, 2026-10-17

| Check | Result |
| --- | --- |
| `vitest run --maxWorkers 2` | **128/128 PASS**, 13 files, 27.66s |
| `npm run lint` | PASS, no warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, 153 modules |
| `git diff --check` | PASS |
| Chrome 155.0.8059.41, 1440×1000, production preview | Workspace → wizard → one POST → result 1001 → GET read-back PASS; no page/console/request errors |

The 128 tests are author verification of the source published at `26aad8d`, not Independent Gate or live BE evidence.
They include merged dev, not the old adapter HEAD or a separate combined branch. HTTP fixtures exercise the actual router/AuthProvider/requestApi: Head Trainer full flow/payload; six other
roles blocked before feature requests; horse/template/version invalidation; late template response; phase/intensity
validation; warning acknowledgement; duplicate submit; 400 field errors; 409 reasons/details; network/permission
retry; expired/inactive session handling; forbidden payload fields.

Screenshots use fixture data only:

The screenshots were refreshed against the production build so bundled font assets load without the local dev
server's node_modules-junction allow-list restriction. No application source changed after the final code checks.

- [Horse selection](evidence/CORE-022/01-horse.png)
- [Customize](evidence/CORE-022/04-customize.png)
- [Trainer](evidence/CORE-022/06-trainer.png)
- [Review](evidence/CORE-022/07-review.png)
- [Created result](evidence/CORE-022/08-created.png)

These results do not prove live E2E integration, persistence, actual candidate availability or a live transaction.

## Router overlap

Current comparison source: **clean CORE-036 PR #8**, `51525af2065041d336ec52d6f6b6d0329e8106c9`.
Files overlapping CORE-022 are `src/app/RequireAuth.tsx`, `src/app/routePaths.ts`, `src/app/router.tsx` and
`src/app/router.test.tsx`. There is no Design System/navigation conflict evidence from this clean branch.

Actual composition was performed in separate worktree `CORE-022-integration`, branch `integration/CORE-022-033-036`,
from dev `f7c290d` + CORE-022 `26aad8d` + CORE-033 `324d51126745ae1f8d9121d939ff93076c004cdb` + PR #8 `51525af`.
Both feature merges conflicted in router.tsx/router.test.tsx. Resolution keeps all feature routes and their production
route-list assertion. RequireAuth/routePaths merged automatically: CORE-022 allowedRoles and CORE-036 post-login
return behavior are retained. One canonical AuthProvider, API base and token store remain. No feature code from
CORE-033/036 is added to the CORE-022 PR. See the separate integration handoff for combination checks/patches.

## Live smoke prerequisites

Endpoint-by-endpoint implementation gaps and concrete requests for Tiến/Dũng are in
[CORE-022-BE-endpoints.md](CORE-022-BE-endpoints.md). BE dev has no wizard implementation. Demo-only implementations
were inspected and have incompatible DTOs; they are not treated as the approved implementation.

Live probe executed: GET `http://localhost:8080/api/health` and GET `/api/auth/me` both failed with
`No connection could be made because the target machine actively refused it. (localhost:8080)`.
Login/create/read-back/DB persistence/LOCKED/template immutability have therefore not been verified live.

Missing external inputs: a contract-compatible endpoint implementation/runtime URL/CORS; safe local Head Trainer account; seeded ACTIVE horses,
ACTIVE template/version/phases and Trainer candidates; restriction/warning scenarios and another-role account.
Set `VITE_API_BASE_URL` in ignored `.env.local` and restart Vite. Enter credentials locally; no passwords/tokens in
committed files, PR text, screenshots or chat.

When supplied: login → GET /me → refresh/restore → Head Trainer workspace → wizard → POST → GET read-back
→ forbidden/expired/inactive scenarios → logout. Verify persistence, pinned version/lineage/assignment and current
availability enforcement. POST /api/auth/logout returns 204; verify local cleanup. A server logout failure must
remain reported as unconfirmed by shared auth.
