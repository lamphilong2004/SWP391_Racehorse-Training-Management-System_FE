# CORE-036 — review handoff

Branch: `feat/CORE-036-vet-medical-groom-ui`.
Temporary base: `origin/feat/CORE-002-shared-design-system`, commit `9094a4f`.
At implementation time `origin/dev` was `6041b0a`; CORE-002 was not merged.
No commit, push, pull request or merge was performed. Backend source was read only.

## Implemented

- Veterinarian: searchable case list, incident review context, incident-prefilled case creation, case detail.
- Medical record sections: Record, Examination, Injury, Treatment, Recovery.
- Required-field validation, symptoms/diagnosis, severity, body region, optional complete finite x/y/z coordinates.
- Verified Figma schematic assets and selectable 2D body regions; coordinate metadata is independent of the schematic.
- Repeated medication and approved care-instruction editing, due dates and re-examination date.
- Recovery findings, case closure confirmation and closed-case editing protection.
- Groom: assigned treatment instructions grouped by horse, pending/completed filter, task details, completion notes and acknowledgement.
- Loading, empty, failure/retry, pending-save and successful-save states.
- Existing AppShell, tokens, Button, Card, Tabs, DataTable, fields, KeyValue and AlertBanner are reused.
- TextAreaField extends the existing Field control for clinical text; it is not a second design system.

## Routes

- `/medical`
- `/medical/cases/new`
- `/medical/cases/:caseId` (section tabs keep one case route)
- `/incidents` (Veterinarian review context only; incident creation and backend review transitions are not implemented)
- `/care/tasks/treatment`
- `/care/tasks/treatment/:taskId`

Route paths extend CORE-002's provisional route registry. Confirm with the missing sitemap before integration.
The Groom treatment route is separate from the unimplemented general Flow 4 care-task route.

## API and authentication

Medical mode is **mock**, with no backend medical persistence or draft HTTP calls.
`service.ts` is the isolated replaceable service boundary. `models.ts` separates draft DTOs from richer feature view models.
Real mode explicitly reports unavailable instead of silently falling back to sample data.

Use `.env.example`; set `VITE_MEDICAL_MOCK=true` only in development.
Production bundles do not enable mock mode. Mock changes are memory-only and reset after reload.
The browser first verifies `GET /api/auth/me`; no fake login, local-storage role or query-string identity is used.
`runtimeClient.loadMedicalRuntime(accessToken)` can receive a JWT from the future shared auth integration.
The current route wrapper uses an authenticated session request; CORE-008 must supply the shared JWT/runtime before end-to-end use.
`MedicalProvider` accepts the verified actor and service for composition and automated tests.
Tests use fixture identities only; they do not establish real authentication.

Mock fixtures assign two tasks to Groom ID 6 and one to Groom ID 99.
Only the current Groom's assignments cross the service boundary. A forged foreign task ID is rejected.
Veterinarian service writes reject other roles and inactive accounts. UI guards mount before medical queries.
Frontend/mock checks do not replace backend RBAC or row-level security.

Draft source: BE `origin/feat/CORE-006-flow3-medical-contract:docs/api/flow3-medical.openapi.yaml`.
Shared auth and permission matrix were read from BE Git references.
The contract explicitly remains unapproved. No backend endpoint or DTO was changed.

Draft operation mapping for future CORE-037 adapter:
- list/create/detail cases: `/api/medical/cases`, `/api/medical/cases/{caseId}`
- examination/injury/re-examination: corresponding case subresources
- treatment viewing/editing: case `/treatment-plan`
- closure: case `/close`
- incident context: `/api/incidents`
- assigned work list: `/api/groom/treatment-tasks`
- acknowledgement: `/api/groom/treatment-tasks/{taskId}/complete`
There is no invented task-detail GET; detail is selected from the already scoped work list.

## Design evidence and deviations

Live Figma design context and screenshots inspected:
- SCR-MED-002 case list: `268:1392`
- SCR-MED-003 medical record: `210:8958`
- SCR-MED-004 examination: `269:1483`
- SCR-MED-005 treatment editor: `270:1588`
- SCR-MED-007 injury location: `210:9145`
- SCR-MED-009 recovery: `271:1706`
- SCR-MED-015 Groom tasks: `252:843`

File: https://www.figma.com/design/tm7dpgAQbHReZ7tlQeQJlc/Racehorse-Training---Management-System--1-

Verified illustration assets are local in `assets/`; their root dimensions are retained.
The injury frame itself is a static prototype. No approved interactive 3D model was supplied; the functional body-region fallback is implemented.
Forms use supported draft fields. Attachments, medication dose/frequency/unit, veterinarian notes outside DTOs, task assignment/completion timestamps, availability and restriction decisions are not fabricated.
Plan instructions are not auto-assigned to arbitrary Grooms because assignment fields are absent from this draft.
Case statuses OPEN/CLOSED and task statuses PENDING/COMPLETED are simulator states, not approved backend enums.
The draft treatment read response lacks instructions/medications, injury reads lack coordinates, and case detail lacks aggregated histories. Rich mock view models must be reconciled with approved read projections.
The clinical editors are composed as case tabs; Figma's distinct page compositions are not claimed to match pixel-for-pixel.
No rendered browser screenshot or backend E2E/persistence verification was performed.

## Remaining dependencies

Workbook contains only Core Flow Execution. Task Playbook, Figma Screen Registry, Role Coverage Matrix and detailed DoD are missing.
CORE-002 and CORE-006 remain review dependencies. User explicitly authorized development on CORE-002 and draft-based mocks.
CORE-008 auth state, approved CORE-006 DTOs/state transitions/read projections, CORE-035 backend and CORE-037 integration are needed for real operation.
Restriction editing/lifting belongs to CORE-020/019 and is not implemented.
No baseline, incident backend, database schema, general Flow 4 or integration task was modified.

## Changed files

Existing: `src/app/routePaths.ts`, `src/app/router.tsx`, `src/layout/navigation.ts`, `src/design-system/index.ts`.
Added: `.env.example`, this handoff, `src/design-system/components/TextAreaField/TextAreaField.tsx`.
Feature additions under `src/features/medical/`:
`models.ts`, `service.ts`, `runtime.tsx`, `runtimeContext.ts`, `runtimeClient.ts`,
`MedicalForm.tsx`, `TreatmentPlanEditor.tsx`, `InjuryMap.tsx`, `bodyRegions.ts`, `pages.tsx`, `medical.css`,
`service.test.ts`, `runtimeClient.test.ts`, `pages.test.tsx`, and four local schematic SVGs.


## Verification executed

Final checks on 13 Oct 2026:
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, no errors or warnings.
- `npm test`: PASS, 69 tests across 7 test files (40 added CORE-036 tests).
- `npm run build`: PASS, 133 modules transformed.
- `git diff --check`: PASS.

Working tree: four tracked files modified, 21 new files; all implementation changes remain uncommitted.
Backend working tree remains clean on its original branch.
These results verify source and simulator behaviour; they do not certify approved-contract integration or pixel-perfect browser rendering.
