# CORE-033 — Session Evaluation and Performance History

Owner: Lâm Phi Long. Branch: `feat/CORE-033-evaluation-fe`. Base: FE `f7c290d100c77ba6d33cf781aed9102f73c8a1bc`.

## Sources and scope

- Latest gated tracker `(1).xlsx`, Task Playbook row34 and Screen Registry row21; implementation/publish permission is the Leader's 17 October request. Independent Gate is still required before merge.
- BE official dev `8b2e22a2aee710cc2ac9b3d1c372cb444ac9e21a`, `docs/api/flow2-training.openapi.yaml` (CORE-005): result, evaluation, horse performance operations and wire schemas.
- Figma file `tm7dpgAQbHReZ7tlQeQJlc`: context and screenshots retrieved for `161:7413`, `164:7560`, `165:7664`, `169:7944`, `166:7791`.
- Existing CORE-002 design system/layout plus merged TextAreaField/RadioGroup and CORE-008 shared authentication. No new tokens/components, token store, API base configuration or runtime mock fallback.

## Entry and behavior

`/training/sessions/:id/evaluation`. Tabs use `?view=result`, `comparison`, `evaluation`; Performance History uses `?view=history` for this session's horse. History links navigate to the same canonical evaluation route for each returned session.

Result reads `GET /api/training-sessions/{id}/result`. History reads `GET /api/horses/{id}/performance` with optional `from`/`to`. Submit uses `POST /api/training-sessions/{id}/evaluation`, exactly `{result, evaluatedSummary, evaluationNotes, recommendation}`. Only result is required by the approved schema; optional blank text sends null. Assessment is MET / PARTIALLY_MET / NOT_MET; each text field is limited to2000 characters. No evaluationLabel or status mutation.

Terminal COMPLETED/INTERRUPTED states come from the server; evaluation does not change them. Existing evaluation/hasEvaluation suppresses duplicate forms. A synchronous in-flight latch prevents duplicate submits, form state survives tab switches, errors preserve input for retry, and409 requires reload before a new attempt. While submitting, reload/history controls are disabled.

Read roles follow the result operation: HT, Trainer, Work Rider, CM, Vet. Submit is Trainer-only; horse history excludes Work Rider. BE remains responsible for current roles and assigned-program/own-session row scope.401/inactive403 uses CORE-008's shared session handler; ordinary403 keeps the session. API requests read the existing CORE-008 authSession and reuse requestApi's envelope and VITE_API_BASE_URL behavior.

## Deliberate contract limits, not fabricated demo data

- Keep null/absent numeric values as unmeasured; preserve zero and m/min/bpm/km/h. No summing exercise distance or multiplying it by repetitions.
- The contract provides an exercise plan but no actual per-exercise completion or rep splits. Those are not invented.
- No recovery-to100bpm values, history top speed, phase/focus history metadata, strategic adjustment control or approved performance formula is exposed by these operations. Show supplied history fields and date filters only; unsupported values/actions are documented instead of simulated.
- Recorded heart-rate samples use the canonical chart by sample order, with raw timestamps/readings in the table. Incomplete series are not joined/interpolated or converted to zero. Simulator badge is shown only when the server actual.simulated flag is true.
- Leader prioritized usable functional UI over pixel refinement. Screen structure, canonical shell, controls, result metrics, comparison, notes and history are implemented. No claim of full pixel-perfect Figma acceptance.

## Verification and integration boundary

Direct Node CLI equivalents are used because Windows npm shims split the workspace ampersand. Commands: eslint ., tsc -b --noEmit, vitest run --maxWorkers=1, tsc -b, vite build, git diff --check.

Author verification: lint/typecheck/build/diff PASS;118/118 tests passed across10 files. The20 CORE-033 cases cover production route/auth, read/write roles, terminal states, nullable values/units, exact payload, validation, failures/retry, duplicate-submit protection and history. Two initial retry assertions used the wrong button label; corrected to canonical ErrorState's "Try again", then20/20 passed. Earlier compile errors used description instead of AlertBanner's children; corrected without modifying the design system.

These are HTTP-fixture UI tests, not CORE-032 runtime or SQL/live integration evidence. Browser fixture validation is recorded separately in the workspace gate artifacts. Independent Gate must review the exact published HEAD and latest base; author tests do not grant Gate PASS.

CORE-009 is prepared in separate FE/BE integration checkouts; latest inspected CORE-007 head6444a56 remains a feature PR. SQL Server is reachable using existing Windows authentication, but no approved isolated test DB/account/configuration was supplied. No migrations, seeding, account changes or live login/logout audit verification were run. See the workspace CORE009-preflight report for the handoff checklist.
