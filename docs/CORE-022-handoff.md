# CORE-022 — Program Creation, contract and state slice

Status: In Progress. Base: FE dev `501ae112c6ef8f578cb681a228fb13a28af9ea7d`.

## Implemented

- Feature DTOs and endpoint adapter for ACTIVE horse/template lookup, template recommendations, explicit version reads,
  Trainer candidates for the pinned template version ID, and `POST /api/training-programs`.
- `copyTemplateForHorse` copies supported fields and phase lineage into an independent draft. It does not derive dates
  or intensity enums by parsing the template's textual guidance, and never writes a template endpoint.
- Validation covers selections, schema lengths, calendar dates, phase dates inside the program, non-overlap, ordered
  intensity range, Trainer selection and candidate warning acknowledgement. BE remains authoritative for lifecycle,
  availability, permissions, and transactional checks at submission time.
- `useProgramCreation` supports horse → template/version → draft edits → Trainer → validate → submit. It exposes
  `created`, `error`, field `issues` and `pending` for a UI host. Changing horse invalidates old template requests;
  creation is guarded against duplicate submissions.
- Explicit payload serialization excludes UI-only fields, generated phase IDs, status, target race and surface fields.

## Runtime binding

`createProgramCreationApi` requires an authenticated `ProgramTransport`. The transport accepts `(path, RequestInit)`
and returns the unwrapped CORE-001 envelope `data`, rejecting with the app's existing API error on failure. Bind the
shared auth `requestApi` at the host and pass its errors to `useAuth().handleApiError` so 401/deactivation handling
stays centralized. No transport, mock data, test credentials, or fallback mode is created implicitly by this feature.

The CORE-008 transport is on a separate review branch; this CORE-022 branch starts directly from dev and does not
copy or merge that implementation. Network binding, rendered UI, route registration and live BE calls are pending.

## Sources read

- CORE-005: `docs/api/flow2-training.openapi.yaml` at BE
  `bbe3677b24c04d8d708483f72b7927fb448961f4` (`feat/CORE-005-contract-flow2`).
- CORE-004 horse list: `docs/api/flow1-horse.openapi.yaml` at BE `ac4e3a0`.
- Execution workbook: local `project-context/Racehorse_Core_Flow_Execution.xlsx`, sheet `Core Flow Execution`, CORE-022
  row. This is execution ownership evidence, not the Task Playbook. The actual Playbook was not found locally or in a
  connected document session; its canonical link/path was requested before implementing the UI.
- Live Figma file `tm7dpgAQbHReZ7tlQeQJlc`, section `457:10853`, SCR-TRAIN-003 wizard:
  S1 `84:286`, S2 `87:684`, S3 `87:1188`, S4 `88:286`, S5 `88:764`, S6 `90:415`, S7 `91:299`.
  Design context/screenshots were retrieved for S3 body `87:1202` and S4 body `88:300`; remaining bodies need design
  context before their UI is implemented.

## Source differences requiring confirmation for the UI

S4 still displays Target race/Target date and per-phase preferred surface. CORE-005 explicitly hides target race
(DEC-007 §3.3); `ProgramPhaseInput` has no surface field, and `CreateProgramRequest` has no separate target-date field.
The adapter omits these fields and does not encode them into `targetMetrics`, notes, or workload as a workaround.
Use the Task Playbook and approved scope to settle the UI mapping before adding those controls.

The shared TextAreaField support revision `da1ed9a` is separate from dev. UI work should reuse its canonical export
when available rather than add another local textarea implementation.

## Verification

- Full feature/base suite: 86/86 tests PASS using `vitest run --maxWorkers 2`.
- ESLint, TypeScript and production build PASS.
- Tests use fixtures and injected request mocks; they do not prove rendered UI, E2E, BE integration or persistence.
- No new production route is registered in this slice.

## Next

1. Read the canonical CORE-022 Task Playbook and resolve the specific Figma/DTO differences above.
2. Retrieve design context for each remaining wizard body, then compose canonical Design System controls and AppShell
   around the state flow. Add the approved route through the auth guard when its integration is available.
3. Bind the real auth transport and run create/read-back smoke tests when CORE-021 runtime/test data are supplied.
